/**
 * @file Jules API Client - Exemplos de Uso
 * @description Exemplos práticos de como usar o Jules API Client
 * @module src/orchestrator/jules-api-examples
 */

import { JulesAPIClient, createJulesAPIClient, julesApiClient } from './jules-api-client';

/**
 * EXEMPLO 1: Listar repositórios disponíveis
 */
export async function exampleListSources() {
  const client = createJulesAPIClient();

  // Lista todos os repositórios configurados no Jules
  const response = await client.listSources();

  console.log(`Encontrados ${response.sources.length} repositórios:`);
  for (const source of response.sources) {
    console.log(`- ${source.displayName} (${source.name})`);
    if (source.description) {
      console.log(`  ${source.description}`);
    }
  }

  // Paginação (se necessário)
  if (response.nextPageToken) {
    const nextPage = await client.listSources(50, response.nextPageToken);
    console.log(`Próxima página: ${nextPage.sources.length} repositórios`);
  }
}

/**
 * EXEMPLO 2: Criar sessão e delegar tarefa
 */
export async function exampleCreateSession() {
  const client = createJulesAPIClient();

  // Cria uma nova sessão de trabalho
  const session = await client.createSession(
    'Fix the authentication bug in src/auth/login.ts that causes infinite redirects',
    {
      source: 'sources/github/myorg/myrepo',
      githubRepoContext: {
        startingBranch: 'main',
        targetBranch: 'fix/auth-redirect',
      },
    }
  );

  console.log(`Sessão criada: ${session.name}`);
  console.log(`Estado: ${session.state}`);
  console.log(`Criada em: ${session.createTime}`);

  if (session.plan) {
    console.log('\nPlano do Jules:');
    console.log(session.plan);
  }

  return session;
}

/**
 * EXEMPLO 3: Interagir com sessão existente
 */
export async function exampleInteractWithSession(sessionId: string) {
  const client = createJulesAPIClient();

  // Envia mensagem para Jules
  const response = await client.sendMessage(
    sessionId,
    'Please also add unit tests for the authentication flow'
  );

  console.log(`Mensagem enviada: ${response.messageId}`);
  console.log(`Estado da sessão: ${response.state}`);

  if (response.response) {
    console.log('\nResposta do Jules:');
    console.log(response.response);
  }

  // Obtém status atualizado da sessão
  const sessionDetails = await client.getSession(sessionId);
  console.log('\nDetalhes da sessão:');
  console.log(`Estado: ${sessionDetails.state}`);
  console.log(`Última atualização: ${sessionDetails.updateTime}`);

  if (sessionDetails.messages) {
    console.log('\nHistórico de mensagens:');
    for (const msg of sessionDetails.messages) {
      console.log(`[${msg.role}] ${msg.content}`);
    }
  }
}

/**
 * EXEMPLO 4: Monitorar sessão até conclusão
 */
export async function exampleMonitorSession(sessionId: string) {
  const client = createJulesAPIClient();
  const maxAttempts = 60; // 5 minutos (60 * 5s)
  let attempts = 0;

  console.log(`Monitorando sessão ${sessionId}...`);

  while (attempts < maxAttempts) {
    const session = await client.getSession(sessionId);

    console.log(`[${new Date().toISOString()}] Estado: ${session.state}`);

    // Estados finais
    if (session.state === 'COMPLETED') {
      console.log('Sessão concluída com sucesso!');
      return { success: true, session };
    }

    if (session.state === 'FAILED') {
      console.log('Sessão falhou!');
      return { success: false, session };
    }

    // Aguarda 5 segundos antes de verificar novamente
    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;
  }

  console.log('Timeout ao monitorar sessão');
  return { success: false, timeout: true };
}

/**
 * EXEMPLO 5: Listar e gerenciar sessões
 */
export async function exampleManageSessions() {
  const client = createJulesAPIClient();

  // Lista todas as sessões
  const sessionsResponse = await client.listSessions();

  console.log(`Total de sessões: ${sessionsResponse.sessions.length}`);

  // Agrupa por estado
  const byState: Record<string, number> = {};
  for (const session of sessionsResponse.sessions) {
    byState[session.state] = (byState[session.state] || 0) + 1;
  }

  console.log('\nSessões por estado:');
  for (const [state, count] of Object.entries(byState)) {
    console.log(`- ${state}: ${count}`);
  }

  // Lista sessões ativas
  const activeSessions = sessionsResponse.sessions.filter((s) => s.state === 'ACTIVE');
  console.log(`\nSessões ativas: ${activeSessions.length}`);
  for (const session of activeSessions) {
    console.log(`- ${session.name} (criada em ${session.createTime})`);
  }

  // Deleta sessões antigas (COMPLETED há mais de 7 dias)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oldSessions = sessionsResponse.sessions.filter((s) => {
    if (s.state !== 'COMPLETED') return false;
    const updateDate = new Date(s.updateTime || s.createTime);
    return updateDate < sevenDaysAgo;
  });

  if (oldSessions.length > 0) {
    console.log(`\nDeletando ${oldSessions.length} sessões antigas...`);
    for (const session of oldSessions) {
      const sessionId = JulesAPIClient.extractSessionId(session.name);
      await client.deleteSession(sessionId);
      console.log(`- Deletada: ${session.name}`);
    }
  }
}

