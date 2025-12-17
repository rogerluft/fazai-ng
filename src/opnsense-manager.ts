import * as https from 'https'
import { loadConfig } from './config'

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
  // Métodos de Firewall
  // ============================================================================

  async listFirewallRules(): Promise<FirewallRule[]> {
    const { rule: rules } = await this.request<any>('firewall/filter/get')
    return Object.values(rules).map((r: any) => ({
      id: r.id,
      action: r.action,
      interface: r.interface,
      protocol: r.protocol,
      source: r.source.any ? 'any' : r.source.address,
      destination: r.destination.any ? 'any' : r.destination.address,
      port: r.destination.port,
      enabled: r.enabled === '1',
    }))
  }

  async addFirewallRule(rule: FirewallRule): Promise<void> {
    await this.request('firewall/filter/add', {
      method: 'POST',
      body: rule,
    })
  }

  async deleteFirewallRule(uuid: string): Promise<void> {
    await this.request(`firewall/filter/del/${uuid}`, {
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
  // ============================================================================

  async listNATRules(): Promise<NATRule[]> {
    const { rule: rules } = await this.request<any>('firewall/nat/get')
    return Object.values(rules).map((r: any) => ({
      id: r.id,
      interface: r.interface,
      protocol: r.protocol,
      externalPort: r.dstport,
      internalIP: r.target,
      internalPort: r['local-port'],
      enabled: r.enabled === '1',
    }))
  }

  async addPortForward(rule: NATRule): Promise<void> {
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
    return this.request<NetworkInterface[]>('interfaces/overview/get')
  }

  async listVPNTunnels(): Promise<VPNTunnel[]> {
    return this.request<VPNTunnel[]>('ipsec/tunnels/get')
  }

  async connectVPN(ikeid: string): Promise<void> {
    await this.request(`ipsec/tunnels/connect/${ikeid}`, { method: 'POST' })
  }

  async disconnectVPN(ikeid: string): Promise<void> {
    await this.request(`ipsec/tunnels/disconnect/${ikeid}`, { method: 'POST' })
  }

  async getSystemStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('core/firmware/status')
  }

  async restartService(service: string): Promise<void> {
    await this.request(`core/service/restart/${service}`, { method: 'POST' })
  }

  async listDHCPLeases(): Promise<DHCPLease[]> {
    return this.request<DHCPLease[]>('dhcpd/leases/get')
  }
}
