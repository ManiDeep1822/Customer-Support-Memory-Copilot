"""
services/hindsight.py — Hindsight Integration Service

Wraps Hindsight retain, recall, and reflect calls using official hindsight-client SDK.
Enforces Hard Rule 4:
- Every retain call MUST include metadata: { "customer_id": "...", "brand": "..." }
- Every recall call MUST filter on customer_id to ensure customer isolation.
"""

import json
import logging
import asyncio
from typing import List, Optional, Dict

try:
    from hindsight_client import Hindsight
except ImportError:
    Hindsight = None

try:
    import httpx
except ImportError:
    httpx = None

from backend.config import (
    HINDSIGHT_API_KEY,
    HINDSIGHT_BASE_URL,
    HINDSIGHT_BANK_ID,
    FILTERED_CUSTOMERS_FILE
)
from backend.models import RecalledItem, RiskProfile

logger = logging.getLogger("hindsight")


class HindsightService:
    def __init__(self):
        self.api_key = HINDSIGHT_API_KEY
        self.base_url = HINDSIGHT_BASE_URL
        self.bank_id = HINDSIGHT_BANK_ID
        self.is_live = bool(self.api_key and self.bank_id)

        self.client = None
        if self.is_live and Hindsight:
            try:
                self.client = Hindsight(api_key=self.api_key, base_url=self.base_url)
                logger.info(f"Connected to Hindsight Cloud at {self.base_url}")
            except Exception as e:
                logger.warning(f"Failed to initialize Hindsight client: {e}")

        # In-memory store for demo session reflect updates
        self._local_opinions = {}
        # In-memory cache for fast memory panel loading
        self._recall_cache: Dict[str, List[RecalledItem]] = {}

    def _get_client(self) -> Optional[Hindsight]:
        """Provides an active Hindsight client instance bound to current event loop."""
        if not self.is_live or not Hindsight:
            return None
        try:
            return Hindsight(api_key=self.api_key, base_url=self.base_url)
        except Exception as e:
            logger.warning(f"Failed to initialize Hindsight client: {e}")
            return None

    async def retain(self, customer_id: str, brand: str, text: str, metadata: Optional[dict] = None) -> bool:
        """
        Retains an experience in Hindsight asynchronously.
        Enforces customer_id and brand in metadata per TRS §3.3.
        """
        meta = metadata or {}
        # Mandatory metadata enforcement (Hard Rule 4)
        meta["customer_id"] = str(customer_id)
        meta["brand"] = str(brand)

        client = self._get_client()
        if not client:
            logger.info(f"[Hindsight SIMULATED retain] customer_id={customer_id}: {text[:60]}...")
            return True

        try:
            res = await client.aretain(
                bank_id=self.bank_id,
                content=text,
                metadata={"customer_id": str(customer_id), "brand": str(brand)},
                tags=[customer_id, brand]
            )
            return getattr(res, "success", True)
        except Exception as e:
            logger.error(f"Hindsight retain exception: {e}")
            return False
        finally:
            try:
                await client.aclose()
            except Exception:
                pass

    async def recall(self, customer_id: str, query: str = "") -> List[RecalledItem]:
        """
        Recalls memories for a specific customer asynchronously.
        Strictly filters by customer_id to enforce per-customer isolation (Hard Rule 4).
        Falls back gracefully per TRS §7 on timeout/error.
        """
        # Fast return from in-memory cache if query is default/empty
        if not query and customer_id in self._recall_cache:
            return self._recall_cache[customer_id]

        client = self._get_client()
        if not client:
            return self._simulated_recall(customer_id)

        try:
            res = await asyncio.wait_for(
                client.arecall(
                    bank_id=self.bank_id,
                    query=query or "previous support issues orders replacements and resolutions",
                    tags=[customer_id]
                ),
                timeout=15.0
            )
            items = []
            results = getattr(res, "results", []) or []
            for r in results:
                text_content = getattr(r, "text", "") or getattr(r, "content", "") or str(r)
                # Map Hindsight types to TRS §4 RecalledItem: "experience" or "opinion"
                raw_type = str(getattr(r, "type", "")).lower()
                item_type = "opinion" if "opinion" in raw_type else "experience"
                
                # Confidence score extraction
                scores = getattr(r, "scores", {}) or {}
                if isinstance(scores, dict):
                    conf = scores.get("semantic") or scores.get("final") or 0.88
                else:
                    conf = getattr(scores, "semantic", None) or getattr(scores, "final", None) or 0.88

                timestamp = getattr(r, "occurred_start", None) or getattr(r, "timestamp", None)
                if timestamp:
                    timestamp = str(timestamp)

                items.append(RecalledItem(
                    type=item_type,
                    summary=text_content,
                    timestamp=timestamp,
                    confidence=float(conf) if conf is not None else 0.88
                ))
            if not items:
                # Add fallback contextual items if fresh bank
                items = self._simulated_recall(customer_id)

            self._recall_cache[customer_id] = items
            return items
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"Hindsight recall timeout/exception for {customer_id}: {e}")
            if customer_id in self._recall_cache:
                return self._recall_cache[customer_id]
            fallback = self._simulated_recall(customer_id)
            if fallback:
                self._recall_cache[customer_id] = fallback
                return fallback
            return [RecalledItem(type="experience", summary="memory temporarily unavailable", confidence=0.0)]
        finally:
            try:
                await client.aclose()
            except Exception:
                pass

    async def reflect(self, customer_id: str) -> Optional[dict]:
        """
        Triggers Hindsight reflection after an issue is resolved asynchronously.
        Updates opinions on customer effort trajectory and frustration risk.
        """
        client = self._get_client()
        if not client:
            prev = self._local_opinions.get(customer_id, {})
            new_count = prev.get("contact_count_this_issue", 1) + 1
            sent = "declining" if new_count >= 2 else "stable"
            r_level = "escalate" if (new_count >= 3 and sent == "declining") else ("watch" if (new_count >= 2 or sent == "declining") else "normal")
            updated = {
                "customer_id": customer_id,
                "contact_count_this_issue": new_count,
                "sentiment_trend": sent,
                "confidence": min(0.95, 0.70 + (new_count * 0.08)),
                "risk_level": r_level
            }
            self._local_opinions[customer_id] = updated
            return updated

        try:
            res = await client.areflect(
                bank_id=self.bank_id,
                query=f"Assess customer effort trajectory, repeat contact patterns, and frustration churn risk for {customer_id}",
                tags=[customer_id]
            )
            # Record reflection result
            prev = self._local_opinions.get(customer_id, {})
            new_count = prev.get("contact_count_this_issue", 1) + 1
            sent = "declining" if new_count >= 2 else "stable"
            r_level = "escalate" if (new_count >= 3 and sent == "declining") else ("watch" if (new_count >= 2 or sent == "declining") else "normal")
            updated = {
                "customer_id": customer_id,
                # NOTE: contact_count_this_issue counts all customer interactions in this 24h build
                "contact_count_this_issue": new_count,
                "sentiment_trend": sent,
                "confidence": 0.94,
                "risk_level": r_level,
                "reflection_text": getattr(res, "text", "") or ""
            }
            self._local_opinions[customer_id] = updated
            return updated
        except Exception as e:
            logger.error(f"Hindsight reflect exception: {e}")
            return None
        finally:
            try:
                await client.aclose()
            except Exception:
                pass

    def _simulated_recall(self, customer_id: str) -> List[RecalledItem]:
        """Simulated recall based on loaded customer thread history when bank is newly created."""
        items = []
        if FILTERED_CUSTOMERS_FILE.exists():
            try:
                with open(FILTERED_CUSTOMERS_FILE, "r", encoding="utf-8") as f:
                    customers = json.load(f)
                for c in customers:
                    if c.get("customer_id") == customer_id:
                        for thread in c.get("threads", []):
                            first_msg = thread.get("messages", [{}])[0].get("text", "")
                            items.append(RecalledItem(
                                type="experience",
                                summary=f"Issue in {thread.get('thread_id')}: {first_msg[:120]}...",
                                timestamp=thread.get("timestamp_start"),
                                confidence=0.92
                            ))
                        break
            except Exception as e:
                logger.error(f"Error reading filtered customers: {e}")

        # Add opinion item
        op = self._local_opinions.get(customer_id)
        if op:
            items.append(RecalledItem(
                type="opinion",
                summary=f"Customer Effort Trajectory: {op['contact_count_this_issue']} repeat contacts; sentiment is {op['sentiment_trend']}.",
                confidence=op["confidence"]
            ))
        else:
            items.append(RecalledItem(
                type="opinion",
                summary="Customer Effort Trajectory: Historical repeat contacts detected across prior delivery and return requests.",
                confidence=0.82
            ))
        return items


# Global singleton service
hindsight_service = HindsightService()
