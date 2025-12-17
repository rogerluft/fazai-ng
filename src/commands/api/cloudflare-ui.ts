import chalk from "chalk";
import { renderTable, TableColumn, statusColor } from "../../ui/table";
import { showMenu, MenuItem } from "../../ui/menu";
import { Spinner } from "../../ui/spinner";
import { showHeader, showError, showSuccess } from "../../ui/banner";
import { inputText, confirmAction } from "../../ui/prompt";
import { CloudflareManager } from "../../cloudflare-manager";

/**
 * Interface para gerenciamento visual do Cloudflare
 * Integra com a API do Cloudflare através de interface CLI visual
 */
export class CloudflareUI {
  private manager: CloudflareManager | null;

  constructor() {
    try {
      this.manager = new CloudflareManager();
    } catch (error: any) {
      this.manager = null;
      showError(`Falha na inicialização do CloudflareManager: ${error.message}`);
      console.log(chalk.yellow("Verifique suas credenciais da Cloudflare em fazai.conf ou variáveis de ambiente."));
    }
  }
  /**
   * Menu principal do Cloudflare
   */
  async showMainMenu(): Promise<void> {
    while (true) {
      showHeader("☁️", "Cloudflare Management", "Gerenciar zonas, DNS, Workers e mais");

      const items: MenuItem[] = [
        {
          label: "Zonas DNS",
          value: "zones",
          icon: "🌐",
          description: "Listar e gerenciar zonas DNS",
        },
        {
          label: "Registros DNS",
          value: "dns",
          icon: "📝",
          description: "Gerenciar registros DNS de uma zona",
        },
        {
          label: "Cloudflare Workers",
          value: "workers",
          icon: "⚙️",
          description: "Gerenciar Workers e Scripts",
        },
        {
          label: "Regras de Firewall",
          value: "firewall",
          icon: "🔥",
          description: "Configurar regras de firewall",
        },
        {
          label: "SSL/TLS",
          value: "ssl",
          icon: "🔒",
          description: "Gerenciar certificados SSL/TLS",
        },
        {
          label: "Cache",
          value: "cache",
          icon: "💾",
          description: "Limpar cache e configurações",
        },
        {
          label: "Analytics",
          value: "analytics",
          icon: "📊",
          description: "Ver estatísticas e métricas",
        },
      ];

      const action = await showMenu("Cloudflare", items);

      if (action === "__exit__") {
        break;
      }

      try {
        switch (action) {
          case "zones":
            await this.listZones();
            break;
          case "dns":
            await this.manageDNS();
            break;
          case "workers":
            await this.manageWorkers();
            break;
          case "firewall":
            await this.manageFirewall();
            break;
          case "ssl":
            await this.manageSSL();
            break;
          case "cache":
            await this.manageCache();
            break;
          case "analytics":
            await this.showAnalytics();
            break;
        }
      } catch (error: any) {
        showError(`Erro: ${error.message}`);
        console.log(chalk.gray("\nPressione Enter para continuar..."));
        await inputText("");
      }
    }
  }

  /**
   * Lista todas as zonas DNS do Cloudflare
   */
  async listZones(): Promise<void> {
    if (!this.manager) throw new Error("Cloudflare não configurado.");
    const spinner = new Spinner();
    spinner.start("Buscando zonas do Cloudflare...");

    try {
      const zones = await this.manager.listZones();
      spinner.succeed("Zonas carregadas com sucesso");

      const columns: TableColumn[] = [
        { header: "Zone ID", key: "id", width: 32, color: (v) => chalk.gray(v) },
        { header: "Nome", key: "name", width: 30, color: (v) => chalk.cyan(v) },
        { header: "Status", key: "status", width: 10, color: statusColor },
        { header: "Conta", key: "account.name", width: 20 },
      ];

      renderTable(zones, columns);
      console.log(chalk.gray(`\nTotal: ${zones.length} zonas`));
    } catch (error: any) {
      spinner.fail("Falha ao carregar zonas");
      throw error;
    }
  }

