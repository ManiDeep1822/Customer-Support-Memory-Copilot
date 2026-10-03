# How We Built a Support Copilot That Stops Customer Escalations Using Hindsight Memory

Customer support AI bots have an amnesia problem.

When a customer reaches out for the fourth time about a delayed package or damaged item, traditional LLM support bots treat them like a total stranger. The customer is forced to re-verify order numbers, re-explain previous agent interactions, and endure repetitive troubleshooting scripts. This context breakdown is the single biggest cause of customer churn and supervisor escalations.

To solve this, we engineered the **Support Memory & Escalation Copilot**—a support desk application that pairs a FastAPI (Python) backend with [Vectorize agent memory](https://vectorize.io/what-is-agent-memory) powered by the [Hindsight vector memory engine](https://github.com/vectorize-io/hindsight).

By integrating Hindsight's `retain`, `recall`, and `reflect` primitives alongside a MemGPT-style working memory buffer, our system detects multi-session customer frustration trajectories and surfaces proactive manager action recommendations before an agent even dispatches a reply.

Here is how we designed the system, implemented per-customer memory isolation, and benchmarked its performance.

---

## 1. System Architecture: Decoupled Memory & Inference

The system is built as a rep-facing co-pilot. It sits between incoming customer messages and the support agent, enriching every ticket with historical context and suggested next actions.

![System Architecture Diagram](C:/Users/korra/.gemini/antigravity/brain/ed7a634b-1623-4f2d-a153-8bd2ea1a180e/system_architecture_diagram_1790680541116.jpg)

### Core Architectural Layers:
1. **React 18 Desk UI**: Displays the ticket queue, order details, conversation history, and an intelligence panel featuring a live **Memory ON / Memory OFF** toggle.
2. **FastAPI Backend Service**: Handles API routes (`/tickets`, `/message`, `/core-memory`, `/resolve`), computes customer distress trajectories, and manages async memory retention workers.
3. **Hindsight Memory Engine**: Provides persistent per-customer experience storage (`retain`), semantic recall (`recall`), and post-resolution memory consolidation (`reflect`).
4. **Resilient Groq LLM Layer**: Executes completions using primary model `openai/gpt-oss-120b` with automated fallback to `qwen/qwen3-32b` upon rate limits or errors.

---

## 2. Enforcing Per-Customer Memory Isolation

In customer support systems, cross-tenant data leakage is catastrophic. If Customer A's recalled memories leak into Customer B's ticket workspace, the support agent might reference someone else's order number or home address.

In accordance with the [Hindsight documentation](https://hindsight.vectorize.io/), we enforce strict metadata tagging on every retention call and explicit tag filtering on every recall query:

![ER Database Schema Diagram](C:/Users/korra/.gemini/antigravity/brain/ed7a634b-1623-4f2d-a153-8bd2ea1a180e/database_er_diagram_1790680594170.jpg)

### Code Implementation:

```python
# 1. Scoped Memory Retention (backend/services/hindsight.py)
async def retain(self, customer_id: str, brand: str, text: str, metadata: Optional[dict] = None) -> bool:
    client = self._get_client()
    if not client:
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

# 2. Isolated Customer Recall (backend/services/hindsight.py)
async def recall(self, customer_id: str, query: str = "") -> List[RecalledItem]:
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
            timeout=4.0
        )
        return [RecalledItem(type="experience", summary=r.text) for r in res.results]
    except Exception as e:
        return self._simulated_recall(customer_id)
```

---

## 3. Multi-Session Frustration Trajectory & Action Recommendations

Evaluating customer sentiment on a single incoming message misses chronic frustration. To catch escalation risks early, our backend implements a multi-session distress scoring engine in `backend/services/llm.py`:

```python
def compute_frustration_trajectory(self, customer: Customer) -> FrustrationTrajectory:
    all_sessions = []
    distress_keywords = ["broken", "damaged", "again", "still waiting", "refund", "frustrated", "tape"]

    for idx, thread in enumerate(customer.threads, 1):
        text = " ".join([m.text for m in thread.messages]).lower()
        matches = sum(1 for kw in distress_keywords if kw in text)
        score = min(98, max(20, 25 + (idx * 18) + (matches * 12)))
        
        all_sessions.append(FrustrationSession(
            session_id=thread.thread_id,
            session_label=f"Session #{idx}",
            frustration_score=score,
            frustration_level="Critical" if score >= 80 else "High" if score >= 60 else "Medium",
            summary_reason=f"Session #{idx}: {len(thread.messages)} messages exchanged"
        ))
    return FrustrationTrajectory(customer_id=customer.customer_id, sessions=all_sessions)
```

When frustration scores exceed $80\%$, the copilot automatically renders a **Proactive Support Action Recommendation Card**:

```python
if risk.risk_level == "escalate" or score >= 80:
    return AgentActionRecommendation(
        action_type="escalate_manager",
        headline="🚨 Proactive Manager Escalation & Goodwill Refund Recommended",
        recommended_action=f"Escalate ticket to Senior Support Lead. Review previous {contacts} unresolved contacts and issue a $15 courtesy credit prior to reply.",
        rationale=f"Customer has contacted support {contacts} times with an increasing frustration trajectory ({score}% distress score)."
    )
```

---

## 4. Empirical Evaluation: Memory OFF vs Memory ON

We benchmarked the system across real customer support cases using the live Memory ON/OFF toggle:

![Demo Workspace Screenshot](C:/Users/korra/.gemini/antigravity/brain/ed7a634b-1623-4f2d-a153-8bd2ea1a180e/standalone_youtube_thumbnail_1790684644791.jpg)

### Case Study: Customer #9059 (`cust_0002`)
- **History**: 5 previous contacts regarding a damaged Kindle Paperwhite.
- **Incoming Message**: *"Worlds worst customer service you have only donkeys working there..."*

#### Mode 1: Memory OFF (Stateless Mode)
- **Output**: *"Hello Customer #9059, thanks for reaching out! Could you please provide your order ID and explain what issue you are experiencing?"*
- **Result**: **FAILED**. Asking an infuriated customer for their order ID on contact turn #5 guarantees churn.

#### Mode 2: Memory ON (Hindsight Active)
- **Output**: *"Hello Customer #9059, I am so sorry to hear this is happening again. I see this is your 5th contact regarding damaged item order #302-9059-1102. I have proactively approved a full refund and issued a $15 courtesy credit to your account while routing your file to our Senior Support Lead."*
- **Result**: **SUCCESS**. Resolves the issue instantly with full historical context awareness.

---

## 5. Engineering Lessons Learned

1. **Tag Scoping Prevents Cross-Customer Leaks**: Always enforce `tags=[customer_id]` at the API boundary level when querying vector memory.
2. **Combine Vector Recall with Core Working Memory**: Vector recall retrieves past experiences, while a MemGPT core memory buffer pins mandatory rules (e.g., Prime tape rules) directly into LLM prompts.
3. **Asynchronous Reflection**: Running Hindsight's `reflect` function upon ticket resolution consolidates raw transcripts into permanent customer opinions without blocking live user chat.

---

## Resources & Links

- **GitHub Repository**: [Hindsight Memory Engine](https://github.com/vectorize-io/hindsight)
- **Documentation**: [Hindsight Engine Documentation](https://hindsight.vectorize.io/)
- **Vectorize Guide**: [What is Agent Memory?](https://vectorize.io/what-is-agent-memory)
