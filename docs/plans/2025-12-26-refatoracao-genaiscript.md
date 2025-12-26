# Plano de Refatoração - GenAIScript como Principal

**Data**: 2025-12-26
**Autor**: Claude Opus 4.5 (Claudio)
**Status**: Aguardando revisão Roginho → Execução Jules

---

## 1. Análise do Estado Atual

### 1.1 O que JÁ existe e está CORRETO

O arquivo `genaisrc/fazai-core.genai.mjs` JÁ implementa:

| Feature | Status | Localização |
|---------|--------|-------------|
| `defTool("qdrant_multi_search")` | ✅ Existe | Linha 30-92 |
| `defTool("qdrant_upsert_insight")` | ✅ Existe | Linha 95-141 |
| `defTool("reflect")` + `runPrompt()` | ✅ Existe | Linha 144-208 |
| `defTool("check_loop_status")` | ✅ Existe | Linha 211-237 |
| `defTool("skill_seeker_scrape")` | ⚠️ Placeholder | Linha 240-287 |
| `defAgent("fazai_core")` | ✅ Existe | Linha 291-325 |

### 1.2 Bugs no GenAIScript (mesmos do TypeScript)

```javascript
// LINHA 57-59 - BUG 1: createEmbeddingService é async
const embeddingService = createEmbeddingService();  // Falta await!
await embeddingService.init();                       // .init() não existe!

// LINHA 61 - BUG 2: Método é .generate(), não .embed()
const embedding = await embeddingService.embed(query);  // ERRADO!
```

### 1.3 O que FALTA implementar

| Feature | Descrição | Prioridade |
|---------|-----------|------------|
| **Corrigir bugs acima** | Async/método correto | CRÍTICO |
| **Transformers.js** | Embeddings 100% local | ALTA |
| **Skill_Seekers real** | Não placeholder | ALTA |
| **Interface Web** | Express.js dashboard | MÉDIA |
| **Hooks → .genai.mjs** | Git hooks triggam scripts | MÉDIA |

---

## 2. Refatorações Necessárias

### 2.1 Corrigir `genaisrc/fazai-core.genai.mjs`

**Antes (bugado):**
```javascript
const { createEmbeddingService } = await import("../dist/services/embeddings.js");
const embeddingService = createEmbeddingService();
await embeddingService.init();
const embedding = await embeddingService.embed(query);
```

**Depois (corrigido):**
```javascript
const { createEmbeddingService } = await import("../dist/services/embeddings.js");
const embeddingService = await createEmbeddingService();  // AWAIT aqui!
// Não precisa de .init() - já está pronto
const embedding = await embeddingService.generate(query);  // .generate() não .embed()
```

**Linhas afetadas:** 57-61, 120-125

### 2.2 Integrar Transformers.js

O GenAIScript suporta Transformers.js para embeddings 100% locais:

```javascript
// Novo arquivo: genaisrc/tools/transformers-embed.mjs
import { pipeline } from "@xenova/transformers";

let embedder = null;

export async function getLocalEmbedder() {
    if (!embedder) {
        // Modelo leve para CPU
        embedder = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2"  // 384 dims, ~80MB
        );
    }
    return embedder;
}

export async function embed(text) {
    const model = await getLocalEmbedder();
    const output = await model(text, {
        pooling: "mean",
        normalize: true
    });
    return Array.from(output.data);
}
```

**Uso no GenAIScript:**
```javascript
defTool(
    "local_embed",
    "Gera embeddings locais com Transformers.js (100% CPU)",
    { text: { type: "string" } },
    async ({ text }) => {
        const { embed } = await import("./tools/transformers-embed.mjs");
        const vector = await embed(text);
        return JSON.stringify({ dimension: vector.length, vector: vector.slice(0, 5) + "..." });
    }
);
```

### 2.3 Implementar Skill_Seekers Real

**Novo arquivo:** `genaisrc/skill-seeker.genai.mjs` (substituir placeholder)

```javascript
script({
    title: "Skill Seeker",
    description: "Auto-gera skills a partir de documentação",
    model: "ollama:phi3",
});

// Tool: Scrape URL
defTool(
    "scrape_url",
    "Extrai conteúdo de uma URL",
    { url: { type: "string" } },
    async ({ url }) => {
        const response = await fetch(url);
        const html = await response.text();
        // Extrai texto principal (simplificado)
        const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        return text.substring(0, 10000);  // Limite
    }
);

// Tool: Gera skill definition
defTool(
    "generate_skill_definition",
    "Gera definição de skill a partir de texto",
    { content: { type: "string" }, topic: { type: "string" } },
    async ({ content, topic }) => {
        const result = await runPrompt(
            `Analise este conteúdo sobre "${topic}" e extraia:

            CONTEÚDO:
            ${content.substring(0, 5000)}

            Responda em JSON:
            {
                "skill_name": "nome_skill",
                "description": "descrição curta",
                "parameters": [
                    { "name": "param1", "type": "string", "description": "..." }
                ],
                "example_usage": "exemplo de uso",
                "knowledge_points": ["ponto1", "ponto2"]
            }`,
            { responseType: "json" }
        );
        return result.text;
    }
);

// Tool: Salva skill no Qdrant
defTool(
    "save_skill_to_kb",
    "Salva skill gerada na knowledge base",
    {
        skill_definition: { type: "string" },
        source_url: { type: "string" }
    },
    async ({ skill_definition, source_url }) => {
        const { createEmbeddingService } = await import("../dist/services/embeddings.js");
        const { QdrantClient } = await import("@qdrant/js-client-rest");

        const embedder = await createEmbeddingService();
        const qdrant = new QdrantClient({ url: "http://localhost:6333" });

        const skill = JSON.parse(skill_definition);
        const embedding = await embedder.generate(
            `${skill.skill_name}: ${skill.description}`
        );

        await qdrant.upsert("fazai_kb", {
            wait: true,
            points: [{
                id: Date.now(),
                vector: embedding,
                payload: {
                    type: "skill",
                    ...skill,
                    source_url,
                    created_at: new Date().toISOString()
                }
            }]
        });

        return JSON.stringify({ success: true, skill_name: skill.skill_name });
    }
);

// Agent: Skill Seeker
defAgent(
    "skill_seeker",
    "Detecta gaps de conhecimento e auto-gera skills de documentação",
    `Você é o Skill Seeker do FazAI. Sua missão:

    1. Quando detectar um gap de conhecimento, scrape a documentação relevante
    2. Extraia skills/conhecimento do conteúdo
    3. Salve na knowledge base para uso futuro

    Use as ferramentas: scrape_url → generate_skill_definition → save_skill_to_kb`,
    {
        tools: ["scrape_url", "generate_skill_definition", "save_skill_to_kb"]
    }
);

// Entrada
const gapDescription = env.vars.gap || "conhecimento geral";
const sourceUrl = env.vars.source || null;

$`Você é o Skill Seeker.

