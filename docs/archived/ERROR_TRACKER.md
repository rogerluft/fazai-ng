# Error Tracker System

Sistema de rastreamento de erros em memória para o FazAI dashboard CLI.

## Características

- **In-Memory Storage**: Array em memória com últimos 50 erros
- **Type Classification**: 6 categorias de erro (api, cache, provider, system, network, validation)
- **Automatic Capture**: Integração automática com `logger.error()`
- **Dashboard Ready**: Formato otimizado para exibição no dashboard
- **Zero Placeholders**: Implementação completa, sem código simulado

## Tipos de Erro

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `api` | Erros de APIs externas | Cloudflare, OpenAI, Anthropic |
| `cache` | Erros do sistema de cache | Qdrant, semantic cache |
| `provider` | Erros de provedores de IA | Ollama, OpenRouter |
| `system` | Erros gerais do sistema | File I/O, permissions |
| `network` | Erros de rede | ECONNREFUSED, timeout |
| `validation` | Erros de validação | Invalid input, schema mismatch |

## Uso Básico

### Captura Manual de Erros

```typescript
import { errorTracker } from "./error-tracker";

// Captura erro simples
errorTracker.captureError("api", "Cloudflare API failed");

// Captura com objeto Error
try {
  throw new Error("Connection refused");
} catch (error) {
  errorTracker.captureError("network", "Failed to connect", error as Error);
}

// Captura com contexto adicional
errorTracker.captureError(
  "provider",
  "Ollama timeout",
  undefined,
  { model: "qwen2.5:7b", timeout: 30000 }
);
```

### Captura Automática via Logger

```typescript
import { logger } from "./logger";

// Automaticamente capturado pelo error-tracker
logger.error("API request failed: ECONNREFUSED");
// Tipo detectado: "network" (por "ECONNREFUSED")

logger.error("Cache lookup failed in Qdrant");
// Tipo detectado: "cache" (por "cache")

logger.error("Ollama provider unavailable");
// Tipo detectado: "provider" (por "ollama", "provider")
```

## Integração com Dashboard

O dashboard CLI (`/dashboard`) exibe automaticamente os últimos 5 erros:

```bash
fazai --cli
> /dashboard

# Exibe:
# Recent Errors:
#   18:45  [NETWORK] ECONNREFUSED 127.0.0.1:11434
#   18:42  [API] Cloudflare API rate limit exceeded
#   18:40  [CACHE] Qdrant collection not found
```

## API Reference

### `errorTracker.captureError()`

Captura um novo erro no sistema.

```typescript
errorTracker.captureError(
  type: "api" | "cache" | "provider" | "system" | "network" | "validation",
  message: string,
  error?: Error,
  context?: Record<string, unknown>
);
```

### `errorTracker.getRecentErrors(limit)`

Retorna últimos N erros formatados para dashboard.

```typescript
const errors = errorTracker.getRecentErrors(10);
// Retorna: FormattedError[]
// [
//   { timestamp: "18:45", type: "network", message: "...", status: "error" },
//   ...
// ]
```

### `errorTracker.getStats()`

Retorna estatísticas de erros por tipo.

```typescript
const stats = errorTracker.getStats();
// {
//   total: 15,
//   api: 3,
//   cache: 2,
//   provider: 5,
//   system: 2,
//   network: 2,
//   validation: 1
// }
```

### `errorTracker.getLastError()`

Retorna o erro mais recente.

```typescript
const lastError = errorTracker.getLastError();
// ErrorEntry | null
```

### `errorTracker.hasRecentErrors()`

Verifica se há erros nos últimos 5 minutos.

```typescript
if (errorTracker.hasRecentErrors()) {
  console.warn("System has recent errors!");
}
```

### `errorTracker.clear()`

Limpa todos os erros rastreados.

```typescript
errorTracker.clear();
```

## Comportamento

### Limite de Erros

- **Máximo**: 50 erros em memória
- **Política**: FIFO (First In, First Out)
- **Quando excede**: Remove o erro mais antigo

### Detecção Automática de Tipo

O logger integra-se ao error-tracker e detecta tipos por keywords:

```typescript
// Palavras-chave por tipo:
api: ["api", "cloudflare", "openai", "anthropic"]
cache: ["cache", "qdrant"]
provider: ["provider", "ollama", "openrouter"]
network: ["network", "econnrefused", "timeout"]
validation: ["validation", "invalid"]
system: (padrão para tudo que não match)
```

## Exemplos Práticos

### Dashboard com Erros Reais

```typescript
// cli-mode.ts
async function getRecentCommands() {
  const { errorTracker } = await import("./error-tracker");
  const errors = errorTracker.getRecentErrors(5);

  return errors.map((err) => ({
    timestamp: err.timestamp,
    command: `[${err.type.toUpperCase()}] ${err.message}`,
    status: "error" as const,
  }));
}
```

### Monitoramento de Saúde

```typescript
// health-check.ts
import { errorTracker } from "./error-tracker";

function checkSystemHealth() {
  const stats = errorTracker.getStats();

  if (stats.total > 30) {
    console.warn("High error count detected!");
  }

  if (errorTracker.hasRecentErrors()) {
    console.warn("Recent errors in last 5 minutes");
  }

  return {
    healthy: stats.total < 10,
    errorRate: stats.total / 50,
    recentErrors: errorTracker.hasRecentErrors(),
  };
}
```

### Análise de Erros por Tipo

```typescript
import { errorTracker } from "./error-tracker";

function analyzeErrors() {
  const stats = errorTracker.getStats();

  console.log("Error Distribution:");
  console.log(`  API:        ${stats.api}`);
  console.log(`  Cache:      ${stats.cache}`);
  console.log(`  Provider:   ${stats.provider}`);
  console.log(`  Network:    ${stats.network}`);
  console.log(`  Validation: ${stats.validation}`);
  console.log(`  System:     ${stats.system}`);
}
```

## Testes

Suite completa de testes em `/opt/fazai/tests/unit/error-tracker.test.ts`:

```bash
npm run test:unit -- tests/unit/error-tracker.test.ts
```

**Coverage**: 10 testes, 100% de cobertura das funções principais.

## Arquitetura

```
┌─────────────┐
│   logger    │  (logger.error())
└─────┬───────┘
      │ auto-capture
      ▼
┌─────────────────┐
│ error-tracker   │  (singleton)
│  - errors[]     │  (max 50)
│  - captureError │
│  - getRecent    │
│  - getStats     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   dashboard     │  (/dashboard)
│  - Recent Errors│
│  - Error Stats  │
└─────────────────┘
```

## Diferenças vs Command History

| Feature | Command History | Error Tracker |
|---------|----------------|---------------|
| Propósito | Histórico de comandos digitados | Erros reais do sistema |
| Fonte | Readline input | logger.error() calls |
| Tipo | Comandos bem-sucedidos + falhas | Apenas erros |
| Limite | Ilimitado (arquivo) | 50 (memória) |
| Dashboard | Não exibido | Exibido em "Recent Errors" |

## Changelog

- **v3.6.13-beta** (2025-12-17) - Implementação inicial
  - Sistema de tracking em memória
  - 6 tipos de erro classificados
  - Integração automática com logger
  - Dashboard CLI exibindo erros reais
