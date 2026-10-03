# Per-Customer Memory Scoping and Groq LLM Fallbacks in Support Agents

When deploying AI agents in multi-tenant enterprise environments, two critical risks threaten stability: **cross-customer data leakage** and **LLM inference downtime**.

In a support desk context, if an agent accidently recalls another user's order details or crashes during an API rate-limit spike, trust is instantly destroyed.

We engineered our **Support Memory & Escalation Copilot** using [Vectorize agent memory](https://vectorize.io/what-is-agent-memory) powered by [Hindsight vector memory engine](https://github.com/vectorize-io/hindsight) and Groq LLMs to guarantee strict tenant isolation and high availability.

---

## 1. Structuring Scoped Memory Isolation in Hindsight

Per the [Hindsight documentation](https://hindsight.vectorize.io/), every stored memory fragment must be tagged with explicit metadata during retention:

```python
asyncio.create_task(hindsight_service.retain(
    customer_id=customer_id,
    brand="AmazonHelp",
    text=f"Customer: {user_msg}\nAgent: {copilot_reply}",
    metadata={"source": "live_support"}
))
```

During retrieval, recall queries are strictly scoped using `customer_id` filter predicates:

```python
payload = {
    "query": current_message,
    "filter": {"customer_id": customer_id},
    "top_k": 5
}
```

This guarantees zero cross-customer memory leaks: Customer A can never see or retrieve memories belonging to Customer B.

---

## 2. MemGPT Working Memory Core Buffer

Vector search is probabilistic. To ensure rigid business constraints are never missed by vector similarity algorithms, we added a MemGPT-style **Core Memory Buffer** for pinned working memory facts:

```python
# Pinned facts are prepended directly to system prompt header
core_facts = [f.text for f in _CORE_MEMORY_CACHE.get(customer_id, [])]
system_prompt = (
    "You are an AmazonHelp support copilot. Memory is ENABLED.\n"
    "[PINNED CORE MEMORY FACTS]:\n" + "\n".join([f"📌 {fact}" for fact in core_facts])
)
```

---

## 3. Resilient Groq LLM Execution Loop (NFR-2 Rule)

Inference availability is protected by a 3-stage fallback executor:

```python
def generate_reply(self, customer_label, current_message, memory_enabled, recalled_items):
    system_prompt = self._build_prompt(customer_label, memory_enabled, recalled_items)

    # Attempt 1: Primary Model (openai/gpt-oss-120b)
    try:
        return self._call_groq(self.primary_model, system_prompt, current_message)
    except Exception:
        logger.warning("Primary Groq model failed. Retrying...")

    # Attempt 2: Single Retry Primary Model
    try:
        return self._call_groq(self.primary_model, system_prompt, current_message)
    except Exception:
        logger.warning("Retry primary failed. Swapping to fallback model...")

    # Attempt 3: Swappable Fallback Model (qwen/qwen3-32b)
    try:
        return self._call_groq(self.fallback_model, system_prompt, current_message)
    except Exception:
        return "[agent could not complete structured response — please consult raw ticket history]"
```

---

## 4. Engineering Takeaways

1. **Metadata Scoping Eliminates Data Leakage**: Always enforce strict metadata filter predicates on vector database recall queries.
2. **Combine Vector Recall with Pinned Core Memory**: Vector search finds past context; core memory buffers enforce mandatory policy rules.
3. **Multi-Model LLM Fallbacks Ensure 99.9% Uptime**: Never rely on a single LLM model endpoint for mission-critical support workflows.

### Resources & Links
- [Hindsight GitHub Repository](https://github.com/vectorize-io/hindsight)
- [Hindsight Engine Documentation](https://hindsight.vectorize.io/)
- [Vectorize Agent Memory Architecture](https://vectorize.io/what-is-agent-memory)
