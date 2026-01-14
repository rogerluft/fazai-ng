# Task 4: Criar OPNsenseManager e Integrar com OPNsenseUI

**Prioridade:** 🟢 MÉDIA-BAIXA
**Estimativa:** 19-22h
**Responsável:** Jules
**Data:** 2025-12-17

---

## Objetivo Final

Criar `OPNsenseManager` do zero para integração com API real do OPNsense e eliminar **todos os métodos MOCK** da `OPNsenseUI`.

---

## Contexto Técnico

### Arquivos Principais
- `/home/rluft/fazai-ng/src/opnsense-manager.ts` (CRIAR - não existe)
- `/home/rluft/fazai-ng/src/commands/api/opnsense-ui.ts` (UI com 100% mock - REFATORAR)
- `/home/rluft/fazai-ng/src/config-loader.ts` (config loader)

### Problema Atual

**OPNsenseUI é 100% MOCK!**

```typescript
// opnsense-ui.ts (linhas 563-652) - PROBLEMA!
export class OPNsenseUI {
  // TODOS os métodos são MOCK
  private async fetchFirewallRules(): Promise<any[]> {
    return [
      { id: "rule1", description: "Allow HTTP", ... },
    ];
  }

  private async fetchSystemStatus(): Promise<any> {
    return {
      cpu: "25%",
      memory: "2.1 GB / 8 GB",
      // ... dados fake
    };
  }

  // ... mais 12 métodos mock
}
```

**NÃO EXISTE OPNsenseManager** - Precisa ser criado do zero.

### Localização de Credenciais

Chaves estão em `/etc/fazai/fazai.conf`, `~/.env`, ou `/root/.env`:
```ini
OPNSENSE_API_URL=https://192.168.1.1
OPNSENSE_API_KEY=your_api_key_here
OPNSENSE_API_SECRET=your_api_secret_here
OPNSENSE_VERIFY_SSL=false
```

### API OPNsense

**Base URL:** `https://<opnsense-ip>/api/`
**Autenticação:** API Key + API Secret (Basic Auth)
**Formato:** JSON
**Documentação:** https://docs.opnsense.org/development/api.html

**Importante:** API OPNsense usa SSL auto-assinado por padrão → `OPNSENSE_VERIFY_SSL=false`

---

## Critérios de Aceitação

### 1. ✓ Criar OPNsenseManager Base

**Arquivo:** `/home/rluft/fazai-ng/src/opnsense-manager.ts`

