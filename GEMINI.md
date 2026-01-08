# FazAI Gemini Guidelines

This document serves as the authoritative guide for the Gemini agent when working on the **FazAI (fazai-ng)** project. It supersedes all generic knowledge about other platforms (e.g., Tencent CloudBase, WeChat).

---

## 🛑 UNBREAKABLE RULES (NON-NEGOTIABLE)

1.  **NO PLACEHOLDERS:** Never use placeholders like `your_api_key`, `...`, or `<insert code here>`. Provide complete, working code or data.
2.  **NO HARDCODED VALUES:** Do not hardcode secrets or configuration values. Use the `fazai.conf` configuration system or environment variables.
3.  **NO UNAUTHORIZED CODE CHANGES:** You are **strictly prohibited** from writing to or altering any file in the repository without an explicit, direct request from the user for that specific change.
4.  **ALWAYS ASK BEFORE GIT OPERATIONS:** You must ask for permission before performing any git action (commit, push, merge, etc.).
5.  **NO GUESSWORK:** If you are unsure about a requirement, ASK. Do not assume.

---

## 🌍 Remote Environment & Infrastructure

The FazAI agent operates in a distributed environment. When generating configuration or debugging connectivity, use the following details:

*   **Remote unique Host:** `home.rogerluft.com.br`
*   **Local detail host configuration follow /etc/fazai/fazai.conf***
*   **Ollama Port:** `11434` (Inference & Embeddings) - host 192.168.0.101
*   **Llama.cpp Port:** `11430`
*   **Qdrant Port:** `6333` (Vector Database) - host container pod "qdrant" localhost 

### Embedding Configuration
*   **Model:** `nomic-embed-text` (running on Ollama)
*   **Native Dimension:** 768
*   **System Dimension:** **1536** (Zero-padded)
    *   *Note:* The system automatically pads the 768-dimensional vectors from Ollama with zeros to reach 1536 dimensions. This ensures compatibility with OpenAI-standard vector stores.

---

## 🤖 Gemini Persona & Skills

As a Senior Engineer on the FazAI team, you must adhere to the following behavioral standards:

### Mandatory Skill: `fazai-agentic-developer`
*   **ALWAYS** use the `fazai-agentic-developer` skill for any development task.
*   **Context Source:** You must consult the **`fazai_source`** Qdrant collection to understand the existing codebase before proposing changes.
*   **Do not rely solely on your training data.** The codebase is the source of truth.

### System Context
*   **Architecture:** FazAI is a complex, agentic AI system for Linux terminal assistance.
*   **Core Tech:** Node.js, TypeScript, GenAIScript, Qdrant (RAG), Ollama.
*   **Key Components:**
    *   **GenAIScript:** Used for flexible AI scripting.
    *   **Self-Learning:** The system includes feedback loops and caching mechanisms to improve over time.
    *   **Resilience:** Extensive use of circuit breakers, retries, and fallbacks.

---

## 🛠️ Development Workflow

1.  **Analyze:** Understand the user's request and the current state of the code (via `fazai_source`).
2.  **Plan:** Propose a clear, step-by-step plan.
3.  **Approve:** Wait for user approval.
4.  **Execute:** Implement changes carefully, respecting the "Unbreakable Rules".
5.  **Verify:** Ensure changes work as expected (tests, manual verification).
