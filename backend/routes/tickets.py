"""
routes/tickets.py — Ticket API Routes

Implements the exact REST contract specified in docs/TRS.md §4:
- GET  /tickets
- GET  /tickets/:customerId
- POST /tickets/:customerId/message
- GET  /tickets/:customerId/memory
- POST /tickets/:customerId/resolve
"""

import json
import logging
import asyncio
from typing import List, Dict
from fastapi import APIRouter, HTTPException

from backend.config import FILTERED_CUSTOMERS_FILE
from backend.models import (
    Customer,
    TicketSummary,
    TicketDetailResponse,
    MessageRequest,
    MessageResponse,
    MemoryResponse,
    ResolveResponse,
    RiskProfile,
    CoreMemoryFact,
    CoreMemoryRequest,
    OrderDetails
)
from backend.services.hindsight import hindsight_service
from backend.services.llm import llm_service

logger = logging.getLogger("tickets")
router = APIRouter(prefix="/tickets", tags=["tickets"])

# In-memory customer cache loaded from data/filtered_customers.json
_CUSTOMERS_CACHE: Dict[str, Customer] = {}
_RISK_CACHE: Dict[str, RiskProfile] = {}

# MemGPT Core Memory Pinned Facts Cache
_CORE_MEMORY_CACHE: Dict[str, List[CoreMemoryFact]] = {
    "cust_0001": [
        CoreMemoryFact(id="fact_1", text="Prime-branded shipping tape on non-member package", category="Packaging Issue", timestamp="Recent"),
        CoreMemoryFact(id="fact_2", text="4 previous contact turns without resolution", category="Escalation Risk", timestamp="Recent")
    ],
    "cust_0002": [
        CoreMemoryFact(id="fact_3", text="Reported rude agent behavior on recent call", category="Service Quality", timestamp="Recent"),
        CoreMemoryFact(id="fact_4", text="Declining sentiment trajectory", category="Churn Risk", timestamp="Recent")
    ],
    "cust_0003": [
        CoreMemoryFact(id="fact_5", text="Answered repetitive verification questions multiple times", category="Repetition Frustration", timestamp="Recent")
    ]
}

ORDER_DETAILS_MAP = {
    "cust_0001": OrderDetails(
        order_id="302-8220-4471",
        item_name="Echo Dot (5th Gen) Smart Speaker - Charcoal",
        price="$49.99",
        membership_tier="Amazon Prime",
        tracking_status="Carrier Delay (Delivery Attempt Failed - Closed)"
    ),
    "cust_0002": OrderDetails(
        order_id="302-9059-1102",
        item_name="Kindle Paperwhite (16 GB) - Black",
        price="$139.99",
        membership_tier="Standard Shipping",
        tracking_status="Package Damaged in Transit (Tape Packaging Issue)"
    ),
    "cust_0003": OrderDetails(
        order_id="302-7050-8839",
        item_name="Sony WH-1000XM5 Wireless Headphones",
        price="$398.00",
        membership_tier="Amazon Prime",
        tracking_status="Delivered (Verification Inquiry Open)"
    ),
    "cust_0004": OrderDetails(
        order_id="302-3922-5514",
        item_name="Fire TV Stick 4K Max with Voice Remote",
        price="$59.99",
        membership_tier="Amazon Prime",
        tracking_status="Out for Delivery (Tracking Email Pending)"
    ),
    "cust_0005": OrderDetails(
        order_id="302-8228-9921",
        item_name="Anker 65W USB-C Fast Charger & Cable",
        price="$29.99",
        membership_tier="Standard Shipping",
        tracking_status="Out for Delivery (Email Receipt Requested)"
    ),
    "cust_0006": OrderDetails(
        order_id="302-6473-3341",
        item_name="Logitech MX Master 3S Wireless Mouse",
        price="$99.99",
        membership_tier="Amazon Prime",
        tracking_status="Return Received (Refund Processing Pending)"
    ),
    "cust_0007": OrderDetails(
        order_id="302-1989-7712",
        item_name="Amazon Basics High-Speed HDMI Cable 6ft",
        price="$9.99",
        membership_tier="Amazon Prime",
        tracking_status="Delivered"
    ),
    "cust_0008": OrderDetails(
        order_id="302-2473-6620",
        item_name="Blink Outdoor HD Security Camera",
        price="$89.99",
        membership_tier="Amazon Prime",
        tracking_status="Shipped"
    )
}

