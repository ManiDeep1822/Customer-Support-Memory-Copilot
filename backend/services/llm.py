"""
services/llm.py — Groq LLM Service with NFR-2 Retry/Fallback

Implements:
- Primary model: openai/gpt-oss-120b
- Fallback model: qwen/qwen3-32b
- NFR-2: Retry primary once -> Fall back to secondary -> Degraded string fallback
- Memory ON vs Memory OFF prompt differentiation (SRS FR-4, FR-5)
- Customer Effort Trajectory & Risk evaluation (TRS §3.2)
"""

import logging
from typing import List, Optional, Dict
try:
    from groq import Groq
except ImportError:
    Groq = None

from backend.config import (
    GROQ_API_KEY,
    LLM_PRIMARY_MODEL,
    LLM_FALLBACK_MODEL
)
from backend.models import RecalledItem, RiskProfile

logger = logging.getLogger("llm")


class LLMService:
    def __init__(self):
        self.api_key = GROQ_API_KEY
        self.primary_model = LLM_PRIMARY_MODEL
        self.fallback_model = LLM_FALLBACK_MODEL
        self.client = Groq(api_key=self.api_key) if (self.api_key and Groq) else None

    def generate_reply(
        self,
        customer_label: str,
        current_message: str,
        memory_enabled: bool,
        recalled_items: Optional[List[RecalledItem]] = None
    ) -> str:
        """
        Generates a suggested agent reply for the support representative.
        - If memory_enabled is False: uses strictly current message content (FR-4).
        - If memory_enabled is True: incorporates recalled experiences and opinions (FR-5).
        """
        if not self.client:
            return self._simulated_reply(customer_label, current_message, memory_enabled, recalled_items)

        system_prompt = self._build_system_prompt(customer_label, memory_enabled, recalled_items)
        user_prompt = f"Customer Message:\n\"{current_message}\"\n\nDraft a concise, empathetic, professional support reply from AmazonHelp."

        # NFR-2 Execution: Primary -> Retry Primary -> Fallback Model -> Degraded message
        # Attempt 1: Primary Model
        try:
            return self._call_groq(self.primary_model, system_prompt, user_prompt)
        except Exception as e1:
            logger.warning(f"Groq call failed on {self.primary_model}: {e1}. Retrying primary...")

        # Attempt 2: Retry Primary Model
        try:
            return self._call_groq(self.primary_model, system_prompt, user_prompt)
        except Exception as e2:
            logger.warning(f"Groq primary retry failed: {e2}. Falling back to {self.fallback_model}...")

        # Attempt 3: Fallback Model
        try:
            return self._call_groq(self.fallback_model, system_prompt, user_prompt)
        except Exception as e3:
            logger.error(f"Groq fallback model {self.fallback_model} failed: {e3}.")

        # Degraded fallback per TRS §7
        return "[agent could not complete a structured response — please consult raw ticket history]"

    def _call_groq(self, model: str, system_prompt: str, user_prompt: str) -> str:
        completion = self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=350
        )
        return completion.choices[0].message.content.strip()

    def _build_system_prompt(
        self,
        customer_label: str,
        memory_enabled: bool,
        recalled_items: Optional[List[RecalledItem]]
    ) -> str:
        if not memory_enabled or not recalled_items:
            # Memory OFF (FR-4): Standard stateless bot
            return (
                "You are an AmazonHelp support copilot. Memory is DISABLED for this session. "
                "You have NO memory of any past interactions with this customer. "
                "Respond strictly based on the user's latest message. "
                "Ask standard clarification questions (e.g. order numbers, tracking info) as if hearing about the issue for the very first time. "
                "Never cite any past conversation or assume prior context."
            )

        # Memory ON (FR-5): Grounded in Hindsight persistent recall
        mem_text = "\n".join([f"- [{item.type.upper()}] {item.summary}" for item in recalled_items])
        return (
            f"You are an AmazonHelp support copilot assisting a support rep with {customer_label}. "
            "Memory is ENABLED. You have access to persistent Hindsight memories from past interactions:\n"
            f"{mem_text}\n\n"
            "Instructions:\n"
            "1. Reference relevant past details (e.g. earlier replacements, tracking numbers, or recurring issues) so the customer never has to repeat themselves.\n"
            "2. If repeat contacts or declining sentiment are noted, acknowledge their frustration directly and propose an immediate proactive solution or escalation.\n"
            "3. Maintain a warm, highly accountable, and professional tone."
        )

    def compute_risk_profile(
        self,
        customer_id: str,
        threads_count: int,
        messages_text: str = ""
    ) -> RiskProfile:
        """
        Derives Customer Effort Trajectory & RiskProfile based on contact count and sentiment trend.
        Thresholds (TRS §3.2):
        - watch: contact_count_this_issue >= 2 OR sentiment_trend == 'declining'
        - escalate: contact_count_this_issue >= 3 AND sentiment_trend == 'declining'
        """
        # NOTE: In this 24-hour hackathon build, contact_count_this_issue deliberately counts ALL historical threads
        # for a customer rather than performing ML topic-clustering. This represents the cumulative customer effort across support interactions.
        contact_count = max(1, threads_count)

        # Sentiment heuristics based on repeat contacts and distress keywords
        distress_keywords = [
            "broken", "damaged", "again", "still waiting", "never arrived", 
            "terrible", "unacceptable", "refund", "frustrated", "hung up", 
            "disgusted", "unreliable", "indignity", "charge it back"
        ]
        matches = sum(1 for kw in distress_keywords if kw in messages_text.lower())

        if matches >= 1 and contact_count >= 2:
            sentiment_trend = "declining"
            confidence = min(0.95, 0.78 + (contact_count * 0.04))
        elif matches >= 2:
            sentiment_trend = "declining"
            confidence = 0.85
        else:
            sentiment_trend = "stable"
            confidence = 0.80

        # Evaluate risk level strictly per TRS §3.2:
        # - watch: contact_count_this_issue >= 2 OR sentiment_trend == 'declining'
        # - escalate: contact_count_this_issue >= 3 AND sentiment_trend == 'declining'
        if contact_count >= 3 and sentiment_trend == "declining":
            risk_level = "escalate"
        elif contact_count >= 2 or sentiment_trend == "declining":
            risk_level = "watch"
        else:
            risk_level = "normal"

        assert not (risk_level == "escalate" and sentiment_trend != "declining"), (
            f"Escalate tier requires declining sentiment, got sentiment_trend='{sentiment_trend}'"
        )

        return RiskProfile(
            customer_id=customer_id,
            contact_count_this_issue=contact_count,
            sentiment_trend=sentiment_trend,
            confidence=confidence,
            risk_level=risk_level
        )

    def _simulated_reply(
        self,
        customer_label: str,
        current_message: str,
        memory_enabled: bool,
        recalled_items: Optional[List[RecalledItem]]
    ) -> str:
        """Simulated response for testing when GROQ_API_KEY is not configured in .env."""
        if not memory_enabled:
            return (
                f"Hello {customer_label}, thanks for reaching out to AmazonHelp! "
                "I would be glad to assist you today. Could you please provide your order ID, "
                "and explain the issue with your item so we can look into what happened?"
            )
        else:
            return (
                f"Hello {customer_label}, I'm so sorry to hear this is happening again. "
                "I've pulled up your file and see that this is your 3rd contact regarding the damaged replacement headset "
                "from order #302-881920. Since our previous replacement didn't arrive in proper condition, "
                "I have proactively approved a full refund and expedited a new package to your address with priority shipping."
            )


# Global singleton service
llm_service = LLMService()
