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


class Customer(BaseModel):
    customer_id: str
    display_label: str
    brand_handle: str = "AmazonHelp"
    threads: List[Thread] = Field(default_factory=list)
    held_out_thread: Optional[HeldOutThread] = None


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
# API Request & Response Shapes (TRS §4)
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


class MessageRequest(BaseModel):
    text: str
    memory_enabled: bool = True


class MessageResponse(BaseModel):
    agent_response: str
    recalled_context: Optional[List[RecalledItem]] = None


class MemoryResponse(BaseModel):
    recalled_items: List[RecalledItem]
    risk_profile: RiskProfile


class ResolveResponse(BaseModel):
    updated_risk_profile: RiskProfile
