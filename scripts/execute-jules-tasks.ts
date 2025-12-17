#!/usr/bin/env ts-node
/**
 * Script para executar tasks com Jules usando o orchestrator
 */

import { delegateToJules, approveJulesPlan } from '../src/orchestrator/jules-client';
import type { JulesTask } from '../src/orchestrator/task-router';
import { formatJulesPrompt } from '../src/orchestrator/task-router';

// Task 1: Fix Dashboard API Status
const task1: JulesTask = {
  title: 'Fix Dashboard API Status com Credenciais Reais',
  objective: 'Refatorar getAPIStatus() em src/cli-mode.ts para verificar status de APIs externas usando credenciais reais dos Managers, não apenas HEAD requests sem autenticação. O dashboard deve mostrar o status REAL das APIs (online/offline/not_configured/unauthorized).',
  context: {
    files: [
      '/home/rluft/fazai-ng/src/cli-mode.ts',
      '/home/rluft/fazai-ng/src/cloudflare-manager.ts',
      '/home/rluft/fazai-ng/src/cloudflare-gemini.ts',
      '/home/rluft/fazai-ng/src/config-loader.ts',
    ],
    errors: [],
    currentBehavior: 'O código faz HEAD request sem autenticação que retorna 401 sendo marcado como "offline" mesmo com API configurada',
    expectedBehavior: 'Instanciar Managers com credenciais, fazer chamada real mínima (ex: CloudflareManager.listZones()), status "online" apenas se chamada com credenciais funcionar',
    resources: [
      'https://developers.cloudflare.com/api/',
      'https://github.com/openai/openai-node',
      'https://github.com/anthropics/anthropic-sdk-typescript',
    ],
  },
  acceptanceCriteria: [
    'Cloudflare usando CloudflareManager.listZones()',
    'OpenAI usando SDK com models.list()',
    'Anthropic usando SDK com chamada mínima',
    'Tratamento de erro graceful (not_configured, unauthorized, offline)',
    'Thresholds de latência mantidos: <1000ms=online, 1000-3000ms=degraded, >3000ms=offline',
    'Testes passando (npm test)',
    'Dashboard testado manualmente (/dashboard)',
  ],
  technicalContext: `**Problema Atual:**
O código (linhas 123-171) faz HEAD request sem autenticação:
\`\`\`typescript
const response = await fetch(api.url, {
  method: "HEAD",
  headers: { "User-Agent": "FazAI/3.5.4" },
  signal: AbortSignal.timeout(5000),
});
\`\`\`

Endpoints como Cloudflare /user/tokens/verify requerem token Bearer. HEAD sem autenticação retorna 401.

**Credenciais:** Em /etc/fazai/fazai.conf, ~/.env, ou /root/.env
- CLOUDFLARE_API_KEY
- CLOUDFLARE_ACCOUNT_ID
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- GEMINI_WORKER_URL

**Flexibilidade:**
Você tem TOTAL liberdade para:
- Melhorar arquitetura (factory pattern, cache)
- Adicionar retry logic inteligente
- Prevenir bugs (validações, timeouts, null checks)
- Adicionar mais providers (Google, Ollama) se útil
- Melhorar tipos TypeScript
- Qualquer melhoria funcional/dinâmica/visual

**Entregar:**
- Código refatorado
- Testes passando
- CHANGELOG.md atualizado (v3.6.14-beta)
- Commit descritivo`,
};

async function main() {
  console.log('🚀 Iniciando execução de tasks com Jules...\n');

  // Task 1
  console.log('📋 Task 1: Fix Dashboard API Status');
  console.log('═══════════════════════════════════════\n');

  console.log('Formatando prompt para Jules...');
  const prompt = formatJulesPrompt(task1);
  console.log('\n--- PROMPT PARA JULES ---');
  console.log(prompt);
  console.log('--- FIM DO PROMPT ---\n');

  console.log('Delegando para Jules...');
  const response = await delegateToJules(task1);

  if (!response.success) {
    console.error('❌ Erro ao delegar para Jules:', response.error);
    process.exit(1);
  }

  if (response.needsInput && response.plan) {
    console.log('\n📝 PLANO PROPOSTO POR JULES:');
    console.log('═══════════════════════════════════════');
    console.log(response.plan);
    console.log('═══════════════════════════════════════\n');

    console.log('✅ Aprovando plano automaticamente...');
    await approveJulesPlan();
    console.log('✓ Plano aprovado. Jules está executando...\n');
  }

  if (response.needsInput && response.question) {
    console.log('\n❓ JULES FEZ UMA PERGUNTA:');
    console.log(response.question);
    console.log('\n⚠️  Responda manualmente usando: echo "sua resposta" | jules\n');
  }

  if (response.result) {
    console.log('\n✅ RESULTADO:');
    console.log(response.result);
  }

  console.log('\n✓ Task 1 delegada para Jules');
  console.log('\nMonitore o progresso com: jules --list-sessions');
}

main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
