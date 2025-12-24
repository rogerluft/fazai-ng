import chalk from "chalk";
import readline from "readline";
import { askAI } from "./askAI";
import { models } from "./models";
import { getLinuxCommandsFromAI } from "./linux-admin";
import { collectSystemInfo } from "./system-info";
import { LinuxCommand } from "./types-linux";
import { LinuxCommandExecutor } from "./linux-executor";
import { ResearchCoordinator } from "./research";
import { AgenticWebCrawler } from "./research/web-crawler";
import { QueryAnalyzer } from "./research/query-analyzer";
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
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
 * Busca comandos recentes do histórico
 * BUGFIX: Agora retorna erros reais do error-tracker (não command history)
 */
async function getRecentCommands(): Promise<Array<{ timestamp: string; command: string; status: "success" | "error" | "pending" }>> {
  try {
    const { errorTracker } = await import("./error-tracker");
    const errors = errorTracker.getRecentErrors(5);

    // Converte erros para formato compatível com RecentCommand
    return errors.map((err) => ({
      timestamp: err.timestamp,
      command: `[${err.type.toUpperCase()}] ${err.message}`,
      status: "error" as const,
    }));
  } catch (error: unknown) {
    logger.debug("Erro ao carregar erros recentes do tracker");
    return [];
  }
}

/**
 * Verifica status de APIs externas usando credenciais reais
 * USA: api-status-checker com credenciais dos Managers (CloudflareManager, OpenAI SDK, Anthropic SDK, etc.)
 */
