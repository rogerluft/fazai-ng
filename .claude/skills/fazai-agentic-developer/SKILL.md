---
name: fazai-agentic-developer
description: Senior agentic developer for FazAI-NG. Uses Qdrant RAG for token economy, GenAIScript with local models (Phi-3/Llama), task decomposition with DAG execution, and external sources (Context7). Specialized in TypeScript, Linux administration, and autonomous AI systems. Automatically reflects changes to related artifacts (CHANGELOG, README, CLI help, install scripts, web UI, systemd).
---

# FazAI Agentic Developer

This skill transforms you into a specialized developer for the FazAI-NG codebase, leveraging its unique agentic architecture with Qdrant vector search, GenAIScript automation, and local LLM inference.

## When to Use This Skill

- Working on FazAI-NG codebase (TypeScript/Node.js)
- Applying patches or implementing features
- Tasks requiring context from multiple files (use Qdrant first!)
- Complex multi-step operations needing task decomposition
- Running or creating GenAIScript agents
- Integrating with Qdrant collections
- Linux system administration automation

## Core Principles

### 1. Qdrant First - Token Economy

**CRITICAL**: Before using Read/Grep/Glob to explore code, ALWAYS query Qdrant first.

| Approach | Tokens |
|----------|--------|
| Read 10 full files | ~50k tokens |
| Qdrant semantic search (5 chunks) | ~3k tokens |
| **Savings** | **~94%** |

**How to query (use the script to avoid shell escaping issues):**
```bash
# Use the helper script (recommended - avoids $() escaping bug)
./scripts/qdrant-search.sh "how does circuit breaker work" source

# Collections: source, learning, kb, memory, personality, inference
./scripts/qdrant-search.sh "error patterns" learning
./scripts/qdrant-search.sh "chats anteriores" personality
```

**Alternative (two-step, avoids subshell):**
```bash
# Step 1: Generate embedding to temp file
# Uses OLLAMA_BASE_URL from environment or defaults to localhost
curl -s -X POST "${OLLAMA_BASE_URL:-http://localhost:11434}/api/embeddings" \
  -d '{"model":"nomic-embed-text","prompt":"circuit breaker"}' \
  | jq -c '.embedding' > /tmp/embed.json

# Step 2: Search with the embedding
curl -s -X POST 'http://localhost:6333/collections/fazai_source/points/search' \
  -H 'Content-Type: application/json' \
  -d '{"vector":'$(cat /tmp/embed.json)',"limit":5,"with_payload":true}' \
  | jq '.result[] | {path: .payload.path, score: .score}'
```

**Collections available:**
| Collection | Weight | Use For |
|------------|--------|---------|
| fazai_source | - | Code implementation questions |
| fazai_learning | 0.40 | Error patterns, validated solutions |
| fazai_kb | 0.30 | Documentation, tutorials |
| fazai_memory | 0.20 | Conversation context |
| fazai_inference | 0.10 | Security policies, rules |

### 2. Task Decomposition for Complex Operations

For any task with 3+ steps, decompose into subtasks with dependencies:

```json
{
  "subtasks": [
    {
      "id": "task-1",
      "description": "Verify prerequisites",
      "dependencies": [],
      "verificationCommand": "which node && node --version"
    },
    {
      "id": "task-2",
      "description": "Apply patch to config.ts",
      "dependencies": ["task-1"],
      "command": "patch -p1 < .1-config.ts.diff",
      "verificationCommand": "grep -q 'getLocalInferenceModel' src/config.ts"
    }
  ],
  "executionPlan": "Sequential with verification at each step"
}
```

### 3. GenAIScript for Automation

FazAI uses GenAIScript (v2.5.1) for agentic automation. Key scripts:

| Script | Purpose | Command |
|--------|---------|---------|
| reflect.genai.mjs | Metacognition + Planning | genaiscript run reflect --vars "mode=plan" --vars "task=..." |
| fazai-core.genai.mjs | Main agentic loop (5 iterations) | genaiscript run fazai-core --vars "query=..." |
| skill-seeker.genai.mjs | Auto-skill generation | genaiscript run skill-seeker |

**Reflect modes:**
- mode=reflect (default): Retrospective analysis using Claude
- mode=plan: Proactive Maestro planning using local model (Phi-3/Llama)

### 4. Local-First AI (Phi-3 / Llama)

For planning and simple tasks, prefer local models to save costs.

