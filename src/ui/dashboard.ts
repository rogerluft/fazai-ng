import chalk from "chalk";
import { showBanner, showSection } from "./banner";
import { renderTable, TableColumn, statusColor } from "./table";
import boxen from "boxen";

/**
 * Estatística para exibição em boxes lado a lado
 */
export interface Stat {
  /** Label da estatística */
  label: string;
  /** Valor da estatística */
  value: string;
  /** Cor do box (green, yellow, red, blue, cyan) */
  color: "green" | "yellow" | "red" | "blue" | "cyan" | "magenta";
  /** Ícone emoji */
  icon?: string;
}

/**
 * Renderiza boxes de estatísticas lado a lado
 *
 * @param stats - Array de estatísticas
 */
function renderStatsBoxes(stats: Stat[]): void {
  const terminalWidth = process.stdout.columns || 80;
  const boxWidth = Math.floor((terminalWidth - stats.length * 2) / stats.length);

  const boxes = stats.map((stat) => {
    const icon = stat.icon ? `${stat.icon} ` : "";
    const content = `${icon}${chalk.bold(stat.label)}\n${chalk[stat.color](stat.value)}`;

    return boxen(content, {
      padding: 1,
      width: boxWidth,
      borderStyle: "round",
      borderColor: stat.color as any,
      textAlignment: "center",
    });
  });

  // Imprime boxes lado a lado (simulação, boxen não suporta nativamente)
  const lines = boxes.map((box) => box.split("\n"));
  const maxLines = Math.max(...lines.map((l) => l.length));

  for (let i = 0; i < maxLines; i++) {
    const line = lines
      .map((boxLines) => {
        const boxLine = boxLines[i] || "";
        // Preenche com espaços se a linha for mais curta
        return boxLine.padEnd(boxWidth + 10); // +10 para compensar códigos ANSI
      })
      .join("  ");
    console.log(line);
  }
  console.log("");
}

/**
 * Informações do sistema para o dashboard
 */
export interface SystemInfo {
  cpu: string;
  memory: string;
  disk: string;
  uptime?: string;
}

/**
 * Comando recente para histórico
 */
export interface RecentCommand {
  timestamp: string;
  command: string;
  status: "success" | "error" | "pending";
  user?: string;
}

/**
 * Status de API externa
 */
export interface APIStatus {
  name: string;
  status: "online" | "offline" | "degraded";
  responseTime?: string;
  lastCheck?: string;
}

/**
 * Opções do dashboard
 */
export interface DashboardOptions {
  /** Exibir informações do sistema */
  showSystem?: boolean;
  /** Exibir comandos recentes */
  showCommands?: boolean;
  /** Exibir status de APIs */
  showAPIs?: boolean;
  /** Limpar tela antes de exibir */
  clearScreen?: boolean;
}

/**
 * Dados do dashboard
 */
export interface DashboardData {
  system?: SystemInfo;
  recentCommands?: RecentCommand[];
  apiStatus?: APIStatus[];
}

/**
 * Exibe dashboard visual completo do FazAI
 *
 * @param data - Dados para exibir no dashboard
 * @param options - Opções de exibição
 *
 * @example
 * ```typescript
 * showDashboard({
 *   system: {
 *     cpu: "42%",
 *     memory: "3.2GB / 8GB",
 *     disk: "120GB / 500GB"
 *   },
 *   recentCommands: [
 *     { timestamp: "10:30", command: "nginx restart", status: "success" }
 *   ],
 *   apiStatus: [
 *     { name: "Cloudflare", status: "online", responseTime: "120ms" }
 *   ]
 * });
 * ```
 */
