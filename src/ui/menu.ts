import { select } from "@inquirer/prompts";
import chalk from "chalk";

/**
 * Item de menu interativo
 */
export interface MenuItem {
  /** Texto exibido no menu */
  label: string;
  /** Valor retornado quando selecionado */
  value: string;
  /** Descrição detalhada (exibida abaixo do label) */
  description?: string;
  /** Ícone emoji exibido antes do label */
  icon?: string;
  /** Se true, esta opção não pode ser selecionada */
  disabled?: boolean | string;
}

/**
 * Opções de configuração do menu
 */
export interface MenuOptions {
  /** Mensagem de loop (executar novamente após ação) */
  loop?: boolean;
  /** Incluir opção "Voltar" automaticamente */
  includeBack?: boolean;
  /** Incluir opção "Sair" automaticamente */
  includeExit?: boolean;
  /** Callback executado quando uma opção é selecionada (antes de retornar) */
  onSelect?: (value: string) => void | Promise<void>;
}

/**
 * Exibe menu interativo com suporte a ícones e descrições
 *
 * @param title - Título do menu
 * @param items - Array de itens do menu
 * @param options - Opções adicionais do menu
 * @returns Promise com o valor do item selecionado
 *
 * @example
 * ```typescript
 * const choice = await showMenu("Cloudflare Management", [
 *   { label: "List Zones", value: "zones", icon: "🌐", description: "Listar todas as zonas" },
 *   { label: "DNS Records", value: "dns", icon: "📝", description: "Gerenciar registros DNS" },
 *   { label: "Workers", value: "workers", icon: "⚙️", description: "Gerenciar Workers" },
 * ]);
 * ```
 */
export async function showMenu(
  title: string,
  items: MenuItem[],
  options: MenuOptions = {}
): Promise<string> {
  const { includeBack = false, includeExit = true } = options;

  // Adiciona opções automáticas
  const menuItems = [...items];

  if (includeBack) {
    menuItems.push({
      label: "Voltar",
      value: "__back__",
      icon: "◀️",
      description: "Voltar ao menu anterior",
    });
  }

  if (includeExit) {
    menuItems.push({
      label: "Sair",
      value: "__exit__",
      icon: "🚪",
      description: "Sair do menu",
    });
  }

  // Formata as escolhas para o inquirer
  const choices = menuItems.map((item) => {
    let name = "";

    if (item.icon) {
      name += `${item.icon}  `;
    }

    name += chalk.cyan(item.label);

    return {
      name,
      value: item.value,
      description: item.description ? chalk.gray(item.description) : undefined,
      disabled: item.disabled,
    };
  });

  // Exibe título do menu
  console.log("");
  console.log(chalk.cyan.bold(`╔══════════════════════════════════════╗`));
  console.log(chalk.cyan.bold(`║  ${title.padEnd(36)}║`));
  console.log(chalk.cyan.bold(`╚══════════════════════════════════════╝`));
  console.log("");

  // Exibe o menu
  const selected = await select({
    message: chalk.gray("Selecione uma opção:"),
    choices,
    pageSize: 15,
  });

  // Executa callback se fornecido
  if (options.onSelect) {
    await options.onSelect(selected);
  }

  return selected;
}

/**
 * Exibe menu numerado simples (sem inquirer, apenas lista)
 *
 * @param title - Título do menu
 * @param items - Array de strings ou MenuItem
 * @returns void (apenas exibe, não retorna seleção)
 */
export function showSimpleMenu(title: string, items: (string | MenuItem)[]): void {
  console.log("");
  console.log(chalk.cyan.bold(title));
  console.log(chalk.gray("─".repeat(title.length)));
  console.log("");

  items.forEach((item, index) => {
    const num = chalk.cyan(`${(index + 1).toString().padStart(2)}. `);

    if (typeof item === "string") {
      console.log(`${num}${item}`);
    } else {
      const icon = item.icon ? `${item.icon}  ` : "";
      const label = chalk.white(item.label);
      const desc = item.description ? chalk.gray(` - ${item.description}`) : "";
      console.log(`${num}${icon}${label}${desc}`);
    }
  });

  console.log("");
}

/**
 * Menu em cascata (sub-menus aninhados)
 *
 * @param title - Título do menu principal
 * @param sections - Seções do menu (cada uma pode ter sub-items)
 * @returns Promise com o caminho completo da seleção (ex: "section1.item2")
 */
export async function showNestedMenu(
  title: string,
  sections: Record<string, MenuItem[]>
): Promise<string> {
  const sectionItems: MenuItem[] = Object.keys(sections).map((key) => ({
    label: key,
    value: key,
    icon: "📁",
  }));

  sectionItems.push({
    label: "Sair",
    value: "__exit__",
    icon: "🚪",
  });

  const section = await showMenu(title, sectionItems, { includeExit: false });

  if (section === "__exit__") {
    return "__exit__";
  }

  const subItems = sections[section];
  if (!subItems || subItems.length === 0) {
    return section;
  }

  const subChoice = await showMenu(section, subItems, { includeBack: true });

  if (subChoice === "__back__") {
    // Recursão: volta ao menu anterior
    return showNestedMenu(title, sections);
  }

  return `${section}.${subChoice}`;
}

/**
 * Menu de confirmação estilizado
 *
 * @param message - Mensagem de confirmação
 * @param defaultValue - Valor padrão (true = Sim)
 * @returns Promise<boolean>
 */
export async function confirmMenu(message: string, defaultValue = false): Promise<boolean> {
  const choices = [
    {
      name: chalk.green("✓ Sim"),
      value: true,
    },
    {
      name: chalk.red("✗ Não"),
      value: false,
    },
  ];

  console.log("");
  console.log(chalk.yellow(`⚠  ${message}`));
  console.log("");

  return await select({
    message: chalk.gray("Confirmar:"),
    choices,
    default: defaultValue,
  });
}
