/**
 * FazAI Completion Command
 *
 * Generates and manages bash/zsh completion scripts with TRUE auto-discovery.
 * Parses src/commands/*.ts files to extract subcommands dynamically.
 *
 * Usage:
 *   fazai completion              # Show help
 *   fazai completion bash         # Output bash completion script
 *   fazai completion zsh          # Output zsh completion script
 *   fazai completion install      # Install to system
 *   fazai completion list         # List available commands (legacy)
 */

import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { models } from "../models";

// ESM compatibility: get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source of truth for main commands: SUBCOMMANDS_WITH_HELP in app.ts
const COMMANDS = [
  "qdrant",
  "vector",
  "ask",
  "import",
  "alias",
  "cloudflare",
  "cf",
  "github",
  "index",
  "sync",
  "config",
  "search",
  "inference",
  "agent",
  "ingest",
  "dashboard",
  "samba",
  "completion",
];

const OPTIONS = [
  "--dry-run",
  "--cli",
  "--debug",
  "--verbose",
  "--log-file",
  "--auto-research",
  "--yolo",
  "-y",
  "--semantic",
  "--help",
  "-h",
];

/**
 * Auto-discover subcommands by parsing case statements in command files.
 * This is the TRUE auto-discovery - not hardcoded lists.
 */
function discoverSubcommands(): Record<string, string[]> {
  const subcommands: Record<string, string[]> = {};

  // Find project root and source directories
  // __dirname could be src/commands or dist/commands depending on how we're running
  const projectRoot = path.resolve(__dirname, "../..");
  const srcCommandsDir = path.join(projectRoot, "src/commands");
  const distCommandsDir = path.join(projectRoot, "dist/commands");

  // Map of command name to file name (when different)
  const fileMapping: Record<string, string> = {
    cf: "cloudflare", // cf uses cloudflare.ts
  };

  for (const cmd of COMMANDS) {
    const fileName = fileMapping[cmd] || cmd;

    // Possible file locations (prefer source for better parsing)
    const possiblePaths = [
      path.join(srcCommandsDir, `${fileName}.ts`),
      path.join(distCommandsDir, `${fileName}.js`),
      path.join(distCommandsDir, `${fileName}.cjs`),
      path.join(__dirname, `${fileName}.ts`),
      path.join(__dirname, `${fileName}.js`),
    ];

    let content = "";

    // Try each possible path
    for (const fp of possiblePaths) {
      try {
        content = fs.readFileSync(fp, "utf-8");
        break;
      } catch {
        // Continue to next file
      }
    }

    if (!content) {
      // For commands without dedicated files, skip
      continue;
    }

    // Extract case statements: case "xxx":
    // Exclude template literals like ${COMP_WORDS[1]}, ${prev}, ${state}, $words[1]
    const casePattern = /case\s+["']([^"'$]+)["']\s*:/g;
    const matches = content.matchAll(casePattern);

    const subs: Set<string> = new Set();
    for (const match of matches) {
      const sub = match[1].trim();
      // Skip template variable references and empty strings
      if (sub && !sub.includes("{") && !sub.includes("$")) {
        subs.add(sub);
      }
    }

    if (subs.size > 0) {
      // Sort: regular commands first, then options (starting with -)
      const regular = [...subs].filter((s) => !s.startsWith("-")).sort();
      const options = [...subs].filter((s) => s.startsWith("-")).sort();
      subcommands[cmd] = [...regular, ...options];
    }
  }

  // Manual additions for commands that use different patterns
  // (e.g., ingest uses --batch, --preview as arguments, not switch cases)
  if (!subcommands["ingest"] || subcommands["ingest"].length === 0) {
    subcommands["ingest"] = ["--batch", "--preview", "--help"];
  }

  // Completion's own subcommands
  subcommands["completion"] = ["bash", "zsh", "install", "list", "help"];

  return subcommands;
}

// Cache discovered subcommands
let _cachedSubcommands: Record<string, string[]> | null = null;

function getSubcommands(): Record<string, string[]> {
  if (!_cachedSubcommands) {
    _cachedSubcommands = discoverSubcommands();
  }
  return _cachedSubcommands;
}

