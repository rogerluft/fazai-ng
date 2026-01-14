# Task 3: Criar SpamExpertsManager e Integrar com SpamExpertsUI

**Prioridade:** 🟡 MÉDIA
**Estimativa:** 16-18h
**Responsável:** Jules
**Data:** 2025-12-17

---

## Objetivo Final

Criar `SpamExpertsManager` do zero para integração com API real do SpamExperts e eliminar **todos os métodos MOCK** da `SpamExpertsUI`.

---

## Contexto Técnico

### Arquivos Principais
- `/home/rluft/fazai-ng/src/spamexperts-manager.ts` (CRIAR - não existe)
- `/home/rluft/fazai-ng/src/commands/api/spamexperts-ui.ts` (UI com 100% mock - REFATORAR)
- `/home/rluft/fazai-ng/src/config-loader.ts` (config loader)

### Problema Atual

**SpamExpertsUI é 100% MOCK!**

```typescript
// spamexperts-ui.ts (linhas 423-542) - PROBLEMA!
export class SpamExpertsUI {
  // TODOS os métodos são MOCK
  private async fetchDomains(): Promise<any[]> {
    return [
      { domain: "example.com", status: "active", ... },
    ];
  }

  private async createDomain(domain: string, destination: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Apenas delay!
  }

  // ... mais 15 métodos mock
}
```

**NÃO EXISTE SpamExpertsManager** - Precisa ser criado do zero.

### Localização de Credenciais

Chaves estão em `/etc/fazai/fazai.conf`, `~/.env`, ou `/root/.env`:
```ini
SPAMEXPERTS_API_URL=https://api.antispamcloud.com/api/
SPAMEXPERTS_USERNAME=admin@example.com
SPAMEXPERTS_PASSWORD=your_password_here
# OU
SPAMEXPERTS_API_KEY=your_api_key_here
```

### API SpamExperts

**Base URL:** `https://api.antispamcloud.com/api/`
**Autenticação:** Basic Auth (username:password) ou API Key no header
**Formato:** JSON
**Documentação:** https://www.spamexperts.com/software/api/

---

## Critérios de Aceitação

### 1. ✓ Criar SpamExpertsManager Base

**Arquivo:** `/home/rluft/fazai-ng/src/spamexperts-manager.ts`

```typescript
/**
 * SpamExperts API Manager
 * Gerencia recursos SpamExperts via API
 */

import { loadConfig } from './config-loader';
import { logger } from './logger';

interface SpamExpertsDomain {
  domain: string;
  destination: string;
  status: 'active' | 'pending' | 'suspended';
  emailsToday: number;
  spamBlocked: number;
  quarantined: number;
}

interface SpamExpertsQuarantineMessage {
  id: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  score: number;
  reason: string;
}

interface SpamExpertsReport {
  totalEmails: number;
  spamBlocked: number;
  cleanEmails: number;
  quarantined: number;
  blockRate: number;
  byDomain: Array<{
    domain: string;
    total: number;
    spam: number;
    clean: number;
  }>;
}

export class SpamExpertsManager {
  private apiUrl: string;
  private username: string;
  private password: string;
  private apiKey?: string;

  constructor() {
    const config = loadConfig();

    this.apiUrl = config.spamExpertsApiUrl ||
                  process.env.SPAMEXPERTS_API_URL ||
                  'https://api.antispamcloud.com/api/';

    this.username = config.spamExpertsUsername || process.env.SPAMEXPERTS_USERNAME || '';
    this.password = config.spamExpertsPassword || process.env.SPAMEXPERTS_PASSWORD || '';
    this.apiKey = config.spamExpertsApiKey || process.env.SPAMEXPERTS_API_KEY;

    if (!this.apiKey && (!this.username || !this.password)) {
      throw new Error('SPAMEXPERTS_API_KEY ou SPAMEXPERTS_USERNAME/PASSWORD não configurados');
    }

    // Remove trailing slash
    this.apiUrl = this.apiUrl.replace(/\/$/, '');
  }

  /**
   * Faz requisição autenticada à API SpamExperts
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    // Autenticação: API Key ou Basic Auth
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    } else {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SpamExperts API error (${response.status}): ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }

  // Métodos públicos serão implementados abaixo...
}
```

### 2. ✓ Implementar Métodos de Domínios

