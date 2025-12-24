/**
 * @file Jules API Client - Integração com Jules API REST do Google
 * @description Cliente TypeScript para interagir com a API REST do Jules (Google),
 * permitindo criar sessões, enviar mensagens e gerenciar repositórios remotos.
 * @module src/orchestrator/jules-api-client
 * @see https://jules.googleapis.com/v1alpha
 */

import { getConfigValue } from '../config';
import { logger } from '../logger';

/**
 * @constant BASE_URL
 * @description URL base da API Jules do Google
 */
const BASE_URL = 'https://jules.googleapis.com/v1alpha';

/**
 * @interface Source
 * @description Representa um repositório ou fonte de código disponível no Jules
 * @property {string} name - Nome identificador da fonte (formato: sources/github/owner/repo)
 * @property {string} displayName - Nome legível da fonte
 * @property {string} [description] - Descrição opcional da fonte
 */
export interface Source {
  name: string;
  displayName: string;
  description?: string;
}

/**
 * @interface ListSourcesResponse
 * @description Resposta da API ao listar fontes disponíveis
 * @property {Source[]} sources - Array de fontes/repositórios disponíveis
 * @property {string} [nextPageToken] - Token para paginação (se houver mais resultados)
 */
export interface ListSourcesResponse {
  sources: Source[];
  nextPageToken?: string;
}

/**
 * @interface GitHubRepoContext
 * @description Contexto específico para repositórios GitHub
 * @property {string} startingBranch - Branch inicial para trabalhar (ex: "main", "develop")
 * @property {string} [targetBranch] - Branch de destino para merge/PR
 */
export interface GitHubRepoContext {
  startingBranch: string;
  targetBranch?: string;
}

/**
 * @interface SourceContext
 * @description Contexto da fonte de código para criar uma sessão
 * @property {string} source - Nome da fonte (formato: sources/github/owner/repo)
 * @property {GitHubRepoContext} [githubRepoContext] - Contexto específico do GitHub
 */
export interface SourceContext {
  source: string;
  githubRepoContext?: GitHubRepoContext;
}

/**
 * @interface CreateSessionRequest
 * @description Payload para criar uma nova sessão de trabalho
 * @property {string} prompt - Descrição da tarefa que Jules deve executar
 * @property {SourceContext} sourceContext - Contexto do repositório/fonte
 */
export interface CreateSessionRequest {
  prompt: string;
  sourceContext: SourceContext;
}

/**
 * @interface Session
 * @description Representa uma sessão de trabalho do Jules
 * @property {string} name - Nome/ID da sessão (formato: sessions/{sessionId})
 * @property {string} state - Estado atual (ACTIVE, COMPLETED, FAILED, etc.)
 * @property {string} createTime - Timestamp ISO de criação
 * @property {string} [updateTime] - Timestamp ISO da última atualização
 * @property {string} [plan] - Plano de execução proposto pelo Jules
 * @property {Message[]} [messages] - Histórico de mensagens
 */
export interface Session {
  name: string;
  state: string;
  createTime: string;
  updateTime?: string;
  plan?: string;
  messages?: Message[];
}

/**
 * @interface Message
 * @description Representa uma mensagem em uma sessão
 * @property {string} role - Papel (user, assistant)
 * @property {string} content - Conteúdo da mensagem
 * @property {string} createTime - Timestamp ISO de criação
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  createTime: string;
}

/**
 * @interface SendMessageRequest
 * @description Payload para enviar mensagem em uma sessão
 * @property {string} content - Conteúdo da mensagem
 */
export interface SendMessageRequest {
  content: string;
}

/**
 * @interface SendMessageResponse
 * @description Resposta ao enviar uma mensagem
 * @property {string} messageId - ID da mensagem enviada
 * @property {string} [response] - Resposta do Jules
 * @property {string} state - Estado atualizado da sessão
 */
export interface SendMessageResponse {
  messageId: string;
  response?: string;
  state: string;
}

/**
 * @interface ListSessionsResponse
 * @description Resposta ao listar sessões
 * @property {Session[]} sessions - Array de sessões
 * @property {string} [nextPageToken] - Token para paginação
 */
export interface ListSessionsResponse {
  sessions: Session[];
  nextPageToken?: string;
}

/**
 * @interface JulesAPIError
 * @description Estrutura de erro retornada pela API Jules
 * @property {number} code - Código HTTP do erro
 * @property {string} message - Mensagem de erro
 * @property {string} [status] - Status textual (ex: "PERMISSION_DENIED")
 * @property {any} [details] - Detalhes adicionais do erro
 */
export interface JulesAPIError {
  code: number;
  message: string;
  status?: string;
  details?: any;
}

/**
 * @class JulesAPIClient
 * @description Cliente para interagir com a API REST do Jules
 */
