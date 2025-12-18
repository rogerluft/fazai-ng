# Task 1: Fix Dashboard API Status com Credenciais Reais

**Prioridade:** 🔴 URGENTE
**Estimativa:** 3h
**Responsável:** Jules
**Data:** 2025-12-17

---

## Objetivo Final

Refatorar `getAPIStatus()` em `cli-mode.ts` para verificar status de APIs externas usando **credenciais reais** dos Managers, não apenas HEAD requests sem autenticação.

---

## Contexto Técnico

### Arquivos Principais
- `/home/rluft/fazai-ng/src/cli-mode.ts` (linhas 123-171)
- `/home/rluft/fazai-ng/src/cloudflare-manager.ts` (CloudflareManager já implementado)
- `/home/rluft/fazai-ng/src/cloudflare-gemini.ts` (CloudflareGeminiClient já implementado)
- `/home/rluft/fazai-ng/src/config-loader.ts` (carregador de configurações)

### Problema Atual

**Código problemático (linhas 134-138):**
```typescript
const response = await fetch(api.url, {
  method: "HEAD",
  headers: { "User-Agent": "FazAI/3.5.4" },
  signal: AbortSignal.timeout(5000),
});
```

**Problema:** O endpoint Cloudflare `/user/tokens/verify` requer token Bearer. HEAD request sem autenticação retorna 403/401 sendo marcado como "offline" mesmo com API configurada corretamente.

### Localização de Credenciais

As chaves de API estão em:
- `/etc/fazai/fazai.conf`
- `~/.env` (usuário)
- `/root/.env` (root)

**Variáveis relevantes:**
```ini
CLOUDFLARE_API_KEY=xxxxx
CLOUDFLARE_ACCOUNT_ID=xxxxx
OPENAI_API_KEY=xxxxx
ANTHROPIC_API_KEY=xxxxx
GEMINI_WORKER_URL=xxxxx
```

---

## Comportamento Atual vs. Esperado

### Atual
```
getAPIStatus()
└── fetch(api.url, { method: "HEAD" }) sem autenticação
    ├── Cloudflare → 401 Unauthorized → marcado como "offline" ❌
    ├── OpenAI → 401 Unauthorized → marcado como "offline" ❌
    └── Anthropic → 401 Unauthorized → marcado como "offline" ❌
```

### Esperado
```
getAPIStatus()
└── Instanciar Manager com credenciais
    ├── CloudflareManager.listZones() → se funciona = "online" ✓
    ├── Tentar OpenAI.models.list() → se funciona = "online" ✓
    └── Tentar Anthropic API call → se funciona = "online" ✓
```

---

## Critérios de Aceitação

1. **✓ Cloudflare:**
   - Deve instanciar `CloudflareManager`
   - Chamar `listZones()` para verificação real
   - Capturar erro se `CLOUDFLARE_API_KEY` não configurada
   - Marcar "online" apenas se chamada com credenciais funcionar

2. **✓ OpenAI:**
   - Usar SDK OpenAI com `OPENAI_API_KEY`
   - Chamar `client.models.list()` ou similar
   - Não marcar "offline" se chave não estiver configurada (mostrar "not_configured")

3. **✓ Anthropic:**
   - Usar SDK Anthropic com `ANTHROPIC_API_KEY`
   - Fazer chamada real mínima
   - Não marcar "offline" se chave não estiver configurada

4. **✓ Tratamento de Erro Graceful:**
   - Se Manager lançar erro "API key não configurada" → status = "not_configured"
   - Se API retornar erro de autenticação → status = "unauthorized"
   - Se API timeout/offline → status = "offline"
   - Se API funcionar → status = "online" (com responseTime)

5. **✓ Thresholds:**
   - Manter thresholds de latência: <1000ms=online, 1000-3000ms=degraded, >3000ms=offline

6. **✓ Testes:**
   - Rodar `npm test` com sucesso
   - Testar dashboard com `/dashboard` no CLI

---

## Sugestão de Implementação

```typescript
async function getAPIStatus(): Promise<Array<{
  name: string;
  status: "online" | "offline" | "degraded" | "not_configured" | "unauthorized";
  responseTime?: string;
  error?: string;
}>> {
  const results = [];

  // 1. Cloudflare
  try {
    const cfManager = new CloudflareManager();
    const start = Date.now();
    await cfManager.listZones();
    const elapsed = Date.now() - start;

    results.push({
      name: "Cloudflare",
      status: elapsed < 1000 ? "online" : elapsed < 3000 ? "degraded" : "offline",
      responseTime: `${elapsed}ms`
    });
  } catch (error: any) {
    if (error.message.includes("API_KEY não configurada")) {
      results.push({ name: "Cloudflare", status: "not_configured" });
    } else if (error.message.includes("401") || error.message.includes("403")) {
      results.push({ name: "Cloudflare", status: "unauthorized" });
    } else {
      results.push({ name: "Cloudflare", status: "offline", error: error.message });
    }
  }

  // 2. OpenAI
  try {
    const apiKey = process.env.OPENAI_API_KEY || getConfigValue("OPENAI_API_KEY");
    if (!apiKey) {
      results.push({ name: "OpenAI", status: "not_configured" });
    } else {
      const openai = new OpenAI({ apiKey, timeout: 5000 });
      const start = Date.now();
      await openai.models.list();
      const elapsed = Date.now() - start;

      results.push({
        name: "OpenAI",
        status: elapsed < 1000 ? "online" : elapsed < 3000 ? "degraded" : "offline",
        responseTime: `${elapsed}ms`
      });
    }
  } catch (error: any) {
    results.push({ name: "OpenAI", status: "offline", error: error.message });
  }

  // 3. Anthropic (similar)
  // ...

  return results;
}
```

---

## Recursos Externos

- Cloudflare API Docs: https://developers.cloudflare.com/api/
- OpenAI SDK: https://github.com/openai/openai-node
- Anthropic SDK: https://github.com/anthropics/anthropic-sdk-typescript

---

## Notas Importantes

- **NÃO** modificar thresholds de latência (já corrigidos na v3.6.13-beta)
- **MANTER** timeout de 5000ms para evitar travamento do dashboard
- **ADICIONAR** import do OpenAI SDK se necessário
- **CONSIDERAR** adicionar outros providers (Google, Ollama) futuramente
- **ATUALIZAR** type `DashboardData` em `src/ui/dashboard.ts` se adicionar novos status

---

## Checklist de Entrega

- [ ] Código refatorado em `cli-mode.ts`
- [ ] Imports necessários adicionados (OpenAI SDK, etc.)
- [ ] Tratamento de erro para cada provider
- [ ] Testes unitários passando (`npm test`)
- [ ] Dashboard testado manualmente (`/dashboard`)
- [ ] CHANGELOG.md atualizado
- [ ] Commit com mensagem descritiva
