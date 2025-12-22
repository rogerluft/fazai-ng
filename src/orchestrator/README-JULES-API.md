# Jules API Client

Cliente TypeScript completo para integração com a Jules API REST do Google.

## Visão Geral

O Jules é um agente de engenharia de software da Google que pode executar tarefas de desenvolvimento de forma autônoma. Este cliente fornece uma interface type-safe para interagir com a API REST do Jules.

## Instalação e Configuração

### 1. Obter API Key

Acesse [Google AI Studio](https://aistudio.google.com/apikey) e gere uma chave de API.

### 2. Configurar no FazAI

```bash
fazai config set JULES_API_KEY "sua-chave-aqui"
```

### 3. Verificar configuração

```bash
fazai config list | grep JULES_API_KEY
```

## Uso Básico

### Importar o cliente

```typescript
import { JulesAPIClient, createJulesAPIClient, julesApiClient } from './jules-api-client';

// Opção 1: Criar nova instância
const client = new JulesAPIClient();

// Opção 2: Usar factory function
const client = createJulesAPIClient();

// Opção 3: Usar singleton
const client = julesApiClient.instance;
```

### Listar repositórios disponíveis

```typescript
const sources = await client.listSources();

for (const source of sources.sources) {
  console.log(`${source.displayName}: ${source.name}`);
}
```

### Criar sessão de trabalho

```typescript
const session = await client.createSession(
  'Fix the authentication bug in src/auth/login.ts',
  {
    source: 'sources/github/myorg/myrepo',
    githubRepoContext: {
      startingBranch: 'main',
      targetBranch: 'fix/auth-bug'
    }
  }
);

console.log(`Sessão criada: ${session.name}`);
console.log(`Estado: ${session.state}`);
```

### Enviar mensagens

```typescript
const response = await client.sendMessage(
  'sessions/abc123',
  'Please also add unit tests for this fix'
);

console.log(`Estado: ${response.state}`);
console.log(`Resposta: ${response.response}`);
```

### Monitorar sessão

```typescript
const session = await client.getSession('sessions/abc123');

console.log(`Estado atual: ${session.state}`);
console.log(`Última atualização: ${session.updateTime}`);

if (session.plan) {
  console.log('Plano:', session.plan);
}
```

### Listar sessões

```typescript
const sessions = await client.listSessions();

console.log(`Total de sessões: ${sessions.sessions.length}`);

// Filtrar por estado
const activeSessions = sessions.sessions.filter(s => s.state === 'ACTIVE');
console.log(`Sessões ativas: ${activeSessions.length}`);
```

### Deletar sessão

```typescript
await client.deleteSession('sessions/abc123');
console.log('Sessão deletada');
```

## Workflows Avançados

### Workflow Completo: Bug Fix

```typescript
// 1. Criar sessão
const session = await client.createSession(
  'Fix payment validation bug in src/payments/processor.ts',
  {
    source: 'sources/github/company/payment-service',
    githubRepoContext: {
      startingBranch: 'main',
      targetBranch: 'hotfix/payment-validation'
    }
  }
);

const sessionId = JulesAPIClient.extractSessionId(session.name);

// 2. Enviar feedback
await client.sendMessage(sessionId, 'Also add integration tests');

// 3. Monitorar até conclusão
while (true) {
  const current = await client.getSession(sessionId);

  if (current.state === 'COMPLETED') {
    console.log('✅ Concluído!');
    break;
  }

  if (current.state === 'FAILED') {
    console.log('❌ Falhou!');
    break;
  }

  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

### Workflow: Feature Implementation

```typescript
const session = await client.createSession(
  `Implement user notification system:
  - Email notifications for order updates
  - Webhook support
  - User preferences
  - Admin dashboard

  Requirements:
  - Tests coverage > 80%
  - OpenAPI documentation
  - Database migrations`,
  {
    source: 'sources/github/company/backend',
    githubRepoContext: {
      startingBranch: 'develop',
      targetBranch: 'feature/notifications'
    }
  }
);
```

## API Reference

### JulesAPIClient

#### Constructor

```typescript
new JulesAPIClient(apiKey?: string, baseUrl?: string)
```

- `apiKey`: API key (opcional, lê de JULES_API_KEY se não fornecido)
- `baseUrl`: URL customizada (padrão: https://jules.googleapis.com/v1alpha)

#### Métodos

##### listSources(pageSize?, pageToken?)

Lista repositórios disponíveis.

**Parâmetros:**
- `pageSize` (number): Resultados por página (padrão: 50)
- `pageToken` (string): Token de paginação

**Retorna:** `Promise<ListSourcesResponse>`

##### createSession(prompt, sourceContext)

Cria nova sessão de trabalho.

**Parâmetros:**
- `prompt` (string): Descrição da tarefa
- `sourceContext` (SourceContext): Contexto do repositório

**Retorna:** `Promise<Session>`

##### sendMessage(sessionId, message)

Envia mensagem para sessão.

**Parâmetros:**
- `sessionId` (string): ID da sessão
- `message` (string): Mensagem

**Retorna:** `Promise<SendMessageResponse>`

##### getSession(sessionId)

Obtém detalhes da sessão.

**Parâmetros:**
- `sessionId` (string): ID da sessão

**Retorna:** `Promise<Session>`

##### listSessions(pageSize?, pageToken?)

Lista sessões.

**Parâmetros:**
- `pageSize` (number): Resultados por página (padrão: 50)
- `pageToken` (string): Token de paginação

**Retorna:** `Promise<ListSessionsResponse>`

##### deleteSession(sessionId)

Deleta sessão.

**Parâmetros:**
- `sessionId` (string): ID da sessão

**Retorna:** `Promise<void>`

### Métodos Estáticos Helper

#### JulesAPIClient.extractSessionId(sessionName)

Remove prefixo "sessions/" de um nome de sessão.

```typescript
JulesAPIClient.extractSessionId('sessions/abc123'); // 'abc123'
```

#### JulesAPIClient.formatSessionName(sessionId)

Adiciona prefixo "sessions/" a um ID de sessão.

```typescript
JulesAPIClient.formatSessionName('abc123'); // 'sessions/abc123'
```

## Interfaces TypeScript

### Source

```typescript
interface Source {
  name: string;                // sources/github/owner/repo
  displayName: string;         // Nome legível
  description?: string;        // Descrição opcional
}
```

### Session

```typescript
interface Session {
  name: string;                // sessions/{sessionId}
  state: string;               // ACTIVE, COMPLETED, FAILED, etc.
  createTime: string;          // ISO timestamp
  updateTime?: string;         // ISO timestamp
  plan?: string;               // Plano de execução
  messages?: Message[];        // Histórico
}
```

### SourceContext

```typescript
interface SourceContext {
  source: string;                          // sources/github/owner/repo
  githubRepoContext?: {
    startingBranch: string;                // main, develop, etc.
    targetBranch?: string;                 // Branch de destino
  };
}
```

## Tratamento de Erros

```typescript
try {
  const session = await client.createSession(...);
} catch (error: any) {
  if (error.message.includes('Jules API error')) {
    // Erro da API
    const match = error.message.match(/\[(\d+)\]/);
    if (match) {
      const code = parseInt(match[1]);

      switch (code) {
        case 401:
          console.error('API key inválida');
          break;
        case 403:
          console.error('Sem permissão');
          break;
        case 404:
          console.error('Recurso não encontrado');
          break;
        case 429:
          console.error('Rate limit excedido');
          break;
      }
    }
  } else {
    // Erro de rede
    console.error('Erro de conexão:', error.message);
  }
}
```

## Estados de Sessão

| Estado | Descrição |
|--------|-----------|
| `ACTIVE` | Sessão em execução |
| `COMPLETED` | Tarefa concluída com sucesso |
| `FAILED` | Tarefa falhou |
| `PENDING` | Aguardando início |
| `CANCELLED` | Cancelada pelo usuário |

## Exemplos Práticos

Veja o arquivo `jules-api-examples.ts` para exemplos completos de:

1. Listar repositórios
2. Criar sessão
3. Interagir com sessão
4. Monitorar até conclusão
5. Gerenciar sessões
6. Workflow completo de bug fix
7. Uso com singleton
8. Tratamento de erros
9. Sessões complexas

## Logging

O cliente usa o logger padrão do FazAI:

```typescript
// Debug (detalhes de requisições)
logger.debug('Jules API request: POST /sessions');

// Info (ações principais)
logger.info('Sessão criada: sessions/abc123');

// Warn (respostas não-JSON)
logger.warn('Resposta não é JSON válido');

// Error (falhas)
logger.error('Jules API error [403]: Permission denied');
```

Para habilitar logs de debug:

```bash
export FAZAI_LOG_LEVEL=debug
fazai config set LOG_LEVEL debug
```

## Integração com FazAI

### CLI Command (futuro)

```bash
# Criar sessão
fazai jules create "Fix bug in auth.ts" --repo=myorg/myrepo

# Listar sessões
fazai jules list

# Status de sessão
fazai jules status sessions/abc123

# Enviar mensagem
fazai jules message sessions/abc123 "Add tests"

# Deletar sessão
fazai jules delete sessions/abc123
```

### Orquestrador

```typescript
import { JulesAPIClient } from './jules-api-client';
import { delegateToJules as delegateToCLI } from './jules-client';

// Decisão: API vs CLI
const useAPI = process.env.JULES_USE_API === 'true';

if (useAPI) {
  // Via API REST
  const client = new JulesAPIClient();
  const session = await client.createSession(prompt, context);
} else {
  // Via CLI (método original)
  const response = await delegateToCLI(task);
}
```

## Limitações e Considerações

### Rate Limits

- A API Jules pode ter rate limits
- Implemente retry logic com backoff exponencial
- Monitore headers de rate limit

### Timeouts

- Operações longas podem levar minutos
- Implemente polling adequado (5-10s entre checks)
- Configure timeouts apropriados

### Autenticação

- API key nunca deve ser commitada
- Use variáveis de ambiente ou config seguro
- Rotacione keys periodicamente

### Custos

- Verifique pricing da API Jules
- Monitore uso através do console Google Cloud
- Implemente mecanismos de controle de custos

## Testes

```bash
# Rodar testes
npm test jules-api-client.test.ts

# Com coverage
npm test -- --coverage jules-api-client.test.ts
```

## Contribuindo

Ao adicionar novas funcionalidades:

1. Adicione tipos TypeScript apropriados
2. Implemente tratamento de erros
3. Adicione JSDoc comments em português
4. Escreva testes unitários
5. Atualize este README
6. Adicione exemplos em `jules-api-examples.ts`

## Changelog

### v1.0.0 (2025-12-22)

- ✨ Implementação inicial do Jules API Client
- 🔧 Suporte completo para CRUD de sessões
- 📝 Documentação completa e exemplos
- ✅ 18 testes unitários (100% coverage)
- 🔐 Integração com sistema de config do FazAI
- 📊 Logging estruturado
- 🛡️ Type-safe com TypeScript strict mode

## Referências

- [Jules API Documentation](https://jules.googleapis.com/v1alpha)
- [Google AI Studio](https://aistudio.google.com)
- [FazAI Documentation](../docs/)

## Suporte

Para issues ou dúvidas:

1. Verifique logs: `/var/log/fazai/YYYY-MM-DD.log`
2. Valide API key: `fazai config list | grep JULES`
3. Teste conectividade: `curl -H "X-Goog-Api-Key: KEY" https://jules.googleapis.com/v1alpha/sources`

---

**Desenvolvido por:** Roger Luft (Roginho)
**Projeto:** FazAI v3.8.0
**Licença:** MIT
