# Testes - Terminal FazAI v3.1-beta

Suite de testes REAL com integração Qdrant e testes unitários.

**IMPORTANTE:** Esses NÃO são mocks ou simulações. Todos os testes de integração conectam em um Qdrant real rodando em `localhost:6333`.

## Pré-requisitos

### 1. Instalar Dependências

```bash
npm install
```

### 2. Qdrant Rodando (para testes de integração)

```bash
# Docker
docker run -d -p 6333:6333 qdrant/qdrant

# Ou Podman
podman run -d -p 6333:6333 qdrant/qdrant

# Verificar
curl http://localhost:6333/collections
```

## Executar Testes

### Todos os Testes

```bash
npm test
```

### Apenas Testes Unitários

```bash
npm run test:unit
```

### Apenas Testes de Integração

```bash
npm run test:integration
```

### Modo Watch (desenvolvimento)

```bash
npm run test:watch
```

### UI Interativa

```bash
npm run test:ui
```

### Com Coverage

```bash
npm run test:coverage
```

## Estrutura de Testes

```
tests/
├── unit/                          # Testes unitários (sem dependências externas)
│   └── config.test.ts             # Sistema de configuração
│
├── integration/                   # Testes de integração (Qdrant real)
│   ├── qdrant-connection.test.ts # Conexão e operações básicas Qdrant
│   ├── vector-store.test.ts      # Criação das 5 collections FazAI
│   └── conversation-importer.test.ts # Importação de conversas
│
└── README.md                      # Este arquivo
```

## Descrição dos Testes

### Unit Tests

#### `tests/unit/config.test.ts`

Testa o sistema de configuração:
- ✅ Leitura de arquivos INI
- ✅ Parser de chave=valor
- ✅ Ignorar comentários
- ✅ Lidar com valores com `=`
- ✅ Criação de diretórios
- ✅ Prioridade de caminhos
- ✅ Atualização de valores

**Execução:**
```bash
npm run test:unit
```

### Integration Tests

#### `tests/integration/qdrant-connection.test.ts`

Testa conexão e operações básicas com Qdrant REAL:
- ✅ Conectar no Qdrant
- ✅ Criar collection
- ✅ Inserir ponto
- ✅ Busca vetorial
- ✅ Deletar ponto
- ✅ Deletar collection

**Requisitos:**
- Qdrant rodando em `localhost:6333`

**Execução:**
```bash
# Iniciar Qdrant primeiro
docker run -d -p 6333:6333 qdrant/qdrant

# Rodar teste
npm test -- tests/integration/qdrant-connection.test.ts
```

#### `tests/integration/vector-store.test.ts`

Testa criação das 5 collections do FazAI:
- ✅ Criar `fazai_personality` com schema
- ✅ Criar `fazai_memory` com schema
- ✅ Criar `fazai_learning` com schema
- ✅ Criar `fazai_kb` com schema
- ✅ Criar `fazai_inference` com schema
- ✅ Validar schemas de cada collection
- ✅ Busca vetorial em fazai_kb
- ✅ Verificar que todas as 5 collections existem

**Requisitos:**
- Qdrant rodando em `localhost:6333`

**Execução:**
```bash
npm test -- tests/integration/vector-store.test.ts
```

#### `tests/integration/conversation-importer.test.ts`

Testa importação REAL de conversas:
- ✅ Importar conversas Claude Desktop (JSON)
- ✅ Importar conversas ChatGPT Desktop (JSON)
- ✅ Extração de conhecimento técnico para `fazai_kb`
- ✅ Importação em lote (diretório recursivo)
- ✅ Validar que dados foram inseridos no Qdrant
- ✅ Lidar com erro (arquivo não existe)
- ✅ Lidar com JSON inválido

**Requisitos:**
- Qdrant rodando em `localhost:6333`
- Collections `fazai_memory`, `fazai_kb`, `fazai_learning` criadas

**Execução:**
```bash
# Criar collections primeiro
npm run build
node dist/app.cjs vector validate

# Rodar teste
npm test -- tests/integration/conversation-importer.test.ts
```

## Características dos Testes

### 🚫 SEM MOCKS

Todos os testes de integração conectam em um Qdrant real. Nada é simulado:
- ✅ Cliente Qdrant REAL (`@qdrant/js-client-rest`)
- ✅ Conexão TCP real para localhost:6333
- ✅ Collections criadas de verdade
- ✅ Dados inseridos de verdade
- ✅ Buscas vetoriais executadas de verdade