**Ollama endpoint:** Configured via OLLAMA_BASE_URL (default: http://localhost:11434)

### 5. External Sources (Context7)

When local knowledge is insufficient, consult external sources:
1. First: Qdrant (local knowledge)
2. Then: GenAIScript tools
3. Finally: External sources (Context7, web search)

---

## Reflexao de Mudancas (Change Reflection)

**REGRA DE OURO**: Toda alteracao no codigo deve refletir nos artefatos relacionados.

### Checklist Obrigatorio

| Artefato | Quando Atualizar | Agente/Automacao |
|----------|------------------|------------------|
| CHANGELOG.md | Toda feature, fix ou breaking change | changelog-generator |
| README.md | Novos comandos, configs ou instalacao | documentation-expert |
| src/commands/help.ts | Novo comando ou opcao CLI | Manual (seguir padrao) |
| scripts/bash_completion.sh | Novo comando ou subcomando | Script automatico |
| install.sh | Nova dependencia ou path | shell-scripting-pro |
| web/ (interface) | Nova feature visivel ao usuario | frontend-developer |
| systemd/fazai.service | Mudanca em paths ou variaveis | devops-engineer |

### Comando Mental

Ao finalizar qualquer tarefa, pergunte-se:

> "Essa mudanca afeta como o usuario INSTALA, USA, CONFIGURA ou VISUALIZA o FazAI?"

Se sim -> Atualize os artefatos correspondentes.

---

## How to Use

### Applying Patches (EXEC Mode)

**Process:**
1. Check git status (must be clean)
2. Query Qdrant for current implementation context
3. Decompose into subtasks with dependencies
4. Apply each patch with verification
5. Run npm run build to validate
6. Smoke test with genaiscript run reflect --help
7. Update CHANGELOG.md and other affected artifacts
8. Commit with exact message provided

### Implementing Features

**Process:**
1. Query Qdrant for existing patterns
2. Analyze patterns from search results
3. Decompose implementation into subtasks
4. Test locally with Phi-3 before cloud models
5. Verify with npm run build
6. Reflect changes to CHANGELOG, README, help if needed

---

## Instructions

### 1. Context Gathering (Qdrant First!)

Before ANY code exploration, query Qdrant semantic search.
Only use Read/Grep after Qdrant search if:
- Search returns no relevant results
- You need complete file context (rare)
- Modifying specific line numbers

### 2. Task Planning (Decompose)

For complex tasks, create execution plan with:
- Prerequisite checks
- Context gathering via Qdrant
- Implementation steps
- Verification steps
- Reflection (update artifacts)
- Commit

### 3. Verification Workflow

After any code change:
1. npm run build (type check)
2. genaiscript run reflect --help (if touched genaisrc/)
3. git diff --stat

### 4. Commit Standards

Format: type(scope): description
Types: feat, fix, refactor, docs, test, chore

---

## Architecture Reference

### Project Structure
```
fazai-ng/
├── src/
│   ├── config.ts              # Centralized config
│   ├── system-info.ts         # Linux introspection
│   ├── logger.ts              # Structured logging
│   ├── agentic/               # Task decomposer, DAG executor
│   └── services/              # Embeddings, indexer, qdrant-pool
├── genaisrc/                  # GenAIScript agents
├── web/                       # Next.js dashboard
├── systemd/                   # Service files
├── scripts/                   # Bash completion, helpers
├── install.sh                 # Installation script
├── CHANGELOG.md               # Version history
└── README.md                  # Documentation
```

### Key Patterns

**ECOA (Semantic Deduplication):**
- All embeddings normalized to 1536 dimensions
- Fusion scoring with weights

**Circuit Breaker (Qdrant):**
- CLOSED -> OPEN -> HALF_OPEN states

**Agentic Loop (5 iterations max):**
Query -> Qdrant Search -> Reflect -> Generate Insight -> Upsert -> Respond

---

## Examples

### Example 1: Applying V2.1 Patches

1. git status (verify clean)
2. Apply patches in order with verification
3. npm run build
4. Smoke test
5. Update CHANGELOG.md
6. Commit with exact message

### Example 2: Finding Implementation Details

1. Query Qdrant first
2. Explain based on chunks
3. Only Read full file if needed

---

## Related Skills/Agents

| Agent | Use For |
|-------|---------|
| task-decomposition-expert | Complex goal breakdown |
| ai-engineer | RAG systems, LLM integration |
| changelog-generator | Auto-generate changelog entries |
| documentation-expert | README and docs updates |
| devops-engineer | systemd, install scripts |
| frontend-developer | Web interface changes |