/**
 * EXEMPLO 6: Workflow completo - Bug Fix
 */
export async function exampleFullBugFixWorkflow() {
  const client = createJulesAPIClient();

  console.log('=== WORKFLOW: Bug Fix com Jules ===\n');

  // 1. Criar sessão
  console.log('1. Criando sessão...');
  const session = await client.createSession(
    `Fix critical bug in payment processing:
    - Issue: Transactions are failing silently when amount > 1000
    - File: src/payments/processor.ts
    - Error: Amount validation is incorrect
    - Expected: Should validate correctly and log errors`,
    {
      source: 'sources/github/company/payment-service',
      githubRepoContext: {
        startingBranch: 'main',
        targetBranch: 'hotfix/payment-validation',
      },
    }
  );

  console.log(`Sessão criada: ${session.name}\n`);

  const sessionId = JulesAPIClient.extractSessionId(session.name);

  // 2. Aguardar plano
  console.log('2. Aguardando plano do Jules...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const sessionWithPlan = await client.getSession(sessionId);
  if (sessionWithPlan.plan) {
    console.log('Plano recebido:');
    console.log(sessionWithPlan.plan);
    console.log();
  }

  // 3. Enviar feedback sobre o plano
  console.log('3. Enviando feedback...');
  await client.sendMessage(sessionId, 'Great plan! Also add integration tests for edge cases.');

  // 4. Monitorar até conclusão
  console.log('4. Monitorando execução...\n');
  const result = await exampleMonitorSession(sessionId);

  // 5. Verificar resultado
  if (result.success && result.session) {
    console.log('\n✅ Bug fix concluído com sucesso!');
    console.log(`Sessão: ${result.session.name}`);
    console.log(`Branch criada: hotfix/payment-validation`);
  } else {
    console.log('\n❌ Bug fix falhou ou timeout');
  }
}

/**
 * EXEMPLO 7: Uso com singleton
 */
export async function exampleUsingSingleton() {
  // Uso direto do singleton
  const sources = await julesApiClient.instance.listSources();
  console.log(`Fontes disponíveis: ${sources.sources.length}`);

  // Ou através da função getter
  const client = julesApiClient.instance;
  const sessions = await client.listSessions();
  console.log(`Sessões ativas: ${sessions.sessions.length}`);
}

/**
 * EXEMPLO 8: Tratamento de erros
 */
export async function exampleErrorHandling() {
  try {
    const client = createJulesAPIClient();

    // Tenta criar sessão com fonte inválida
    await client.createSession('Fix bug', {
      source: 'sources/invalid/repo',
    });
  } catch (error: any) {
    if (error.message.includes('Jules API error')) {
      // Erro da API Jules
      console.error('Erro da API Jules:', error.message);

      // Parse do código de erro
      const codeMatch = error.message.match(/\[(\d+)\]/);
      if (codeMatch) {
        const code = parseInt(codeMatch[1]);
        if (code === 403) {
          console.error('API key inválida ou sem permissão');
        } else if (code === 404) {
          console.error('Recurso não encontrado');
        } else if (code === 429) {
          console.error('Rate limit excedido');
        }
      }
    } else {
      // Erro de rede ou outro
      console.error('Erro ao comunicar com Jules:', error.message);
    }
  }
}

/**
 * EXEMPLO 9: Criar sessão com configuração avançada
 */
export async function exampleAdvancedSessionCreation() {
  const client = createJulesAPIClient();

  // Sessão complexa com múltiplos requisitos
  const session = await client.createSession(
    `
Implement new feature: User notification system

Requirements:
- Add email notifications for order status changes
- Implement webhook support for external integrations
- Add notification preferences to user settings
- Create admin dashboard for notification logs

Technical specs:
- Use existing email service (src/services/email.ts)
- Store preferences in PostgreSQL users table
- Use Redis for notification queue
- Add OpenAPI specs for webhook endpoints

Acceptance criteria:
- Unit tests coverage > 80%
- Integration tests for all notification types
- Documentation in docs/notifications.md
- Migration script for database changes
`,
    {
      source: 'sources/github/company/backend-api',
      githubRepoContext: {
        startingBranch: 'develop',
        targetBranch: 'feature/notification-system',
      },
    }
  );

  console.log('Sessão de feature complexa criada:', session.name);
  return session;
}