GAP DETECTADO: ${gapDescription}
${sourceUrl ? `FONTE SUGERIDA: ${sourceUrl}` : ""}

Se tiver uma fonte, scrape e gere skill.
Se não tiver, sugira fontes relevantes para este gap.`;
```

### 2.4 Interface Web (Express.js)

**Novo arquivo:** `src/dashboard.ts`

```typescript
import express from "express";
import { QdrantClient } from "@qdrant/js-client-rest";
import { runGenAIScript } from "./agentic/genai-runner.js";

const app = express();
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });

app.use(express.json());

// GET /collections - Lista collections
app.get("/api/collections", async (req, res) => {
    const collections = await qdrant.getCollections();
    res.json(collections);
});

// POST /search - Busca semântica
app.post("/api/search", async (req, res) => {
    const { query, collection = "fazai_learning" } = req.body;
    const result = await runGenAIScript({
        script: "fazai-core.genai.mjs",
        vars: { query },
    });
    res.json({ result: result.output });
});

// POST /agent - Executa agente
app.post("/api/agent", async (req, res) => {
    const { query } = req.body;
    const result = await runGenAIScript({
        script: "fazai-core.genai.mjs",
        vars: { query },
    });
    res.json({ success: result.success, output: result.output });
});

// GET /status - Status do sistema
app.get("/api/status", async (req, res) => {
    const collections = await qdrant.getCollections();
    res.json({
        qdrant: "online",
        collections: collections.collections.map(c => c.name),
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.DASHBOARD_PORT || 3000;
app.listen(PORT, () => {
    console.log(`FazAI Dashboard: http://localhost:${PORT}`);
});
```

### 2.5 Hooks → GenAIScript

Atualizar `.claude/settings.json` para triggars scripts:

```json
{
    "hooks": {
        "PostCommit": [
            {
                "command": "npx genaiscript run genaisrc/reflect.genai.mjs --vars 'trigger=post-commit'",
                "timeout": 30000
            }
        ],
        "PostToolUse": [
            {
                "matcher": { "tool": "Edit" },
                "command": "npx genaiscript run genaisrc/skill-seeker.genai.mjs --vars 'mode=detect'"
            }
        ]
    }
}
```

---

## 3. Ordem de Execução

### Fase 1: Correções Críticas (IMEDIATO)
1. [x] Corrigir bugs em `fazai-core.genai.mjs` (async, .generate())
2. [ ] Testar com `npx genaiscript run fazai-core --vars "query=teste"`

### Fase 2: Embeddings Locais
3. [ ] Instalar `@xenova/transformers`
4. [ ] Criar `genaisrc/tools/transformers-embed.mjs`
5. [ ] Adicionar `defTool("local_embed")` ao fazai-core
6. [ ] Testar embeddings 100% locais

### Fase 3: Skill Seekers
7. [ ] Implementar `skill-seeker.genai.mjs` real
8. [ ] Testar scraping + geração de skill
9. [ ] Verificar skills salvos no Qdrant

### Fase 4: Dashboard
10. [ ] Criar `src/dashboard.ts`
11. [ ] Adicionar comando `fazai dashboard`
12. [ ] Testar endpoints

### Fase 5: Integração
13. [ ] Atualizar hooks para triggarem .genai.mjs
14. [ ] Documentar tudo
15. [ ] Commit + tag

---

## 4. Dependências a Instalar

```bash
npm install @xenova/transformers express
```

---

## 5. Para o Jules

**Contexto**: Projeto FazAI-ng precisa usar GenAIScript da Microsoft como orquestrador principal do sistema agêntico.

**Tarefa**: Executar as correções e implementações descritas acima, seguindo a ordem de fases.

**Arquivos principais**:
- `genaisrc/fazai-core.genai.mjs` - Corrigir bugs
- `genaisrc/tools/transformers-embed.mjs` - Criar novo
- `genaisrc/skill-seeker.genai.mjs` - Implementar real (não placeholder)
- `src/dashboard.ts` - Criar novo

**Referência**: `docs/plans/coracao-agenico.txt` contém o prompt original com todas as especificações.

---

**Revisado por**: _Pendente revisão Roginho_
**Aprovado para Jules**: _Pendente_
