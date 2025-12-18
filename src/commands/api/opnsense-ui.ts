import chalk from "chalk";
import { renderTable, TableColumn, statusColor } from "../../ui/table";
import { showMenu, MenuItem } from "../../ui/menu";
import { Spinner } from "../../ui/spinner";
import { showHeader, showError, showSuccess } from "../../ui/banner";
import { inputText, confirmAction } from "../../ui/prompt";
import { OPNsenseManager, FirewallRule, NATRule } from "../../opnsense-manager";

/**
 * Interface para gerenciamento visual do OPNsense
 * Integra com a API do OPNsense para gestão de firewall e rede
 */
export class OPNsenseUI {
  private manager: OPNsenseManager;

  constructor() {
    try {
      this.manager = new OPNsenseManager();
    } catch (error: any) {
      showError(`Falha ao inicializar OPNsense: ${error.message}`);
      throw new Error("Inicialização do OPNsense falhou. Verifique as credenciais em /etc/fazai/fazai.conf");
    }
  }
  /**
   * Menu principal do OPNsense
   */
  async showMainMenu(): Promise<void> {
    while (true) {
      showHeader("🔥", "OPNsense Management", "Gerenciar firewall e serviços de rede");

      const items: MenuItem[] = [
        {
          label: "Regras de Firewall",
          value: "firewall",
          icon: "🔥",
          description: "Gerenciar regras de firewall",
        },
        {
          label: "NAT / Port Forward",
          value: "nat",
          icon: "🔄",
          description: "Configurar NAT e redirecionamento",
        },
        {
          label: "VPN",
          value: "vpn",
          icon: "🔐",
          description: "Gerenciar túneis VPN (IPsec)",
        },
        {
          label: "Interfaces",
          value: "interfaces",
          icon: "🌐",
          description: "Configurar interfaces de rede",
        },
        {
          label: "DHCP Leases",
          value: "dhcp",
          icon: "📡",
          description: "Visualizar leases DHCP ativos",
        },
        {
          label: "Status do Sistema",
          value: "status",
          icon: "📊",
          description: "Monitoramento e logs",
        },
      ];

      const action = await showMenu("OPNsense", items);

      if (action === "__exit__") {
        break;
      }

      try {
        switch (action) {
          case "firewall":
            await this.manageFirewall();
            break;
          case "nat":
            await this.manageNAT();
            break;
          case "vpn":
            await this.manageVPN();
            break;
          case "interfaces":
            await this.manageInterfaces();
            break;
          case "dhcp":
            await this.showDHCPLeases();
            break;
          case "status":
            await this.showSystemStatus();
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
   * Gerencia regras de firewall
   */
  async manageFirewall(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando regras de firewall...");

    try {
      const rules = await this.manager.listFirewallRules();
      spinner.succeed("Regras de firewall carregadas");

      const columns: TableColumn[] = [
        { header: "ID", key: "id", width: 38 },
        {
          header: "Ação",
          key: "action",
          width: 10,
          color: (v: string) => {
            if (v === "pass") return chalk.green(v);
            if (v === "block") return chalk.red(v);
            return chalk.yellow(v);
          },
        },
        { header: "Interface", key: "interface", width: 12 },
        { header: "Protocolo", key: "protocol", width: 10 },
        { header: "Origem", key: "source", width: 20 },
        { header: "Destino", key: "destination", width: 20 },
        { header: "Porta", key: "port", width: 10 },
        {
          header: "Status",
          key: "enabled",
          width: 8,
          color: (v: boolean) => (v ? chalk.green("✓") : chalk.gray("✗")),
        },
      ];

      renderTable(rules, columns);

      const action = await showMenu("Ações de Firewall", [
        { label: "Adicionar Regra", value: "add", icon: "➕" },
        { label: "Deletar Regra", value: "delete", icon: "🗑️" },
        { label: "Aplicar Mudanças", value: "apply", icon: "✅" },
        { label: "Voltar", value: "back", icon: "◀️" },
      ]);

      if (action === "add") {
        await this.addFirewallRule();
      } else if (action === "delete") {
        const ruleId = await inputText("Digite o UUID da regra a ser deletada:");
        if (ruleId) await this.deleteFirewallRule(ruleId);
      } else if (action === "apply") {
        await this.applyFirewallChanges();
      }
    } catch (error: any) {
      spinner.fail("Falha ao carregar regras de firewall");
      throw error;
    }
  }

  /**
   * Adiciona nova regra de firewall
   */
  async addFirewallRule(): Promise<void> {
    console.log(chalk.cyan("\nAdicionar Nova Regra de Firewall\n"));

    const actionResult = await showMenu("Ação da Regra", [
      { label: "Permitir (Pass)", value: "pass", icon: "✅" },
      { label: "Bloquear (Block)", value: "block", icon: "❌" },
      { label: "Rejeitar (Reject)", value: "reject", icon: "🚫" },
    ]);

    if (!actionResult || actionResult === "__exit__") return;

    const action = actionResult as FirewallRule['action'];

    const newRule: FirewallRule = {
      action,
      interface: await inputText("Interface (ex: WAN, LAN):", "WAN"),
      protocol: await inputText("Protocolo (tcp, udp, icmp, any):", "tcp"),
      source: await inputText("Origem (IP ou 'any'):", "any"),
      destination: await inputText("Destino (IP ou 'any'):", "any"),
      port: await inputText("Porta de destino (ou vazio):", ""),
      enabled: true,
    };

    const confirmed = await confirmAction(
      `Criar regra: ${newRule.action} ${newRule.protocol} de ${newRule.source} para ${newRule.destination}:${newRule.port || "any"}?`,
      true
    );

    if (!confirmed) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner();
    spinner.start("Criando regra...");

    try {
      await this.manager.addFirewallRule(newRule);
      spinner.succeed("Regra criada com sucesso!");
      console.log(chalk.yellow("\nLembre-se de aplicar as mudanças!"));
    } catch (error: any) {
      spinner.fail("Falha ao criar regra");
      throw error;
    }
  }

  /**
   * Deleta uma regra de firewall
   */
  async deleteFirewallRule(uuid: string): Promise<void> {
    const confirmed = await confirmAction(`Deletar regra com UUID ${uuid}?`, false);
    if (!confirmed) return;

    const spinner = new Spinner();
    spinner.start("Deletando regra...");
    try {
      await this.manager.deleteFirewallRule(uuid);
      spinner.succeed("Regra deletada. Lembre-se de aplicar as mudanças.");
    } catch (error: any) {
      spinner.fail("Falha ao deletar regra");
      throw error;
    }
  }

  /**
   * Aplica mudanças de firewall
   */
  async applyFirewallChanges(): Promise<void> {
    const confirmed = await confirmAction(
      "Aplicar mudanças de firewall? Isso pode interromper conexões temporariamente.",
      true
    );

    if (!confirmed) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner();
    spinner.start("Aplicando mudanças de firewall...");

    try {
      await this.manager.applyFirewallChanges();
      spinner.succeed("Mudanças aplicadas com sucesso!");
    } catch (error: any) {
      spinner.fail("Falha ao aplicar mudanças");
      throw error;
    }
  }

  /**
   * Gerencia NAT e Port Forwarding
   */
  async manageNAT(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando regras NAT...");

    try {
      const rules = await this.manager.listNATRules();
      spinner.succeed("Regras NAT carregadas");

      const columns: TableColumn[] = [
        { header: "ID", key: "id", width: 38 },
        { header: "Interface", key: "interface", width: 12 },
        { header: "Protocolo", key: "protocol", width: 10 },
        { header: "Porta Ext", key: "externalPort", width: 12 },
        { header: "IP Interno", key: "internalIP", width: 18 },
        { header: "Porta Int", key: "internalPort", width: 12 },
        {
          header: "Status",
          key: "enabled",
          width: 8,
          color: (v: boolean) => (v ? chalk.green("✓") : chalk.gray("✗")),
        },
      ];

      renderTable(rules, columns);

      const action = await showMenu("Ações NAT", [
        { label: "Adicionar Port Forward", value: "add", icon: "➕" },
        { label: "Deletar Regra", value: "delete", icon: "🗑️" },
        { label: "Aplicar Mudanças", value: "apply", icon: "✅" },
        { label: "Voltar", value: "back", icon: "◀️" },
      ]);

      if (action === "add") {
        await this.addPortForward();
      } else if (action === "delete") {
        const ruleId = await inputText("Digite o UUID da regra a ser deletada:");
        if (ruleId) await this.deletePortForward(ruleId);
      } else if (action === "apply") {
        await this.applyNATChanges();
      }
    } catch (error: any) {
      spinner.fail("Falha ao carregar regras NAT");
      throw error;
    }
  }

  /**
   * Adiciona port forwarding
   */
  async addPortForward(): Promise<void> {
    console.log(chalk.cyan("\nAdicionar Port Forwarding\n"));

    const externalPortInput = await inputText("Porta externa:");
    const newRule: NATRule = {
      interface: await inputText("Interface (WAN, OPT1, etc):", "WAN"),
      protocol: await inputText("Protocolo (tcp, udp, tcp/udp):", "tcp"),
      externalPort: externalPortInput,
      internalIP: await inputText("IP interno:"),
      internalPort: await inputText("Porta interna:", externalPortInput),
      enabled: true,
    };

    const confirmed = await confirmAction(
      `Criar redirecionamento: ${newRule.interface}:${newRule.externalPort} → ${newRule.internalIP}:${newRule.internalPort}?`,
      true
    );

    if (!confirmed) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner();
    spinner.start("Criando redirecionamento...");

    try {
      await this.manager.addPortForward(newRule);
      spinner.succeed("Redirecionamento criado com sucesso!");
      console.log(chalk.yellow("\nLembre-se de aplicar as mudanças!"));
    } catch (error: any) {
      spinner.fail("Falha ao criar redirecionamento");
      throw error;
    }
  }

  /**
   * Deleta uma regra de port forward
   */
  async deletePortForward(uuid: string): Promise<void> {
    const confirmed = await confirmAction(`Deletar regra de NAT com UUID ${uuid}?`, false);
    if (!confirmed) return;

    const spinner = new Spinner();
    spinner.start("Deletando regra...");
    try {
      await this.manager.deletePortForward(uuid);
      spinner.succeed("Regra deletada. Lembre-se de aplicar as mudanças.");
    } catch (error: any) {
      spinner.fail("Falha ao deletar regra");
      throw error;
    }
  }

  /**
   * Aplica mudanças de NAT
   */
  async applyNATChanges(): Promise<void> {
    const confirmed = await confirmAction(
      "Aplicar mudanças de NAT? Isso pode impactar o redirecionamento de portas.",
      true
    );
    if (!confirmed) return;

    const spinner = new Spinner();
    spinner.start("Aplicando mudanças de NAT...");
    try {
      await this.manager.applyNATChanges();
      spinner.succeed("Mudanças de NAT aplicadas com sucesso!");
    } catch (error: any) {
      spinner.fail("Falha ao aplicar mudanças de NAT");
      throw error;
    }
  }

  /**
   * Gerencia VPN
   */
  async manageVPN(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando túneis VPN IPsec...");

    try {
      const tunnels = await this.manager.listVPNTunnels();
      spinner.succeed("Túneis VPN carregados");

      const columns: TableColumn[] = [
        { header: "ID", key: "ikeid", width: 10 },
        { header: "Descrição", key: "descr", width: 30 },
        { header: "Remoto", key: "remote-gw", width: 20 },
        {
          header: "Status",
          key: "status",
          width: 12,
          color: statusColor,
        },
      ];

      renderTable(tunnels, columns);

      // Add actions for connect/disconnect
    } catch (error: any) {
      spinner.fail("Falha ao carregar túneis VPN");
      throw error;
    }
  }

  /**
   * Gerencia interfaces de rede
   */
  async manageInterfaces(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando interfaces...");

    try {
      const interfaces = await this.manager.listInterfaces();
      spinner.succeed("Interfaces carregadas");

      const columns: TableColumn[] = [
        { header: "Nome", key: "name", width: 12 },
        { header: "Dispositivo", key: "device", width: 12 },
        { header: "IP Address", key: "ipaddr", width: 20 },
        { header: "Gateway", key: "gateway", width: 18 },
        {
          header: "Status",
          key: "status",
          width: 10,
          color: statusColor,
        },
        { header: "MAC", key: "macaddr", width: 20 },
      ];

      renderTable(interfaces, columns);
    } catch (error: any) {
      spinner.fail("Falha ao carregar interfaces");
      throw error;
    }
  }

  /**
   * Exibe leases DHCP
   */
  async showDHCPLeases(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando leases DHCP...");

    try {
      const leases = await this.manager.listDHCPLeases();
      spinner.succeed("Leases DHCP carregados");

      const columns: TableColumn[] = [
        { header: "IP", key: "address", width: 18 },
        { header: "MAC", key: "mac", width: 20 },
        { header: "Hostname", key: "hostname", width: 25 },
        { header: "Descrição", key: "descr", width: 30 },
        { header: "Status", key: "status", width: 12, color: statusColor },
      ];

      renderTable(leases, columns);
    } catch (error: any) {
      spinner.fail("Falha ao carregar leases DHCP");
      throw error;
    }
  }

  /**
   * Exibe status do sistema
   */
  async showSystemStatus(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando status do sistema...");

    try {
      const status = await this.manager.getSystemStatus();
      spinner.succeed("Status do sistema carregado");

      console.log("");
      console.log(chalk.cyan.bold("Status do Sistema OPNsense:"));
      console.log(chalk.gray("─".repeat(50)));
      console.log(chalk.cyan("Hostname:"), chalk.green(status.hostname));
      console.log(chalk.cyan("Versão:"), chalk.yellow(status.product_version));
      console.log(chalk.cyan("CPU:"), chalk.yellow(status.cpu_usage) + "%");
      console.log(chalk.cyan("Memória:"), chalk.yellow(status.mem_usage) + "%");
      console.log(chalk.cyan("Temperatura:"), chalk.yellow(status.temp) + "°C");
      console.log("");

    } catch (error: any) {
      spinner.fail("Falha ao carregar status do sistema");
      throw error;
    }
  }
}
