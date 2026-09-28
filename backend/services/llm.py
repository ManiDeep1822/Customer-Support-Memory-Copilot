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
from backend.models import (
    RecalledItem, 
    RiskProfile, 
    Customer,
    FrustrationSession, 
    FrustrationTrajectory, 
    AgentActionRecommendation
)

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
        recalled_items: Optional[List[RecalledItem]] = None,
        core_memory: Optional[List[str]] = None
    ) -> str:
        """
        Generates a suggested agent reply for the support representative.
        - If memory_enabled is False: uses strictly current message content (FR-4).
        - If memory_enabled is True: incorporates recalled experiences and opinions (FR-5).
        - Also incorporates MemGPT Core Memory pinned customer facts if present.
        """
        if not self.client:
            return self._simulated_reply(customer_label, current_message, memory_enabled, recalled_items)

        system_prompt = self._build_system_prompt(customer_label, memory_enabled, recalled_items, core_memory)
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
        recalled_items: Optional[List[RecalledItem]],
        core_memory: Optional[List[str]] = None
    ) -> str:
        core_facts_text = ""
        if core_memory and len(core_memory) > 0:
            core_facts_text = "\n[PINNED CORE MEMORY FACTS (MemGPT Working Memory)]:\n" + "\n".join([f"📌 {fact}" for fact in core_memory]) + "\n"

        if not memory_enabled or not recalled_items:
            # Memory OFF (FR-4): Standard stateless bot
            return (
                "You are an AmazonHelp support copilot. Memory is DISABLED for this session. "
                "You have NO memory of any past interactions with this customer. "
                f"{core_facts_text}"
                "Respond strictly based on the user's latest message. "
                "Ask standard clarification questions (e.g. order numbers, tracking info) as if hearing about the issue for the very first time. "
                "Never cite any past conversation or assume prior context."
            )

        # Memory ON (FR-5): Grounded in Hindsight persistent recall
        mem_text = "\n".join([f"- [{item.type.upper()}] {item.summary}" for item in recalled_items])
        return (
            f"You are an AmazonHelp support copilot assisting a support rep with {customer_label}. "
            "Memory is ENABLED. You have access to persistent Hindsight memories from past interactions:\n"
            f"{mem_text}\n"
            f"{core_facts_text}\n"
            "Instructions:\n"
            "1. Reference relevant past details and pinned core facts so the customer never has to repeat themselves.\n"
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

    def compute_frustration_trajectory(self, customer: Customer) -> FrustrationTrajectory:
        """
        Feature 1: Computes multi-session frustration progression across historical threads & live ticket.
        """
        all_sessions = []
        threads = customer.threads or []
        held_out = customer.held_out_thread

        distress_keywords = [
            "broken", "damaged", "again", "still waiting", "never arrived", 
            "terrible", "unacceptable", "refund", "frustrated", "hung up", 
            "disgusted", "unreliable", "tape", "prime", "donkeys", "email", "money"
        ]

        # 1. Historical Threads
        for idx, t in enumerate(threads, 1):
            text = " ".join([m.text for m in t.messages]).lower()
            matches = sum(1 for kw in distress_keywords if kw in text)
            
            score = min(98, max(20, 25 + (idx * 18) + (matches * 12)))
            if score >= 80:
                level = "Critical"
            elif score >= 60:
                level = "High"
            elif score >= 40:
                level = "Medium"
            else:
                level = "Low"

            # Dynamic summary snippet from actual customer message
            cust_msgs = [m.text.replace("@AmazonHelp", "").strip() for m in t.messages if m.role == 'customer']
            snippet = cust_msgs[0] if cust_msgs else ""
            if len(snippet) > 55:
                snippet = snippet[:52] + "..."

            reason = f"Session #{idx}: \"{snippet}\"" if snippet else f"Session #{idx}: {len(t.messages)} messages exchanged"

            all_sessions.append(FrustrationSession(
                session_id=t.thread_id,
                session_label=f"Session #{idx}",
                timestamp=t.timestamp_start or "Historical",
                frustration_score=score,
                frustration_level=level,
                summary_reason=reason
            ))

        # 2. Held Out Live Session
        if held_out and held_out.messages:
            idx = len(threads) + 1
            text = " ".join([m.text for m in held_out.messages]).lower()
            matches = sum(1 for kw in distress_keywords if kw in text)
            
            score = min(98, max(30, 35 + (idx * 16) + (matches * 14)))
            if score >= 80:
                level = "Critical"
            elif score >= 60:
                level = "High"
            elif score >= 40:
                level = "Medium"
            else:
                level = "Low"

            cust_msgs = [m.text.replace("@AmazonHelp", "").strip() for m in held_out.messages if m.role == 'customer']
            snippet = cust_msgs[0] if cust_msgs else ""
            if len(snippet) > 55:
                snippet = snippet[:52] + "..."

            reason = f"Live Ticket: \"{snippet}\"" if snippet else f"Active interaction: {matches} frustration signals detected"

            all_sessions.append(FrustrationSession(
                session_id=held_out.thread_id or "thread_live",
                session_label=f"Live Ticket (Turn #{idx})",
                timestamp="Active",
                frustration_score=score,
                frustration_level=level,
                summary_reason=reason
            ))

        if not all_sessions:
            all_sessions.append(FrustrationSession(
                session_id="thread_0",
                session_label="Session #1",
                timestamp="New Ticket",
                frustration_score=25,
                frustration_level="Low",
                summary_reason="First contact inquiry"
            ))

        current_score = all_sessions[-1].frustration_score
        current_level = all_sessions[-1].frustration_level

        if len(all_sessions) >= 2:
            first_score = all_sessions[0].frustration_score
            if current_score - first_score >= 15:
                overall_trend = "increasing"
            elif first_score - current_score >= 15:
                overall_trend = "decreasing"
            else:
                overall_trend = "stable"
        else:
            overall_trend = "stable"

        return FrustrationTrajectory(
            customer_id=customer.customer_id,
            overall_trend=overall_trend,
            current_frustration_score=current_score,
            current_frustration_level=current_level,
            sessions=all_sessions
        )

    def generate_action_recommendation(
        self,
        customer_id: str,
        risk: RiskProfile,
        trajectory: FrustrationTrajectory,
        core_memory: Optional[List[str]] = None,
        recalled_items: Optional[List[RecalledItem]] = None,
        current_message: str = "",
        customer: Optional[Customer] = None
    ) -> AgentActionRecommendation:
        """
        Feature 2: Generates memory-grounded agent action recommendations tailored to customer issue.
        """
        # Collect customer text to determine specific issue topic
        all_text_list = [current_message]
        if customer:
            for t in (customer.threads or []):
                for m in t.messages:
                    all_text_list.append(m.text)
            if customer.held_out_thread:
                for m in customer.held_out_thread.messages:
                    all_text_list.append(m.text)
        if core_memory:
            all_text_list.extend(core_memory)
        if recalled_items:
            all_text_list.extend([r.summary for r in recalled_items])

        all_text = " ".join(all_text_list).lower()

        score = trajectory.current_frustration_score
        level = trajectory.current_frustration_level
        contacts = risk.contact_count_this_issue

        # Dynamic Topic Classifier
        if any(kw in all_text for kw in ["money", "refund", "get back", "cost", "charge", "credit", "return"]):
            topic_category = "refund_delay"
        elif any(kw in all_text for kw in ["tape", "prime", "packaging", "box", "package"]):
            topic_category = "packaging_issue"
        elif any(kw in all_text for kw in ["carrier", "closed", "delivered", "driver", "where is", "not arrived", "delay"]):
            topic_category = "carrier_delivery"
        elif any(kw in all_text for kw in ["email", "receive", "message", "receipt", "sent", "didn't receive"]):
            topic_category = "email_notification"
        elif any(kw in all_text for kw in ["effort", "everything", "rude", "again", "repeat", "verify"]):
            topic_category = "repetition_effort"
        else:
            topic_category = "general_support"

        if risk.risk_level == "escalate" or level in ["Critical", "High"] or contacts >= 3:
            if topic_category == "refund_delay":
                return AgentActionRecommendation(
                    action_type="issue_goodwill",
                    headline="🚨 Priority Refund Acceleration & Goodwill Credit",
                    recommended_action=f"Expedite pending refund with billing department immediately and issue a $15 courtesy account credit prior to dispatching customer reply.",
                    rationale=f"Customer has contacted support {contacts} times regarding refund delay with high frustration ({score}% distress score). Prompt financial resolution required.",
                    confidence=0.94
                )
            elif topic_category == "packaging_issue":
                return AgentActionRecommendation(
                    action_type="escalate_manager",
                    headline="🚨 Proactive Manager Escalation & Packaging Clarification",
                    recommended_action=f"Escalate ticket to Senior Support Lead. Review non-member Prime tape packaging rules and issue a $15 courtesy credit.",
                    rationale=f"Customer has contacted support {contacts} times with increasing frustration ({score}% score). Standard replies failed to clarify packaging policies.",
                    confidence=0.94
                )
            elif topic_category == "carrier_delivery":
                return AgentActionRecommendation(
                    action_type="escalate_manager",
                    headline="🚨 Proactive Carrier Escalation & Priority Redelivery",
                    recommended_action=f"Contact carrier dispatch supervisor to override delivery failure status and schedule priority morning redelivery with direct tracking update.",
                    rationale=f"Customer turn #{contacts} regarding carrier delivery failure ('carrier closed'). Proactive carrier dispatch required.",
                    confidence=0.94
                )
            elif topic_category == "repetition_effort":
                return AgentActionRecommendation(
                    action_type="escalate_manager",
                    headline="🚨 Supervisor Fast-Track & Courtesy Credit",
                    recommended_action=f"Supervisor takeover: Bypass repetitive verification questions, take direct ownership, and apply a $15 goodwill credit.",
                    rationale=f"Customer expressing severe frustration over repeat contacts ({contacts} turns, {score}% distress score) and perceived lack of resolution effort.",
                    confidence=0.94
                )
            else:
                return AgentActionRecommendation(
                    action_type="escalate_manager",
                    headline="🚨 Proactive Manager Escalation & Goodwill Resolution",
                    recommended_action=f"Escalate ticket to Senior Support Lead immediately. Review previous {contacts} unresolved contacts and issue a $15 courtesy credit.",
                    rationale=f"Customer has contacted support {contacts} times with high distress score ({score}%). Proactive resolution strongly advised.",
                    confidence=0.94
                )
        elif risk.risk_level == "watch" or level == "Medium" or contacts == 2:
            if topic_category == "email_notification":
                return AgentActionRecommendation(
                    action_type="verify_details",
                    headline="⚠️ Immediate Email Resend & Delivery Verification",
                    recommended_action="Resend order confirmation and tracking details directly to customer's verified email address and confirm receipt.",
                    rationale=f"Customer is on contact turn #{contacts} regarding unreceived notification email ({score}% distress score). System email resend recommended.",
                    confidence=0.88
                )
            elif topic_category == "refund_delay":
                return AgentActionRecommendation(
                    action_type="verify_details",
                    headline="⚠️ Refund Processing Status Verification",
                    recommended_action="Verify refund transaction status with accounting and communicate expected bank processing timeline (3-5 business days).",
                    rationale=f"Customer is on contact turn #{contacts} inquiring on refund timeline ({score}% distress score). Clear timeline prevents escalation.",
                    confidence=0.88
                )
            elif topic_category == "carrier_delivery":
                return AgentActionRecommendation(
                    action_type="verify_details",
                    headline="⚠️ Priority Carrier Tracking Verification",
                    recommended_action="Trace current package GPS coordinates with carrier and provide exact updated delivery window.",
                    rationale=f"Customer on turn #{contacts} checking delayed shipment status. Clear tracking update calms frustration.",
                    confidence=0.88
                )
            elif topic_category == "repetition_effort":
                return AgentActionRecommendation(
                    action_type="verify_details",
                    headline="⚠️ Account Verification Fast-Track",
                    recommended_action="Verify customer identity via order ID without repeating previously answered security questions.",
                    rationale=f"Customer turn #{contacts} with medium frustration trajectory ({score}% score). Streamlining verification avoids escalation.",
                    confidence=0.88
                )
            else:
                return AgentActionRecommendation(
                    action_type="verify_details",
                    headline="⚠️ Priority Order Status & Issue Clarification",
                    recommended_action="Re-verify shipment tracking status and provide direct issue resolution steps before closing.",
                    rationale=f"Customer is on contact turn #{contacts} with medium frustration trajectory ({score}% score). Direct clarification prevents escalation.",
                    confidence=0.88
                )
        else:
            return AgentActionRecommendation(
                action_type="standard_resolution",
                headline="✅ Standard First-Contact Assistance",
                recommended_action="Verify customer account ID and provide standard order status update.",
                rationale="First-contact inquiry with normal sentiment trajectory and zero previous escalations.",
                confidence=0.85
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
