# Test Helpers

Utilitários para facilitar a escrita de testes no FazAI.

---

## Qdrant Helper

Helper para testes que dependem do Qdrant estar online. Testes são automaticamente pulados quando o serviço está offline.

### Instalação

```typescript
import {
  isQdrantAvailable,
  describeIfQdrant,
  itIfQdrant,
  getQdrantClientForTests,
  collectionExists,
  cleanCollectionForTests,
  clearQdrantAvailabilityCache,
  QDRANT_URL,
} from './helpers/qdrant-helper';
```

### Funções Disponíveis

#### `isQdrantAvailable(): Promise<boolean>`

Verifica se o Qdrant está disponível e respondendo.

```typescript
const available = await isQdrantAvailable();
if (available) {
  console.log('Qdrant online');
} else {
  console.log('Qdrant offline');
}
```

**Características:**
- Timeout de 2 segundos
- Resultado é cacheado (evita múltiplas verificações)
- Retorna `false` em caso de erro ou timeout

---

#### `describeIfQdrant(name: string, fn: () => void): void`

Wrapper para `describe()` que pula toda a suite se Qdrant estiver offline.

```typescript
describeIfQdrant('Vector Store Tests', () => {
  it('deve criar embedding', async () => {
    const client = await getQdrantClientForTests();
    // teste
  });

  it('deve buscar vetores similares', async () => {
    // teste
  });
});
```

**Uso recomendado:** Quando TODOS os testes da suite precisam do Qdrant.

---

#### `itIfQdrant(name: string, fn: TestFunction, timeout?: number): void`

Wrapper para `it()` que pula teste individual se Qdrant estiver offline.

```typescript
describe('Meus testes', () => {
  it('teste que não precisa do Qdrant', () => {
    expect(2 + 2).toBe(4);
  });

  itIfQdrant('teste que precisa do Qdrant', async () => {
    const client = await getQdrantClientForTests();
    const collections = await client.getCollections();
    expect(collections).toBeDefined();
  });
});
```

**Uso recomendado:** Quando apenas ALGUNS testes precisam do Qdrant.

---

#### `getQdrantClientForTests(): Promise<QdrantClient>`

Cria um cliente Qdrant configurado para testes. Lança erro se Qdrant não estiver disponível.

```typescript
const client = await getQdrantClientForTests();
const collections = await client.getCollections();
```

**Configurações:**
- URL: `QDRANT_URL` (padrão: `http://localhost:6333`)
- Valida disponibilidade antes de retornar

---

#### `collectionExists(collectionName: string): Promise<boolean>`

Verifica se uma collection existe no Qdrant.

```typescript
if (await collectionExists('fazai_memory')) {
  console.log('Collection existe');
}
```

---

#### `cleanCollectionForTests(collectionName: string): Promise<void>`

Deleta uma collection (útil para limpar estado entre testes). **CUIDADO:** Não usar em produção!

```typescript
beforeEach(async () => {
  await cleanCollectionForTests('test_collection');
});
```

---

#### `clearQdrantAvailabilityCache(): void`

Limpa o cache de disponibilidade do Qdrant. Útil para forçar nova verificação.

```typescript
clearQdrantAvailabilityCache();
const available = await isQdrantAvailable(); // nova verificação
```

---

### Constantes

#### `QDRANT_URL: string`

URL do Qdrant. Pode ser configurada via variável de ambiente:

```bash
export QDRANT_URL="http://192.168.0.101:6333"
npm test
```

**Padrão:** `http://localhost:6333`

---

### Exemplos de Uso

#### Exemplo 1: Suite completa que depende do Qdrant

```typescript
import { describeIfQdrant, getQdrantClientForTests } from './helpers/qdrant-helper';
import type { QdrantClient } from '@qdrant/js-client-rest';

describeIfQdrant('Semantic Cache Tests', () => {
  let client: QdrantClient;

  beforeAll(async () => {
    client = await getQdrantClientForTests();
  });

  it('deve armazenar embedding', async () => {
    await client.upsert('test_collection', {
      points: [{ id: '1', vector: [0.1, 0.2], payload: {} }],
    });
  });

  it('deve buscar embedding', async () => {
    const results = await client.search('test_collection', {
      vector: [0.1, 0.2],
      limit: 5,
    });
    expect(results.length).toBeGreaterThan(0);
  });
});
```

