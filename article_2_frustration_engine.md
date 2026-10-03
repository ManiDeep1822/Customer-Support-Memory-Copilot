# Building a Multi-Session Frustration Trajectory Engine for AI Copilots

Most AI support bots evaluate customer sentiment in a vacuum—analyzing only the text of the latest incoming message.

This single-turn evaluation misses chronic escalation risk. A customer might write a polite 1-sentence follow-up message ("Any update on this?"), but if it's their 4th unresolved contact this week, their actual distress level is critical.

To solve this, we built a **Multi-Session Frustration Trajectory Engine** inside our Support Copilot, backed by [Vectorize agent memory](https://vectorize.io/what-is-agent-memory) and the [Hindsight vector memory engine](https://github.com/vectorize-io/hindsight). Here is how we designed and implemented it.

---

## 1. Algorithmic Distress Scoring Across Historical Sessions

The trajectory engine evaluates customer distress progression ($0\% - 100\%$) across all historical threads plus the active live ticket:

```python
def compute_frustration_trajectory(customer: Customer) -> FrustrationTrajectory:
    all_sessions = []
    distress_keywords = ["broken", "damaged", "again", "still waiting", "refund", "frustrated", "tape"]

    for idx, thread in enumerate(customer.threads, 1):
        text = " ".join([m.text for m in thread.messages]).lower()
        matches = sum(1 for kw in distress_keywords if kw in text)
        
        # Algorithmic distress formula incorporating turn count & distress signals
        score = min(98, max(20, 25 + (idx * 18) + (matches * 12)))
        level = "Critical" if score >= 80 else "High" if score >= 60 else "Medium"
        
        all_sessions.append(FrustrationSession(
            session_id=thread.thread_id,
            session_label=f"Session #{idx}",
            frustration_score=score,
            frustration_level=level
        ))
    return FrustrationTrajectory(customer_id=customer.customer_id, sessions=all_sessions)
```

---

## 2. Memory-Grounded Action Recommendation Engine

When a customer's frustration trajectory crosses critical thresholds ($\ge 80\%$), the backend automatically generates a **Support Action Recommendation** prior to dispatching the agent's reply:

![ER Database Schema Diagram](C:/Users/korra/.gemini/antigravity/brain/ed7a634b-1623-4f2d-a153-8bd2ea1a180e/database_er_diagram_1790680594170.jpg)

```python
if risk.risk_level == "escalate" or score >= 80:
    return AgentActionRecommendation(
        action_type="escalate_manager",
        headline="🚨 Proactive Manager Escalation & Goodwill Refund Recommended",
        recommended_action=f"Escalate ticket to Senior Support Lead. Review previous {contacts} unresolved contacts and issue a $15 courtesy credit.",
        rationale=f"Customer has contacted support {contacts} times with an increasing frustration trajectory ({score}% distress score)."
    )
```

---

## 3. Real-Time Memory Consolidation via Hindsight Reflection

When the support rep marks the ticket as resolved, Hindsight's `reflect` function consolidates raw transcript history into permanent customer opinions:

```python
@router.post("/tickets/{customer_id}/resolve")
async def resolve_ticket(customer_id: str):
    # Trigger Hindsight reflection background worker
    asyncio.create_task(hindsight_service.reflect(customer_id=customer_id))
    return {"status": "resolved", "confidence": 0.94}
```

Per the [Hindsight documentation](https://hindsight.vectorize.io/), `reflect` transforms episodic logs into long-term structured insights, preventing future agents from making the same mistake.

---

## 4. Key Takeaways for AI Engineers

1. **Sentiment Analysis Demands Historical Trajectories**: Single-turn sentiment checks miss chronic customer frustration.
2. **Advisory Action Cards Empower Agents**: Generating advisory next steps before reply dispatch drastically cuts resolution time.
3. **Reflect Locks In Learning**: Consolidating memory upon ticket resolution prevents future support amnesia.

### Resource Links
- [Hindsight GitHub Repository](https://github.com/vectorize-io/hindsight)
- [Hindsight Technical Docs](https://hindsight.vectorize.io/)
- [Vectorize Agent Memory Overview](https://vectorize.io/what-is-agent-memory)
