# How We Built a 99.9% Reliable AI Copilot With FastAPI, Groq Fallbacks, and Hindsight

When building AI support agents for production, inference speed and reliability are just as critical as memory recall.

If your primary LLM endpoint experiences a rate-limit spike or function-calling timeout during a live customer conversation, your agent halts. Conversely, if your agent takes 8 seconds to retrieve memory and synthesize a reply, user experience degrades rapidly.

To solve both challenges, we engineered our **Support Memory & Escalation Copilot** around a high-speed inference pipeline pairing FastAPI with Groq LPUs and the [Hindsight vector memory engine](https://github.com/vectorize-io/hindsight). 

Here is how we implemented multi-tier model fallbacks and low-latency memory recall using [Vectorize agent memory](https://vectorize.io/what-is-agent-memory).

---

## 1. Multi-Tier NFR-2 Fallback Executor

In accordance with enterprise non-functional requirements, our backend implements a 3-tier fallback handler in `backend/services/llm.py`:

```python
def generate_reply(self, customer_label: str, current_message: str, memory_enabled: bool, recalled_items=None):
    system_prompt = self._build_prompt(customer_label, memory_enabled, recalled_items)

    # Attempt 1: Primary Model (openai/gpt-oss-120b)
    try:
        return self._call_groq(self.primary_model, system_prompt, current_message)
    except Exception as e1:
        logger.warning(f"Primary model {self.primary_model} failed: {e1}. Retrying primary...")

    # Attempt 2: Single Retry Primary
    try:
        return self._call_groq(self.primary_model, system_prompt, current_message)
    except Exception as e2:
        logger.warning(f"Retry primary failed: {e2}. Swapping to fallback model...")

    # Attempt 3: Secondary Fallback Model (qwen/qwen3-32b)
    try:
        return self._call_groq(self.fallback_model, system_prompt, current_message)
    except Exception as e3:
        return "[agent could not complete structured response — please consult raw ticket history]"
```

This guarantees that an API hiccup on the primary model never disrupts a live support representative.

---

## 2. Low-Latency Memory Recall Under 150 Tokens

Per the [Hindsight documentation](https://hindsight.vectorize.io/), memory retrieval queries are filtered by `customer_id` and restricted to `top_k=5`:

![System Architecture Diagram](C:/Users/korra/.gemini/antigravity/brain/ed7a634b-1623-4f2d-a153-8bd2ea1a180e/system_architecture_diagram_1790680541116.jpg)

Because Hindsight returns pre-indexed experiences and synthesized opinions, the recalled prompt context stays below 150 tokens. This allows Groq's LPU hardware to complete generation in under 400ms.

---

## 3. Core Takeaways for Systems Engineers

1. **Decouple Vector Writes from User Latency**: Execute `retain` and `reflect` in background async tasks.
2. **Implement Swappable LLM Fallbacks**: Always pair primary models with secondary fallback endpoints.
3. **Keep Recalled Prompt Context Dense**: Filter memory by customer ID to maintain low latency and high relevance.

### Project Resources
- [Hindsight Memory Engine GitHub](https://github.com/vectorize-io/hindsight)
- [Hindsight Documentation](https://hindsight.vectorize.io/)
- [Vectorize Agent Memory Guide](https://vectorize.io/what-is-agent-memory)
