#!/usr/bin/env tsx
/**
 * Demo dos componentes de UI do FazAI
 *
 * Execução:
 *   npx tsx examples/ui-demo.ts
 */

import {
  showLogo,
  showBanner,
  showSection,
  showHeader,
  showSuccess,
  showError,
  showWarning,
  showInfo,
} from "../src/ui/banner";
import { renderTable, TableColumn, statusColor } from "../src/ui/table";
import { Spinner, withSpinner } from "../src/ui/spinner";
import {
  selectOption,
  confirmAction,
  inputText,
  selectWithDescription,
} from "../src/ui/prompt";
import { showMenu, MenuItem } from "../src/ui/menu";
import { showDashboard, DashboardData, showMiniDashboard } from "../src/ui/dashboard";
import chalk from "chalk";

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function demoLogo() {
  console.clear();
  showLogo();
  await delay(2000);
}

async function demoBanners() {
  console.clear();
  showBanner("FazAI UI Demo", "Demonstração dos Componentes Visuais", {
    gradient: true,
    gradientColors: ["cyan", "blue"],
    borderStyle: "round",
  });

  await delay(1000);

  showSection("Exemplos de Banners");
  await delay(500);

  showHeader("🔥", "Firewall Manager", "Gerenciar regras de firewall");
  await delay(500);

  showSuccess("Operação concluída com sucesso!");
  await delay(500);

  showError("Erro ao processar requisição");
  await delay(500);

  showWarning("Atenção: Esta ação não pode ser desfeita");
  await delay(500);

  showInfo("Informação: Sistema em manutenção às 02:00");
  await delay(2000);
}

async function demoTables() {
  console.clear();
  showSection("Demo de Tabelas");

  // Tabela 1: Servidores
  const servers = [
    { id: "1", name: "web-01", ip: "192.168.1.10", status: "online", cpu: "42%" },
    { id: "2", name: "web-02", ip: "192.168.1.11", status: "online", cpu: "35%" },
    { id: "3", name: "db-01", ip: "192.168.1.20", status: "offline", cpu: "0%" },
    { id: "4", name: "cache-01", ip: "192.168.1.30", status: "degraded", cpu: "78%" },
  ];

  const serverColumns: TableColumn[] = [
    { header: "ID", key: "id", width: 5 },
    { header: "Nome", key: "name", width: 15, color: (v) => chalk.cyan(v) },
    { header: "IP", key: "ip", width: 18 },
    { header: "Status", key: "status", width: 12, color: statusColor },
    { header: "CPU", key: "cpu", width: 8 },
  ];

  console.log(chalk.cyan.bold("\nServidores:\n"));
  renderTable(servers, serverColumns);

  await delay(2000);

  // Tabela 2: DNS Records
  const dnsRecords = [
    { type: "A", name: "example.com", content: "192.0.2.1", proxied: true },
    { type: "CNAME", name: "www", content: "example.com", proxied: true },
    { type: "MX", name: "@", content: "mail.example.com", proxied: false },
  ];

  const dnsColumns: TableColumn[] = [
    { header: "Tipo", key: "type", width: 8, color: (v) => chalk.yellow(v) },
    { header: "Nome", key: "name", width: 20, color: (v) => chalk.cyan(v) },
    { header: "Conteúdo", key: "content", width: 25 },
    {
      header: "Proxied",
      key: "proxied",
      width: 10,
      color: (v: boolean) => (v ? chalk.green("Sim") : chalk.gray("Não")),
    },
  ];

  console.log(chalk.cyan.bold("\nRegistros DNS:\n"));
  renderTable(dnsRecords, dnsColumns);

  await delay(3000);
}

async function demoSpinner() {
  console.clear();
  showSection("Demo de Spinners");

  const spinner = new Spinner();

  // Spinner success
  spinner.start("Carregando dados do servidor...");
  await delay(2000);
  spinner.succeed("Dados carregados com sucesso!");

  await delay(1000);

  // Spinner fail
  spinner.start("Conectando ao banco de dados...");
  await delay(2000);
  spinner.fail("Falha ao conectar ao banco de dados");

  await delay(1000);

  // Spinner info
  spinner.start("Verificando atualizações...");
  await delay(2000);
  spinner.info("Nenhuma atualização disponível");

  await delay(1000);

  // withSpinner helper
  console.log(chalk.cyan("\nUsando withSpinner helper:\n"));
  const result = await withSpinner(
    "Processando dados...",
    async () => {
      await delay(2000);
      return { processed: 100, errors: 0 };
    },
    "Processamento concluído!"
  );

  console.log(chalk.gray(`Resultado: ${JSON.stringify(result)}`));

  await delay(2000);
}

