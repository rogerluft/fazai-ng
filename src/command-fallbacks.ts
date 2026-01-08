/**
 * Command Fallback System for FazAI
 *
 * Provides reliable fallback commands for common Linux admin tasks
 * when LLM generates invalid or incomplete commands.
 *
 * @author Roger Luft
 * @version 3.14.8
 */

import { LinuxCommand } from "./types-linux";

/**
 * Intent types for common Linux admin tasks
 * These map user requests to known-good commands
 */
export type CommandIntent =
  | "disk_usage"
  | "system_info"
  | "memory_usage"
  | "list_files"
  | "network_info"
  | "process_list"
  | "uptime"
  | "who_logged"
  | "kernel_info";

/**
 * Patterns to match user requests to intents
 * Supports both Portuguese and English
 */
const INTENT_PATTERNS: Record<CommandIntent, RegExp[]> = {
  disk_usage: [
    /disco.*usado/i,
    /uso.*disco/i,
    /espa[çc]o.*disco/i,
    /disk.*usage/i,
    /disk.*space/i,
    /quanto.*disco/i,
    /^df\b/i,
  ],
  system_info: [
    /informa[çc][õo].*sistema/i,
    /sistema.*operacional/i,
    /system.*info/i,
    /os.*info/i,
    /qual.*sistema/i,
    /vers[aã]o.*sistema/i,
  ],
  memory_usage: [
    /mem[oó]ria/i,
    /memory.*usage/i,
    /uso.*ram/i,
    /ram.*uso/i,
    /^free\b/i,
  ],
  list_files: [
    /list.*arquivos/i,
    /arquivos.*diret[oó]rio/i,
    /mostrar.*arquivos/i,
    /^ls\b/i,
    /list.*files/i,
    /liste.*arquivos/i,
  ],
  network_info: [
    /config.*rede/i,
    /rede.*config/i,
    /network.*info/i,
    /ip.*addr/i,
    /interface.*rede/i,
    /endere[çc]o.*ip/i,
  ],
  process_list: [
    /processos/i,
    /process.*list/i,
    /^ps\b/i,
    /^top\b/i,
    /o que.*rodando/i,
    /running.*process/i,
  ],
  uptime: [
    /uptime/i,
    /tempo.*ligado/i,
    /quanto.*tempo.*sistema/i,
    /system.*uptime/i,
  ],
  who_logged: [
    /quem.*logado/i,
    /usu[aá]rios.*logados/i,
    /who.*logged/i,
    /^who\b/i,
    /^w\b/i,
  ],
  kernel_info: [
    /kernel/i,
    /vers[aã]o.*kernel/i,
    /^uname\b/i,
  ],
};

/**
 * Fallback commands for each intent
 * These are guaranteed to work on standard Linux systems
 */
const FALLBACK_COMMANDS: Record<CommandIntent, LinuxCommand> = {
  disk_usage: {
    command: "df -h",
    explain: "Mostra uso de disco em formato legível para humanos",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  system_info: {
    command: "uname -a && cat /etc/os-release 2>/dev/null || hostnamectl",
    explain: "Mostra informações completas do sistema operacional",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  memory_usage: {
    command: "free -h",
    explain: "Mostra uso de memória RAM em formato legível",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  list_files: {
    command: "ls -la",
    explain: "Lista todos os arquivos do diretório atual com detalhes",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  network_info: {
    command: "ip addr show || ifconfig",
    explain: "Mostra configuração de interfaces de rede",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  process_list: {
    command: "ps aux --sort=-%mem | head -20",
    explain: "Lista os 20 processos que mais consomem memória",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  uptime: {
    command: "uptime",
    explain: "Mostra tempo que o sistema está ligado e carga média",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  who_logged: {
    command: "who",
    explain: "Mostra usuários logados no sistema",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  kernel_info: {
    command: "uname -r",
    explain: "Mostra versão do kernel Linux",
    riskLevel: "low",
    requiresConfirmation: false,
  },
};

/**
 * Match a user request to a known intent
 *
 * @param request - The user's request in natural language
 * @returns The matched intent or null if no match
 */
export function matchIntent(request: string): CommandIntent | null {
  const normalized = request.toLowerCase().trim();

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return intent as CommandIntent;
      }
    }
  }

  return null;
}

/**
 * Get a fallback command for a known intent
 *
 * @param intent - The command intent
 * @returns The fallback command or null
 */
export function getFallbackCommand(intent: CommandIntent): LinuxCommand | null {
  return FALLBACK_COMMANDS[intent] || null;
}

/**
 * Try to get a fallback command for a user request
 *
 * This is the main entry point for the fallback system.
 * Returns null if no matching intent is found, allowing
 * the system to continue with normal AI command generation.
 *
 * @param request - The user's request in natural language
 * @returns The fallback command or null
 */
export function tryGetFallbackForRequest(request: string): LinuxCommand | null {
  const intent = matchIntent(request);
  if (!intent) return null;
  return getFallbackCommand(intent);
}

/**
 * Get all available intents (for help/documentation)
 */
export function getAvailableIntents(): CommandIntent[] {
  return Object.keys(FALLBACK_COMMANDS) as CommandIntent[];
}
