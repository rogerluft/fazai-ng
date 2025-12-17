import chalk from "chalk";

/**
 * Configuração de uma coluna da tabela
 */
export interface TableColumn {
  /** Cabeçalho exibido no topo da coluna */
  header: string;
  /** Chave do objeto a ser exibida nesta coluna */
  key: string;
  /** Largura fixa da coluna (em caracteres). Se não especificada, será auto-calculada */
  width?: number;
  /** Alinhamento do conteúdo da coluna */
  align?: "left" | "center" | "right";
  /** Função para aplicar cor ao valor da célula */
  color?: (value: any) => string;
}

/**
 * Opções de renderização da tabela
 */
export interface TableOptions {
  /** Mostrar bordas ao redor da tabela */
  showBorders?: boolean;
  /** Mostrar cabeçalho da tabela */
  showHeader?: boolean;
  /** Estilo das bordas (single, double, rounded) */
  borderStyle?: "single" | "double" | "rounded";
}

/**
 * Caracteres de desenho de box para diferentes estilos
 */
const BORDER_STYLES = {
  single: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
    topJoin: "┬",
    bottomJoin: "┴",
    leftJoin: "├",
    rightJoin: "┤",
    centerJoin: "┼",
  },
  double: {
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║",
    topJoin: "╦",
    bottomJoin: "╩",
    leftJoin: "╠",
    rightJoin: "╣",
    centerJoin: "╬",
  },
  rounded: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
    topJoin: "┬",
    bottomJoin: "┴",
    leftJoin: "├",
    rightJoin: "┤",
    centerJoin: "┼",
  },
};

/**
 * Calcula a largura de uma string removendo códigos ANSI de cor
 */
function stripAnsi(str: string): string {
  // Remove códigos ANSI de cor
  return str.replace(/\u001b\[\d+m/g, "");
}

/**
 * Calcula a largura visual de uma string (sem códigos ANSI)
 */
function visualLength(str: string): number {
  return stripAnsi(String(str)).length;
}

/**
 * Trunca uma string para um tamanho máximo, adicionando "..." se necessário
 */
function truncate(str: string, maxLength: number): string {
  const cleanStr = String(str);
  if (visualLength(cleanStr) <= maxLength) {
    return cleanStr;
  }
  return stripAnsi(cleanStr).substring(0, maxLength - 3) + "...";
}

/**
 * Alinha texto dentro de uma largura especificada
 */
function alignText(
  text: string,
  width: number,
  align: "left" | "center" | "right" = "left"
): string {
  const cleanText = String(text);
  const currentLength = visualLength(cleanText);
  const padding = width - currentLength;

  if (padding <= 0) {
    return truncate(cleanText, width);
  }

  switch (align) {
    case "right":
      return " ".repeat(padding) + cleanText;
    case "center":
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return " ".repeat(leftPad) + cleanText + " ".repeat(rightPad);
    default: // left
      return cleanText + " ".repeat(padding);
  }
}

/**
 * Calcula larguras automáticas para colunas sem largura definida
 */
function calculateColumnWidths(
  data: any[],
  columns: TableColumn[]
): Map<string, number> {
  const widths = new Map<string, number>();

  for (const col of columns) {
    if (col.width) {
      widths.set(col.key, col.width);
    } else {
      // Calcula largura baseado no maior valor da coluna (incluindo header)
      let maxWidth = visualLength(col.header);

      for (const row of data) {
        const value = row[col.key];
        const valueLength = visualLength(String(value ?? ""));
        if (valueLength > maxWidth) {
          maxWidth = valueLength;
        }
      }

      // Limita largura máxima a 50 caracteres para auto-width
      widths.set(col.key, Math.min(maxWidth, 50));
    }
  }

  return widths;
}

/**
 * Renderiza uma linha horizontal de separação
 */
function renderSeparator(
  columns: TableColumn[],
  widths: Map<string, number>,
  position: "top" | "middle" | "bottom",
  style: keyof typeof BORDER_STYLES
): string {
  const borders = BORDER_STYLES[style];
  let line = "";

  // Determina os caracteres de junção baseado na posição
  let leftChar: string, rightChar: string, joinChar: string;
  switch (position) {
    case "top":
      leftChar = borders.topLeft;
      rightChar = borders.topRight;
      joinChar = borders.topJoin;
      break;
    case "bottom":
      leftChar = borders.bottomLeft;
      rightChar = borders.bottomRight;
      joinChar = borders.bottomJoin;
      break;
    default: // middle
      leftChar = borders.leftJoin;
      rightChar = borders.rightJoin;
      joinChar = borders.centerJoin;
  }

  line += chalk.gray(leftChar);

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const width = widths.get(col.key) || 10;
    line += chalk.gray(borders.horizontal.repeat(width + 2)); // +2 para padding

    if (i < columns.length - 1) {
      line += chalk.gray(joinChar);
    }
  }

  line += chalk.gray(rightChar);
  return line;
}

