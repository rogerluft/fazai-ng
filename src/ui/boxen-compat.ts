/**
 * Boxen Compatibility Layer
 *
 * Simple box drawing implementation that works in both ESM and CJS.
 * Replaces boxen v8+ which is ESM-only and breaks CJS bundling.
 */

import chalk from "chalk";

type BorderStyle = "single" | "double" | "round" | "bold" | "classic";
type Alignment = "left" | "center" | "right";

interface BoxenOptions {
  padding?: number;
  margin?: number;
  borderStyle?: BorderStyle;
  borderColor?: string;
  textAlignment?: Alignment;
}

const BORDERS: Record<BorderStyle, {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}> = {
  single: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
  },
  double: {
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║",
  },
  round: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
  },
  bold: {
    topLeft: "┏",
    topRight: "┓",
    bottomLeft: "┗",
    bottomRight: "┛",
    horizontal: "━",
    vertical: "┃",
  },
  classic: {
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    horizontal: "-",
    vertical: "|",
  },
};

/**
 * Simple boxen replacement that works in CJS
 */
export function boxen(text: string, options: BoxenOptions = {}): string {
  const {
    padding = 0,
    margin = 0,
    borderStyle = "single",
    borderColor = "white",
    textAlignment = "left",
  } = options;

  const border = BORDERS[borderStyle];
  const lines = text.split("\n");

  // Calculate box width
  const contentWidth = Math.max(...lines.map(line => stripAnsi(line).length));
  const innerWidth = contentWidth + (padding * 2);

  // Apply border color
  const colorFn = (chalk as any)[borderColor] || chalk.white;

  // Build box
  const topBorder = colorFn(border.topLeft + border.horizontal.repeat(innerWidth) + border.topRight);
  const bottomBorder = colorFn(border.bottomLeft + border.horizontal.repeat(innerWidth) + border.bottomRight);

  const paddingLine = colorFn(border.vertical) + " ".repeat(innerWidth) + colorFn(border.vertical);
  const marginSpace = " ".repeat(margin);

  // Format content lines
  const contentLines = lines.map(line => {
    const stripped = stripAnsi(line);
    const ansiCodes = line.replace(stripped, "");
    const lineLength = stripped.length;

    let paddedLine = line;

    // Apply text alignment
    if (textAlignment === "center") {
      const leftPad = Math.floor((contentWidth - lineLength) / 2);
      const rightPad = contentWidth - lineLength - leftPad;
      paddedLine = " ".repeat(leftPad) + line + " ".repeat(rightPad);
    } else if (textAlignment === "right") {
      const leftPad = contentWidth - lineLength;
      paddedLine = " ".repeat(leftPad) + line;
    } else {
      // left align
      paddedLine = line + " ".repeat(contentWidth - lineLength);
    }

    const sidePadding = " ".repeat(padding);
    return colorFn(border.vertical) + sidePadding + paddedLine + sidePadding + colorFn(border.vertical);
  });

  // Assemble box
  const box: string[] = [];

  // Top margin
  for (let i = 0; i < margin; i++) {
    box.push("");
  }

  // Top border
  box.push(marginSpace + topBorder);

  // Top padding
  for (let i = 0; i < padding; i++) {
    box.push(marginSpace + paddingLine);
  }

  // Content
  contentLines.forEach(line => {
    box.push(marginSpace + line);
  });

  // Bottom padding
  for (let i = 0; i < padding; i++) {
    box.push(marginSpace + paddingLine);
  }

  // Bottom border
  box.push(marginSpace + bottomBorder);

  // Bottom margin
  for (let i = 0; i < margin; i++) {
    box.push("");
  }

  return box.join("\n");
}

/**
 * Strip ANSI escape codes from string
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}
