# Sistema RAG Neural - FazAI

Sistema completo de **RAG (Retrieval-Augmented Generation)** com busca neural multi-collection, fusion scoring e auto-aprendizado para o FazAI.

## Arquivos Criados

1. **`neural-flow.ts`** - Busca neural multi-collection com fusion scoring
2. **`auto-learning.ts`** - Sistema de captura e aprendizado contínuo
3. **`interaction-logger.ts`** - Análise de uso e performance
4. **`index.ts`** - Exports centralizados
5. **`integration-examples.ts`** - Exemplos de integração

## Collections Qdrant (Pesos de Fusion)

- `fazai_personality` (15%) - Traços de personalidade
- `fazai_memory` (20%) - Histórico de conversas
- `fazai_learning` (30%) - Padrões aprendidos **[MAIS IMPORTANTE]**
- `fazai_kb` (25%) - Base de conhecimento técnico
- `fazai_inference` (10%) - Regras operacionais

## Uso Rápido

### Busca Neural

```typescript
import { neuralQuery } from "./rag/neural-flow";
import { createEmbeddingService } from "../services/embeddings";

const embeddingService = await createEmbeddingService();
const embedding = await embeddingService.generate("Como configurar nginx?");

const result = await neuralQuery("Como configurar nginx?", embedding, {
  topK: 5,
  minScore: 0.3,
});
```

### Captura de Aprendizado

```typescript
import { captureLearning } from "./rag/auto-learning";

await captureLearning({
  type: "acerto",
  title: "Configuração nginx reverse proxy",
  description: "Configurado proxy para app Node.js",
  context: "Cliente reportou app inacessível",
  actionTaken: "Criado /etc/nginx/sites-available/app.conf",
  outcome: "sucesso",
  category: "nginx",
  tags: ["reverse-proxy", "nodejs"],
});
```

### Logging de Interações

```typescript
import { logQuerySuccess } from "./rag/interaction-logger";

await logQuerySuccess("admin", query, collections, resultsCount, score, time);
```

## Testes

```bash
npx tsx tests/rag/test-neural-flow.ts
```

## Documentação Completa

Ver `/home/rluft/fazai-ng/src/rag/README.md` (este arquivo) para documentação detalhada.