```typescript
/**
 * Lista todos os domínios protegidos
 */
async listDomains(): Promise<SpamExpertsDomain[]> {
  const data = await this.request('/domain/list');

  // Transformar resposta da API para formato esperado
  return data.domains.map((d: any) => ({
    domain: d.domain,
    destination: d.destination_server,
    status: d.active ? 'active' : 'suspended',
    emailsToday: d.stats?.today?.total || 0,
    spamBlocked: d.stats?.today?.spam || 0,
    quarantined: d.stats?.today?.quarantine || 0,
  }));
}

/**
 * Adiciona novo domínio à proteção
 */
async addDomain(domain: string, destination: string): Promise<void> {
  await this.request('/domain/add', {
    method: 'POST',
    body: JSON.stringify({
      domain,
      destination,
    }),
  });

  logger.info(`Domínio ${domain} adicionado ao SpamExperts`);
}

/**
 * Remove domínio da proteção
 */
async removeDomain(domain: string): Promise<void> {
  await this.request('/domain/remove', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });

  logger.info(`Domínio ${domain} removido do SpamExperts`);
}

/**
 * Obtém detalhes de um domínio específico
 */
async getDomainDetails(domain: string): Promise<any> {
  return this.request(`/domain/info/${encodeURIComponent(domain)}`);
}
```

### 3. ✓ Implementar Métodos de Quarentena

```typescript
/**
 * Lista emails em quarentena
 */
async listQuarantine(domain?: string, limit: number = 50): Promise<SpamExpertsQuarantineMessage[]> {
  const endpoint = domain
    ? `/quarantine/messages?domain=${encodeURIComponent(domain)}&limit=${limit}`
    : `/quarantine/messages?limit=${limit}`;

  const data = await this.request(endpoint);

  return data.messages.map((m: any) => ({
    id: m.id,
    date: m.timestamp,
    from: m.sender,
    to: m.recipient,
    subject: m.subject,
    score: parseFloat(m.spam_score),
    reason: m.spam_reason || 'Unknown',
  }));
}

/**
 * Libera email da quarentena
 */
async releaseMessage(messageId: string, recipient?: string): Promise<void> {
  await this.request('/quarantine/release', {
    method: 'POST',
    body: JSON.stringify({
      message_id: messageId,
      recipient,
    }),
  });

  logger.info(`Mensagem ${messageId} liberada da quarentena`);
}

/**
 * Deleta email da quarentena
 */
async deleteMessage(messageId: string): Promise<void> {
  await this.request('/quarantine/delete', {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId }),
  });

  logger.info(`Mensagem ${messageId} deletada da quarentena`);
}
```

### 4. ✓ Implementar Métodos de Relatórios

```typescript
/**
 * Gera relatório de estatísticas
 */
async getReport(period: '24h' | '7d' | '30d' = '24h'): Promise<SpamExpertsReport> {
  const hoursMap = { '24h': 24, '7d': 168, '30d': 720 };
  const hours = hoursMap[period];

  const data = await this.request(`/reports/statistics?hours=${hours}`);

  return {
    totalEmails: data.total_emails || 0,
    spamBlocked: data.spam_blocked || 0,
    cleanEmails: data.clean_emails || 0,
    quarantined: data.quarantined || 0,
    blockRate: data.spam_blocked > 0
      ? ((data.spam_blocked / data.total_emails) * 100).toFixed(1)
      : 0,
    byDomain: data.by_domain || [],
  };
}
```

### 5. ✓ Implementar Métodos de Whitelist/Blacklist

```typescript
/**
 * Lista entradas de whitelist ou blacklist
 */
async listList(type: 'whitelist' | 'blacklist', domain?: string): Promise<any[]> {
  const endpoint = domain
    ? `/${type}/list?domain=${encodeURIComponent(domain)}`
    : `/${type}/list`;

  const data = await this.request(endpoint);
  return data.entries || [];
}

/**
 * Adiciona entrada à whitelist ou blacklist
 */
async addToList(type: 'whitelist' | 'blacklist', entry: string, entryType: 'email' | 'domain' = 'email'): Promise<void> {
  await this.request(`/${type}/add`, {
    method: 'POST',
    body: JSON.stringify({
      entry,
      type: entryType,
    }),
  });

  logger.info(`Entrada ${entry} adicionada à ${type}`);
}

/**
 * Remove entrada da whitelist ou blacklist
 */
async removeFromList(type: 'whitelist' | 'blacklist', entry: string): Promise<void> {
  await this.request(`/${type}/remove`, {
    method: 'POST',
    body: JSON.stringify({ entry }),
  });

  logger.info(`Entrada ${entry} removida da ${type}`);
}
```

