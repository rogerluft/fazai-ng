import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { loadConfig } from './config';

// Interfaces para a tipagem dos dados da API SpamExperts
// Baseado nos mocks de spamexperts-ui.ts e na documentação da API

export interface SpamExpertsDomain {
  id: number;
  domain: string;
  status: 'active' | 'disabled';
  emailsToday: number;
  spamBlocked: number;
  quarantined: number;
  destination: string;
}

export interface QuarantineMessage {
  id: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  score: number;
}

export interface SpamExpertsReport {
  totalEmails: number;
  spamBlocked: number;
  cleanEmails: number;
  quarantined: number;
  blockRate: string;
  byDomain: Array<{
    domain: string;
    total: number;
    spam: number;
    clean: number;
  }>;
}

export interface SpamExpertsListItem {
  entry: string;
  type: 'Email' | 'Domain';
  added: string;
}

export interface SpamExpertsSettings {
  spamScore: number;
  spamAction: 'quarantine' | 'reject' | 'allow';
  notifications: boolean;
  autoWhitelist: boolean;
}

/**
 * SpamExpertsManager
 *
 * Classe responsável pela comunicação com a API do SpamExperts.
 * Abstrai os detalhes de autenticação e requisições HTTP.
 */
export class SpamExpertsManager {
  private apiClient: AxiosInstance;
  private apiKey?: string;
  private username?: string;
  private password?: string;

  constructor() {
    const config = loadConfig();

    this.apiKey = config.spamexpertsApiKey;
    this.username = config.spamexpertsUsername;
    this.password = config.spamexpertsPassword;

    const apiUrl = config.spamexpertsApiUrl || 'https://api.antispamcloud.com/';

    if (!this.apiKey && (!this.username || !this.password)) {
      throw new Error('Credenciais da API do SpamExperts não configuradas em fazai.conf.');
    }

    this.apiClient = axios.create({
      baseURL: apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Métodos de Domínio
  async listDomains(): Promise<SpamExpertsDomain[]> {
    return this.request('get', 'domain/get');
  }
  async addDomain(domain: string, destination: string): Promise<void> {
    return this.request('post', 'domain/add', { domain, destination });
  }
  async removeDomain(domain: string): Promise<void> {
    return this.request('post', 'domain/remove', { domain });
  }

  // Métodos de Quarentena
  async listQuarantine(domain?: string, limit: number = 50): Promise<QuarantineMessage[]> {
    return this.request('get', 'quarantine/list', { domain, limit });
  }
  async releaseMessage(messageId: string): Promise<void> {
    return this.request('post', 'quarantine/release', { messageId });
  }
  async deleteMessage(messageId: string): Promise<void> {
    return this.request('post', 'quarantine/delete', { messageId });
  }

  // Métodos de Relatório
  async getReport(period: '24h' | '7d' | '30d'): Promise<SpamExpertsReport> {
    return this.request('get', 'report/get', { period });
  }

  // Métodos de Whitelist/Blacklist
  async listList(type: 'whitelist' | 'blacklist'): Promise<SpamExpertsListItem[]> {
    return this.request('get', 'email_list/get', { type });
  }
  async addToList(type: 'whitelist' | 'blacklist', entry: string): Promise<void> {
    return this.request('post', 'email_list/add', { type, entry });
  }
  async removeFromList(type: 'whitelist' | 'blacklist', entry: string): Promise<void> {
    return this.request('post', 'email_list/remove', { type, entry });
  }

  // Métodos de Configuração
  async getSettings(): Promise<SpamExpertsSettings> {
    return this.request('get', 'settings/get');
  }
  async updateSettings(settings: Partial<SpamExpertsSettings>): Promise<void> {
    return this.request('post', 'settings/update', settings);
  }

  /**
   * Método privado para realizar as requisições à API.
   */
  private async request<T>(method: 'get' | 'post' | 'put' | 'delete', path: string, payload?: any): Promise<T> {
    const config: AxiosRequestConfig = {
      method,
      url: `/api/${path}`,
    };

    if (method === 'get') {
      config.params = payload;
    } else {
      config.data = payload;
    }

    if (this.apiKey) {
      config.headers = { ...config.headers, 'Authorization': `ApiKey ${this.apiKey}` };
    } else if (this.username && this.password) {
      config.auth = { username: this.username, password: this.password };
    }

    try {
      const response = await this.apiClient.request(config);
      // Supondo que a resposta bem-sucedida contenha os dados diretamente
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const { status, data } = error.response;
        let errorMessage = `Erro na API SpamExperts (${status})`;
        if (data && (data.message || data.error)) {
          errorMessage += `: ${data.message || data.error}`;
        }
        throw new Error(errorMessage);
      }
      throw new Error(`Erro de comunicação com a API do SpamExperts: ${(error as Error).message}`);
    }
  }
}
