# Task 2: Integrar CloudflareUI com CloudflareManager Real

**Prioridade:** 🔴 URGENTE
**Estimativa:** 10-11h
**Responsável:** Jules
**Data:** 2025-12-17

---

## Objetivo Final

Eliminar **todos os métodos MOCK** da `CloudflareUI` e integrá-la com o `CloudflareManager` real que já existe e funciona. Adicionar métodos faltantes ao Manager (Firewall, SSL, Cache, Analytics).

---

## Contexto Técnico

### Arquivos Principais
- `/home/rluft/fazai-ng/src/commands/api/cloudflare-ui.ts` (UI com mocks - REFATORAR)
- `/home/rluft/fazai-ng/src/cloudflare-manager.ts` (Manager real - USAR)
- `/home/rluft/fazai-ng/src/config-loader.ts` (config loader)

### Problema Atual

**CloudflareUI NÃO USA CloudflareManager!**

```typescript
// cloudflare-ui.ts (linhas 409-476) - PROBLEMA!
export class CloudflareUI {
  // Métodos MOCK internos que IGNORAM o CloudflareManager
  private async fetchZones(): Promise<any[]> {
    // Mock implementation
    return [
      { id: "a1b2c3d4...", name: "example.com", status: "active", ... },
    ];
  }

  private async fetchDNSRecords(zoneId: string): Promise<any[]> {
    return [
      { id: "rec1", type: "A", name: "example.com", ... },
    ];
  }

  // ... mais 10 métodos mock
}
```

**CloudflareManager JÁ IMPLEMENTADO (linhas 34-195):**
```typescript
export class CloudflareManager {
  private apiKey: string;
  private accountId: string;

  async listZones(): Promise<CloudflareZone[]> { /* API REAL */ }
  async listDNSRecords(zoneId: string): Promise<CloudflareDNSRecord[]> { /* API REAL */ }
  async createDNSRecord(...): Promise<CloudflareDNSRecord> { /* API REAL */ }
  async deleteDNSRecord(...): Promise<void> { /* API REAL */ }
  async listWorkers(): Promise<CloudflareWorker[]> { /* API REAL */ }
  async deployWorker(...): Promise<void> { /* API REAL */ }
  // ... mais métodos
}
```

### Localização de Credenciais

Chaves estão em `/etc/fazai/fazai.conf`, `~/.env`, ou `/root/.env`:
```ini
CLOUDFLARE_API_KEY=your_cloudflare_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

---

## Comportamento Atual vs. Esperado

### Atual (ERRADO)
```
Usuario: /cloudflare
└── CloudflareUI.showMainMenu()
    └── CloudflareUI.listZones()
        └── fetchZones() → MOCK [retorna dados fake] ❌
```

### Esperado (CORRETO)
```
Usuario: /cloudflare
└── CloudflareUI.showMainMenu()
    └── CloudflareUI.listZones()
        └── this.manager.listZones() → API Cloudflare REAL ✓
