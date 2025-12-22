# Qdrant Connection Pool - Fluxograma e Lógica

**Arquivo:** `src/database/qdrant-pool.ts`
**Versão Atual:** v3.8.0 (com Circuit Breaker)

Este documento descreve o funcionamento interno do Pool de Conexões do Qdrant, detalhando a lógica de inicialização, retentativa (retry) e proteção sistêmica (circuit breaker).

---

## 1. Visão Geral

O `QdrantConnectionPool` é um Singleton responsável por gerenciar uma única instância do cliente Qdrant (`QdrantClient`) para toda a aplicação. Seus objetivos principais são:
1.  **Eficiência:** Evitar criar múltiplas conexões desnecessárias.
2.  **Resiliência:** Tentar reconectar automaticamente em caso de falha.
3.  **Proteção:** Impedir que falhas repetidas no banco derrubem a aplicação (Circuit Breaker).

---

## 2. Fluxograma de Obtenção do Cliente (`getClient()`)

Quando qualquer parte do sistema chama `qdrantPool.getClient()`, o seguinte fluxo é executado:

```mermaid
graph TD
    A[Início: getClient()] --> B{Está em Cooldown?}
    B -- Sim (Erro recente < 30s) --> C[Lançar Erro Imediato]
    B -- Não --> D{Cliente já existe?}
    
    D -- Sim --> E[Retornar Cliente Existente]
    D -- Não --> F{Inicialização em andamento?}
    
    F -- Sim --> G[Bloquear/Erro: Race Condition]
    F -- Não --> H[Iniciar Inicialização]
    
    subgraph "Inicialização (com Retry)"
        H --> I[Tentativa 1: _initialize()]
        I --> J{Sucesso?}
        J -- Sim --> K[Definir Estado: Connected]
        J -- Não --> L{Ainda tem retries? (Max 3)}
        L -- Sim --> M[Aguardar Delay]
        M --> I
        L -- Não --> N[Definir Estado: Error]
    end
    
    K --> O[Retornar Novo Cliente]
    N --> P[Ativar Circuit Breaker (Timestamp)]
    P --> Q[Lançar Erro Final]
```

---

## 3. Detalhe dos Mecanismos de Defesa

### 3.1. Retry Logic (Lógica de Retentativa)
Utiliza a função utilitária `withRetry`.
- **Tentativas Totais:** 4 (1 inicial + 3 retries).
- **Intervalo:** Começa com 500ms (backoff pode variar dependendo da implementação do `withRetry`).
- **Comportamento:** Se a conexão falhar (ex: `ECONNREFUSED`), ele espera e tenta de novo.
- **Objetivo:** Tolerância a falhas transientes de rede.

### 3.2. Circuit Breaker (Disjuntor)
Protege o sistema quando o Qdrant está fora do ar permanentemente.
- **Gatilho:** Falha em todas as 4 tentativas de inicialização.
- **Ação:**
  1.  Define estado como `error`.
  2.  Registra `lastErrorTimestamp`.
  3.  **IMPEDE** novas chamadas a `_initialize()` pelos próximos **30 segundos** (`COOL_DOWN_PERIOD`).
- **Resultado:** Qualquer chamada a `getClient()` durante esses 30s falha **instantaneamente** (sem tentar conectar), economizando CPU e evitando travamento de threads.

### 3.3. Health Check (Monitoramento)
Um timer roda a cada 5 minutos (`HEALTH_CHECK_INTERVAL`) se o cliente estiver conectado.
- **Ação:** Executa `client.getCollections()` (operação leve).
- **Sucesso:** Atualiza `lastHealthCheck`.
- **Falha:**
  - Loga aviso (`WARN`).
  - Define `client = null` e estado `disconnected`.
  - Isso força a próxima chamada a `getClient()` a tentar reconectar do zero (passando pelo fluxo de inicialização novamente).

---

## 4. Pontos Críticos de Falha (Análise de Bug)

**Onde o loop infinito pode ocorrer?**

1.  **Falha no Circuit Breaker:** Se o `lastErrorTimestamp` não for gravado corretamente, o sistema tentará reconectar a cada milissegundo.
2.  **Retry Infinito Externo:** Se o código que chama `getClient()` (ex: nos testes) tiver seu próprio loop de retentativa sem respeitar o erro do pool, ele vai martelar o Circuit Breaker repetidamente.
3.  **Race Conditions:** Se múltiplas threads chamarem `getClient()` ao mesmo tempo antes do estado `isInitializing` ser setado, podem ocorrer múltiplas tentativas paralelas de conexão.

---

## 5. Exemplo de Uso Seguro

```typescript
try {
  // Tenta obter o cliente (pode falhar rápido se estiver em cooldown)
  const client = await qdrantPool.getClient();
  await client.search(...);
} catch (error) {
  // IMPORTANTE: Não tentar reconectar imediatamente aqui!
  // O pool já gerenciou as retentativas.
  // Apenas logue e siga o fluxo de fallback (ex: usar Context7).
  logger.warn("Qdrant indisponível, usando fallback...");
  return fallbackSearch(...);
}
```