async function getAPIStatus(): Promise<Array<{ name: string; status: "online" | "offline" | "degraded" | "not_configured" | "unauthorized"; responseTime?: string }>> {
  try {
    const { checkAllAPIs, formatResponseTime } = await import("./services/api-status-checker");
    const results = await checkAllAPIs();

    return results.map((result) => ({
      name: result.name,
      status: result.status,
      responseTime: result.responseTime ? formatResponseTime(result.responseTime) : undefined,
    }));
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Erro ao verificar status de APIs: ${err.message}`);

    // Retorna array vazio em caso de erro
    return [];
  }
}

/**
 * Coleta estatísticas reais do sistema para o dashboard
 */
async function getSystemStats(): Promise<SystemInfo> {
  try {
    // CPU: usa top para pegar uso médio
    const { stdout: cpuOut } = await execAsync(
      "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"
    );
    const cpuUsage = parseFloat(cpuOut.trim());
    const cpu = `${cpuUsage.toFixed(1)}%`;

    // Memória: usa free
    const { stdout: memOut } = await execAsync(
      "free -h | awk '/^Mem:/ {print $3 \" / \" $2}'"
    );
    const memory = memOut.trim();

    // Disco: usa df para o /
    const { stdout: diskOut } = await execAsync(
      "df -h / | awk 'NR==2 {print $3 \" / \" $2}'"
    );
    const disk = diskOut.trim();

    // Uptime: usa uptime -p
    const { stdout: uptimeOut } = await execAsync("uptime -p");
    const uptime = uptimeOut.trim().replace("up ", "");

    return {
      cpu,
      memory,
      disk,
      uptime,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.debug(`Erro ao coletar stats do sistema: ${err.message}`);

    // Fallback: retorna valores indicando erro
    return {
      cpu: "N/A",
      memory: "N/A",
      disk: "N/A",
      uptime: "N/A",
    };
  }
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
  logger.info(chalk.gray("💡 Busca na web: 'pesquise sobre <tema>', 'busque informações sobre <assunto>'"));
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

  let inactivityTimeout: NodeJS.Timeout;

  const resetInactivityTimeout = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
          logger.info(chalk.yellow('\nInatividade detectada, encerrando a sessão.'));
          rl.close();
      }, 300000); // 5 minutes
  };

  resetInactivityTimeout();

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
    resetInactivityTimeout();
    const line = input.trim();
    if (line.length > 0) {
      historyBuffer.push(line);
      appendCommandHistory(line);
    }

    if (!line) {
      rl.prompt();
      return;
    }

    // Detecta intenção de busca na web ANTES dos comandos slash
    const searchIntents = [
      /^pesquis(e|a|ar) (sobre|na internet|web)?/i,
      /^busqu(e|a|ar) (informações sobre|sobre|na internet)?/i,
      /^o que (há de novo|tem de novo) (sobre|em)/i,
      /^procur(e|a|ar) (sobre|informações sobre|na web)?/i,
      /^encontr(e|a|ar) (informações sobre|sobre)?/i,
    ];

    const isWebSearch = searchIntents.some((pattern) => pattern.test(line));

    if (isWebSearch) {
      // Extrai query removendo o prefixo de intenção
      const query = line
        .replace(/^(pesquis|busqu|procur|encontr)(e|a|ar)( sobre| na internet| web| informações sobre)?/i, "")
        .replace(/^o que (há de novo|tem de novo) (sobre|em)/i, "")
        .trim();

      if (!query) {
        logger.error(chalk.red("Por favor, especifique o que deseja pesquisar."));
        logger.info(chalk.gray('Exemplo: pesquise sobre "nginx reverse proxy"'));
        rl.prompt();
        return;
      }

      logger.info(chalk.cyan(`\n🔍 Iniciando busca multi-fonte: "${query}"\n`));

      try {
        const crawler = new AgenticWebCrawler();
        const analyzer = new QueryAnalyzer();

        // Classifica a query
        const classification = analyzer.classifyQuery(query);
        const { type, strategy } = classification;

        logger.info(chalk.gray(`📊 Tipo detectado: ${type}`));
        logger.info(chalk.gray(`📚 Estratégia: ${strategy.description}`));
        logger.info(chalk.gray(`🎯 Fontes: ${strategy.sources.join(", ")}\n`));

        // Busca multi-fonte
        const results = await crawler.searchMultiSource(query, {
          sources: strategy.sources,
          maxResults: strategy.maxResults,
        });

        if (results.length === 0) {
          logger.warn(chalk.yellow("⚠️  Nenhum resultado encontrado."));
          logger.info(chalk.gray("\nTente refinar sua busca ou use termos diferentes."));
          rl.prompt();
          return;
        }

        // Cruza dados
        const consolidated = await crawler.crossReference(results);

        // Exibe resultados
        logger.info(chalk.green(`\n✅ Encontrados ${results.length} resultados de ${consolidated.sources.join(", ")}\n`));

        if (consolidated.consensus.length > 0) {
          logger.info(chalk.bold("📊 CONSENSO:"));
          for (const point of consolidated.consensus) {
            logger.info(chalk.cyan(`  • ${point}`));
          }
          logger.info("");
        }

        if (consolidated.contradictions.length > 0) {
          logger.info(chalk.yellow("⚠️  CONTRADIÇÕES:"));
          for (const conflict of consolidated.contradictions) {
            logger.info(chalk.yellow(`  • ${conflict}`));
          }
          logger.info("");
        }

        logger.info(chalk.bold("📝 TOP RESULTADOS:"));
        for (const result of results.slice(0, 5)) {
          logger.info(chalk.bold(`\n  ${result.title}`));
          logger.info(chalk.gray(`  ${result.link}`));
          if (result.snippet) {
            logger.info(chalk.dim(`  ${result.snippet.substring(0, 150)}...`));
          }
          logger.info(chalk.gray(`  [${result.source} - ${result.category}]`));
        }

        logger.info("");
        logger.info(chalk.bold("💡 RESUMO:"));
        logger.info(chalk.cyan(`  ${consolidated.summary}`));
        logger.info("");

        // Cache em Qdrant
        await crawler.cacheInQdrant(query, results);

      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(chalk.red(`\n❌ Erro na busca: ${err.message}`));
      }

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
        logger.info("/quit, /exit       Encerra o modo CLI");
        logger.info("");
        logger.info(chalk.cyan("Busca na Web:"));
        logger.info('pesquise sobre "tema"      Busca multi-fonte com análise agêntica');
        logger.info('busque informações sobre   Detecta tipo de query e estratégia ideal');
        logger.info('procure sobre              Cruza dados de web, forums e docs');
        logger.info("");
      } else if (line === "/quit" || line === "/exit") {
        rl.close();
        return;
      } else if (line === "/dashboard") {
        // Exibe dashboard com dados reais do sistema
        logger.info(chalk.gray("Coletando dados do sistema..."));

        const [systemStats, recentCommands, apiStatus] = await Promise.all([
          getSystemStats(),
          getRecentCommands(),
          getAPIStatus(),
        ]);

        const dashboardData: DashboardData = {
          system: systemStats,
          recentCommands,
          apiStatus,
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