  /**
   * Gerencia registros DNS de uma zona
   */
  async manageDNS(): Promise<void> {
    if (!this.manager) throw new Error("Cloudflare não configurado.");
    const zoneId = await inputText("Digite o Zone ID:", undefined, (value) => value.length > 0 || "Zone ID é obrigatório");

    const spinner = new Spinner();
    spinner.start("Carregando registros DNS...");

    try {
      const records = await this.manager.listDNSRecords(zoneId);
      spinner.succeed("Registros DNS carregados");

      const columns: TableColumn[] = [
        { header: "ID", key: "id", width: 32, color: (v) => chalk.gray(v) },
        { header: "Tipo", key: "type", width: 8, color: (v) => chalk.yellow(v) },
        { header: "Nome", key: "name", width: 30, color: (v) => chalk.cyan(v) },
        { header: "Conteúdo", key: "content", width: 30 },
        { header: "Proxied", key: "proxied", width: 8, color: (v: boolean) => (v ? chalk.green("Sim") : chalk.gray("Não")) },
      ];

      renderTable(records, columns);

      const action = await showMenu("Ações DNS", [
        { label: "Adicionar Registro", value: "add", icon: "➕" },
        { label: "Deletar Registro", value: "delete", icon: "🗑️" },
        { label: "Voltar", value: "back", icon: "◀️" },
      ]);

      if (action === "add") await this.addDNSRecord(zoneId);
      else if (action === "delete") await this.deleteDNSRecord(zoneId);
    } catch (error: any) {
      spinner.fail("Falha ao carregar registros DNS");
      throw error;
    }
  }

  /**
   * Adiciona novo registro DNS
   */
  async addDNSRecord(zoneId: string): Promise<void> {
    if (!this.manager) throw new Error("Cloudflare não configurado.");
    console.log(chalk.cyan("\nAdicionar Novo Registro DNS\n"));

    const type = await inputText("Tipo (A, AAAA, CNAME, MX, TXT):", "A");
    const name = await inputText("Nome:", "@");
    const content = await inputText("Conteúdo:");
    const proxied = await confirmAction("Habilitar Cloudflare Proxy?", true);

    if (!await confirmAction(`Criar registro ${type} ${name} → ${content}?`, true)) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner();
    spinner.start("Criando registro DNS...");

    try {
      await this.manager.createDNSRecord(zoneId, { type, name, content, proxied });
      spinner.succeed("Registro DNS criado com sucesso!");
    } catch (error: any) {
      spinner.fail("Falha ao criar registro DNS");
      throw error;
    }
  }

  /**
   * Deleta um registro DNS
   */
  async deleteDNSRecord(zoneId: string): Promise<void> {
    if (!this.manager) throw new Error("Cloudflare não configurado.");
    const recordId = await inputText("Digite o ID do registro para deletar:");

    if (!await confirmAction(`Tem certeza que deseja deletar o registro ${recordId}?`, false)) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner();
    spinner.start("Deletando registro DNS...");

    try {
      await this.manager.deleteDNSRecord(zoneId, recordId);
      spinner.succeed("Registro DNS deletado com sucesso!");
    } catch (error: any) {
      spinner.fail("Falha ao deletar registro DNS");
      throw error;
    }
  }

  /**
   * Gerencia Cloudflare Workers
   */
  async manageWorkers(): Promise<void> {
    if (!this.manager) throw new Error("Cloudflare não configurado.");
    const spinner = new Spinner();
    spinner.start("Carregando Workers...");

    try {
      const workers = await this.manager.listWorkers();
      spinner.succeed("Workers carregados");

      const columns: TableColumn[] = [
        { header: "Nome", key: "id", width: 40, color: (v) => chalk.cyan(v) },
        { header: "Script ID", key: "id", width: 40, color: (v) => chalk.gray(v) },
      ];

      renderTable(workers, columns);
    } catch (error: any) {
      spinner.fail("Falha ao carregar Workers");
      throw error;
    }
  }

  /**
   * Gerencia regras de firewall
   */
  async manageFirewall(): Promise<void> {
    if (!this.manager) throw new Error("Cloudflare não configurado.");
    const zoneId = await inputText("Digite o Zone ID:");
    const spinner = new Spinner();
    spinner.start("Carregando regras de firewall...");

    try {
      const rules = await this.manager.listFirewallRules(zoneId);
      spinner.succeed("Regras de firewall carregadas");

      const columns: TableColumn[] = [
        { header: "ID", key: "id", width: 32, color: (v) => chalk.gray(v) },
        { header: "Descrição", key: "description", width: 40 },
        { header: "Ação", key: "action", width: 12, color: statusColor },
        { header: "Ativo", key: "paused", width: 8, color: (v: boolean) => (v ? chalk.red("Não") : chalk.green("Sim")) },
      ];

      renderTable(rules, columns);
    } catch (error: any) {
      spinner.fail("Falha ao carregar regras de firewall");
      throw error;
    }
  }