async function demoPrompts() {
  console.clear();
  showSection("Demo de Prompts Interativos");

  // Select option
  const action = await selectOption("Escolha uma ação:", [
    { value: "create", name: "Criar novo", description: "Cria um novo recurso" },
    { value: "update", name: "Atualizar", description: "Atualiza recurso existente" },
    { value: "delete", name: "Deletar", description: "Remove recurso" },
  ]);

  console.log(chalk.green(`\n✓ Ação selecionada: ${action}\n`));

  // Confirm action
  const confirmed = await confirmAction("Deseja continuar com a operação?", true);

  console.log(
    confirmed
      ? chalk.green("\n✓ Operação confirmada\n")
      : chalk.yellow("\n⚠ Operação cancelada\n")
  );

  // Input text
  const name = await inputText("Digite um nome:", "default-name");

  console.log(chalk.green(`\n✓ Nome digitado: ${name}\n`));

  await delay(1000);
}

async function demoMenu() {
  console.clear();
  showSection("Demo de Menus");

  const items: MenuItem[] = [
    {
      label: "Cloudflare",
      value: "cloudflare",
      icon: "☁️",
      description: "Gerenciar zonas e DNS",
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

  console.log(chalk.green(`\n✓ API selecionada: ${choice}\n`));

  if (choice !== "__exit__") {
    const subItems: MenuItem[] = [
      { label: "Listar", value: "list", icon: "📋", description: "Listar recursos" },
      { label: "Criar", value: "create", icon: "➕", description: "Criar novo recurso" },
      { label: "Deletar", value: "delete", icon: "🗑️", description: "Remover recurso" },
    ];

    const subChoice = await showMenu(`${choice} - Ações`, subItems, {
      includeBack: true,
    });

    console.log(chalk.green(`\n✓ Ação selecionada: ${subChoice}\n`));
  }

  await delay(2000);
}

async function demoDashboard() {
  console.clear();

  const dashboardData: DashboardData = {
    system: {
      cpu: "42%",
      memory: "3.2GB / 8GB",
      disk: "120GB / 500GB",
      uptime: "15 days 6 hours",
    },
    recentCommands: [
      { timestamp: "10:30", command: "nginx restart", status: "success" },
      { timestamp: "10:25", command: "systemctl status", status: "success" },
      { timestamp: "10:20", command: "docker ps", status: "success" },
      { timestamp: "10:15", command: "git pull", status: "error" },
    ],
    apiStatus: [
      { name: "Cloudflare", status: "online", responseTime: "120ms", lastCheck: "10:35" },
      { name: "SpamExperts", status: "online", responseTime: "85ms", lastCheck: "10:35" },
      { name: "OPNsense", status: "degraded", responseTime: "450ms", lastCheck: "10:34" },
    ],
  };

  showDashboard(dashboardData);

  await delay(5000);

  // Mini dashboard
  console.clear();
  showSection("Mini Dashboard");
  showMiniDashboard({
    cpu: "42%",
    memory: "3.2GB / 8GB",
    disk: "120GB / 500GB",
  });

  await delay(3000);
}

async function main() {
  console.log(chalk.cyan.bold("\n=== FazAI UI Components Demo ===\n"));
  console.log(chalk.gray("Esta demo mostrará todos os componentes visuais disponíveis.\n"));
  console.log(chalk.yellow("Pressione Ctrl+C para sair a qualquer momento.\n"));

  await delay(2000);

  // 1. Logo
  await demoLogo();

  // 2. Banners
  await demoBanners();

  // 3. Tabelas
  await demoTables();

  // 4. Spinners
  await demoSpinner();

  // 5. Prompts
  await demoPrompts();

  // 6. Menus
  await demoMenu();

  // 7. Dashboard
  await demoDashboard();

  // Final
  console.clear();
  showBanner("Demo Concluída!", "Obrigado por conferir os componentes FazAI UI", {
    gradient: true,
    gradientColors: ["green", "cyan"],
    borderStyle: "round",
  });

  console.log(chalk.gray("\nPara usar no seu projeto:"));
  console.log(chalk.cyan('  import { showBanner, renderTable } from "./ui";'));
  console.log(chalk.gray("\nDocumentação completa em:"));
  console.log(chalk.cyan("  src/ui/README.md\n"));
}

main().catch((error) => {
  console.error(chalk.red("\nErro na demo:"), error);
  process.exit(1);
});