**Resultado:** Se Qdrant offline, toda a suite é pulada com warning claro.

---

#### Exemplo 2: Testes mistos (alguns precisam, outros não)

```typescript
import { itIfQdrant, getQdrantClientForTests } from './helpers/qdrant-helper';

describe('RAG Service Tests', () => {
  it('deve validar entrada', () => {
    const input = validateInput('query');
    expect(input).toBe('query');
  });

  itIfQdrant('deve gerar embedding e buscar', async () => {
    const client = await getQdrantClientForTests();
    const embedding = await generateEmbedding('test');
    const results = await client.search('kb', {
      vector: embedding,
      limit: 5,
    });
    expect(results).toBeDefined();
  });

  it('deve formatar resposta', () => {
    const response = formatResponse({ data: 'test' });
    expect(response).toBeDefined();
  });
});
```

**Resultado:** Apenas o teste do meio é pulado se Qdrant estiver offline.

---

#### Exemplo 3: Verificação manual

```typescript
import { isQdrantAvailable, getQdrantClientForTests } from './helpers/qdrant-helper';

describe('Custom behavior', () => {
  it('executa lógica customizada baseada em disponibilidade', async () => {
    const available = await isQdrantAvailable();

    if (available) {
      const client = await getQdrantClientForTests();
      // testa com Qdrant real
    } else {
      // usa mock
      console.log('Usando mock ao invés de Qdrant');
    }

    expect(true).toBe(true);
  });
});
```

---

### Comportamento de SKIP

Quando Qdrant está offline, os testes são marcados como **skipped** (não falham):

```
⚠️  SKIP: "Vector Store Tests" - Qdrant não disponível em http://localhost:6333

 ✓ tests/example.test.ts (5 tests | 2 skipped)
   ✓ teste normal
   ↓ teste que precisa do Qdrant (SKIPPED)
   ✓ outro teste normal
```

---

### Performance

- **Cache inteligente:** Primeira verificação é armazenada
- **Timeout rápido:** 2 segundos de timeout
- **Sem overhead:** Testes que não usam Qdrant não são afetados

---

### Troubleshooting

#### Todos os testes são pulados, mas Qdrant está rodando

1. Verifique a URL:
   ```bash
   echo $QDRANT_URL
   curl http://localhost:6333/collections
   ```

2. Limpe o cache no teste:
   ```typescript
   import { clearQdrantAvailabilityCache } from './helpers/qdrant-helper';

   beforeAll(() => {
     clearQdrantAvailabilityCache();
   });
   ```

#### Quero que testes falhem se Qdrant estiver offline

Use `describe` e `it` normais + `beforeAll` para verificar:

```typescript
describe('Tests that REQUIRE Qdrant', () => {
  beforeAll(async () => {
    const available = await isQdrantAvailable();
    if (!available) {
      throw new Error('Qdrant MUST be online for these tests');
    }
  });

  it('teste', async () => {
    // teste
  });
});
```

---

### Arquivo de Exemplo

Veja exemplos completos em:
```
/home/rluft/fazai-ng/tests/helpers/qdrant-helper.example.test.ts
```

Execute:
```bash
npm test -- tests/helpers/qdrant-helper.example.test.ts
```

---

### Informações Técnicas

| Propriedade | Valor |
|------------|-------|
| Timeout | 2000ms |
| Cache | Sim (limpar com `clearQdrantCache()`) |
| URL padrão | `http://localhost:6333` |
| Variável de ambiente | `QDRANT_URL` |
| Compatibilidade | Vitest 4.x |

---

**Criado por:** ClaudiÃO
**Versão:** 1.0.0
**Data:** 2025-12-21