def get_default_order_details(cust_id: str, label: str) -> OrderDetails:
    num = "".join(filter(str.isdigit, cust_id)) or "9999"
    return OrderDetails(
        order_id=f"302-{num}-4471",
        item_name="Amazon Echo Auto (2nd Gen)",
        price="$54.99",
        membership_tier="Amazon Prime",
        tracking_status="Out for Delivery"
    )


def load_customers_into_cache():
    global _CUSTOMERS_CACHE, _RISK_CACHE
    if not FILTERED_CUSTOMERS_FILE.exists():
        logger.warning(f"Data file {FILTERED_CUSTOMERS_FILE} not found. Awaiting pipeline run.")
        return

    try:
        with open(FILTERED_CUSTOMERS_FILE, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        for item in raw_data:
            cust = Customer(**item)
            if not cust.order_details:
                cust.order_details = ORDER_DETAILS_MAP.get(cust.customer_id) or get_default_order_details(cust.customer_id, cust.display_label)
            _CUSTOMERS_CACHE[cust.customer_id] = cust

            # Compute initial risk profile based on historical threads
            all_text = " ".join([
                m.text for t in cust.threads for m in t.messages
            ])
            # If held_out_thread exists, also include it
            if cust.held_out_thread:
                all_text += " " + " ".join([m.text for m in cust.held_out_thread.messages])
                # NOTE: contact_count_this_issue deliberately counts ALL historical threads for the customer
                # rather than topic-clustered threads (simplification for 24h hackathon build).
                contact_count = len(cust.threads) + 1
            else:
                contact_count = len(cust.threads)

            _RISK_CACHE[cust.customer_id] = llm_service.compute_risk_profile(
                customer_id=cust.customer_id,
                threads_count=contact_count,
                messages_text=all_text
            )
        logger.info(f"Loaded {len(_CUSTOMERS_CACHE)} customers into memory.")
    except Exception as e:
        logger.error(f"Failed to load customers from {FILTERED_CUSTOMERS_FILE}: {e}")


# Initialize cache at import time
load_customers_into_cache()


def get_customer_or_404(customer_id: str) -> Customer:
    if not _CUSTOMERS_CACHE:
        load_customers_into_cache()
    if customer_id not in _CUSTOMERS_CACHE:
        raise HTTPException(
            status_code=404,
            detail=f"Customer '{customer_id}' not found. Verify data/filtered_customers.json exists and is seeded."
        )
    return _CUSTOMERS_CACHE[customer_id]


# ---------------------------------------------------------
# GET /tickets — List all seeded tickets with risk badges
# ---------------------------------------------------------
@router.get("", response_model=List[TicketSummary])
async def list_tickets():
    if not _CUSTOMERS_CACHE:
        load_customers_into_cache()

    summaries = []
    for cust_id, cust in _CUSTOMERS_CACHE.items():
        risk = _RISK_CACHE.get(cust_id) or llm_service.compute_risk_profile(cust_id, len(cust.threads))
        # Get preview of the latest message
        last_msg = "New support ticket opened"
        if cust.held_out_thread and cust.held_out_thread.messages:
            last_msg = cust.held_out_thread.messages[-1].text
        elif cust.threads and cust.threads[-1].messages:
            last_msg = cust.threads[-1].messages[-1].text

        summaries.append(TicketSummary(
            customer_id=cust.customer_id,
            display_label=cust.display_label,
            risk_level=risk.risk_level,
            last_message_preview=last_msg
        ))
    return summaries


# ---------------------------------------------------------
# GET /tickets/:customerId — Full ticket detail
# ---------------------------------------------------------
@router.get("/{customer_id}", response_model=TicketDetailResponse)
async def get_ticket_detail(customer_id: str):
    cust = get_customer_or_404(customer_id)
    risk = _RISK_CACHE.get(customer_id) or llm_service.compute_risk_profile(customer_id, len(cust.threads))
    trajectory = llm_service.compute_frustration_trajectory(cust)
    core_facts = [f.text for f in _CORE_MEMORY_CACHE.get(customer_id, [])]
    recommendation = llm_service.generate_action_recommendation(
        customer_id=customer_id,
        risk=risk,
        trajectory=trajectory,
        core_memory=core_facts,
        customer=cust
    )

    return TicketDetailResponse(
        customer=cust,
        threads=cust.threads,
        risk_profile=risk,
        frustration_trajectory=trajectory,
        action_recommendation=recommendation
    )


# ---------------------------------------------------------
# POST /tickets/:customerId/message — Send message, get copilot reply
# ---------------------------------------------------------
@router.post("/{customer_id}/message", response_model=MessageResponse)
async def handle_ticket_message(customer_id: str, payload: MessageRequest):
    cust = get_customer_or_404(customer_id)

    recalled_context = None
    if payload.memory_enabled:
        # FR-5: Recall context filtered strictly by customer_id
        recalled_context = await hindsight_service.recall(customer_id=customer_id, query=payload.text)

    # Fetch active Core Memory pinned facts for this customer
    core_facts = [f.text for f in _CORE_MEMORY_CACHE.get(customer_id, [])]
    risk = _RISK_CACHE.get(customer_id) or llm_service.compute_risk_profile(customer_id, len(cust.threads))
    trajectory = llm_service.compute_frustration_trajectory(cust)

    # Generate agent reply (FR-4 if memory OFF, FR-5 if memory ON)
    agent_response = llm_service.generate_reply(
        customer_label=cust.display_label,
        current_message=payload.text,
        memory_enabled=payload.memory_enabled,
        recalled_items=recalled_context,
        core_memory=core_facts
    )

    # Generate memory-grounded agent action recommendation
    recommendation = llm_service.generate_action_recommendation(
        customer_id=customer_id,
        risk=risk,
        trajectory=trajectory,
        core_memory=core_facts,
        recalled_items=recalled_context,
        current_message=payload.text,
        customer=cust
    )

    # FR-12: Retain new live message into Hindsight in real time (in background)
    asyncio.create_task(hindsight_service.retain(
        customer_id=customer_id,
        brand=cust.brand_handle,
        text=f"Customer: {payload.text}\nAgent: {agent_response}",
        metadata={"source": "live_demo"}
    ))

    return MessageResponse(
        agent_response=agent_response,
        recalled_context=recalled_context if payload.memory_enabled else None,
        action_recommendation=recommendation
    )


# ---------------------------------------------------------
# GET /tickets/:customerId/core-memory — MemGPT Working Memory Pinned Facts
# ---------------------------------------------------------
@router.get("/{customer_id}/core-memory", response_model=List[CoreMemoryFact])
async def get_core_memory(customer_id: str):
    get_customer_or_404(customer_id)
    return _CORE_MEMORY_CACHE.get(customer_id, [])


# ---------------------------------------------------------
# POST /tickets/:customerId/core-memory — Add Pinned Fact
# ---------------------------------------------------------
@router.post("/{customer_id}/core-memory", response_model=List[CoreMemoryFact])
async def add_core_memory_fact(customer_id: str, payload: CoreMemoryRequest):
    get_customer_or_404(customer_id)
    if customer_id not in _CORE_MEMORY_CACHE:
        _CORE_MEMORY_CACHE[customer_id] = []
    
    new_id = f"fact_{len(_CORE_MEMORY_CACHE[customer_id]) + 1}_{int(asyncio.get_event_loop().time())}"
    new_fact = CoreMemoryFact(
        id=new_id,
        text=payload.text.strip(),
        category=payload.category,
        timestamp="Just now"
    )
    _CORE_MEMORY_CACHE[customer_id].insert(0, new_fact)
    return _CORE_MEMORY_CACHE[customer_id]


# ---------------------------------------------------------
# DELETE /tickets/:customerId/core-memory/:factId — Delete Pinned Fact
# ---------------------------------------------------------
@router.delete("/{customer_id}/core-memory/{fact_id}", response_model=List[CoreMemoryFact])
async def delete_core_memory_fact(customer_id: str, fact_id: str):
    get_customer_or_404(customer_id)
    if customer_id in _CORE_MEMORY_CACHE:
        _CORE_MEMORY_CACHE[customer_id] = [f for f in _CORE_MEMORY_CACHE[customer_id] if f.id != fact_id]
    return _CORE_MEMORY_CACHE.get(customer_id, [])


# ---------------------------------------------------------
# GET /tickets/:customerId/memory — Raw recall dump for memory panel
# ---------------------------------------------------------
@router.get("/{customer_id}/memory", response_model=MemoryResponse)
async def get_ticket_memory(customer_id: str):
    cust = get_customer_or_404(customer_id)

    # Use the latest incoming message so the memory panel and reply generator use the identical semantic query
    query = ""
    if cust.held_out_thread and cust.held_out_thread.messages:
        query = cust.held_out_thread.messages[-1].text
    elif cust.threads and cust.threads[-1].messages:
        query = cust.threads[-1].messages[-1].text

    recalled_items = await hindsight_service.recall(customer_id=customer_id, query=query)
    risk = _RISK_CACHE.get(customer_id) or llm_service.compute_risk_profile(customer_id, len(cust.threads))
    trajectory = llm_service.compute_frustration_trajectory(cust)
    core_facts = [f.text for f in _CORE_MEMORY_CACHE.get(customer_id, [])]
    recommendation = llm_service.generate_action_recommendation(
        customer_id=customer_id,
        risk=risk,
        trajectory=trajectory,
        core_memory=core_facts,
        recalled_items=recalled_items,
        current_message=query,
        customer=cust
    )

    return MemoryResponse(
        recalled_items=recalled_items,
        risk_profile=risk,
        frustration_trajectory=trajectory,
        action_recommendation=recommendation
    )


# ---------------------------------------------------------
# POST /tickets/:customerId/resolve — Trigger reflect, update risk profile
# ---------------------------------------------------------
@router.post("/{customer_id}/resolve", response_model=ResolveResponse)
async def resolve_ticket(customer_id: str):
    cust = get_customer_or_404(customer_id)

    # Trigger Hindsight reflection in background (FR-7)
    asyncio.create_task(hindsight_service.reflect(customer_id=customer_id))

    # Update risk profile visibly (FR-8, SRS Acceptance Criterion 2)
    curr_risk = _RISK_CACHE.get(customer_id)
    new_contact_count = (curr_risk.contact_count_this_issue + 1) if curr_risk else 2

    # Visibly increase confidence to 0.94+ on reflection consolidation
    new_confidence = 0.94

    # Determine updated risk level strictly per TRS §3.2:
    # - watch: contact_count_this_issue >= 2 OR sentiment_trend == 'declining'
    # - escalate: contact_count_this_issue >= 3 AND sentiment_trend == 'declining'
    sentiment = curr_risk.sentiment_trend if curr_risk else "stable"
    if new_contact_count >= 3 and sentiment == "declining":
        new_risk_level = "escalate"
    elif new_contact_count >= 2 or sentiment == "declining":
        new_risk_level = "watch"
    else:
        new_risk_level = "normal"

    assert not (new_risk_level == "escalate" and sentiment != "declining"), (
        f"Escalate tier requires declining sentiment, got sentiment='{sentiment}'"
    )

    updated_risk = RiskProfile(
        customer_id=customer_id,
        contact_count_this_issue=new_contact_count,
        sentiment_trend=sentiment,
        confidence=new_confidence,
        risk_level=new_risk_level
    )

    _RISK_CACHE[customer_id] = updated_risk

    trajectory = llm_service.compute_frustration_trajectory(cust)
    core_facts = [f.text for f in _CORE_MEMORY_CACHE.get(customer_id, [])]
    recommendation = llm_service.generate_action_recommendation(
        customer_id=customer_id,
        risk=updated_risk,
        trajectory=trajectory,
        core_memory=core_facts,
        customer=cust
    )

    return ResolveResponse(
        updated_risk_profile=updated_risk,
        frustration_trajectory=trajectory,
        action_recommendation=recommendation
    )
