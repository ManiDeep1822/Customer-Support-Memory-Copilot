"""
models.py — Data Schemas and API Models for Support Memory Copilot
Matches docs/TRS.md §3 and §4 exactly.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------
# Customer & Thread Schemas (TRS §3.1)
# ---------------------------------------------------------

class Message(BaseModel):
    role: Literal["customer", "brand"]
    text: str
    timestamp: str


class Thread(BaseModel):
    thread_id: str
    timestamp_start: str
    messages: List[Message]


class HeldOutThread(BaseModel):
    thread_id: str
    messages: List[Message]


class OrderDetails(BaseModel):
    order_id: str
    item_name: str
    price: str
    membership_tier: str = "Amazon Prime"
    tracking_status: str


class Customer(BaseModel):
    customer_id: str
    display_label: str
    brand_handle: str = "AmazonHelp"
    threads: List[Thread] = Field(default_factory=list)
    held_out_thread: Optional[HeldOutThread] = None
    order_details: Optional[OrderDetails] = None


# ---------------------------------------------------------
# Risk Profile Schema (TRS §3.2)
# ---------------------------------------------------------

class RiskProfile(BaseModel):
    customer_id: str
    contact_count_this_issue: int
    sentiment_trend: Literal["declining", "stable", "improving"]
    confidence: float
    risk_level: Literal["normal", "watch", "escalate"]


# ---------------------------------------------------------
# Hindsight Recall Context Item (TRS §4)
# ---------------------------------------------------------

class RecalledItem(BaseModel):
    type: Literal["experience", "opinion"]
    summary: str
    timestamp: Optional[str] = None
    confidence: Optional[float] = None


# ---------------------------------------------------------
# Feature 1: Multi-Session Frustration Trajectory Schema
# ---------------------------------------------------------

class FrustrationSession(BaseModel):
    session_id: str
    session_label: str
    timestamp: str
    frustration_score: int  # 0 to 100 percentage
    frustration_level: Literal["Low", "Medium", "High", "Critical"]
    summary_reason: str


class FrustrationTrajectory(BaseModel):
    customer_id: str
    overall_trend: Literal["increasing", "stable", "decreasing"]
    current_frustration_score: int
    current_frustration_level: Literal["Low", "Medium", "High", "Critical"]
    sessions: List[FrustrationSession]


# ---------------------------------------------------------
# Feature 2: Memory-Grounded Support Action Recommendation Schema
# ---------------------------------------------------------

class AgentActionRecommendation(BaseModel):
    action_type: Literal["escalate_manager", "issue_goodwill", "verify_details", "standard_resolution"]
    headline: str
    recommended_action: str
    rationale: str
    confidence: float


# ---------------------------------------------------------
# API Request & Response Shapes (TRS §4 Extended)
# ---------------------------------------------------------

class TicketSummary(BaseModel):
    customer_id: str
    display_label: str
    risk_level: Literal["normal", "watch", "escalate"]
    last_message_preview: str


class TicketDetailResponse(BaseModel):
    customer: Customer
    threads: List[Thread]
    risk_profile: RiskProfile
    frustration_trajectory: Optional[FrustrationTrajectory] = None
    action_recommendation: Optional[AgentActionRecommendation] = None


class MessageRequest(BaseModel):
    text: str
    memory_enabled: bool = True


class MessageResponse(BaseModel):
    agent_response: str
    recalled_context: Optional[List[RecalledItem]] = None
    action_recommendation: Optional[AgentActionRecommendation] = None


class MemoryResponse(BaseModel):
    recalled_items: List[RecalledItem]
    risk_profile: RiskProfile
    frustration_trajectory: Optional[FrustrationTrajectory] = None
    action_recommendation: Optional[AgentActionRecommendation] = None


class ResolveResponse(BaseModel):
    updated_risk_profile: RiskProfile
    frustration_trajectory: Optional[FrustrationTrajectory] = None
    action_recommendation: Optional[AgentActionRecommendation] = None


# ---------------------------------------------------------
# Core Memory / Pinned Customer Facts Schema (MemGPT Working Memory)
# ---------------------------------------------------------

class CoreMemoryFact(BaseModel):
    id: str
    text: str
    category: str = "General"
    timestamp: Optional[str] = None


class CoreMemoryRequest(BaseModel):
    text: str
    category: str = "General"