export class JulesAPIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * Cria uma instância do cliente Jules API
   * @param {string} [apiKey] - Chave da API (se não fornecida, lê de JULES_API_KEY no config)
   * @param {string} [baseUrl] - URL base customizada (padrão: https://jules.googleapis.com/v1alpha)
   * @throws {Error} Se a chave da API não for encontrada
   */
  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || getConfigValue('JULES_API_KEY') || '';
    this.baseUrl = baseUrl || BASE_URL;

    if (!this.apiKey) {
      const error = 'JULES_API_KEY não encontrada. Configure com: fazai config set JULES_API_KEY "sua-chave"';
      logger.error(error);
      throw new Error(error);
    }

    logger.debug(`JulesAPIClient inicializado com baseUrl: ${this.baseUrl}`);
  }

  /**
   * Realiza uma requisição HTTP para a API Jules
   * @private
   * @param {string} endpoint - Endpoint da API (ex: "/sources", "/sessions")
   * @param {RequestInit} [options] - Opções do fetch
   * @returns {Promise<T>} Resposta parseada como JSON
   * @throws {Error} Em caso de erro HTTP ou de rede
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey,
      ...options.headers,
    };

    logger.debug(`Jules API request: ${options.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const responseText = await response.text();
      let data: any;

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        logger.warn(`Resposta não é JSON válido: ${responseText}`);
        data = { raw: responseText };
      }

      if (!response.ok) {
        const error: JulesAPIError = {
          code: response.status,
          message: data.error?.message || data.message || response.statusText,
          status: data.error?.status || data.status,
          details: data.error?.details || data.details,
        };
        // Lança um erro para ser tratado e logado de forma centralizada no bloco catch.
        const apiError = new Error(`Jules API error [${error.code}]: ${error.message}`);
        (apiError as any).julesErrorDetails = error;
        throw apiError;
      }

      logger.debug(`Jules API response: ${response.status}`, data);
      return data as T;
    } catch (error: any) {
      if ((error as any).julesErrorDetails) {
        // Erro da API, log formatado. O erro já tem uma mensagem descritiva.
        logger.error(error.message, (error as any).julesErrorDetails);
        throw error; // Propaga o erro original da API.
      } else {
        // Erro de rede ou outro erro inesperado.
        const networkError = new Error(`Erro de rede ao acessar Jules API: ${error.message}`);
        logger.error(networkError.message, { endpoint, originalError: error });
        throw networkError; // Lança um novo erro mais descritivo.
      }
    }
  }

  /**
   * Lista todos os repositórios/fontes disponíveis
   * @param {number} [pageSize=50] - Número de resultados por página
   * @param {string} [pageToken] - Token para paginação
   * @returns {Promise<ListSourcesResponse>} Lista de fontes disponíveis
   * @example
   * const client = new JulesAPIClient();
   * const sources = await client.listSources();
   * console.log(sources.sources.map(s => s.name));
   */
  async listSources(pageSize: number = 50, pageToken?: string): Promise<ListSourcesResponse> {
    logger.info('Listando fontes disponíveis no Jules...');

    const params = new URLSearchParams();
    if (pageSize) params.append('pageSize', pageSize.toString());
    if (pageToken) params.append('pageToken', pageToken);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await this.request<ListSourcesResponse>(`/sources${queryString}`);

    logger.info(`Encontradas ${response.sources?.length || 0} fontes`);
    return response;
  }

  /**
   * Cria uma nova sessão de trabalho para o Jules
   * @param {string} prompt - Descrição da tarefa (ex: "Fix the bug in auth.ts")
   * @param {SourceContext} sourceContext - Contexto do repositório
   * @returns {Promise<Session>} Sessão criada
   * @example
   * const session = await client.createSession(
   *   "Fix authentication bug in src/auth.ts",
   *   {
   *     source: "sources/github/owner/repo",
   *     githubRepoContext: { startingBranch: "main" }
   *   }
   * );
   */
  async createSession(prompt: string, sourceContext: SourceContext): Promise<Session> {
    logger.info(`Criando nova sessão Jules com prompt: "${prompt}"`);

    const payload: CreateSessionRequest = {
      prompt,
      sourceContext,
    };

    const session = await this.request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    logger.info(`Sessão criada: ${session.name} (estado: ${session.state})`);
    return session;
  }

  /**
   * Envia uma mensagem para uma sessão existente
   * @param {string} sessionId - ID da sessão (formato: "sessions/123" ou apenas "123")
   * @param {string} message - Mensagem a enviar
   * @returns {Promise<SendMessageResponse>} Resposta do Jules
   * @example
   * const response = await client.sendMessage(
   *   "sessions/abc123",
   *   "Please also add unit tests for the fix"
   * );
   */
  async sendMessage(sessionId: string, content: string): Promise<SendMessageResponse> {
    // Normaliza sessionId (aceita "123" ou "sessions/123")
    const normalizedId = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;

    logger.info(`Enviando mensagem para ${normalizedId}: "${content}"`);

    const payload: SendMessageRequest = {
      content,
    };

    const response = await this.request<SendMessageResponse>(`/${normalizedId}:sendMessage`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    logger.info(`Mensagem enviada. Estado da sessão: ${response.state}`);
    return response;
  }

  /**
   * Obtém detalhes de uma sessão específica
   * @param {string} sessionId - ID da sessão (formato: "sessions/123" ou apenas "123")
   * @returns {Promise<Session>} Detalhes da sessão
   * @example
   * const session = await client.getSession("sessions/abc123");
   * console.log(`Estado: ${session.state}`);
   * console.log(`Plano: ${session.plan}`);
   */
  async getSession(sessionId: string): Promise<Session> {
    // Normaliza sessionId
    const normalizedId = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;

    logger.info(`Obtendo detalhes da sessão ${normalizedId}...`);

    const session = await this.request<Session>(`/${normalizedId}`);

    logger.info(`Sessão ${normalizedId}: estado=${session.state}, atualizada em ${session.updateTime}`);
    return session;
  }

  /**
   * Lista todas as sessões do usuário
   * @param {number} [pageSize=50] - Número de resultados por página
   * @param {string} [pageToken] - Token para paginação
   * @returns {Promise<ListSessionsResponse>} Lista de sessões
   * @example
   * const sessions = await client.listSessions();
   * for (const session of sessions.sessions) {
   *   console.log(`${session.name}: ${session.state}`);
   * }
   */
  async listSessions(pageSize: number = 50, pageToken?: string): Promise<ListSessionsResponse> {
    logger.info('Listando sessões Jules...');

    const params = new URLSearchParams();
    if (pageSize) params.append('pageSize', pageSize.toString());
    if (pageToken) params.append('pageToken', pageToken);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await this.request<ListSessionsResponse>(`/sessions${queryString}`);

    logger.info(`Encontradas ${response.sessions?.length || 0} sessões`);
    return response;
  }

  /**
   * Deleta uma sessão específica
   * @param {string} sessionId - ID da sessão (formato: "sessions/123" ou apenas "123")
   * @returns {Promise<void>}
   * @example
   * await client.deleteSession("sessions/abc123");
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Normaliza sessionId
    const normalizedId = sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;

    logger.info(`Deletando sessão ${normalizedId}...`);

    await this.request<void>(`/${normalizedId}`, {
      method: 'DELETE',
    });

    logger.info(`Sessão ${normalizedId} deletada com sucesso`);
  }

  /**
   * Helper: Extrai ID de sessão de uma string (remove prefixo "sessions/" se presente)
   * @param {string} sessionName - Nome completo ou ID da sessão
   * @returns {string} ID da sessão sem prefixo
   * @example
   * extractSessionId("sessions/abc123") // "abc123"
   * extractSessionId("abc123") // "abc123"
   */
  static extractSessionId(sessionName: string): string {
    return sessionName.replace(/^sessions\//, '');
  }

  /**
   * Helper: Formata ID de sessão com prefixo "sessions/"
   * @param {string} sessionId - ID da sessão
   * @returns {string} Nome completo da sessão
   * @example
   * formatSessionName("abc123") // "sessions/abc123"
   * formatSessionName("sessions/abc123") // "sessions/abc123"
   */
  static formatSessionName(sessionId: string): string {
    return sessionId.startsWith('sessions/') ? sessionId : `sessions/${sessionId}`;
  }
}

/**
 * Factory function para criar instância do cliente
 * @param {string} [apiKey] - Chave da API (opcional, lê do config se não fornecida)
 * @returns {JulesAPIClient} Instância do cliente
 * @example
 * import { createJulesAPIClient } from './jules-api-client';
 * const client = createJulesAPIClient();
 * const sources = await client.listSources();
 */
export function createJulesAPIClient(apiKey?: string): JulesAPIClient {
  return new JulesAPIClient(apiKey);
}

/**
 * Singleton instance (lazy-initialized)
 * @example
 * import { julesApiClient } from './jules-api-client';
 * const session = await julesApiClient.createSession(...);
 */
let _defaultClient: JulesAPIClient | null = null;

export function getJulesAPIClient(): JulesAPIClient {
  if (!_defaultClient) {
    _defaultClient = new JulesAPIClient();
  }
  return _defaultClient;
}

// Export singleton para uso direto
export const julesApiClient = {
  get instance(): JulesAPIClient {
    return getJulesAPIClient();
  },
};
