import * as https from 'https'
import { loadConfig } from './config'
import { logger } from './logger'

// Interfaces para a configuração do OPNsenseManager
interface OPNsenseConfig {
  apiUrl: string
  apiKey: string
  apiSecret: string
  verifySSL: boolean
}

// Interface para as opções de uma requisição
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
}

// ============================================================================
// Tipos e Interfaces da API do OPNsense
// ============================================================================

export interface FirewallRule {
  id?: string;
  action: 'pass' | 'block' | 'reject';
  interface: string;
  protocol: string;
  source: string;
  destination: string;
  port: string;
  enabled: boolean;
}

export interface NATRule {
  id?: string;
  interface: string;
  protocol: string;
  externalPort: string;
  internalIP: string;
  internalPort: string;
  enabled: boolean;
}

export interface VPNTunnel {
  ikeid?: string;
  descr?: string;
  'remote-gw'?: string;
  status?: string;
}

export interface NetworkInterface {
  name?: string;
  device?: string;
  ipaddr?: string;
  gateway?: string;
  status?: string;
  macaddr?: string;
}

export interface DHCPLease {
  address?: string;
  mac?: string;
  hostname?: string;
  descr?: string;
  status?: string;
}

export interface SystemStatus {
  hostname?: string;
  product_version?: string;
  cpu_usage?: number;
  mem_usage?: number;
  temp?: number;
}

/**
 * OPNsenseManager
 *
 * Classe para interagir com a API do OPNsense,
 * abstraindo a complexidade das chamadas HTTP, autenticação e tratamento de SSL.
 *
 * Refatorado para usar endpoints MVC corretos (firewall/filter/...).
 */
export class OPNsenseManager {
  private config: OPNsenseConfig
  private httpsAgent: https.Agent

