# Guia de Uso - Sistema RAG Neural FazAI

## Casos de Uso Comuns

### 1. Busca Simples de Conhecimento

```typescript
import { neuralQuery } from "./rag/neural-flow";
import { createEmbeddingService } from "../services/embeddings";

async function searchKnowledge(query: string) {
  const embeddingService = await createEmbeddingService();
  const embedding = await embeddingService.generate(query);
  
  const result = await neuralQuery(query, embedding, {
    topK: 5,
    minScore: 0.3,
  });
  
  for (const r of result.fusedResults) {
    console.log(`[${r.collection}] ${r.score.toFixed(3)}`);
    console.log(r.content);
    console.log("---");
  }
}

await searchKnowledge("Como configurar nginx como reverse proxy?");
```

### 2. Captura de Erro e Solução

```typescript
import { captureLearning } from "./rag/auto-learning";

async function captureError(error: string, solution: string) {
  await captureLearning({
    type: "erro",
    title: `Erro: ${error.substring(0, 100)}`,
    description: error,
    context: "Comando executado via FazAI",
    actionTaken: solution,
    outcome: "sucesso",
    category: "linux",
    tags: ["troubleshooting"],
  });
}

await captureError(
  "nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)",
  "Identificado processo usando porta 80: apache2. Executado 'systemctl stop apache2'"
);
```

### 3. Reutilização de Learning

```typescript
import { findSimilarLearnings, incrementLearningApplication } from "./rag/auto-learning";

async function reuseKnowledge(problem: string) {
  // Busca learnings similares
  const similar = await findSimilarLearnings(problem, undefined, 5);
  
  if (similar.length > 0) {
    console.log("Soluções conhecidas:");
    for (const l of similar) {
      console.log(`${l.title} (${l.applied_count}x, confidence: ${l.confidence})`);
    }
    
    // Se aplicar solução similar com sucesso
    const selectedLearning = similar[0];
    const success = true; // executou e funcionou
    
    await incrementLearningApplication(selectedLearning.learning_id, success);
  } else {
    console.log("Nenhuma solução conhecida para este problema");
  }
}

await reuseKnowledge("Erro ao reiniciar nginx");
```

### 4. Busca Focada em Categoria

```typescript
import { neuralQuery, createCategoryFilter } from "./rag/neural-flow";

async function searchByCategory(query: string, category: string) {
  const embeddingService = await createEmbeddingService();
  const embedding = await embeddingService.generate(query);
  
  const result = await neuralQuery(query, embedding, {
    topK: 5,
    filters: {
      fazai_kb: createCategoryFilter(category),
      fazai_learning: createCategoryFilter(category),
    },
  });
  
  console.log(`Resultados para categoria "${category}":`);
  for (const r of result.fusedResults) {
    console.log(`- ${r.content.substring(0, 100)}...`);
  }
}

await searchByCategory("Como configurar firewall", "security");
```

### 5. Análise de Uso do Sistema

```typescript
import { interactionLogger } from "./rag/interaction-logger";

async function analyzeUsage() {
  // Estatísticas em memória
  const stats = interactionLogger.analyzePatterns();
  
  console.log(`Total de queries: ${stats.totalInteractions}`);
  console.log(`Taxa de sucesso: ${(stats.successRate * 100).toFixed(1)}%`);
  console.log(`Tempo médio: ${stats.avgExecutionTime}ms`);
  console.log();
  
  console.log("Collections mais usadas:");
  for (const [collection, count] of Object.entries(stats.collectionUsage)) {
    const pct = (count / stats.totalInteractions * 100).toFixed(1);
    console.log(`  ${collection}: ${count} (${pct}%)`);
  }
}

analyzeUsage();
```

### 6. Top Learnings por Categoria

```typescript
import { getTopLearningsByCategory } from "./rag/auto-learning";

async function showTopSolutions(category: string) {
  const top = await getTopLearningsByCategory(category, 10);
  
  console.log(`Top 10 soluções de ${category}:`);
  for (let i = 0; i < top.length; i++) {
    const l = top[i];
    console.log(`${i + 1}. ${l.title}`);
    console.log(`   Aplicado ${l.applied_count}x | Confidence: ${l.confidence.toFixed(2)}`);
  }
}

await showTopSolutions("nginx");
```

### 7. Workflow Completo