/**
 * Renderiza uma linha de dados da tabela
 */
function renderRow(
  row: any,
  columns: TableColumn[],
  widths: Map<string, number>,
  isHeader: boolean,
  style: keyof typeof BORDER_STYLES
): string {
  const borders = BORDER_STYLES[style];
  let line = chalk.gray(borders.vertical) + " ";

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const width = widths.get(col.key) || 10;
    const value = isHeader ? col.header : row[col.key];
    let cellContent = alignText(String(value ?? ""), width, col.align);

    // Aplica cor se fornecida (apenas para células de dados, não header)
    if (!isHeader && col.color) {
      cellContent = col.color(value);
      // Precisamos repadding pois a cor adiciona caracteres ANSI
      const currentVisualLength = visualLength(cellContent);
      const paddingNeeded = width - currentVisualLength;
      if (paddingNeeded > 0) {
        cellContent += " ".repeat(paddingNeeded);
      }
    } else if (isHeader) {
      // Headers sempre em cyan bold
      cellContent = chalk.cyan.bold(cellContent);
    }

    line += cellContent + " ";

    if (i < columns.length - 1) {
      line += chalk.gray(borders.vertical) + " ";
    }
  }

  line += chalk.gray(borders.vertical);
  return line;
}

/**
 * Renderiza uma tabela formatada no terminal
 *
 * @param data - Array de objetos a serem exibidos
 * @param columns - Configuração das colunas
 * @param options - Opções de renderização
 *
 * @example
 * ```typescript
 * const data = [
 *   { id: "1", name: "Server 1", status: "online" },
 *   { id: "2", name: "Server 2", status: "offline" },
 * ];
 *
 * const columns: TableColumn[] = [
 *   { header: "ID", key: "id", width: 5 },
 *   { header: "Name", key: "name", width: 20 },
 *   {
 *     header: "Status",
 *     key: "status",
 *     width: 10,
 *     color: (v) => v === "online" ? chalk.green(v) : chalk.red(v)
 *   },
 * ];
 *
 * renderTable(data, columns);
 * ```
 */
export function renderTable(
  data: any[],
  columns: TableColumn[],
  options: TableOptions = {}
): void {
  const {
    showBorders = true,
    showHeader = true,
    borderStyle = "rounded",
  } = options;

  if (!data || data.length === 0) {
    console.log(chalk.gray("Nenhum dado para exibir"));
    return;
  }

  const widths = calculateColumnWidths(data, columns);

  if (showBorders) {
    // Linha superior
    console.log(renderSeparator(columns, widths, "top", borderStyle));
  }

  if (showHeader) {
    // Header
    console.log(renderRow({}, columns, widths, true, borderStyle));

    if (showBorders) {
      // Linha separadora entre header e dados
      console.log(renderSeparator(columns, widths, "middle", borderStyle));
    }
  }

  // Linhas de dados
  for (const row of data) {
    console.log(renderRow(row, columns, widths, false, borderStyle));
  }

  if (showBorders) {
    // Linha inferior
    console.log(renderSeparator(columns, widths, "bottom", borderStyle));
  }
}

/**
 * Helpers de cor pré-definidos para status comuns
 */
export const statusColors = {
  success: (value: any) => chalk.green(String(value)),
  error: (value: any) => chalk.red(String(value)),
  warning: (value: any) => chalk.yellow(String(value)),
  info: (value: any) => chalk.blue(String(value)),
  active: (value: any) => chalk.green(String(value)),
  inactive: (value: any) => chalk.gray(String(value)),
  pending: (value: any) => chalk.yellow(String(value)),
};

/**
 * Helper para colorir status baseado em valor
 */
export function statusColor(value: any): string {
  const val = String(value).toLowerCase();
  if (["online", "active", "enabled", "success", "ok", "running"].includes(val)) {
    return chalk.green(value);
  }
  if (["offline", "inactive", "disabled", "error", "failed", "stopped"].includes(val)) {
    return chalk.red(value);
  }
  if (["pending", "warning", "degraded", "starting"].includes(val)) {
    return chalk.yellow(value);
  }
  if (["not_configured", "not configured"].includes(val)) {
    return chalk.gray(value);
  }
  if (["unauthorized", "forbidden"].includes(val)) {
    return chalk.magenta(value);
  }
  return chalk.gray(value);
}