```

---

## Mapeamento de Métodos (UI Mock → Manager Real)

### ✅ Métodos JÁ EXISTENTES no Manager

| UI Mock (cloudflare-ui.ts) | Manager Real (cloudflare-manager.ts) | Status |
|----------------------------|-------------------------------------|--------|
| `fetchZones()` linha 414 | `listZones()` linha 69 | ✅ Substituir direto |
| `fetchDNSRecords(zoneId)` linha 422 | `listDNSRecords(zoneId)` linha 78 | ✅ Substituir direto |
| `createDNSRecord(zoneId, record)` linha 429 | `createDNSRecord(zoneId, record)` linha 82 | ✅ Substituir direto |
| `removeDNSRecord(zoneId, recordId)` linha 434 | `deleteDNSRecord(zoneId, recordId)` linha 103 | ✅ Substituir direto |
| `fetchWorkers()` linha 438 | `listWorkers()` linha 110 | ✅ Substituir direto |

### ❌ Métodos FALTANTES no Manager (CRIAR)

| UI Mock (cloudflare-ui.ts) | Manager Real | Endpoint Cloudflare | Complexidade |
|----------------------------|--------------|---------------------|--------------|
| `fetchFirewallRules(zoneId)` linha 445 | **CRIAR** `listFirewallRules(zoneId)` | `GET /zones/{zone_id}/firewall/rules` | ALTA |
| `fetchSSLConfig(zoneId)` linha 452 | **CRIAR** `getSSLSettings(zoneId)` | `GET /zones/{zone_id}/settings/ssl` | MÉDIA |
| `updateSSLMode(zoneId, mode)` linha 460 | **CRIAR** `updateSSLMode(zoneId, mode)` | `PATCH /zones/{zone_id}/settings/ssl` | MÉDIA |
| `purgeCache(zoneId, action)` linha 464 | **CRIAR** `purgeCache(zoneId, options)` | `POST /zones/{zone_id}/purge_cache` | MÉDIA |
| `fetchAnalytics(zoneId)` linha 468 | **CRIAR** `getAnalytics(zoneId, period)` | `GET /zones/{zone_id}/analytics/dashboard` | ALTA |

---

## Critérios de Aceitação

### 1. ✓ Refatoração da CloudflareUI

**Adicionar constructor:**
```typescript
export class CloudflareUI {
  private manager: CloudflareManager;

  constructor() {
    try {
      this.manager = new CloudflareManager();
    } catch (error: any) {
      logger.warn(`Cloudflare não configurado: ${error.message}`);
      this.manager = null as any; // Será tratado nos métodos
    }
  }
}
```

**Substituir TODOS os métodos mock:**
```typescript
// ANTES (linha 414-419)
private async fetchZones(): Promise<any[]> {
  return [
    { id: "a1b2c3d4...", name: "example.com", ... },
  ];
}

// DEPOIS
private async fetchZones(): Promise<CloudflareZone[]> {
  if (!this.manager) {
    throw new Error("Cloudflare não configurado. Configure CLOUDFLARE_API_KEY.");
  }
  return this.manager.listZones();
}
```

### 2. ✓ Adicionar Métodos ao CloudflareManager

**A) Firewall Rules (ALTA complexidade)**
```typescript
interface CloudflareFirewallRule {
  id: string;
  description: string;
  action: "block" | "challenge" | "js_challenge" | "allow" | "log";
  paused: boolean;
  filter: {
    expression: string;
  };
}

async listFirewallRules(zoneId: string): Promise<CloudflareFirewallRule[]> {
  return this.request(`/zones/${zoneId}/firewall/rules`);
}

async createFirewallRule(zoneId: string, rule: Partial<CloudflareFirewallRule>): Promise<CloudflareFirewallRule> {
  return this.request(`/zones/${zoneId}/firewall/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}
```

**B) SSL Settings (MÉDIA complexidade)**
```typescript
interface CloudflareSSLSettings {
  mode: "off" | "flexible" | "full" | "strict";
  universal_ssl: boolean;
  edge_certificates_count: number;
}

async getSSLSettings(zoneId: string): Promise<CloudflareSSLSettings> {
  const settings = await this.request(`/zones/${zoneId}/settings/ssl`);
  const universal = await this.request(`/zones/${zoneId}/settings/universal_ssl`);
  const certs = await this.request(`/zones/${zoneId}/ssl/certificate_packs`);

  return {
    mode: settings.value,
    universal_ssl: universal.value === "on",
    edge_certificates_count: certs.length,
  };
}

async updateSSLMode(zoneId: string, mode: string): Promise<void> {
  await this.request(`/zones/${zoneId}/settings/ssl`, {
    method: 'PATCH',
    body: JSON.stringify({ value: mode }),
  });
}
```

**C) Cache Purge (MÉDIA complexidade)**
```typescript
interface CachePurgeOptions {
  purge_everything?: boolean;
  files?: string[];
  tags?: string[];
  hosts?: string[];
}

async purgeCache(zoneId: string, options: CachePurgeOptions): Promise<void> {
  await this.request(`/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}
```

**D) Analytics (ALTA complexidade - usa GraphQL)**
```typescript
interface CloudflareAnalytics {
  requests: number;
  bandwidth: number;
  threats: number;
  pageViews: number;
  period: {
    since: string;
    until: string;
  };
}