```typescript
import { neuralQuery } from "./rag/neural-flow";
import { captureLearning, findSimilarLearnings } from "./rag/auto-learning";
import { logQuerySuccess, logQueryFailure } from "./rag/interaction-logger";
import { createEmbeddingService } from "../services/embeddings";

async function completeWorkflow(userRequest: string) {
  const startTime = Date.now();
  
  try {
    // 1. Verifica se já tem solução conhecida
    const similar = await findSimilarLearnings(userRequest, undefined, 1);
    if (similar.length > 0 && similar[0].confidence > 0.8) {
      console.log("✓ Solução conhecida encontrada (confidence: " + similar[0].confidence + ")");
      console.log(similar[0].title);
      await incrementLearningApplication(similar[0].learning_id, true);
      return;
    }
    
    // 2. Busca contexto relevante
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate(userRequest);
    
    const context = await neuralQuery(userRequest, embedding, {
      topK: 3,
      minScore: 0.5,
    });
    
    console.log(`Contexto encontrado: ${context.fusedResults.length} resultados`);
    
    // 3. Gera solução (aqui seria chamada ao LLM - não implementado)
    const solution = "systemctl restart nginx";
    
    // 4. Executa solução (simulado)
    const success = true;
    
    // 5. Captura aprendizado
    await captureLearning({
      type: success ? "acerto" : "erro",
      title: `Solução para: ${userRequest.substring(0, 100)}`,
      description: `Gerado baseado em contexto RAG. Comando: ${solution}`,
      context: context.fusedResults.map(r => r.content).join("\n\n"),
      actionTaken: solution,
      outcome: success ? "sucesso" : "falha",
      category: "linux",
      tags: ["automated"],
    });
    
    // 6. Log interação
    await logQuerySuccess(
      "admin",
      userRequest,
      context.results.map(r => r.collection),
      context.fusedResults.length,
      context.stats.averageScore,
      Date.now() - startTime
    );
    
    console.log("✅ Workflow concluído com sucesso");
  } catch (error: any) {
    await logQueryFailure(
      "admin",
      userRequest,
      [],
      0,
      0,
      Date.now() - startTime,
      error.message
    );
    console.error("❌ Workflow falhou:", error.message);
  }
}

await completeWorkflow("Reiniciar nginx com reload de configuração");
```

### 8. Validação Humana de Learning

```typescript
import { markLearningAsValidated } from "./rag/auto-learning";

async function validateSolution(learningId: string, wasHelpful: boolean) {
  if (wasHelpful) {
    await markLearningAsValidated(learningId);
    console.log("✓ Learning marcado como validado (confidence → 0.95)");
  } else {
    console.log("✗ Learning não foi útil (sem alteração)");
  }
}

await validateSolution("learning_abc123", true);
```

### 9. Análise Histórica

```typescript
import { interactionLogger } from "./rag/interaction-logger";

async function analyzeHistory(date: string) {
  const filePath = `/var/log/fazai/interactions-${date}.jsonl`;
  const stats = await interactionLogger.analyzeHistoricalPatterns(filePath);
  
  console.log(`Análise histórica para ${date}:`);
  console.log(`Total: ${stats.totalInteractions} queries`);
  console.log(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
  console.log(`Avg time: ${stats.avgExecutionTime}ms`);
  console.log(`Slowest: ${stats.slowestQuery}ms`);
  console.log(`Fastest: ${stats.fastestQuery}ms`);
}

await analyzeHistory("2025-12-12");
```

### 10. Busca Multi-Peso Customizada

```typescript
import { neuralQuery } from "./rag/neural-flow";

async function searchWithCustomWeights(query: string, focusOnLearning: boolean) {
  const embeddingService = await createEmbeddingService();
  const embedding = await embeddingService.generate(query);
  
  const weights = focusOnLearning
    ? {
        learning: 0.5,    // 50% learnings
        kb: 0.3,          // 30% knowledge base
        inference: 0.2,   // 20% regras
        personality: 0,
        memory: 0,
      }
    : {
        kb: 0.5,          // 50% knowledge base
        learning: 0.3,    // 30% learnings
        personality: 0.2, // 20% personality
        memory: 0,
        inference: 0,
      };
  
  const result = await neuralQuery(query, embedding, {
    topK: 5,
    weights,
  });
  
  console.log(`Busca com foco em ${focusOnLearning ? "learnings" : "KB"}:`);
  for (const r of result.fusedResults) {
    console.log(`- [${r.collection}] ${r.score.toFixed(3)}: ${r.content.substring(0, 80)}...`);
  }
}

await searchWithCustomWeights("Configurar nginx HTTPS", false);
await searchWithCustomWeights("Erro nginx 502 bad gateway", true);
```

## Boas Práticas

### 1. Sempre gerar embedding antes de neuralQuery
```typescript
// ✓ Correto
const embedding = await embeddingService.generate(query);
const result = await neuralQuery(query, embedding);

// ✗ Errado - neuralQuery não gera embedding automaticamente
const result = await neuralQuery(query, []); // Erro!
```

### 2. Ajustar minScore por contexto
```typescript
// Comandos críticos: score alto
await neuralQuery(query, embedding, { minScore: 0.7 });

// Perguntas gerais: score permissivo
await neuralQuery(query, embedding, { minScore: 0.3 });
```

### 3. Capturar learnings sempre que possível
```typescript
// Após executar comando com sucesso/falha
await captureLearning({...});

// Incrementar quando reutilizar
await incrementLearningApplication(learningId, success);
```

### 4. Usar collections específicas quando apropriado
```typescript
// Para comandos Linux
collections: createCollectionSubset("kb", "learning")

// Para chat contextual
collections: createCollectionSubset("memory", "personality", "kb")
```

### 5. Sempre logar interações
```typescript
if (success) {
  await logQuerySuccess(...);
} else {
  await logQueryFailure(...);
}
```