### 🧹 Auto-Limpeza

Todos os testes de integração limpam após execução:
- `beforeAll`: Deleta collections de teste se existirem
- `afterAll`: Deleta todas as collections de teste criadas

### 📝 Nomes de Teste

Collections de teste têm prefixo `fazai_test_`:
- `fazai_test_fazai_personality`
- `fazai_test_fazai_memory`
- Etc.

Isso evita conflito com collections reais do FazAI.

## Troubleshooting

### Teste falha: "Could not resolve Qdrant"

**Problema:** Qdrant não está rodando.

**Solução:**
```bash
# Verificar se está rodando
curl http://localhost:6333/collections

# Se não estiver, iniciar:
docker run -d -p 6333:6333 qdrant/qdrant

# Aguardar inicialização (5-10s)
sleep 10
curl http://localhost:6333/collections
```

### Teste falha: "Connection refused"

**Problema:** Porta 6333 não está acessível.

**Solução:**
```bash
# Verificar se porta está aberta
sudo netstat -tulpn | grep 6333

# Verificar firewall
sudo ufw allow 6333/tcp  # Ubuntu/Debian
sudo firewall-cmd --add-port=6333/tcp  # RHEL/CentOS

# Verificar container Qdrant
docker ps | grep qdrant
docker logs <container-id>
```

### Teste falha: "Timeout"

**Problema:** Qdrant está lento ou sobrecarregado.

**Solução:**
```bash
# Aumentar timeout no vitest.config.ts
# testTimeout: 60000  # 60s

# Ou aumentar recursos do container
docker run -d -p 6333:6333 \
  -m 2g \
  --cpus="2" \
  qdrant/qdrant
```

### Testes passam mas dados persistem

**Problema:** `afterAll` não executou.

**Solução:**
```bash
# Deletar collections de teste manualmente
curl -X DELETE http://localhost:6333/collections/fazai_test_fazai_memory
curl -X DELETE http://localhost:6333/collections/fazai_test_fazai_kb
curl -X DELETE http://localhost:6333/collections/fazai_test_fazai_learning
curl -X DELETE http://localhost:6333/collections/fazai_test_fazai_personality
curl -X DELETE http://localhost:6333/collections/fazai_test_fazai_inference
curl -X DELETE http://localhost:6333/collections/fazai_test_connection
```

## CI/CD

### GitHub Actions (exemplo)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      qdrant:
        image: qdrant/qdrant:latest
        ports:
          - 6333:6333
          - 6334:6334

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install
      - run: npm run build
      - run: npm run test:unit
      - run: npm run test:integration
```

## Adicionar Novos Testes

### Teste Unitário

```typescript
// tests/unit/meu-teste.test.ts
import { describe, it, expect } from 'vitest';

describe('Meu Módulo', () => {
  it('deve fazer algo', () => {
    const resultado = minhaFuncao();
    expect(resultado).toBe(valorEsperado);
  });
});
```

### Teste de Integração

```typescript
// tests/integration/meu-teste-integracao.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

describe('Meu Teste de Integração', () => {
  let client: QdrantClient;

  beforeAll(async () => {
    client = new QdrantClient({ url: QDRANT_URL });
    // Setup
  });

  afterAll(async () => {
    // Cleanup
  });

  it('deve testar algo real', async () => {
    const result = await client.getCollections();
    expect(result).toBeDefined();
  });
});
```

## Estatísticas de Cobertura

Para gerar relatório de coverage:

```bash
npm run test:coverage
```

Isso irá:
1. Executar todos os testes
2. Gerar relatório de cobertura
3. Mostrar % de código coberto
4. Criar `coverage/` com HTML report

## Boas Práticas

1. **✅ Sempre limpar após testes** - Use `afterAll` para deletar collections de teste
2. **✅ Use prefixos de teste** - Collections de teste devem ter `fazai_test_` prefix
3. **✅ Documente pré-requisitos** - Mencione se Qdrant precisa estar rodando
4. **✅ Teste com dados reais** - Sem mocks, insira dados reais no Qdrant
5. **✅ Timeouts generosos** - Integration tests podem ser lentos (30s+)
6. **✅ Teste casos de erro** - Não apenas happy path
7. **✅ Assertions claras** - Use mensagens descritivas

## Licença

Mesmo que o projeto principal (Apache 2.0).
