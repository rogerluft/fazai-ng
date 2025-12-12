import chalk from "chalk";
import readline from "readline";
import { askAI } from "./askAI";
import { models } from "./models";
import { getLinuxCommandsFromAI } from "./linux-admin";
import { collectSystemInfo } from "./system-info";
import { LinuxCommand } from "./types-linux";
import { LinuxCommandExecutor } from "./linux-executor";
import { ResearchCoordinator } from "./research";
import { checkAPIKey, getAndSetAPIKey } from "./apiKeyUtils-fazai";
import { logger } from "./logger";
import {
  appendCommandHistory,
  appendConversationEntry,
  clearPersistentHistory,
  clearPersistentMemory,
  loadCommandHistory,
  loadConversationHistory,
} from "./memory";
import { CloudflareUI } from "./commands/api/cloudflare-ui";
import { SpamExpertsUI } from "./commands/api/spamexperts-ui";
import { OPNsenseUI } from "./commands/api/opnsense-ui";
import { showMenu, MenuItem } from "./ui/menu";
import { showDashboard, DashboardData, SystemInfo } from "./ui/dashboard";
import { showLogo } from "./ui/banner";
import { SemanticCache } from "./services/semantic-cache";

type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

const SLASH_COMMANDS = [
  "/help",
  "/exec",
  "/history",
  "/history clear",
  "/memory clear",
  "/cache",
  "/cache stats",
  "/cache clear",
  "/rag",
  "/metrics",
  "/cloudflare",
  "/cf",
  "/spamexperts",
  "/spam",
  "/opnsense",
  "/ops",
  "/api",
  "/dashboard",
  "/quit",
  "/exit",
];

function buildChatPrompt(history: ConversationTurn[]): string {
  const trimmedHistory = history.slice(-10); // limita contexto imediato
  const conversation = trimmedHistory
    .map((turn) =>
      turn.role === "user"
        ? `Usuário: ${turn.content}`
        : `Assistente: ${turn.content}`
    )
    .join("\n");

  return `${conversation}\nAssistente:`;
}

function parseExecPayload(raw: string): string | null {
  const withoutCommand = raw.replace(/^\/exec\s*/i, "");
  if (!withoutCommand.trim()) {
    return null;
  }

  if (withoutCommand.startsWith("'''") && withoutCommand.endsWith("'''")) {
    return withoutCommand.slice(3, -3).trim();
  }

  return withoutCommand.trim();
}

function createCompleter() {
  return (line: string) => {
    if (line.startsWith("/")) {
      const hits = SLASH_COMMANDS.filter((cmd) => cmd.startsWith(line));
      return [hits.length ? hits : SLASH_COMMANDS, line];
    }
    return [[], line];
  };
}

/**
 * Coleta estatísticas do sistema para o dashboard
 */
async function getSystemStats(): Promise<SystemInfo> {
  // Mock data - substituir por coleta real de sistema
  return {
    cpu: "42%",
    memory: "3.2GB / 8GB",
    disk: "120GB / 500GB",
    uptime: "15 days 6 hours",
  };
}

/**
 * Cria prompt visual aprimorado
 */
function getPrompt(): string {
  const user = process.env.USER || "user";
  const cwd = process.cwd().replace(process.env.HOME || "", "~");
  return (
    chalk.green(user) +
    chalk.gray("@") +
    chalk.blue("fazai") +
    chalk.gray(":") +
    chalk.yellow(cwd) +
    chalk.gray(" $ ")
  );
}