async getAnalytics(zoneId: string, since: string = "-1440"): Promise<CloudflareAnalytics> {
  // Cloudflare Analytics API v1
  const data = await this.request(
    `/zones/${zoneId}/analytics/dashboard?since=${since}`
  );

  return {
    requests: data.totals.requests.all,
    bandwidth: data.totals.bandwidth.all,
    threats: data.totals.threats.all,
    pageViews: data.totals.pageviews.all,
    period: {
      since: data.query.since,
      until: data.query.until,
    },
  };
}
```

### 3. ✓ Tratamento de Erros

**Em cada método da UI:**
```typescript
try {
  const zones = await this.manager.listZones();
  // ... renderizar
} catch (error: any) {
  if (error.message.includes("API_KEY não configurada")) {
    showError("Configure CLOUDFLARE_API_KEY em /etc/fazai/fazai.conf");
  } else if (error.message.includes("401") || error.message.includes("403")) {
    showError("Token Cloudflare inválido ou expirado");
  } else {
    showError(`Erro ao acessar Cloudflare: ${error.message}`);
  }
  throw error;
}
```

### 4. ✓ Remover COMPLETAMENTE Seção Mock

**DELETAR linhas 409-476 inteiras** (seção "API Mock Methods") após refatoração.

### 5. ✓ Testes

- Rodar `npm test` com sucesso
- Testar `/cloudflare` no CLI:
  - Listar zonas (deve mostrar zonas reais ou erro de config)
  - Listar DNS records de uma zona
  - Criar/deletar registro DNS
  - Ver analytics
  - Limpar cache

---

## Sugestão de Ordem de Implementação

1. **Refatorar CloudflareUI (2h):**
   - Adicionar constructor com CloudflareManager
   - Substituir fetchZones(), fetchDNSRecords(), createDNSRecord(), removeDNSRecord(), fetchWorkers()

2. **Adicionar métodos simples ao Manager (2h):**
   - updateSSLMode()
   - purgeCache()

3. **Adicionar métodos complexos ao Manager (4h):**
   - getSSLSettings() (precisa combinar 3 endpoints)
   - listFirewallRules()
   - getAnalytics() (Analytics API)

4. **Deletar seção mock (0.5h):**
   - Remover linhas 409-476

5. **Testes e validação (2h):**
   - Testes unitários
   - Testes manuais no CLI

6. **Documentação (0.5h):**
   - Atualizar CHANGELOG.md
   - Commit

---

## Recursos Externos

- Cloudflare API Docs: https://developers.cloudflare.com/api/
- Firewall Rules API: https://developers.cloudflare.com/firewall/api/
- SSL Settings: https://developers.cloudflare.com/ssl/reference/ssl-api/
- Cache Purge: https://developers.cloudflare.com/cache/how-to/purge-cache/
- Analytics API: https://developers.cloudflare.com/analytics/graphql-api/

---

## Notas Importantes

- **PROIBIDO** manter qualquer método mock após refatoração
- **MANTER** a interface visual da UI (menus, prompts) - só mudar backend
- **ADICIONAR** tipos TypeScript para todas as respostas da API
- **CONSIDERAR** rate limiting (Cloudflare limita 1200 req/5min no free tier)
- **TESTAR** com zona real se possível

---

## Checklist de Entrega

- [ ] CloudflareUI refatorado com constructor
- [ ] Todos fetchZones/DNS/Workers usando Manager
- [ ] CloudflareManager com listFirewallRules()
- [ ] CloudflareManager com getSSLSettings()
- [ ] CloudflareManager com updateSSLMode()
- [ ] CloudflareManager com purgeCache()
- [ ] CloudflareManager com getAnalytics()
- [ ] Seção mock (linhas 409-476) deletada
- [ ] Tratamento de erro em todos os métodos UI
- [ ] Tipos TypeScript criados
- [ ] Testes unitários passando
- [ ] Testes manuais no CLI
- [ ] CHANGELOG.md atualizado (v3.6.14-beta)
- [ ] Commit com mensagem descritiva