```typescript
/**
 * OPNsense API Manager
 * Gerencia recursos OPNsense via API
 */

import { loadConfig } from './config-loader';
import { logger } from './logger';
import https from 'https';

interface OPNsenseFirewallRule {
  uuid: string;
  enabled: string; // "1" or "0"
  sequence: string;
  action: 'pass' | 'block' | 'reject';
  interface: string;
  protocol: string;
  source: {
    network: string;
    port?: string;
  };
  destination: {
    network: string;
    port?: string;
  };
  description: string;
}

interface OPNsenseNATRule {
  uuid: string;
  enabled: string;
  interface: string;
  protocol: string;
  target_ip: string;
  target_port: string;
  local_ip: string;
  local_port: string;
  description: string;
}

interface OPNsenseInterface {
  identifier: string;
  description: string;
  status: 'up' | 'down';
  ipv4: string;
  ipv6: string;
  mac: string;
  media: string;
}

export class OPNsenseManager {
  private apiUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private verifySsl: boolean;

  constructor() {
    const config = loadConfig();

    this.apiUrl = config.opnsenseApiUrl ||
                  process.env.OPNSENSE_API_URL ||
                  'https://192.168.1.1';

    this.apiKey = config.opnsenseApiKey || process.env.OPNSENSE_API_KEY || '';
    this.apiSecret = config.opnsenseApiSecret || process.env.OPNSENSE_API_SECRET || '';
    this.verifySsl = config.opnsenseVerifySsl !== 'false' &&
                     process.env.OPNSENSE_VERIFY_SSL !== 'false';

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('OPNSENSE_API_KEY e OPNSENSE_API_SECRET não configurados');
    }

    // Remove trailing slash
    this.apiUrl = this.apiUrl.replace(/\/$/, '');
  }

  /**
   * Faz requisição autenticada à API OPNsense
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.apiUrl}/api${endpoint}`;

    // Basic Auth com API Key + Secret
    const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

    const headers: Record<string, string> = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    // Agent para SSL auto-assinado
    const agent = !this.verifySsl
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;

    const response = await fetch(url, {
      ...options,
      headers,
      // @ts-ignore - agent não está tipado no fetch padrão
      agent,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OPNsense API error (${response.status}): ${errorText}`);
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

### 2. ✓ Implementar Métodos de Firewall

```typescript
/**
 * Lista regras de firewall
 */
async listFirewallRules(): Promise<OPNsenseFirewallRule[]> {
  const data = await this.request('/firewall/filter/searchRule');

  if (!data.rows) {
    return [];
  }

  return data.rows.map((rule: any) => ({
    uuid: rule.uuid,
    enabled: rule.enabled,
    sequence: rule.sequence,
    action: rule.action,
    interface: rule.interface,
    protocol: rule.protocol,
    source: {
      network: rule.source_net,
      port: rule.source_port,
    },
    destination: {
      network: rule.destination_net,
      port: rule.destination_port,
    },
    description: rule.description || '',
  }));
}

/**
 * Adiciona regra de firewall
 */
async addFirewallRule(rule: Partial<OPNsenseFirewallRule>): Promise<string> {
  const result = await this.request('/firewall/filter/addRule', {
    method: 'POST',
    body: JSON.stringify({ rule }),
  });

  if (result.result !== 'saved') {
    throw new Error('Falha ao adicionar regra de firewall');
  }

  logger.info(`Regra de firewall adicionada: ${rule.description}`);
  return result.uuid;
}

/**
 * Deleta regra de firewall
 */
async deleteFirewallRule(uuid: string): Promise<void> {
  await this.request(`/firewall/filter/delRule/${uuid}`, {
    method: 'POST',
  });

  logger.info(`Regra de firewall ${uuid} deletada`);
}

/**
 * Aplica mudanças no firewall (necessário após add/delete)
 */
async applyFirewallChanges(): Promise<void> {
  const result = await this.request('/firewall/filter/apply', {
    method: 'POST',
  });

  if (result.status !== 'OK') {
    throw new Error('Falha ao aplicar mudanças no firewall');
  }

  logger.info('Mudanças no firewall aplicadas');
}
```

### 3. ✓ Implementar Métodos de NAT/Port Forward

```typescript
/**
 * Lista regras de NAT (Port Forward)
 */
async listNATRules(): Promise<OPNsenseNATRule[]> {
  const data = await this.request('/firewall/nat/searchPortForward');

  if (!data.rows) {
    return [];
  }

  return data.rows.map((rule: any) => ({
    uuid: rule.uuid,
    enabled: rule.enabled,
    interface: rule.interface,
    protocol: rule.protocol,
    target_ip: rule.target,
    target_port: rule.local_port,
    local_ip: rule.target_ip,
    local_port: rule.target_port,
    description: rule.descr || '',
  }));
}

/**
 * Adiciona regra de Port Forward
 */
async addPortForward(rule: Partial<OPNsenseNATRule>): Promise<string> {
  const result = await this.request('/firewall/nat/addPortForward', {
    method: 'POST',
    body: JSON.stringify({ rule }),
  });

  if (result.result !== 'saved') {
    throw new Error('Falha ao adicionar Port Forward');
  }

  logger.info(`Port Forward adicionado: ${rule.description}`);
  return result.uuid;
}

/**
 * Deleta regra de Port Forward
 */
async deletePortForward(uuid: string): Promise<void> {
  await this.request(`/firewall/nat/delPortForward/${uuid}`, {
    method: 'POST',
  });

  logger.info(`Port Forward ${uuid} deletado`);
}

/**
 * Aplica mudanças no NAT
 */
async applyNATChanges(): Promise<void> {
  await this.request('/firewall/nat/apply', {
    method: 'POST',
  });

  logger.info('Mudanças no NAT aplicadas');
}
```

### 4. ✓ Implementar Métodos de Interfaces

```typescript
/**
 * Lista interfaces de rede
 */
async listInterfaces(): Promise<OPNsenseInterface[]> {
  const data = await this.request('/interfaces/overview/export');

  if (!data.interfaces) {
    return [];
  }

  return Object.entries(data.interfaces).map(([id, iface]: [string, any]) => ({
    identifier: id,
    description: iface.description || id,
    status: iface.status === 'up' ? 'up' : 'down',
    ipv4: iface.addr4 || 'N/A',
    ipv6: iface.addr6 || 'N/A',
    mac: iface.macaddr || 'N/A',
    media: iface.media || 'Unknown',
  }));
}
```

### 5. ✓ Implementar Métodos de VPN

```typescript
/**
 * Lista túneis VPN (IPsec)
 */
async listVPNTunnels(): Promise<any[]> {
  const data = await this.request('/ipsec/sessions/searchPhase1');

  if (!data.rows) {
    return [];
  }

  return data.rows.map((tunnel: any) => ({
    id: tunnel.ikeid,
    description: tunnel.description,
    remote: tunnel.remote_addr,
    status: tunnel.status === 'up' ? 'connected' : 'disconnected',
    type: tunnel.type || 'ikev2',
  }));
}

/**
 * Conecta túnel VPN
 */
async connectVPN(ikeid: string): Promise<void> {
  await this.request(`/ipsec/sessions/connect/${ikeid}`, {
    method: 'POST',
  });

  logger.info(`VPN tunnel ${ikeid} conectado`);
}

/**
 * Desconecta túnel VPN
 */
async disconnectVPN(ikeid: string): Promise<void> {
  await this.request(`/ipsec/sessions/disconnect/${ikeid}`, {
    method: 'POST',
  });

  logger.info(`VPN tunnel ${ikeid} desconectado`);
}
```

### 6. ✓ Implementar Métodos de Sistema

```typescript
/**
 * Obtém status do sistema
 */
async getSystemStatus(): Promise<any> {
  const activity = await this.request('/diagnostics/activity/getActivity');
  const interfaces = await this.listInterfaces();

  // CPU e memória
  const cpu = activity.cpu?.usage || 'N/A';
  const memory = activity.memory
    ? `${activity.memory.used} / ${activity.memory.total}`
    : 'N/A';

  // Disco
  const disk = activity.disk?.root
    ? `${activity.disk.root.used} / ${activity.disk.root.total}`
    : 'N/A';

  // Uptime
  const uptime = activity.uptime || 'N/A';

  // Interfaces ativas
  const activeInterfaces = interfaces.filter(i => i.status === 'up').length;

  return {
    cpu,
    memory,
    disk,
    uptime,
    activeInterfaces,
    totalInterfaces: interfaces.length,
  };
}

/**
 * Reinicia serviço
 */
async restartService(service: string): Promise<void> {
  await this.request(`/core/service/restart/${service}`, {
    method: 'POST',
  });

  logger.info(`Serviço ${service} reiniciado`);
}
```

### 7. ✓ Implementar Métodos de DHCP

```typescript
/**
 * Lista leases DHCP
 */
async listDHCPLeases(): Promise<any[]> {
  const data = await this.request('/dhcpv4/leases/searchLease');

  if (!data.rows) {
    return [];
  }

  return data.rows.map((lease: any) => ({
    ip: lease.address,
    mac: lease.mac,
    hostname: lease.hostname || 'Unknown',
    starts: lease.starts,
    ends: lease.ends,
    state: lease.state,
  }));
}
```

### 8. ✓ Refatorar OPNsenseUI

**Adicionar constructor e substituir TODOS os métodos mock:**

```typescript
export class OPNsenseUI {
  private manager: OPNsenseManager;

  constructor() {
    try {
      this.manager = new OPNsenseManager();
    } catch (error: any) {
      logger.warn(`OPNsense não configurado: ${error.message}`);
      this.manager = null as any;
    }
  }

  // Substituir fetchFirewallRules (linha 568-573)
  private async fetchFirewallRules(): Promise<any[]> {
    if (!this.manager) {
      throw new Error("OPNsense não configurado. Configure OPNSENSE_API_KEY e OPNSENSE_API_SECRET.");
    }
    return this.manager.listFirewallRules();
  }

  // Substituir fetchNATRules (linha 583-588)
  private async fetchNATRules(): Promise<any[]> {
    if (!this.manager) {
      throw new Error("OPNsense não configurado.");
    }
    return this.manager.listNATRules();
  }

  // ... substituir todos os outros métodos mock
}
```

### 9. ✓ Deletar Seção Mock

**DELETAR linhas 563-652** (seção "API Mock Methods") após refatoração completa.

### 10. ✓ Tratamento de Erros

Adicionar try/catch em todos os métodos da UI:

```typescript
try {
  const rules = await this.manager.listFirewallRules();
  // ... renderizar
} catch (error: any) {
  if (error.message.includes("não configurado")) {
    showError("Configure OPNsense em /etc/fazai/fazai.conf");
  } else if (error.message.includes("401") || error.message.includes("403")) {
    showError("Credenciais OPNsense inválidas");
  } else if (error.message.includes("ECONNREFUSED")) {
    showError("Não foi possível conectar ao OPNsense. Verifique OPNSENSE_API_URL.");
  } else {
    showError(`Erro ao acessar OPNsense: ${error.message}`);
  }
  throw error;
}
```

---

## Recursos Externos

- OPNsense API Docs: https://docs.opnsense.org/development/api.html
- Firewall Filter API: https://docs.opnsense.org/development/api/core/firewall.html
- NAT API: https://docs.opnsense.org/development/api/core/nat.html
- IPsec API: https://docs.opnsense.org/development/api/plugins/ipsec.html

---

## Notas Importantes

- **SSL Auto-assinado:** OPNsense usa certificado auto-assinado por padrão → usar `rejectUnauthorized: false`
- **Apply Changes:** Mudanças no firewall/NAT requerem chamada a `/apply` para serem ativadas
- **API versão:** Usar Core API (v1) - mais estável
- **TESTAR** com instância OPNsense real se disponível
- **ADICIONAR** tipos TypeScript para todas as respostas
- **PROIBIDO** manter qualquer método mock

---

## Checklist de Entrega

- [ ] OPNsenseManager criado em `src/opnsense-manager.ts`
- [ ] Autenticação (API Key + Secret)
- [ ] Suporte a SSL auto-assinado
- [ ] Métodos de firewall (list, add, delete, apply)
- [ ] Métodos de NAT/Port Forward (list, add, delete, apply)
- [ ] Métodos de interfaces (list)
- [ ] Métodos de VPN (list, connect, disconnect)
- [ ] Métodos de sistema (status, restart service)
- [ ] Métodos de DHCP (leases)
- [ ] OPNsenseUI refatorado com constructor
- [ ] Todos os métodos UI usando Manager
- [ ] Seção mock (linhas 563-652) deletada
- [ ] Tratamento de erro em todos os métodos
- [ ] Tipos TypeScript criados
- [ ] Testes unitários
- [ ] Testes manuais no CLI (`/opnsense`)
- [ ] CHANGELOG.md atualizado (v3.6.16-beta)
- [ ] Commit com mensagem descritiva
