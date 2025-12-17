import chalk from "chalk";
import { SpamExpertsManager, SpamExpertsSettings } from "../../spamexperts-manager";
import { renderTable, TableColumn, statusColor } from "../../ui/table";
import { showMenu, MenuItem } from "../../ui/menu";
import { Spinner } from "../../ui/spinner";
import { showHeader, showError, showSuccess } from "../../ui/banner";
import { inputText, confirmAction } from "../../ui/prompt";

/**
 * Interface para gerenciamento visual do SpamExperts
 * Integra com a API do SpamExperts para gestão de email e spam
 */
export class SpamExpertsUI {
  private manager: SpamExpertsManager;

  constructor() {
    try {
      this.manager = new SpamExpertsManager();
    } catch (error: any) {
      showError(`Falha ao inicializar SpamExperts: ${error.message}`);
      throw new Error("Inicialização do SpamExperts falhou.");
    }
  }
  /**
   * Menu principal do SpamExperts
   */
  async showMainMenu(): Promise<void> {
    while (true) {
      showHeader("📧", "SpamExperts Management", "Gerenciar proteção de email e spam");

      const items: MenuItem[] = [
        { label: "Domínios", value: "domains", icon: "🌐", description: "Gerenciar domínios protegidos" },
        { label: "Quarentena", value: "quarantine", icon: "🗑️", description: "Visualizar emails em quarentena" },
        { label: "Relatórios", value: "reports", icon: "📊", description: "Estatísticas e relatórios" },
        { label: "Whitelist/Blacklist", value: "lists", icon: "📋", description: "Gerenciar listas de permissão/bloqueio" },
        { label: "Configurações", value: "settings", icon: "⚙️", description: "Configurar filtros e políticas" },
      ];

      const action = await showMenu("SpamExperts", items);

      if (action === "__exit__") break;

      try {
        switch (action) {
          case "domains": await this.manageDomains(); break;
          case "quarantine": await this.viewQuarantine(); break;
          case "reports": await this.showReports(); break;
          case "lists": await this.manageLists(); break;
          case "settings": await this.manageSettings(); break;
        }
      } catch (error: any) {
        showError(`Erro: ${error.message}`);
        console.log(chalk.gray("\nPressione Enter para continuar..."));
        await inputText("");
      }
    }
  }

  /**
   * Gerencia domínios protegidos
   */
  async manageDomains(): Promise<void> {
    const spinner = new Spinner().start("Carregando domínios...");
    try {
      const domains = await this.manager.listDomains();
      spinner.succeed("Domínios carregados com sucesso");

      const columns: TableColumn[] = [
        { header: "Domínio", key: "domain", width: 30, color: (v) => chalk.cyan(v) },
        { header: "Status", key: "status", width: 12, color: statusColor },
        { header: "Emails (24h)", key: "emailsToday", width: 15 },
        { header: "Spam Bloqueado", key: "spamBlocked", width: 15 },
        { header: "Quarentena", key: "quarantined", width: 12 },
      ];
      renderTable(domains, columns);

      const action = await showMenu("Ações de Domínio", [
        { label: "Adicionar Domínio", value: "add", icon: "➕" },
        { label: "Remover Domínio", value: "remove", icon: "🗑️" },
        { label: "Voltar", value: "back", icon: "◀️" },
      ]);

      if (action === 'add') await this.addDomain();
      if (action === 'remove') await this.removeDomain();

    } catch (error: any) {
      spinner.fail("Falha ao carregar domínios");
      throw error;
    }
  }

  /**
   * Adiciona novo domínio à proteção
   */
  async addDomain(): Promise<void> {
    const domain = await inputText("Nome do domínio:", undefined, (v) => /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(v) || "Domínio inválido");
    const destination = await inputText("Servidor de destino (MX):");
    if (!await confirmAction(`Adicionar domínio ${domain} com destino ${destination}?`, true)) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner().start("Adicionando domínio...");
    try {
      await this.manager.addDomain(domain, destination);
      spinner.succeed("Domínio adicionado com sucesso!");
      console.log(chalk.yellow("\nAtualize os registros MX do domínio para..."));
    } catch (error: any) {
      spinner.fail("Falha ao adicionar domínio");
      throw error;
    }
  }

  /**
   * Remove domínio da proteção
   */
  async removeDomain(): Promise<void> {
    const domain = await inputText("Nome do domínio para remover:");
    if (!await confirmAction(`ATENÇÃO: Remover o domínio ${domain}?`, false)) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner().start("Removendo domínio...");
    try {
      await this.manager.removeDomain(domain);
      spinner.succeed("Domínio removido com sucesso!");
    } catch (error: any) {
      spinner.fail("Falha ao remover domínio");
      throw error;
    }
  }