export function showDashboard(
  data: DashboardData,
  options: DashboardOptions = {}
): void {
  const {
    showSystem = true,
    showCommands = true,
    showAPIs = true,
    clearScreen = true,
  } = options;

  if (clearScreen) {
    console.clear();
  }

  // Header principal
  showBanner("FazAI Dashboard", "Intelligent Linux Administrator", {
    gradient: true,
    gradientColors: ["cyan", "blue"],
    borderStyle: "round",
  });

  // System Stats
  if (showSystem && data.system) {
    showSection("Recursos do Sistema");

    const stats: Stat[] = [
      {
        label: "CPU",
        value: data.system.cpu,
        color: getCPUColor(data.system.cpu),
        icon: "💻",
      },
      {
        label: "Memória",
        value: data.system.memory,
        color: getMemoryColor(data.system.memory),
        icon: "🧠",
      },
      {
        label: "Disco",
        value: data.system.disk,
        color: getDiskColor(data.system.disk),
        icon: "💾",
      },
    ];

    if (data.system.uptime) {
      stats.push({
        label: "Uptime",
        value: data.system.uptime,
        color: "green",
        icon: "⏱️",
      });
    }

    renderStatsBoxes(stats);
  }

  // Recent Commands
  if (showCommands && data.recentCommands && data.recentCommands.length > 0) {
    showSection("Comandos Recentes");

    const columns: TableColumn[] = [
      { header: "Hora", key: "timestamp", width: 8 },
      { header: "Comando", key: "command", width: 40 },
      {
        header: "Status",
        key: "status",
        width: 10,
        color: (v: string) => {
          if (v === "success") return chalk.green("✓ Success");
          if (v === "error") return chalk.red("✗ Error");
          return chalk.yellow("⋯ Pending");
        },
      },
    ];

    if (data.recentCommands[0]?.user) {
      columns.push({ header: "Usuário", key: "user", width: 12 });
    }

    renderTable(data.recentCommands.slice(0, 10), columns);
  }

  // API Status
  if (showAPIs && data.apiStatus && data.apiStatus.length > 0) {
    showSection("Status de APIs Externas");

    const columns: TableColumn[] = [
      { header: "API", key: "name", width: 20 },
      {
        header: "Status",
        key: "status",
        width: 12,
        color: statusColor,
      },
    ];

    if (data.apiStatus[0]?.responseTime) {
      columns.push({ header: "Resposta", key: "responseTime", width: 12 });
    }

    if (data.apiStatus[0]?.lastCheck) {
      columns.push({ header: "Última Checagem", key: "lastCheck", width: 16 });
    }

    renderTable(data.apiStatus, columns);
  }

  console.log("");
  console.log(chalk.gray("Use os comandos do menu para gerenciar o sistema"));
  console.log(chalk.gray("Digite '/help' para ver comandos disponíveis\n"));
}

/**
 * Determina cor baseado no uso de CPU
 */
function getCPUColor(cpu: string): "green" | "yellow" | "red" {
  const value = Number.parseFloat(cpu);
  if (value < 60) return "green";
  if (value < 80) return "yellow";
  return "red";
}

/**
 * Determina cor baseado no uso de memória
 */
function getMemoryColor(memory: string): "green" | "yellow" | "red" {
  // Extrai percentual da string "3.2GB / 8GB" ou similar
  const match = memory.match(/(\d+\.?\d*)\s*GB\s*\/\s*(\d+\.?\d*)\s*GB/);
  if (!match) return "green";

  const used = Number.parseFloat(match[1]);
  const total = Number.parseFloat(match[2]);
  const percent = (used / total) * 100;

  if (percent < 60) return "green";
  if (percent < 80) return "yellow";
  return "red";
}

/**
 * Determina cor baseado no uso de disco
 */
function getDiskColor(disk: string): "green" | "yellow" | "red" {
  const match = disk.match(/(\d+)\s*GB\s*\/\s*(\d+)\s*GB/);
  if (!match) return "green";

  const used = Number.parseInt(match[1]);
  const total = Number.parseInt(match[2]);
  const percent = (used / total) * 100;

  if (percent < 70) return "green";
  if (percent < 85) return "yellow";
  return "red";
}

/**
 * Exibe dashboard minimalista (apenas stats)
 */
export function showMiniDashboard(system: SystemInfo): void {
  const stats: Stat[] = [
    { label: "CPU", value: system.cpu, color: getCPUColor(system.cpu), icon: "💻" },
    {
      label: "RAM",
      value: system.memory,
      color: getMemoryColor(system.memory),
      icon: "🧠",
    },
    {
      label: "Disk",
      value: system.disk,
      color: getDiskColor(system.disk),
      icon: "💾",
    },
  ];

  console.log("");
  renderStatsBoxes(stats);
}
