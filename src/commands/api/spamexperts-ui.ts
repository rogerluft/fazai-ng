import chalk from "chalk";
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
  /**
   * Menu principal do SpamExperts
   */
  async showMainMenu(): Promise<void> {
    while (true) {
      showHeader("📧", "SpamExperts Management", "Gerenciar proteção de email e spam");

      const items: MenuItem[] = [
        {
          label: "Domínios",
          value: "domains",
          icon: "🌐",
          description: "Gerenciar domínios protegidos",
        },
        {
          label: "Quarentena",
          value: "quarantine",
          icon: "🗑️",
          description: "Visualizar emails em quarentena",
        },
        {
          label: "Relatórios",
          value: "reports",
          icon: "📊",
          description: "Estatísticas e relatórios",
        },
        {
          label: "Whitelist/Blacklist",
          value: "lists",
          icon: "📋",
          description: "Gerenciar listas de permissão/bloqueio",
        },
        {
          label: "Configurações",
          value: "settings",
          icon: "⚙️",
          description: "Configurar filtros e políticas",
        },
        {
          label: "Usuários",
          value: "users",
          icon: "👥",
          description: "Gerenciar usuários e permissões",
        },
      ];

      const action = await showMenu("SpamExperts", items);

      if (action === "__exit__") {
        break;
      }

      try {
        switch (action) {
          case "domains":
            await this.manageDomains();
            break;
          case "quarantine":
            await this.viewQuarantine();
            break;
          case "reports":
            await this.showReports();
            break;
          case "lists":
            await this.manageLists();
            break;
          case "settings":
            await this.manageSettings();
            break;
          case "users":
            await this.manageUsers();
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
   * Gerencia domínios protegidos
   */
  async manageDomains(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando domínios...");

    try {
      const domains = await this.fetchDomains();
      spinner.succeed("Domínios carregados com sucesso");

      const columns: TableColumn[] = [
        { header: "Domínio", key: "domain", width: 30, color: (v) => chalk.cyan(v) },
        {
          header: "Status",
          key: "status",
          width: 12,
          color: statusColor,
        },
        { header: "Emails (24h)", key: "emailsToday", width: 15 },
        { header: "Spam Bloqueado", key: "spamBlocked", width: 15 },
        { header: "Quarentena", key: "quarantined", width: 12 },
      ];

      renderTable(domains, columns);

      const action = await showMenu("Ações de Domínio", [
        { label: "Adicionar Domínio", value: "add", icon: "➕" },
        { label: "Remover Domínio", value: "remove", icon: "🗑️" },
        { label: "Detalhes", value: "details", icon: "🔍" },
        { label: "Voltar", value: "back", icon: "◀️" },
      ]);

      if (action === "add") {
        await this.addDomain();
      } else if (action === "remove") {
        await this.removeDomain();
      } else if (action === "details") {
        await this.showDomainDetails();
      }
    } catch (error: any) {
      spinner.fail("Falha ao carregar domínios");
      throw error;
    }
  }

  /**
   * Adiciona novo domínio à proteção
   */
  async addDomain(): Promise<void> {
    console.log(chalk.cyan("\nAdicionar Novo Domínio\n"));

    const domain = await inputText(
      "Nome do domínio:",
      undefined,
      (value) => {
        if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(value)) {
          return "Domínio inválido";
        }
        return true;
      }
    );

    const destination = await inputText("Servidor de destino (MX):");

    const confirmed = await confirmAction(
      `Adicionar domínio ${domain} com destino ${destination}?`,
      true
    );

    if (!confirmed) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner();
    spinner.start("Adicionando domínio...");

    try {
      await this.createDomain(domain, destination);
      spinner.succeed("Domínio adicionado com sucesso!");
      console.log(chalk.yellow("\nAtualize os registros MX do domínio para:"));
      console.log(chalk.cyan("  Primary MX:   mx1.spamexperts.com (priority 10)"));
      console.log(chalk.cyan("  Secondary MX: mx2.spamexperts.com (priority 20)"));
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

    const confirmed = await confirmAction(
      `ATENÇÃO: Remover o domínio ${domain}? Esta ação não pode ser desfeita.`,
      false
    );

    if (!confirmed) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner();
    spinner.start("Removendo domínio...");

    try {
      await this.deleteDomain(domain);
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

    const spinner = new Spinner();
    spinner.start("Carregando quarentena...");

    try {
      const emails = await this.fetchQuarantine(domain || undefined);
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
        { label: "Adicionar à Whitelist", value: "whitelist", icon: "✅" },
        { label: "Voltar", value: "back", icon: "◀️" },
      ]);

      if (action === "release") {
        await this.releaseEmail();
      } else if (action === "delete") {
        await this.deleteEmail();
      } else if (action === "whitelist") {
        await this.addToWhitelist();
      }
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
    ]);

    if (period === "__exit__" || period === "back") return;

    const spinner = new Spinner();
    spinner.start("Gerando relatório...");

    try {
      const report = await this.fetchReport(period);
      spinner.succeed("Relatório gerado");

      console.log("");
      console.log(chalk.cyan.bold(`Relatório - ${this.getPeriodLabel(period)}`));
      console.log(chalk.gray("─".repeat(50)));
      console.log(chalk.cyan("Total de Emails:"), chalk.green(report.totalEmails));
      console.log(chalk.cyan("Spam Bloqueado:"), chalk.red(report.spamBlocked));
      console.log(chalk.cyan("Emails Limpos:"), chalk.green(report.cleanEmails));
      console.log(chalk.cyan("Quarentena:"), chalk.yellow(report.quarantined));
      console.log(
        chalk.cyan("Taxa de Bloqueio:"),
        chalk.yellow(report.blockRate + "%")
      );
      console.log("");

      const columns: TableColumn[] = [
        { header: "Domínio", key: "domain", width: 30 },
        { header: "Total", key: "total", width: 10 },
        { header: "Spam", key: "spam", width: 10 },
        { header: "Limpos", key: "clean", width: 10 },
      ];

      if (report.byDomain && report.byDomain.length > 0) {
        console.log(chalk.cyan.bold("Por Domínio:"));
        renderTable(report.byDomain, columns);
      }
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
    ]);

    if (listType === "__exit__" || listType === "back") return;

    const spinner = new Spinner();
    spinner.start(`Carregando ${listType}...`);

    try {
      const entries = await this.fetchList(listType);
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

      if (action === "add") {
        await this.addToList(listType);
      } else if (action === "remove") {
        await this.removeFromList(listType);
      }
    } catch (error: any) {
      spinner.fail(`Falha ao carregar ${listType}`);
      throw error;
    }
  }

  /**
   * Gerencia configurações
   */
  async manageSettings(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando configurações...");

    try {
      const settings = await this.fetchSettings();
      spinner.succeed("Configurações carregadas");

      console.log("");
      console.log(chalk.cyan.bold("Configurações Atuais:"));
      console.log(chalk.gray("─".repeat(50)));
      console.log(chalk.cyan("Nível de Spam Score:"), chalk.yellow(settings.spamScore));
      console.log(
        chalk.cyan("Ação para Spam:"),
        chalk.yellow(settings.spamAction)
      );
      console.log(
        chalk.cyan("Notificações Quarentena:"),
        settings.notifications ? chalk.green("✓") : chalk.red("✗")
      );
      console.log(
        chalk.cyan("Auto-Whitelist:"),
        settings.autoWhitelist ? chalk.green("✓") : chalk.red("✗")
      );
      console.log("");
    } catch (error: any) {
      spinner.fail("Falha ao carregar configurações");
      throw error;
    }
  }

  /**
   * Gerencia usuários
   */
  async manageUsers(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando usuários...");

    try {
      const users = await this.fetchUsers();
      spinner.succeed("Usuários carregados");

      const columns: TableColumn[] = [
        { header: "Email", key: "email", width: 30 },
        { header: "Nome", key: "name", width: 25 },
        { header: "Permissão", key: "role", width: 15 },
        {
          header: "Status",
          key: "status",
          width: 10,
          color: statusColor,
        },
      ];

      renderTable(users, columns);
    } catch (error: any) {
      spinner.fail("Falha ao carregar usuários");
      throw error;
    }
  }

  // ========================
  // API Mock Methods
  // TODO: Substituir por chamadas reais à API do SpamExperts
  // ========================

  private async fetchDomains(): Promise<any[]> {
    return [
      { domain: "example.com", status: "active", emailsToday: "1,234", spamBlocked: "456", quarantined: "12" },
      { domain: "test.org", status: "active", emailsToday: "567", spamBlocked: "123", quarantined: "5" },
    ];
  }

  private async createDomain(domain: string, destination: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private async deleteDomain(domain: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private async fetchQuarantine(domain?: string): Promise<any[]> {
    return [
      { id: "1", date: "2025-12-10 10:30", from: "spam@bad.com", to: "user@example.com", subject: "Buy now!", score: 12.5 },
      { id: "2", date: "2025-12-10 09:15", from: "phish@evil.net", to: "admin@example.com", subject: "Reset password", score: 8.2 },
    ];
  }

  private async releaseEmail(): Promise<void> {
    const id = await inputText("ID do email:");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    showSuccess("Email liberado!");
  }

  private async deleteEmail(): Promise<void> {
    const id = await inputText("ID do email:");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    showSuccess("Email deletado!");
  }

  private async addToWhitelist(): Promise<void> {
    const sender = await inputText("Email do remetente:");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    showSuccess("Remetente adicionado à whitelist!");
  }

  private async fetchReport(period: string): Promise<any> {
    return {
      totalEmails: "10,450",
      spamBlocked: "3,210",
      cleanEmails: "6,890",
      quarantined: "350",
      blockRate: "30.7",
      byDomain: [
        { domain: "example.com", total: "8,230", spam: "2,100", clean: "5,980" },
        { domain: "test.org", total: "2,220", spam: "1,110", clean: "910" },
      ],
    };
  }

  private async fetchList(type: string): Promise<any[]> {
    return [
      { entry: "trusted@partner.com", type: "Email", added: "2025-12-01" },
      { entry: "*.safe-domain.com", type: "Domain", added: "2025-11-15" },
    ];
  }

  private async addToList(listType: string): Promise<void> {
    const entry = await inputText("Entrada (email ou domínio):");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    showSuccess(`Entrada adicionada à ${listType}!`);
  }

  private async removeFromList(listType: string): Promise<void> {
    const entry = await inputText("Entrada para remover:");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    showSuccess(`Entrada removida da ${listType}!`);
  }

  private async fetchSettings(): Promise<any> {
    return {
      spamScore: 5.0,
      spamAction: "quarantine",
      notifications: true,
      autoWhitelist: false,
    };
  }

  private async fetchUsers(): Promise<any[]> {
    return [
      { email: "admin@example.com", name: "Admin User", role: "Administrator", status: "active" },
      { email: "user@example.com", name: "Regular User", role: "User", status: "active" },
    ];
  }

  private async showDomainDetails(): Promise<void> {
    const domain = await inputText("Nome do domínio:");
    const spinner = new Spinner();
    spinner.start("Carregando detalhes...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    spinner.succeed("Detalhes carregados");

    console.log("");
    console.log(chalk.cyan.bold(`Detalhes: ${domain}`));
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.cyan("Status:"), chalk.green("Ativo"));
    console.log(chalk.cyan("Servidor Destino:"), "mail.example.com");
    console.log(chalk.cyan("Emails hoje:"), "1,234");
    console.log(chalk.cyan("Spam bloqueado:"), "456 (37%)");
    console.log("");
  }

  private getPeriodLabel(period: string): string {
    const labels: Record<string, string> = {
      "24h": "Últimas 24 horas",
      "7d": "Últimos 7 dias",
      "30d": "Últimos 30 dias",
    };
    return labels[period] || period;
  }
}