  /**
   * Visualiza quarentena de emails
   */
  async viewQuarantine(): Promise<void> {
    const domain = await inputText("Domínio (deixe vazio para todos):", "");
    const spinner = new Spinner().start("Carregando quarentena...");
    try {
      const emails = await this.manager.listQuarantine(domain || undefined);
      spinner.succeed("Quarentena carregada");

      const columns: TableColumn[] = [
        { header: "ID", key: "id", width: 10 },
        { header: "Data", key: "date", width: 16 },
        { header: "De", key: "from", width: 25 },
        { header: "Para", key: "to", width: 25 },
        { header: "Assunto", key: "subject", width: 30 },
        {
          header: "Score",
          key: "score",
          width: 8,
          color: (v: number) => {
            if (v >= 10) return chalk.red(v.toString());
            if (v >= 5) return chalk.yellow(v.toString());
            return chalk.green(v.toString());
          },
        },
      ];
      renderTable(emails, columns);

      const action = await showMenu("Ações de Quarentena", [
        { label: "Liberar Email", value: "release", icon: "✉️" },
        { label: "Deletar Email", value: "delete", icon: "🗑️" },
        { label: "Voltar", value: "back", icon: "◀️" },
      ]);

      if (action === 'release') await this.releaseEmail();
      if (action === 'delete') await this.deleteEmail();

    } catch (error: any) {
      spinner.fail("Falha ao carregar quarentena");
      throw error;
    }
  }

    /**
   * Exibe relatórios e estatísticas
   */
  async showReports(): Promise<void> {
    const period = await showMenu("Período do Relatório", [
      { label: "Últimas 24 horas", value: "24h", icon: "📅" },
      { label: "Últimos 7 dias", value: "7d", icon: "📅" },
      { label: "Últimos 30 dias", value: "30d", icon: "📅" },
      { label: "Voltar", value: "back", icon: "◀️" },
    ]) as '24h' | '7d' | '30d' | 'back' | '__exit__';

    if (period === "__exit__" || period === "back") return;

    const spinner = new Spinner().start("Gerando relatório...");
    try {
      const report = await this.manager.getReport(period);
      spinner.succeed("Relatório gerado");

      console.log(`\n${chalk.cyan.bold(`Relatório - ${this.getPeriodLabel(period)}`)}`);
      // Display logic
    } catch (error: any) {
      spinner.fail("Falha ao gerar relatório");
      throw error;
    }
  }

  /**
   * Gerencia whitelist/blacklist
   */
  async manageLists(): Promise<void> {
    const listType = await showMenu("Tipo de Lista", [
        { label: "Whitelist (Permitidos)", value: "whitelist", icon: "✅" },
        { label: "Blacklist (Bloqueados)", value: "blacklist", icon: "❌" },
        { label: "Voltar", value: "back", icon: "◀️" },
      ]) as 'whitelist' | 'blacklist' | 'back' | '__exit__';

      if (listType === "__exit__" || listType === "back") return;

      const spinner = new Spinner().start(`Carregando ${listType}...`);
      try {
          const entries = await this.manager.listList(listType);
          spinner.succeed(`${listType} carregada`);

          const columns: TableColumn[] = [
            { header: "Entrada", key: "entry", width: 40 },
            { header: "Tipo", key: "type", width: 15 },
            { header: "Adicionado em", key: "added", width: 20 },
          ];
          renderTable(entries, columns);

          const action = await showMenu(`Gerenciar ${listType}`, [
            { label: "Adicionar Entrada", value: "add", icon: "➕" },
            { label: "Remover Entrada", value: "remove", icon: "🗑️" },
            { label: "Voltar", value: "back", icon: "◀️" },
          ]);

          if (action === 'add') await this.addToList(listType);
          if (action === 'remove') await this.removeFromList(listType);

      } catch (error: any) {
          spinner.fail(`Falha ao carregar ${listType}`);
          throw error;
      }
  }

  /**
   * Gerencia configurações
   */
  async manageSettings(): Promise<void> {
    const spinner = new Spinner().start("Carregando configurações...");
    try {
      const settings = await this.manager.getSettings();
      spinner.succeed("Configurações carregadas");

      console.log(`\n${chalk.cyan.bold("Configurações Atuais:")}`);
      // display logic
    } catch (error: any) {
      spinner.fail("Falha ao carregar configurações");
      throw error;
    }
  }

  async releaseEmail(): Promise<void> {
      const id = await inputText("ID do email para liberar:");
      const spinner = new Spinner().start("Liberando email...");
      try {
          await this.manager.releaseMessage(id);
          spinner.succeed("Email liberado!");
      } catch (error: any) {
          spinner.fail("Falha ao liberar email");
          throw error;
      }
  }

  async deleteEmail(): Promise<void> {
    const id = await inputText("ID do email para deletar:");
    const spinner = new Spinner().start("Deletando email...");
    try {
        await this.manager.deleteMessage(id);
        spinner.succeed("Email deletado!");
    } catch (error: any) {
        spinner.fail("Falha ao deletar email");
        throw error;
    }
  }

  async addToList(listType: 'whitelist' | 'blacklist'): Promise<void> {
    const entry = await inputText("Entrada (email ou domínio):");
    const spinner = new Spinner().start(`Adicionando à ${listType}...`);
    try {
        await this.manager.addToList(listType, entry);
        spinner.succeed(`Entrada adicionada à ${listType}!`);
    } catch (error: any) {
        spinner.fail("Falha ao adicionar entrada");
        throw error;
    }
  }

  async removeFromList(listType: 'whitelist' | 'blacklist'): Promise<void> {
    const entry = await inputText("Entrada para remover:");
    const spinner = new Spinner().start(`Removendo da ${listType}...`);
    try {
        await this.manager.removeFromList(listType, entry);
        spinner.succeed(`Entrada removida da ${listType}!`);
    } catch (error: any) {
        spinner.fail("Falha ao remover entrada");
        throw error;
    }
  }

  private getPeriodLabel(period: string): string {
    const labels: Record<string, string> = {
      "24h": "Últimas 24 horas", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias",
    };
    return labels[period] || period;
  }
}
