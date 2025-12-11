import chalk from "chalk";
import { renderTable, TableColumn, statusColor } from "../../ui/table";
import { showMenu, MenuItem } from "../../ui/menu";
import { Spinner } from "../../ui/spinner";
import { showHeader, showError, showSuccess } from "../../ui/banner";
import { inputText, confirmAction } from "../../ui/prompt";

/**
 * Interface para gerenciamento visual do OPNsense
 * Integra com a API do OPNsense para gestão de firewall e rede
 */
export class OPNsenseUI {
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
          description: "Gerenciar túneis VPN (IPsec, OpenVPN)",
        },
        {
          label: "Traffic Shaper",
          value: "traffic",
          icon: "🚦",
          description: "Controle de tráfego e QoS",
        },
        {
          label: "Interfaces",
          value: "interfaces",
          icon: "🌐",
          description: "Configurar interfaces de rede",
        },
        {
          label: "DHCP / DNS",
          value: "dhcp",
          icon: "📡",
          description: "Serviços DHCP e DNS",
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
          case "traffic":
            await this.manageTrafficShaper();
            break;
          case "interfaces":
            await this.manageInterfaces();
            break;
          case "dhcp":
            await this.manageDHCP();
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
      const rules = await this.fetchFirewallRules();
      spinner.succeed("Regras de firewall carregadas");

      const columns: TableColumn[] = [
        { header: "ID", key: "id", width: 8 },
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
        { label: "Editar Regra", value: "edit", icon: "✏️" },
        { label: "Deletar Regra", value: "delete", icon: "🗑️" },
        { label: "Habilitar/Desabilitar", value: "toggle", icon: "🔄" },
        { label: "Aplicar Mudanças", value: "apply", icon: "✅" },
        { label: "Voltar", value: "back", icon: "◀️" },
      ]);

      if (action === "add") {
        await this.addFirewallRule();
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

    const action = await showMenu("Ação da Regra", [
      { label: "Permitir (Pass)", value: "pass", icon: "✅" },
      { label: "Bloquear (Block)", value: "block", icon: "❌" },
      { label: "Rejeitar (Reject)", value: "reject", icon: "🚫" },
    ]);

    if (action === "__exit__") return;

    const iface = await inputText("Interface (ex: WAN, LAN):", "WAN");
    const protocol = await inputText("Protocolo (tcp, udp, icmp, any):", "tcp");
    const source = await inputText("Origem (IP ou 'any'):", "any");
    const destination = await inputText("Destino (IP ou 'any'):", "any");
    const port = await inputText("Porta de destino (ou vazio):", "");

    const confirmed = await confirmAction(
      `Criar regra: ${action} ${protocol} de ${source} para ${destination}:${port || "any"}?`,
      true
    );

    if (!confirmed) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner();
    spinner.start("Criando regra...");

    try {
      await this.createFirewallRule({
        action,
        interface: iface,
        protocol,
        source,
        destination,
        port,
      });
      spinner.succeed("Regra criada com sucesso!");
      console.log(chalk.yellow("\nLembre-se de aplicar as mudanças!"));
    } catch (error: any) {
      spinner.fail("Falha ao criar regra");
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
      await this.applyChanges();
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
      const rules = await this.fetchNATRules();
      spinner.succeed("Regras NAT carregadas");

      const columns: TableColumn[] = [
        { header: "ID", key: "id", width: 8 },
        { header: "Interface", key: "interface", width: 12 },
        { header: "Protocolo", key: "protocol", width: 10 },
        { header: "IP Externo", key: "external", width: 18 },
        { header: "Porta Ext", key: "externalPort", width: 12 },
        { header: "IP Interno", key: "internal", width: 18 },
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
      } else if (action === "apply") {
        await this.applyFirewallChanges();
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

    const iface = await inputText("Interface (WAN, OPT1, etc):", "WAN");
    const protocol = await inputText("Protocolo (tcp, udp, tcp/udp):", "tcp");
    const externalPort = await inputText("Porta externa:");
    const internalIP = await inputText("IP interno:");
    const internalPort = await inputText("Porta interna:", externalPort);

    const confirmed = await confirmAction(
      `Criar redirecionamento: ${iface}:${externalPort} → ${internalIP}:${internalPort}?`,
      true
    );

    if (!confirmed) {
      console.log(chalk.yellow("Operação cancelada"));
      return;
    }

    const spinner = new Spinner();
    spinner.start("Criando redirecionamento...");

    try {
      await this.createPortForward({
        interface: iface,
        protocol,
        externalPort,
        internalIP,
        internalPort,
      });
      spinner.succeed("Redirecionamento criado com sucesso!");
      console.log(chalk.yellow("\nLembre-se de aplicar as mudanças!"));
    } catch (error: any) {
      spinner.fail("Falha ao criar redirecionamento");
      throw error;
    }
  }

  /**
   * Gerencia VPN
   */
  async manageVPN(): Promise<void> {
    const vpnType = await showMenu("Tipo de VPN", [
      { label: "IPsec", value: "ipsec", icon: "🔐" },
      { label: "OpenVPN", value: "openvpn", icon: "🔒" },
      { label: "WireGuard", value: "wireguard", icon: "🛡️" },
      { label: "Voltar", value: "back", icon: "◀️" },
    ]);

    if (vpnType === "__exit__" || vpnType === "back") return;

    const spinner = new Spinner();
    spinner.start(`Carregando túneis ${vpnType}...`);

    try {
      const tunnels = await this.fetchVPNTunnels(vpnType);
      spinner.succeed(`Túneis ${vpnType} carregados`);

      const columns: TableColumn[] = [
        { header: "Nome", key: "name", width: 25 },
        { header: "Remote Gateway", key: "remote", width: 20 },
        { header: "Local Network", key: "local", width: 20 },
        {
          header: "Status",
          key: "status",
          width: 12,
          color: statusColor,
        },
        { header: "Uptime", key: "uptime", width: 15 },
      ];

      renderTable(tunnels, columns);
    } catch (error: any) {
      spinner.fail(`Falha ao carregar túneis ${vpnType}`);
      throw error;
    }
  }

  /**
   * Gerencia Traffic Shaper
   */
  async manageTrafficShaper(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando regras de traffic shaper...");

    try {
      const rules = await this.fetchTrafficRules();
      spinner.succeed("Regras de traffic shaper carregadas");

      const columns: TableColumn[] = [
        { header: "Nome", key: "name", width: 25 },
        { header: "Interface", key: "interface", width: 12 },
        { header: "Protocolo", key: "protocol", width: 10 },
        { header: "Bandwidth", key: "bandwidth", width: 15 },
        { header: "Prioridade", key: "priority", width: 12 },
        {
          header: "Status",
          key: "enabled",
          width: 8,
          color: (v: boolean) => (v ? chalk.green("✓") : chalk.gray("✗")),
        },
      ];

      renderTable(rules, columns);
    } catch (error: any) {
      spinner.fail("Falha ao carregar traffic shaper");
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
      const interfaces = await this.fetchInterfaces();
      spinner.succeed("Interfaces carregadas");

      const columns: TableColumn[] = [
        { header: "Nome", key: "name", width: 12 },
        { header: "Tipo", key: "type", width: 12 },
        { header: "IP Address", key: "ip", width: 20 },
        { header: "Gateway", key: "gateway", width: 18 },
        {
          header: "Status",
          key: "status",
          width: 10,
          color: statusColor,
        },
        { header: "MAC", key: "mac", width: 20 },
      ];

      renderTable(interfaces, columns);
    } catch (error: any) {
      spinner.fail("Falha ao carregar interfaces");
      throw error;
    }
  }

  /**
   * Gerencia DHCP e DNS
   */
  async manageDHCP(): Promise<void> {
    const service = await showMenu("Serviço", [
      { label: "DHCP Server", value: "dhcp", icon: "📡" },
      { label: "DNS Resolver", value: "dns", icon: "🔍" },
      { label: "Voltar", value: "back", icon: "◀️" },
    ]);

    if (service === "__exit__" || service === "back") return;

    if (service === "dhcp") {
      await this.showDHCPConfig();
    } else if (service === "dns") {
      await this.showDNSConfig();
    }
  }

  /**
   * Exibe configuração DHCP
   */
  async showDHCPConfig(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando configuração DHCP...");

    try {
      const config = await this.fetchDHCPConfig();
      spinner.succeed("Configuração DHCP carregada");

      console.log("");
      console.log(chalk.cyan.bold("Configuração DHCP:"));
      console.log(chalk.gray("─".repeat(50)));
      console.log(chalk.cyan("Interface:"), chalk.green(config.interface));
      console.log(chalk.cyan("Range:"), chalk.yellow(`${config.start} - ${config.end}`));
      console.log(chalk.cyan("Gateway:"), chalk.yellow(config.gateway));
      console.log(chalk.cyan("DNS Servers:"), chalk.yellow(config.dns.join(", ")));
      console.log(chalk.cyan("Lease Time:"), chalk.yellow(config.leaseTime));
      console.log("");

      const columns: TableColumn[] = [
        { header: "IP", key: "ip", width: 18 },
        { header: "MAC", key: "mac", width: 20 },
        { header: "Hostname", key: "hostname", width: 25 },
        { header: "Expira", key: "expires", width: 20 },
      ];

      if (config.leases && config.leases.length > 0) {
        console.log(chalk.cyan.bold("Leases Ativos:"));
        renderTable(config.leases, columns);
      }
    } catch (error: any) {
      spinner.fail("Falha ao carregar configuração DHCP");
      throw error;
    }
  }

  /**
   * Exibe configuração DNS
   */
  async showDNSConfig(): Promise<void> {
    const spinner = new Spinner();
    spinner.start("Carregando configuração DNS...");

    try {
      const config = await this.fetchDNSConfig();
      spinner.succeed("Configuração DNS carregada");

      console.log("");
      console.log(chalk.cyan.bold("Configuração DNS Resolver:"));
      console.log(chalk.gray("─".repeat(50)));
      console.log(
        chalk.cyan("DNSSEC:"),
        config.dnssec ? chalk.green("✓") : chalk.gray("✗")
      );
      console.log(chalk.cyan("Upstream:"), chalk.yellow(config.upstream.join(", ")));
      console.log(chalk.cyan("Cache Size:"), chalk.yellow(config.cacheSize));
      console.log("");
    } catch (error: any) {
      spinner.fail("Falha ao carregar configuração DNS");
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
      const status = await this.fetchSystemStatus();
      spinner.succeed("Status do sistema carregado");

      console.log("");
      console.log(chalk.cyan.bold("Status do Sistema OPNsense:"));
      console.log(chalk.gray("─".repeat(50)));
      console.log(chalk.cyan("Hostname:"), chalk.green(status.hostname));
      console.log(chalk.cyan("Versão:"), chalk.yellow(status.version));
      console.log(chalk.cyan("Uptime:"), chalk.yellow(status.uptime));
      console.log(chalk.cyan("CPU:"), this.getColoredMetric(status.cpu, "%"));
      console.log(chalk.cyan("Memória:"), this.getColoredMetric(status.memory, "%"));
      console.log(chalk.cyan("Swap:"), this.getColoredMetric(status.swap, "%"));
      console.log(chalk.cyan("Temperatura:"), chalk.yellow(status.temp));
      console.log("");

      const columns: TableColumn[] = [
        { header: "Interface", key: "name", width: 12 },
        { header: "RX (MB)", key: "rx", width: 15 },
        { header: "TX (MB)", key: "tx", width: 15 },
        { header: "Erros", key: "errors", width: 10 },
      ];

      if (status.interfaces && status.interfaces.length > 0) {
        console.log(chalk.cyan.bold("Tráfego de Rede:"));
        renderTable(status.interfaces, columns);
      }
    } catch (error: any) {
      spinner.fail("Falha ao carregar status do sistema");
      throw error;
    }
  }

  /**
   * Colore métrica baseado em valor
   */
  private getColoredMetric(value: number, unit: string): string {
    const valueStr = `${value}${unit}`;
    if (value < 60) return chalk.green(valueStr);
    if (value < 80) return chalk.yellow(valueStr);
    return chalk.red(valueStr);
  }

  // ========================
  // API Mock Methods
  // TODO: Substituir por chamadas reais à API do OPNsense
  // ========================

  private async fetchFirewallRules(): Promise<any[]> {
    return [
      { id: "1", action: "pass", interface: "WAN", protocol: "tcp", source: "any", destination: "192.168.1.10", port: "443", enabled: true },
      { id: "2", action: "block", interface: "WAN", protocol: "any", source: "any", destination: "any", port: "", enabled: true },
    ];
  }

  private async createFirewallRule(rule: any): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private async applyChanges(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  private async fetchNATRules(): Promise<any[]> {
    return [
      { id: "1", interface: "WAN", protocol: "tcp", external: "any", externalPort: "80", internal: "192.168.1.100", internalPort: "80", enabled: true },
      { id: "2", interface: "WAN", protocol: "tcp", external: "any", externalPort: "443", internal: "192.168.1.100", internalPort: "443", enabled: true },
    ];
  }

  private async createPortForward(rule: any): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private async fetchVPNTunnels(type: string): Promise<any[]> {
    return [
      { name: "Office-VPN", remote: "203.0.113.10", local: "192.168.1.0/24", status: "active", uptime: "5d 12h" },
      { name: "Backup-Site", remote: "198.51.100.50", local: "192.168.2.0/24", status: "inactive", uptime: "-" },
    ];
  }

  private async fetchTrafficRules(): Promise<any[]> {
    return [
      { name: "VoIP Priority", interface: "WAN", protocol: "udp", bandwidth: "2 Mbps", priority: "High", enabled: true },
      { name: "Web Traffic", interface: "WAN", protocol: "tcp", bandwidth: "10 Mbps", priority: "Medium", enabled: true },
    ];
  }

  private async fetchInterfaces(): Promise<any[]> {
    return [
      { name: "WAN", type: "em0", ip: "203.0.113.1", gateway: "203.0.113.254", status: "active", mac: "00:0c:29:xx:xx:xx" },
      { name: "LAN", type: "em1", ip: "192.168.1.1", gateway: "-", status: "active", mac: "00:0c:29:yy:yy:yy" },
    ];
  }

  private async fetchDHCPConfig(): Promise<any> {
    return {
      interface: "LAN",
      start: "192.168.1.100",
      end: "192.168.1.200",
      gateway: "192.168.1.1",
      dns: ["8.8.8.8", "1.1.1.1"],
      leaseTime: "86400s",
      leases: [
        { ip: "192.168.1.105", mac: "aa:bb:cc:dd:ee:01", hostname: "laptop", expires: "2025-12-11 10:30" },
        { ip: "192.168.1.110", mac: "aa:bb:cc:dd:ee:02", hostname: "desktop", expires: "2025-12-11 14:20" },
      ],
    };
  }

  private async fetchDNSConfig(): Promise<any> {
    return {
      dnssec: true,
      upstream: ["8.8.8.8", "1.1.1.1"],
      cacheSize: "100MB",
    };
  }

  private async fetchSystemStatus(): Promise<any> {
    return {
      hostname: "opnsense.local",
      version: "24.7.1",
      uptime: "15 days 6 hours",
      cpu: 35,
      memory: 42,
      swap: 5,
      temp: "45°C",
      interfaces: [
        { name: "WAN", rx: "12,450", tx: "8,230", errors: "0" },
        { name: "LAN", rx: "45,670", tx: "32,100", errors: "0" },
      ],
    };
  }
}