### 6. ✓ Implementar Métodos de Configurações

```typescript
/**
 * Obtém configurações gerais
 */
async getSettings(): Promise<any> {
  const data = await this.request('/settings');

  return {
    spamScore: data.spam_score_threshold || 5.0,
    spamAction: data.spam_action || 'quarantine',
    notifications: data.quarantine_notifications || false,
    autoWhitelist: data.auto_whitelist || false,
  };
}

/**
 * Atualiza configurações
 */
async updateSettings(settings: Partial<any>): Promise<void> {
  await this.request('/settings/update', {
    method: 'POST',
    body: JSON.stringify(settings),
  });

  logger.info('Configurações do SpamExperts atualizadas');
}
```

### 7. ✓ Refatorar SpamExpertsUI

**Adicionar constructor e substituir TODOS os métodos mock:**

```typescript
export class SpamExpertsUI {
  private manager: SpamExpertsManager;

  constructor() {
    try {
      this.manager = new SpamExpertsManager();
    } catch (error: any) {
      logger.warn(`SpamExperts não configurado: ${error.message}`);
      this.manager = null as any;
    }
  }

  // Substituir fetchDomains (linha 428-433)
  private async fetchDomains(): Promise<any[]> {
    if (!this.manager) {
      throw new Error("SpamExperts não configurado. Configure SPAMEXPERTS_API_KEY.");
    }
    return this.manager.listDomains();
  }

  // Substituir createDomain (linha 435-437)
  private async createDomain(domain: string, destination: string): Promise<void> {
    if (!this.manager) {
      throw new Error("SpamExperts não configurado.");
    }
    return this.manager.addDomain(domain, destination);
  }

  // Substituir deleteDomain (linha 439-441)
  private async deleteDomain(domain: string): Promise<void> {
    if (!this.manager) {
      throw new Error("SpamExperts não configurado.");
    }
    return this.manager.removeDomain(domain);
  }

  // ... substituir todos os outros métodos mock
}
```

### 8. ✓ Deletar Seção Mock

**DELETAR linhas 423-542** (seção "API Mock Methods") após refatoração completa.

### 9. ✓ Tratamento de Erros

Adicionar try/catch em todos os métodos da UI:

```typescript
try {
  const domains = await this.manager.listDomains();
  // ... renderizar
} catch (error: any) {
  if (error.message.includes("não configurado")) {
    showError("Configure SpamExperts em /etc/fazai/fazai.conf");
  } else if (error.message.includes("401") || error.message.includes("403")) {
    showError("Credenciais SpamExperts inválidas");
  } else {
    showError(`Erro ao acessar SpamExperts: ${error.message}`);
  }
  throw error;
}
```

---

## Recursos Externos

- SpamExperts API Docs: https://www.spamexperts.com/software/api/
- SpamExperts Support: https://support.spamexperts.com/

---

## Notas Importantes

- **API SpamExperts** pode variar conforme instalação (on-premise vs. cloud)
- **TESTAR** com credenciais reais se disponível
- **CONSIDERAR** rate limiting se houver
- **ADICIONAR** tipos TypeScript para todas as respostas
- **PROIBIDO** manter qualquer método mock

---

## Checklist de Entrega

- [ ] SpamExpertsManager criado em `src/spamexperts-manager.ts`
- [ ] Autenticação (Basic Auth + API Key)
- [ ] Métodos de domínios (list, add, remove, details)
- [ ] Métodos de quarentena (list, release, delete)
- [ ] Métodos de relatórios (getReport)
- [ ] Métodos de whitelist/blacklist
- [ ] Métodos de configurações
- [ ] SpamExpertsUI refatorado com constructor
- [ ] Todos os métodos UI usando Manager
- [ ] Seção mock (linhas 423-542) deletada
- [ ] Tratamento de erro em todos os métodos
- [ ] Tipos TypeScript criados
- [ ] Testes unitários
- [ ] Testes manuais no CLI (`/spamexperts`)
- [ ] CHANGELOG.md atualizado (v3.6.15-beta)
- [ ] Commit com mensagem descritiva
