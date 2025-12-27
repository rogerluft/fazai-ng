# TAREFA JULES: Corrigir 9 Testes Falhando

## Estado Atual
- 180 testes passando
- 9 testes falhando
- 4 testes skipped

## Falhas Detalhadas

### 1. CLI Tests (6 falhas) - `tests/cli.test.ts`

#### 1.1 Command Parsing: /exec
- Linha ~150
- Problema: comando /exec não está sendo parseado corretamente

#### 1.2 Search Functionality: web search triggers
- Linha ~200
- Problema: mock do web search não está retornando formato esperado

#### 1.3 Session Integration: timeout handling (4 casos)
- Linhas ~250-300
- Problema: timeout não está sendo tratado corretamente em sessões longas

### 2. Resilience Orchestrator (2 falhas) - `tests/resilience-orchestrator.test.ts`

#### 2.1 Nível 1 (IA primária) - Linha 49
```typescript
expect(result.success).toBe(true);
expect(result.level).toBe('fallback_ai');
```
- Problema: mock do callAI precisa ser async generator
- O callAI usa `yield` para streaming, mock atual não suporta

#### 2.2 Nível 2 (IA secundária fallback) - Similar ao anterior

**Solução sugerida:**
```typescript
vi.mock('../src/call-ai', () => ({
  callAI: vi.fn().mockImplementation(async function* () {
    yield { type: 'text', content: 'Resposta' };
    yield { type: 'done', finalAnswer: 'Resposta da IA' };
  }),
}));
```

### 3. Conversation Importer (1 falha) - `tests/integration/conversation-importer.test.ts`

#### 3.1 "deve validar que dados foram inseridos no Qdrant" - Linha 238
```typescript
expect(scrollResult.points.length).toBeGreaterThan(0);
// Retorna 0, esperado > 0
```

- Problema: dados não estão sendo inseridos na collection de teste
- Verificar:
  1. Collection está sendo criada?
  2. Upsert está funcionando?
  3. Scroll está na collection correta?

## Arquivos Relevantes

- `src/call-ai.ts` - Implementação do callAI (async generator)
- `src/resilience-orchestrator.ts` - Orquestrador de resiliência
- `src/conversation-importer.ts` - Importador de conversas
- `src/cli.ts` - Comandos CLI

## Padrão de Mock Correto para Async Generator

```typescript
// Para funções que usam yield (async generators)
const mockAsyncGenerator = async function* (responses: any[]) {
  for (const response of responses) {
    yield response;
  }
};

vi.mock('../src/call-ai', () => ({
  callAI: vi.fn().mockReturnValue(mockAsyncGenerator([
    { type: 'text', content: 'Chunk 1' },
    { type: 'text', content: 'Chunk 2' },
    { type: 'done', finalAnswer: 'Resposta Final' },
  ])),
}));
```

## Critérios de Aceitação

1. [ ] Todos os 189 testes passando
2. [ ] Nenhum teste skipped desnecessariamente
3. [ ] Mocks refletem comportamento real das funções
4. [ ] Sem dependência de serviços externos nos testes unitários
