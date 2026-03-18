# Fix 9 Failing Tests - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir os 9 testes falhando para atingir 100% de testes passando (196/196).

**Architecture:** Os testes falham por 3 motivos distintos: (1) mocks incorretos para async generators, (2) mocks de web search não configurados, (3) dados não persistidos no Qdrant de teste.

**Tech Stack:** Vitest, TypeScript, Qdrant, async generators

---

## Análise dos 9 Testes Falhando

| # | Arquivo | Teste | Causa Raiz |
|---|---------|-------|------------|
| 1 | cli.test.ts | /exec command parsing | Mock de getLinuxCommandsFromAI não chamado |
| 2 | cli.test.ts | multi-line /exec | Mock de getLinuxCommandsFromAI não chamado |
| 3 | cli.test.ts | web search intent | Mock de web search retorna formato errado |
| 4 | cli.test.ts | web search no results | Mock de web search não configurado |
| 5 | cli.test.ts | web search error handling | Mock de web search não configurado |
| 6 | cli.test.ts | session timeout | Mock não sendo chamado |
| 7 | resilience-orchestrator.test.ts | nível 1 IA primária | Mock de callAI precisa ser async generator |
| 8 | resilience-orchestrator.test.ts | nível 2 IA fallback | Mock de callAI precisa ser async generator |
| 9 | conversation-importer.test.ts | dados no Qdrant | Upsert não está funcionando na collection de teste |

---

## Task 1: Fix Resilience Orchestrator Tests (2 falhas)

**Files:**
- Modify: `tests/resilience-orchestrator.test.ts`

**Problema:** O `callAI` é um async generator que usa `yield`, mas o mock atual não suporta isso.

**Step 1: Ler o teste atual**

```bash
cat tests/resilience-orchestrator.test.ts | head -100
```

**Step 2: Identificar o mock atual do callAI**

Procurar por `vi.mock` ou `mockImplementation` relacionado a callAI.

**Step 3: Substituir mock por async generator**

```typescript
vi.mock('../src/call-ai', () => ({
  callAI: vi.fn().mockImplementation(async function* () {
    yield { type: 'text', content: 'Resposta parcial' };
    yield { type: 'done', finalAnswer: 'Resposta final da IA' };
  }),
}));
```

**Step 4: Rodar testes específicos**

```bash
npm test -- tests/resilience-orchestrator.test.ts
```

**Step 5: Commit**

```bash
git add tests/resilience-orchestrator.test.ts
git commit -m "fix(test): use async generator mock for callAI"
```

---

## Task 2: Fix CLI /exec Tests (2 falhas)

**Files:**
- Modify: `tests/cli.test.ts`

**Problema:** O mock de `getLinuxCommandsFromAI` não está sendo chamado corretamente.

**Step 1: Ler os testes de /exec**

```bash
grep -A30 "should correctly parse the /exec command" tests/cli.test.ts
```

**Step 2: Verificar como getLinuxCommandsFromAI é mockado**

```bash
grep -n "getLinuxCommandsFromAI" tests/cli.test.ts
```

**Step 3: Ajustar o mock para retornar estrutura esperada**

O mock precisa retornar um array de LinuxCommand válido.

**Step 4: Rodar testes específicos**

```bash
npm test -- tests/cli.test.ts -t "exec"
```

**Step 5: Commit**

```bash
git add tests/cli.test.ts
git commit -m "fix(test): correct getLinuxCommandsFromAI mock in CLI tests"
```

---

## Task 3: Fix CLI Web Search Tests (3 falhas)

**Files:**
- Modify: `tests/cli.test.ts`

**Problema:** Mock de web search não está configurado ou retorna formato incorreto.

**Step 1: Ler os testes de search**

```bash
grep -A30 "should trigger web search" tests/cli.test.ts
```

**Step 2: Identificar a função de search que precisa ser mockada**

Provavelmente `ResearchCoordinator` ou similar.

**Step 3: Configurar mock correto**

```typescript
vi.mock('../src/research', () => ({
  ResearchCoordinator: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue([
      { title: 'Result 1', link: 'http://example.com', snippet: 'Test' }
    ])
  }))
}));
```

**Step 4: Rodar testes específicos**

```bash
npm test -- tests/cli.test.ts -t "search"
```

**Step 5: Commit**

```bash
git add tests/cli.test.ts
git commit -m "fix(test): configure web search mock in CLI tests"
```

---

## Task 4: Fix CLI Session Timeout Test (1 falha)

**Files:**
- Modify: `tests/cli.test.ts`

**Problema:** Mock não está sendo chamado durante timeout handling.

**Step 1: Ler o teste de timeout**

```bash
grep -A50 "should handle a mixed session" tests/cli.test.ts
```

**Step 2: Verificar se fake timers estão configurados**

O teste pode precisar de `vi.useFakeTimers()` e `vi.advanceTimersByTime()`.

**Step 3: Ajustar teste**

Garantir que o mock é chamado antes do timeout.

**Step 4: Rodar teste específico**

```bash
npm test -- tests/cli.test.ts -t "timeout"
```

**Step 5: Commit**

```bash
git add tests/cli.test.ts
git commit -m "fix(test): handle timeout mock in CLI session test"
```

---

## Task 5: Fix Conversation Importer Qdrant Test (1 falha)

**Files:**
- Modify: `tests/integration/conversation-importer.test.ts`

**Problema:** `scrollResult.points.length === 0` quando deveria ser > 0.

**Step 1: Verificar se collection de teste existe**

```bash
grep -n "createCollection\|TEST_COLLECTION" tests/integration/conversation-importer.test.ts
```

**Step 2: Verificar se upsert está sendo chamado**

```bash
grep -n "upsert\|insert" tests/integration/conversation-importer.test.ts
```

**Step 3: Adicionar wait após upsert**

Qdrant pode precisar de tempo para indexar:

```typescript
await new Promise(resolve => setTimeout(resolve, 100));
```

**Step 4: Verificar scroll na collection correta**

```typescript
const scrollResult = await client.scroll(TEST_COLLECTION, { limit: 10 });
console.log('Points found:', scrollResult.points.length);
```

**Step 5: Rodar teste específico**

```bash
npm test -- tests/integration/conversation-importer.test.ts -t "dados foram inseridos"
```

**Step 6: Commit**

```bash
git add tests/integration/conversation-importer.test.ts
git commit -m "fix(test): ensure Qdrant data is indexed before assertion"
```

---

## Ordem de Execução Recomendada

1. **Task 1** (Resilience Orchestrator) - Mais isolado, fácil de testar
2. **Task 5** (Conversation Importer) - Teste de integração, pode revelar problemas reais
3. **Task 2** (CLI /exec) - Depende de entender o fluxo do CLI
4. **Task 3** (CLI Search) - Similar ao anterior
5. **Task 4** (CLI Timeout) - Mais complexo, pode precisar de refatoração

---

## Critérios de Sucesso

- [ ] 196 testes passando (0 falhando)
- [ ] Nenhum teste skipped desnecessariamente
- [ ] Mocks refletem comportamento real das funções
- [ ] Commits atômicos por cada fix