function showCompletionHelp(): void {
  console.log(chalk.bold.cyan("\n🔧 FazAI Completion Command\n"));
  console.log("Generate and manage shell completion scripts.\n");

  console.log(chalk.bold("USAGE:"));
  console.log("  fazai completion <subcommand>\n");

  console.log(chalk.bold("SUBCOMMANDS:"));
  console.log("  bash       Output bash completion script to stdout");
  console.log("  zsh        Output zsh completion script to stdout");
  console.log("  install    Install completion to system (/etc/bash_completion.d/)");
  console.log("  list       List available commands and models (legacy)");
  console.log("  help       Show this help message\n");

  console.log(chalk.bold("DISCOVERED SUBCOMMANDS:"));
  const subs = getSubcommands();
  for (const [cmd, subcmds] of Object.entries(subs)) {
    if (subcmds.length > 0) {
      console.log(`  ${chalk.cyan(cmd)}: ${subcmds.join(", ")}`);
    }
  }
  console.log();

  console.log(chalk.bold("EXAMPLES:"));
  console.log("  fazai completion bash > /tmp/fazai.bash");
  console.log("  fazai completion zsh > ~/.zsh/completion/_fazai");
  console.log("  sudo fazai completion install");
  console.log("  fazai completion list\n");

  console.log(chalk.bold("INSTALLATION:"));
  console.log(chalk.dim("  # Bash (system-wide)"));
  console.log("  sudo fazai completion install\n");
  console.log(chalk.dim("  # Bash (user)"));
  console.log("  fazai completion bash >> ~/.bashrc\n");
  console.log(chalk.dim("  # Zsh"));
  console.log("  mkdir -p ~/.zsh/completion");
  console.log("  fazai completion zsh > ~/.zsh/completion/_fazai");
  console.log("  echo 'fpath=(~/.zsh/completion $fpath)' >> ~/.zshrc");
  console.log("  echo 'autoload -Uz compinit && compinit' >> ~/.zshrc\n");
}

function generateBashCompletion(): string {
  const SUBCOMMANDS = getSubcommands();
  const commandsList = COMMANDS.join(" ");
  const optionsList = OPTIONS.join(" ");
  const modelsList = models.map((m) => m.name).join(" ");

  // Generate case statements for commands with subcommands
  const subcommandCases = Object.entries(SUBCOMMANDS)
    .filter(([, subs]) => subs.length > 0)
    .map(([cmd, subs]) => {
      const subcmds = subs.join(" ");
      return `        ${cmd})
            local subcmds="${subcmds}"
            COMPREPLY=( $(compgen -W "\${subcmds}" -- \${cur}) )
            return 0
            ;;`;
    })
    .join("\n");

  return `#!/usr/bin/env bash
# Bash completion for FazAI - AUTO-GENERATED via TRUE auto-discovery
# Generated by: fazai completion bash
# Source: Parses src/commands/*.ts case statements at runtime
#
# Installation:
#   sudo fazai completion install
# Or:
#   fazai completion bash > /etc/bash_completion.d/fazai
# Or:
#   fazai completion bash >> ~/.bashrc

# Load models dynamically from fazai.conf at runtime
_fazai_load_models() {
    local config_file="\${FAZAI_CONFIG_PATH:-/etc/fazai/fazai.conf}"

    if [[ -r "\$config_file" ]]; then
        grep '^MODELS_' "\$config_file" 2>/dev/null | awk -F'=' '{print \$2}' | tr ',' ' ' | tr -s ' '
    fi
}

_fazai_completion() {
    local cur prev opts commands models subcmds
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands (auto-discovered)
    commands="${commandsList}"

    # Options/flags
    opts="${optionsList}"

    # AI models (loaded dynamically from /etc/fazai/fazai.conf)
    if [[ -z "\$FAZAI_MODELS_CACHE" ]]; then
        FAZAI_MODELS_CACHE=\$(_fazai_load_models)
    fi
    models="\$FAZAI_MODELS_CACHE"

    # Fallback models if config not available
    if [[ -z "\$models" ]]; then
        models="${modelsList}"
    fi

    # First argument (command or model)
    if [[ \$COMP_CWORD -eq 1 ]]; then
        COMPREPLY=( \$(compgen -W "\$commands \$models \$opts" -- \${cur}) )
        return 0
    fi

    # Handle specific commands with subcommands (auto-discovered)
    case "\${COMP_WORDS[1]}" in
${subcommandCases}

        ask)
            COMPREPLY=( \$(compgen -W "\$models" -- \${cur}) )
            return 0
            ;;

        import)
            case "\${prev}" in
                import)
                    COMPREPLY=( \$(compgen -f -- \${cur}) )
                    return 0
                    ;;
                --source)
                    COMPREPLY=( \$(compgen -W "claude chatgpt" -- \${cur}) )
                    return 0
                    ;;
                *)
                    if [[ \${cur} == -* ]]; then
                        COMPREPLY=( \$(compgen -W "--source --recursive -r --no-knowledge --no-learning" -- \${cur}) )
                    else
                        COMPREPLY=( \$(compgen -f -- \${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;

        *)
            COMPREPLY=( \$(compgen -W "\${opts}" -- \${cur}) )
            return 0
            ;;
    esac
}

complete -F _fazai_completion fazai
`;
}

