import chalk from "chalk";
import boxen from "boxen";

/**
 * Opções para exibição de banner
 */
export interface BannerOptions {
  /** Cor do banner (usa chalk colors) */
  color?: "cyan" | "green" | "yellow" | "red" | "blue" | "magenta";
  /** Aplicar gradiente ao texto */
  gradient?: boolean;
  /** Cores do gradiente (requer gradient: true) */
  gradientColors?: string[];
  /** Padding interno do box */
  padding?: number;
  /** Margem externa do box */
  margin?: number;
  /** Estilo da borda */
  borderStyle?: "single" | "double" | "round" | "bold" | "classic";
  /** Cor da borda */
  borderColor?: "cyan" | "green" | "yellow" | "red" | "blue" | "magenta" | "gray";
  /** Alinhamento do texto */
  textAlign?: "left" | "center" | "right";
}

/**
 * Exibe um banner visual com título e subtítulo opcional
 *
 * @param title - Título principal do banner
 * @param subtitle - Subtítulo opcional
 * @param options - Opções de estilo do banner
 *
 * @example
 * ```typescript
 * showBanner("FazAI CLI", "Administrador Linux Inteligente", {
 *   gradient: true,
 *   gradientColors: ["cyan", "blue"],
 *   borderStyle: "round"
 * });
 * ```
 */
export function showBanner(
  title: string,
  subtitle?: string,
  options: BannerOptions = {}
): void {
  const {
    color = "cyan",
    gradient: useGradient = false,
    gradientColors = ["cyan", "blue"],
    padding = 1,
    margin = 1,
    borderStyle = "round",
    borderColor = "cyan",
    textAlign = "center",
  } = options;

  let content = title;
  if (subtitle) {
    content += "\n" + chalk.gray(subtitle);
  }

  // Aplica cor (gradient option deprecated due to ESM/CJS compatibility)
  const selectedColor = useGradient && gradientColors.length > 0
    ? gradientColors[0]
    : color;

  const chalkColor = chalk[selectedColor as keyof typeof chalk] as any;
  if (typeof chalkColor === "function") {
    const lines = content.split("\n");
    content = chalkColor.bold(lines[0]);
    if (lines.length > 1) {
      content += "\n" + chalk.gray(lines.slice(1).join("\n"));
    }
  }

  const box = boxen(content, {
    padding,
    margin,
    borderStyle: borderStyle as any,
    borderColor: borderColor as any,
    textAlignment: textAlign as any,
  });

  console.log(box);
}

/**
 * Exibe um separador visual entre seções
 *
 * @param title - Título da seção
 * @param style - Estilo do separador (line, double, thick)
 *
 * @example
 * ```typescript
 * showSection("Configurações");
 * // Saída:
 * // ══════════════ Configurações ══════════════
 * ```
 */
export function showSection(title?: string, style: "line" | "double" | "thick" = "double"): void {
  const terminalWidth = process.stdout.columns || 80;
  const chars = {
    line: "─",
    double: "═",
    thick: "━",
  };

  const char = chars[style];

  if (!title) {
    console.log(chalk.gray(char.repeat(terminalWidth)));
    return;
  }

  const titleText = ` ${title} `;
  const titleLength = titleText.length;
  const sideLength = Math.floor((terminalWidth - titleLength) / 2);

  const line =
    chalk.gray(char.repeat(sideLength)) +
    chalk.cyan.bold(titleText) +
    chalk.gray(char.repeat(terminalWidth - sideLength - titleLength));

  console.log("\n" + line + "\n");
}

/**
 * Exibe header minimalista com ícone
 *
 * @param icon - Emoji ou ícone
 * @param title - Título
 * @param description - Descrição opcional
 *
 * @example
 * ```typescript
 * showHeader("🔥", "Firewall Manager", "Gerenciar regras de firewall");
 * ```
 */
export function showHeader(icon: string, title: string, description?: string): void {
  console.log("");
  console.log(chalk.cyan(`${icon}  ${chalk.bold(title)}`));
  if (description) {
    console.log(chalk.gray(`   ${description}`));
  }
  console.log("");
}

/**
 * Exibe mensagem de sucesso em box
 */
export function showSuccess(message: string): void {
  const box = boxen(chalk.green(`✅ ${message}`), {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "green",
  });
  console.log(box);
}

/**
 * Exibe mensagem de erro em box
 */
export function showError(message: string): void {
  const box = boxen(chalk.red(`✗ ${message}`), {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "red",
  });
  console.log(box);
}

/**
 * Exibe mensagem de aviso em box
 */
export function showWarning(message: string): void {
  const box = boxen(chalk.yellow(`⚠ ${message}`), {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "yellow",
  });
  console.log(box);
}

/**
 * Exibe informação em box
 */
export function showInfo(message: string): void {
  const box = boxen(chalk.blue(`ℹ ${message}`), {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "blue",
  });
  console.log(box);
}

/**
 * ASCII Art simples do logo FazAI
 */
export function showLogo(): void {
  const logo = `
  ███████╗ █████╗ ███████╗ █████╗ ██╗
  ██╔════╝██╔══██╗╚══███╔╝██╔══██╗██║
  █████╗  ███████║  ███╔╝ ███████║██║
  ██╔══╝  ██╔══██║ ███╔╝  ██╔══██║██║
  ██║     ██║  ██║███████╗██║  ██║██║
  ╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝
  `;

  console.log(chalk.cyan(logo));
  console.log(chalk.gray("  Administrador Linux Inteligente com IA\n"));
}