  constructor() {
    const loadedConfig = loadConfig()

    this.config = {
      apiUrl: loadedConfig.opnsenseApiUrl || '',
      apiKey: loadedConfig.opnsenseApiKey || '',
      apiSecret: loadedConfig.opnsenseApiSecret || '',
      verifySSL: loadedConfig.opnsenseVerifySsl !== 'false',
    }

    if (!this.config.apiUrl || !this.config.apiKey || !this.config.apiSecret) {
      throw new Error('As credenciais da API do OPNsense não foram configuradas em fazai.conf.')
    }

    this.httpsAgent = new https.Agent({
      rejectUnauthorized: this.config.verifySSL,
    })
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body = null } = options
    const url = `${this.config.apiUrl}/api/${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64'),
    }

    try {
      logger.debug(`OPNsense Request: ${method} ${url}`);
      const response = await fetch(url, {
        method,
        headers,
        // @ts-ignore - Node.js fetch supports agent
        agent: this.httpsAgent,
        body: body ? JSON.stringify(body) : null,
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`Erro na API do OPNsense: ${response.status} ${response.statusText} - ${errorBody}`)
      }

      if (response.status === 204) {
        return {} as T
      }

      return response.json() as Promise<T>
    } catch (error: any) {
      throw new Error(`Falha ao se comunicar com a API do OPNsense em ${url}: ${error.message}`)
    }
  }

  // ============================================================================
  // Métodos de Firewall (MVC API)
  // ============================================================================

  async listFirewallRules(): Promise<FirewallRule[]> {
    // searchRule retorna { rows: [...] }
    const response = await this.request<any>('firewall/filter/searchRule');
    const rows = response.rows || [];

    return rows.map((r: any) => ({
      id: r.uuid,
      action: r.action || 'pass',
      interface: r.interface || 'lan',
      protocol: r.protocol || 'any',
      source: r.source_net || 'any',
      destination: r.destination_net || 'any',
      port: r.destination_port || '',
      enabled: r.enabled === '1',
    }))
  }

  async addFirewallRule(rule: FirewallRule): Promise<void> {
    const payload = {
      rule: {
        action: rule.action,
        interface: rule.interface,
        protocol: rule.protocol,
        source_net: rule.source,
        destination_net: rule.destination,
        destination_port: rule.port,
        enabled: rule.enabled ? '1' : '0',
        description: 'Created by FazAI'
      }
    };
    await this.request('firewall/filter/addRule', {
      method: 'POST',
      body: payload,
    })
  }

  async deleteFirewallRule(uuid: string): Promise<void> {
    await this.request(`firewall/filter/delRule/${uuid}`, {
      method: 'POST',
    })
  }

  async applyFirewallChanges(): Promise<void> {
    await this.request('firewall/filter/apply', {
      method: 'POST',
    })
  }

  // ============================================================================
  // Métodos de NAT (Port Forward)
  // Nota: A API de NAT Port Forward (firewall/nat) pode não estar disponível em todas as versões.
  // ============================================================================

  async listNATRules(): Promise<NATRule[]> {
    // Tentativa best-effort usando endpoint comum ou placeholder
    try {
      const response = await this.request<any>('firewall/nat/get');
      // Se a API antiga existir, pode retornar { nat: { rule: ... } }
      const rules = response.nat?.rule || {};
      return Object.values(rules).map((r: any) => ({
        id: r.uuid || r.id,
        interface: r.interface,
        protocol: r.protocol,
        externalPort: r.dstport,
        internalIP: r.target,
        internalPort: r['local-port'],
        enabled: r.enabled === '1',
      }));
    } catch (e) {
      logger.warn("Falha ao listar regras NAT (endpoint pode não existir): " + e);
      return [];
    }
  }

  async addPortForward(rule: NATRule): Promise<void> {
    // Placeholder - endpoint exato de NAT/PortForward varia
    logger.warn("Adicionar Port Forward via API pode não ser suportado nesta versão.");
    await this.request('firewall/nat/add', {
      method: 'POST',
      body: rule,
    })
  }

  async deletePortForward(uuid: string): Promise<void> {
    await this.request(`firewall/nat/del/${uuid}`, {
      method: 'POST',
    })
  }

  async applyNATChanges(): Promise<void> {
    await this.request('firewall/nat/apply', {
      method: 'POST',
    })
  }

  // ============================================================================
  // Métodos de Interfaces, VPN, Sistema e DHCP
  // ============================================================================

  async listInterfaces(): Promise<NetworkInterface[]> {
    // Retorna objeto { "wan": {...}, "lan": {...} }
    const data = await this.request<any>('interfaces/overview/interfacesInfo');

    return Object.keys(data).map(key => {
      const iface = data[key];
      return {
        name: iface.descr || key.toUpperCase(),
        device: iface.config?.if || iface.identifier,
        ipaddr: iface.ipaddr,
        gateway: iface.gateway,
        status: iface.status,
        macaddr: iface.macaddr
      };
    });
  }

  async listVPNTunnels(): Promise<VPNTunnel[]> {
    // Tenta usar endpoint IPsec MVC
    try {
      const response = await this.request<any>('ipsec/connections/search'); // ou tunnel/search
      const rows = response.rows || [];
      return rows.map((r: any) => ({
        ikeid: r.uuid,
        descr: r.description,
        'remote-gw': r.remote_gateway,
        status: r.enabled === '1' ? 'active' : 'disabled'
      }));
    } catch (e) {
       // Fallback para legacy se necessário
       return [];
    }
  }

  async connectVPN(ikeid: string): Promise<void> {
    await this.request(`ipsec/service/connect/${ikeid}`, { method: 'POST' })
  }

  async disconnectVPN(ikeid: string): Promise<void> {
    await this.request(`ipsec/service/disconnect/${ikeid}`, { method: 'POST' })
  }

  async getSystemStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('core/firmware/status')
  }

  async restartService(service: string): Promise<void> {
    await this.request(`core/service/restart/${service}`, { method: 'POST' })
  }

  async listDHCPLeases(): Promise<DHCPLease[]> {
    // dhcpv4/leases/searchLease
    const response = await this.request<any>('dhcpv4/leases/searchLease');
    const rows = response.rows || [];
    return rows.map((r: any) => ({
      address: r.address,
      mac: r.mac,
      hostname: r.hostname,
      descr: r.description,
      status: r.status
    }));
  }
}