function generateZshCompletion(): string {
  const SUBCOMMANDS = getSubcommands();
  const commandsZsh = COMMANDS.map((c) => `'${c}:${c} command'`).join("\n        ");
  const modelsZsh = models.map((m) => `'${m.name}:${m.provider} model'`).join("\n        ");
  const optsZsh = OPTIONS.map((o) => `'${o}:option'`).join("\n        ");

  // Generate subcommand cases
  const subcommandCases = Object.entries(SUBCOMMANDS)
    .filter(([, subs]) => subs.length > 0)
    .map(([cmd, subs]) => {
      const subcmdsZsh = subs.map((s) => `'${s}:${s} subcommand'`).join("\n                ");
      return `        ${cmd})
            local -a ${cmd}_cmds
            ${cmd}_cmds=(
                ${subcmdsZsh}
            )
            _describe '${cmd} subcommands' ${cmd}_cmds
            ;;`;
    })
    .join("\n");

  return `#compdef fazai
# Zsh completion for FazAI - AUTO-GENERATED via TRUE auto-discovery
# Generated by: fazai completion zsh
# Source: Parses src/commands/*.ts case statements at runtime
#
# Installation:
#   mkdir -p ~/.zsh/completion
#   fazai completion zsh > ~/.zsh/completion/_fazai
#   Add to ~/.zshrc: fpath=(~/.zsh/completion $fpath)
#   Run: autoload -Uz compinit && compinit

_fazai_load_models() {
    local config_file="\${FAZAI_CONFIG_PATH:-/etc/fazai/fazai.conf}"

    if [[ -r "\$config_file" ]]; then
        grep '^MODELS_' "\$config_file" 2>/dev/null | cut -d'=' -f2 | tr ',' '\\n'
    fi
}

_fazai() {
    local -a commands models opts

    commands=(
        ${commandsZsh}
    )

    if [[ -z "\$FAZAI_MODELS_CACHE_ZSH" ]]; then
        FAZAI_MODELS_CACHE_ZSH=(\${(f)"\$(_fazai_load_models)"})
    fi
    models=("\$FAZAI_MODELS_CACHE_ZSH[@]")

    # Fallback models
    if [[ \${#models[@]} -eq 0 ]]; then
        models=(
            ${modelsZsh}
        )
    fi

    opts=(
        ${optsZsh}
    )

    _arguments \\
        '1:command:->command' \\
        '*::arg:->args'

    case "\$state" in
        command)
            _describe 'fazai commands' commands
            _describe 'fazai models' models
            _describe 'fazai options' opts
            ;;

        args)
            case "\$words[1]" in
${subcommandCases}

                ask)
                    _describe 'fazai models' models
                    ;;

                import)
                    _arguments \\
                        '1:file:_files' \\
                        '--source[Source platform]:source:(claude chatgpt)' \\
                        '--recursive[Process directory recursively]' \\
                        '-r[Process directory recursively]'
                    ;;
            esac
            ;;
    esac
}

_fazai "\$@"
`;
}

function installCompletion(): void {
  const bashScript = generateBashCompletion();
  const targetPath = "/etc/bash_completion.d/fazai";

  try {
    // Check if we have write permission
    fs.accessSync("/etc/bash_completion.d", fs.constants.W_OK);

    fs.writeFileSync(targetPath, bashScript, { mode: 0o644 });
    console.log(chalk.green(`✅ Completion installed to ${targetPath}`));
    console.log(chalk.dim("   Run 'exec bash' or open a new terminal to activate"));

    // Show what was discovered
    const subs = getSubcommands();
    console.log(chalk.cyan("\n📊 Auto-discovered subcommands:"));
    for (const [cmd, subcmds] of Object.entries(subs)) {
      if (subcmds.length > 0) {
        console.log(`   ${cmd}: ${subcmds.length} subcommands`);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      console.log(chalk.red("❌ Permission denied. Run with sudo:"));
      console.log(chalk.yellow("   sudo fazai completion install"));
    } else {
      console.log(chalk.red(`❌ Error: ${(error as Error).message}`));
    }
    process.exit(1);
  }
}

function listCompletions(): void {
  // Legacy behavior: list commands, options, and models
  const suggestions = [
    ...COMMANDS,
    ...OPTIONS,
    ...models.map((m) => m.name),
  ];
  console.log(suggestions.join("\n"));
}

export async function handleCompletionCommand(args: string[]): Promise<void> {
  const subcommand = args[0]?.toLowerCase();

  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    showCompletionHelp();
    return;
  }

  switch (subcommand) {
    case "bash":
      console.log(generateBashCompletion());
      break;

    case "zsh":
      console.log(generateZshCompletion());
      break;

    case "install":
      installCompletion();
      break;

    case "list":
      listCompletions();
      break;

    default:
      console.log(chalk.yellow(`Unknown subcommand: ${subcommand}`));
      showCompletionHelp();
      process.exit(1);
  }
}

export { COMMANDS, OPTIONS, getSubcommands };