  /**
   * Gerencia configurações SSL/TLS
   */
  async manageSSL(): Promise<void> {
    if (!this.manager) throw new Error("Cloudflare não configurado.");
    const zoneId = await inputText("Digite o Zone ID:");
    const spinner = new Spinner();
    spinner.start("Carregando configurações SSL/TLS...");

    try {
      const sslConfig = await this.manager.getSSLSettings(zoneId);
      spinner.succeed("Configurações SSL carregadas");

      console.log("");
      console.log(chalk.cyan("Modo SSL/TLS:"), chalk.green(sslConfig.value));
      console.log(chalk.cyan("Editável:"), sslConfig.editable ? "Sim" : "Não");
      console.log(chalk.cyan("Modificado em:"), new Date(sslConfig.modified_on).toLocaleString());
      console.log("");

      if (sslConfig.editable && await confirmAction("Deseja alterar o modo SSL?", false)) {
        const modes = ["off", "flexible", "full", "strict"];
        const newMode = await inputText(`Novo modo (${modes.join(", ")}):`, sslConfig.value) as 'off' | 'flexible' | 'full' | 'strict';

        if (modes.includes(newMode)) {
          const updateSpinner = new Spinner(`Alterando modo SSL para ${newMode}...`);
          await this.manager.updateSSLMode(zoneId, newMode);
          updateSpinner.succeed(`Modo SSL alterado para: ${newMode}`);
        } else {
          showError("Modo inválido.");
        }
      }
    } catch (error: any) {
      spinner.fail("Falha ao carregar configurações SSL");
      throw error;
    }
  }

  /**
   * Gerencia cache
   */
  async manageCache(): Promise<void> {
    if (!this.manager) throw new Error("Cloudflare não configurado.");
    const zoneId = await inputText("Digite o Zone ID:");

    const action = await showMenu("Gerenciar Cache", [
      { label: "Limpar Todo Cache", value: "purge_everything", icon: "🗑️" },
      { label: "Voltar", value: "back", icon: "◀️" },
    ]);

    if (action === "__exit__" || action === "back") return;

    if (await confirmAction("Confirmar limpeza de TODO o cache?", false)) {
      const spinner = new Spinner();
      spinner.start("Limpando cache...");
      try {
        await this.manager.purgeCache(zoneId, { purge_everything: true });
        spinner.succeed("Cache limpo com sucesso!");
      } catch (error: any) {
        spinner.fail("Falha ao limpar cache");
        throw error;
      }
    } else {
      console.log(chalk.yellow("Operação cancelada"));
    }
  }

  /**
   * Exibe analytics
   */
  async showAnalytics(): Promise<void> {
    if (!this.manager) throw new Error("Cloudflare não configurado.");
    const zoneId = await inputText("Digite o Zone ID:");
    const spinner = new Spinner();
    spinner.start("Carregando analytics...");

    try {
      const analytics = await this.manager.getAnalytics(zoneId);
      spinner.succeed("Analytics carregados");

      // Helper to format large numbers
      const formatNumber = (num: number) => num.toLocaleString('pt-BR');
      const formatBytes = (bytes: number) => {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      console.log("");
      console.log(chalk.cyan.bold("Estatísticas (Últimas 24h)"));
      console.log(chalk.gray("─".repeat(40)));
      console.log(chalk.cyan("Requests:"), chalk.green(formatNumber(analytics.totals.requests)));
      console.log(chalk.cyan("Bandwidth:"), chalk.green(formatBytes(analytics.totals.bandwidth)));
      console.log(chalk.cyan("Threats Blocked:"), chalk.red(formatNumber(analytics.totals.threats)));
      console.log(chalk.cyan("Page Views:"), chalk.blue(formatNumber(analytics.totals.pageviews)));
      console.log("");
    } catch (error: any) {
      spinner.fail("Falha ao carregar analytics");
      throw error;
    }
  }

}