export async function runCliMode(): Promise<void> {
  const defaultModel = models[0];

  // Exibe logo visual
  console.clear();
  showLogo();

  logger.info(chalk.gray("Digite mensagens livres para conversar ou use comandos especiais começando com '/'"));
  logger.info(
    chalk.gray(
      "Comandos: /help, /exec, /api, /dashboard, /cloudflare, /spamexperts, /opnsense\n"
    )
  );

  if (!checkAPIKey(defaultModel.provider)) {
    await getAndSetAPIKey(defaultModel.provider);
  }
  logger.info(chalk.green(`✅ API key configurada (${defaultModel.provider})`));

  const storedConversation = loadConversationHistory();
  const conversationHistory: ConversationTurn[] = storedConversation.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
  const historyBuffer: string[] = loadCommandHistory();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt(),
    completer: createCompleter(),
    historySize: 100,
  });
  if (historyBuffer.length) {
    rl.history = [...historyBuffer].reverse();
  }

  const systemInfo = await collectSystemInfo();
  const researchCoordinator = new ResearchCoordinator();
  const executor = new LinuxCommandExecutor(false, researchCoordinator);

  rl.prompt();

  const handleChat = async (message: string) => {
    conversationHistory.push({ role: "user", content: message });
    appendConversationEntry({
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });
    const prompt = buildChatPrompt(conversationHistory);
    logger.info(chalk.blueBright("\n🤖 FazAI:"));

    let response = "";
    try {
      const stream = askAI(
        "",
        prompt,
        defaultModel.name,
        defaultModel.provider,
        true
      );

      for await (const chunk of stream) {
        process.stdout.write(chunk);
        response += chunk;
      }
      logger.info("");
    } catch (error) {
      logger.error(chalk.red("\n❌ Erro ao conversar com o modelo:"), error);
    } finally {
      conversationHistory.push({
        role: "assistant",
        content: response.trim() || "(sem resposta)",
      });
      appendConversationEntry({
        role: "assistant",
        content: response.trim() || "(sem resposta)",
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleExec = async (task: string) => {
    if (!task) {
      logger.warn(chalk.yellow("Forneça uma instrução após /exec. Ex: /exec limpar /tmp"));
      return;
    }

    logger.info(chalk.magentaBright("\n⚙️  Gerando comandos para: "), chalk.magenta(task));

    const commandStream = getLinuxCommandsFromAI(
      systemInfo,
      task,
      defaultModel.name,
      defaultModel.provider
    );

    const collectedCommands: LinuxCommand[] = [];

    for await (const packet of commandStream) {
      if (packet.type === "command") {
        collectedCommands.push(packet.command);
      }
    }

    if (!collectedCommands.length) {
      logger.warn(chalk.yellow("Nenhum comando gerado para a tarefa informada."));
      return;
    }

    for (const command of collectedCommands) {
      await executor.executeCommand(command);
    }
  };

  rl.on("line", async (input) => {
    const line = input.trim();
    if (line.length > 0) {
      historyBuffer.push(line);
      appendCommandHistory(line);
    }

    if (!line) {
      rl.prompt();
      return;
    }

    if (line.startsWith("/")) {
      if (line === "/help") {
        logger.info(chalk.cyan("\nComandos disponíveis:"));
        logger.info("/help              Mostra esta ajuda");
        logger.info("/exec ...          Converte instrução natural em comandos Linux e executa");
        logger.info("/history           Lista entradas anteriores (persistente)");
        logger.info("/history clear     Limpa histórico persistente");
        logger.info("/memory clear      Limpa memória contextual persistente");
        logger.info("/cache             Exibe estatísticas do cache semântico");
        logger.info("/cache stats       Exibe estatísticas detalhadas do cache");
        logger.info("/cache clear       Limpa o cache semântico completamente");
        logger.info("/rag, /metrics     Exibe métricas completas do sistema RAG");
        logger.info("/dashboard         Exibe dashboard visual do sistema");
        logger.info("/api               Menu de gerenciamento de APIs externas");
        logger.info("/cloudflare, /cf   Gerenciar Cloudflare (zonas, DNS, workers)");
        logger.info("/spamexperts, /spam Gerenciar SpamExperts (domínios, quarentena)");
        logger.info("/opnsense, /ops    Gerenciar OPNsense (firewall, VPN, NAT)");
        logger.info("/quit, /exit       Encerra o modo CLI\n");
      } else if (line === "/quit" || line === "/exit") {
        rl.close();
        return;
      } else if (line === "/dashboard") {
        // Exibe dashboard
        const dashboardData: DashboardData = {
          system: await getSystemStats(),
          recentCommands: [
            { timestamp: "10:30", command: "nginx restart", status: "success" as const },
            { timestamp: "10:25", command: "systemctl status", status: "success" as const },
          ],
          apiStatus: [
            { name: "Cloudflare", status: "online" as const, responseTime: "120ms" },
            { name: "SpamExperts", status: "online" as const, responseTime: "85ms" },
            { name: "OPNsense", status: "online" as const, responseTime: "45ms" },
          ],
        };
        showDashboard(dashboardData);
      } else if (line === "/api") {
        // Menu de APIs
        const items: MenuItem[] = [
          {
            label: "Cloudflare",
            value: "cloudflare",
            icon: "☁️",
            description: "Gerenciar zonas, DNS e Workers",
          },
          {
            label: "SpamExperts",
            value: "spamexperts",
            icon: "📧",
            description: "Gerenciar proteção de email",
          },
          {
            label: "OPNsense",
            value: "opnsense",
            icon: "🔥",
            description: "Gerenciar firewall e VPN",
          },
        ];

        const choice = await showMenu("Gerenciar APIs Externas", items);

        if (choice === "cloudflare") {
          const cfUI = new CloudflareUI();
          await cfUI.showMainMenu();
        } else if (choice === "spamexperts") {
          const spamUI = new SpamExpertsUI();
          await spamUI.showMainMenu();
        } else if (choice === "opnsense") {
          const opsUI = new OPNsenseUI();
          await opsUI.showMainMenu();
        }
      } else if (line === "/cloudflare" || line === "/cf") {
        // Cloudflare UI
        const cfUI = new CloudflareUI();
        await cfUI.showMainMenu();
      } else if (line === "/spamexperts" || line === "/spam") {
        // SpamExperts UI
        const spamUI = new SpamExpertsUI();
        await spamUI.showMainMenu();
      } else if (line === "/opnsense" || line === "/ops") {
        // OPNsense UI
        const opsUI = new OPNsenseUI();
        await opsUI.showMainMenu();
      } else if (line === "/history") {
        if (!historyBuffer.length) {
          logger.info(chalk.gray("Sem histórico registrado nesta sessão."));
        } else {
          logger.info(chalk.cyan("\nHistórico recente:"));
          historyBuffer.slice(-20).forEach((entry, index) => {
            logger.info(`${index + 1}. ${entry}`);
          });
        }
      } else if (line === "/history clear") {
        clearPersistentHistory();
        historyBuffer.length = 0;
        rl.history = [];
        logger.info(chalk.green("✅ Histórico de comandos limpo."));
      } else if (line === "/memory clear") {
        clearPersistentMemory();
        conversationHistory.length = 0;
        logger.info(chalk.green("✅ Memória contextual limpa."));
      } else if (line === "/cache" || line === "/cache stats") {
        try {
          const cache = await SemanticCache.getInstance();
          const statsString = await cache.getStatsString();
          logger.info(chalk.cyan("\n" + statsString));
        } catch (error: any) {
          logger.error(chalk.red(`Erro ao obter estatísticas do cache: ${error.message}`));
        }
      } else if (line === "/cache clear") {
        try {
          const cache = await SemanticCache.getInstance();
          await cache.clear();
          logger.info(chalk.green("✅ Cache semântico limpo completamente."));
        } catch (error: any) {
          logger.error(chalk.red(`Erro ao limpar cache: ${error.message}`));
        }
      } else if (line === "/rag" || line === "/metrics") {
        try {
          const { collectRAGMetrics, formatRAGMetrics } = await import("./rag/metrics");
          logger.info(chalk.cyan("\n⏳ Coletando métricas do sistema RAG..."));
          const metrics = await collectRAGMetrics();
          const formatted = formatRAGMetrics(metrics);
          logger.info(formatted);
        } catch (error: any) {
          logger.error(chalk.red(`Erro ao coletar métricas: ${error.message}`));
        }
      } else if (line.startsWith("/exec")) {
        const task = parseExecPayload(line);
        await handleExec(task ?? "");
      } else {
        logger.warn(chalk.yellow("Comando não reconhecido. Use /help para ver as opções."));
      }
      rl.prompt();
      return;
    }

    await handleChat(line);
    rl.prompt();
  });

  rl.on("close", () => {
    logger.info(chalk.green("\nAté breve!"));
    process.exit(0);
  });
}
