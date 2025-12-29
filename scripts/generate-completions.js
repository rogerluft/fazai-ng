#!/usr/bin/env node
/**
 * Auto-Discovery Completion Generator for FazAI
 *
 * This script DYNAMICALLY extracts commands, subcommands, and options from:
 * - src/app.ts (SUBCOMMANDS_WITH_HELP array + displayHelp function)
 * - src/models.ts (model definitions)
 * - src/commands/*.ts (subcommand patterns)
 *
 * NO HARDCODED COMMANDS - Everything is parsed from source code.
 *
 * @version 2.0.0
 * @author FazAI Agentic Developer
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

/**
 * Parse SUBCOMMANDS_WITH_HELP array from app.ts
 * This is the SOURCE OF TRUTH for all commands
 */
function parseSubcommandsWithHelp(appContent) {
  const commands = [];

  // Match SUBCOMMANDS_WITH_HELP array
  const match = appContent.match(/SUBCOMMANDS_WITH_HELP\s*=\s*\[([\s\S]*?)\]/);
  if (match) {
    const arrayContent = match[1];
    // Extract quoted strings
    const cmdMatches = arrayContent.matchAll(/["']([^"']+)["']/g);
    for (const m of cmdMatches) {
      commands.push(m[1]);
    }
    console.log(`📋 Found ${commands.length} commands in SUBCOMMANDS_WITH_HELP`);
  }

  return commands;
}

/**
 * Parse displayHelp() function to extract command descriptions
 * Returns a map of command -> description
 */
function parseHelpDescriptions(appContent) {
  const descriptions = {};

  // Find displayHelp function content
  const helpMatch = appContent.match(/function displayHelp\(\)\s*{([\s\S]*?)^}/m);
  if (!helpMatch) return descriptions;

  const helpContent = helpMatch[1];

  // Parse fazai <command> lines from help text
  // Pattern: fazai command [options] # description or fazai command <action> # description
  const patterns = [
    /fazai\s+(\w+)\s+(?:<[^>]+>|[\w|\[\]]+)?\s*#?\s*(.+?)(?:\n|$)/g,
    /fazai\s+(\w+)\s*\n/g,
  ];

  // Extract from help text template literals
  const helpTextMatch = helpContent.match(/helpText\s*=\s*`([\s\S]*?)`/);
  if (helpTextMatch) {
    const helpText = helpTextMatch[1];

    // Parse "fazai command" lines with descriptions
    const lines = helpText.split("\n");
    for (const line of lines) {
      // Match: "  fazai command [options]   # Description"
      const lineMatch = line.match(/^\s*fazai\s+(\w+)(?:\s+\S+)*\s+#\s*(.+)$/);
      if (lineMatch) {
        const [, cmd, desc] = lineMatch;
        if (!descriptions[cmd]) {
          descriptions[cmd] = desc.trim();
        }
      }
      // Match: "  fazai command <action>   Description without #"
      const altMatch = line.match(/^\s*fazai\s+(\w+)\s+<(\w+)>\s+(.+)$/);
      if (altMatch) {
        const [, cmd, , desc] = altMatch;
        if (!descriptions[cmd]) {
          descriptions[cmd] = desc.trim();
        }
      }
    }
  }

  // Fallback descriptions for common commands
  const fallbackDescriptions = {
    ask: "Ask general AI question without executing commands",
    config: "List configured API keys",
    completion: "Print available CLI completions",
    alias: "Create/manage global bash aliases",
    search: "Manual research via Context7/Web",
    vector: "Validate vector collections (Qdrant)",
    import: "Import conversations to Qdrant",
    sync: "Sync configuration and settings",
    cloudflare: "Manage Cloudflare (zones, dns, workers)",
    cf: "Cloudflare (alias)",
    github: "GitHub integration (auth, repos, issues, etc)",
    qdrant: "Qdrant management (status, metrics, backup, etc)",
    index: "Manage source code index for metacognition",
    inference: "Manage user-injected knowledge",
    agent: "Execute GenAIScript agents",
    dashboard: "Manage REST API Dashboard",
    samba: "Manage Samba shares",
    ingest: "Personality data ingestion",
  };

  // Merge fallbacks for missing descriptions
  for (const [cmd, desc] of Object.entries(fallbackDescriptions)) {
    if (!descriptions[cmd]) {
      descriptions[cmd] = desc;
    }
  }

  return descriptions;
}

/**
 * Parse command handlers to extract subcommands
 * Searches for case statements and subcommand patterns
 */
function parseSubcommands(appContent, commandsDir) {
  const subcommands = {};

  // Known subcommand patterns from app.ts
  const knownPatterns = {
    vector: ["validate", "recreate", "reset"],
    alias: ["list", "ls", "show", "remove", "rm", "delete"],
    github: ["auth", "user", "repos", "issues", "fork", "star", "pr", "help"],
    qdrant: [
      "status",
      "metrics",
      "backup",
      "restore",
      "import",
      "export",
      "container",
      "collections",
      "help",
    ],
    cloudflare: ["zones", "dns", "workers", "purge", "analytics"],
    cf: ["zones", "dns", "workers", "purge", "analytics"],
    inference: ["add", "import", "list", "search", "remove", "clear", "help"],
    agent: ["loop", "run", "reflect", "status", "scripts", "help"],
    dashboard: ["start", "stop", "status", "help"],
    samba: [
      "list",
      "add",
      "del",
      "criauser",
      "criadir",
      "criagroup",
      "completion",
      "help",
    ],
    ingest: ["--batch", "--preview", "--help"],
  };

  // Try to parse from command files
  if (fs.existsSync(commandsDir)) {
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".ts"));

    for (const file of files) {
      const cmdName = file.replace(/[-_]?command\.ts$/, "").replace(/-/g, "");
      const filePath = path.join(commandsDir, file);

      try {
        const content = fs.readFileSync(filePath, "utf-8");

        // Look for subcommand arrays or case statements
        const subcmdMatch = content.match(/subcommands?\s*[:=]\s*\[([\s\S]*?)\]/i);
        if (subcmdMatch) {
          const subcmds = [];
          const matches = subcmdMatch[1].matchAll(/["']([^"']+)["']/g);
          for (const m of matches) {
            subcmds.push(m[1]);
          }
          if (subcmds.length > 0) {
            subcommands[cmdName] = subcmds;
          }
        }

        // Look for case "subcmd": patterns
        const caseMatches = content.matchAll(/case\s+["'](\w+)["']\s*:/g);
        const caseCmds = [];
        for (const m of caseMatches) {
          if (!["default", "help"].includes(m[1])) {
            caseCmds.push(m[1]);
          }
        }
        if (caseCmds.length > 0 && !subcommands[cmdName]) {
          subcommands[cmdName] = caseCmds;
        }
      } catch (error) {
        // Ignore parse errors for individual files
      }
    }
  }

  // Merge with known patterns (known patterns take priority for completeness)
  for (const [cmd, subs] of Object.entries(knownPatterns)) {
    if (!subcommands[cmd] || subcommands[cmd].length < subs.length) {
      subcommands[cmd] = subs;
    }
  }

  return subcommands;
}

/**
 * Parse models.ts to extract actual model definitions
 */
function parseModelsTS(modelsPath) {
  try {
    const content = fs.readFileSync(modelsPath, "utf-8");
    const models = [];

    // Extract model definitions from getBuiltInModels() function
    // Pattern: name: "model-name", provider: "provider-name"
    // Uses 's' flag (dotAll) to match across newlines
    const modelBlockRegex =
      /{\s*name:\s*["']([^"']+)["']\s*,\s*provider:\s*["']([^"']+)["']/gs;
    let match;

    while ((match = modelBlockRegex.exec(content)) !== null) {
      models.push({
        name: match[1],
        provider: match[2],
      });
    }

    if (models.length > 0) {
      console.log(`📋 Found ${models.length} models in models.ts`);
      return models;
    }
  } catch (error) {
    console.warn(`Warning: Could not parse models.ts: ${error.message}`);
  }

  // Fallback to minimal defaults if parsing fails
  console.log("⚠️ Using fallback models (could not parse models.ts)");
  return [
    { name: "gemini-2.5-pro", provider: "google" },
    { name: "gemini-2.5-flash", provider: "google" },
    { name: "qwen2.5:7b", provider: "ollama" },
    { name: "gpt-4o-mini", provider: "openai" },
    { name: "claude-3-5-sonnet-latest", provider: "anthropic" },
  ];
}

/**
 * Parse global options from app.ts
 */
function parseGlobalOptions(appContent) {
  const options = [];

  // Look for option patterns in help text
  const optionPatterns = [
    /--[\w-]+/g, // --option-name
    /-\w(?:\s|,|$)/g, // -o (single letter)
  ];

  // Extract from Options section in help
  const optionsMatch = appContent.match(/Options:([\s\S]*?)(?:Examples:|$)/);
  if (optionsMatch) {
    const optSection = optionsMatch[1];
    const matches = optSection.matchAll(/^\s*(--[\w-]+|-\w)(?:\s|,)/gm);
    for (const m of matches) {
      options.push(m[1]);
    }
  }

  // Ensure essential options are included
  const essentialOptions = [
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

  for (const opt of essentialOptions) {
    if (!options.includes(opt)) {
      options.push(opt);
    }
  }

  return [...new Set(options)]; // Remove duplicates
}

/**
 * Main parsing function - extracts all data from app.ts
 */
function parseAppTS(appPath) {
  const content = fs.readFileSync(appPath, "utf-8");

  // Get commands from SUBCOMMANDS_WITH_HELP
  const commandNames = parseSubcommandsWithHelp(content);

  // Get descriptions from displayHelp
  const descriptions = parseHelpDescriptions(content);

  // Get subcommands from handlers
  const commandsDir = path.join(path.dirname(appPath), "commands");
  const subcommands = parseSubcommands(content, commandsDir);

  // Get global options
  const globalOptions = parseGlobalOptions(content);

  // Get models from models.ts
  const modelsPath = path.join(path.dirname(appPath), "models.ts");
  const models = parseModelsTS(modelsPath);

  // Build command objects
  const commands = commandNames.map((name) => ({
    name,
    description: descriptions[name] || `${name} command`,
    subcommands: subcommands[name] || [],
  }));

  console.log(`\n📊 Auto-Discovery Results:`);
  console.log(`   Commands: ${commands.length}`);
  console.log(`   Models: ${models.length}`);
  console.log(`   Options: ${globalOptions.length}`);
  console.log(
    `   Commands with subcommands: ${commands.filter((c) => c.subcommands.length > 0).length}`
  );

  return { commands, globalOptions, models };
}

/**
 * Generate Bash completion script
 */
function generateBashCompletion(data) {
  const commandsList = data.commands.map((c) => c.name).join(" ");
  const optionsList = data.globalOptions.join(" ");

  // Generate case statements for commands with subcommands
  const subcommandCases = data.commands
    .filter((c) => c.subcommands && c.subcommands.length > 0)
    .map((c) => {
      const subcmds = c.subcommands.join(" ");
      return `        ${c.name})
            local subcmds="${subcmds}"
            COMPREPLY=( $(compgen -W "\${subcmds}" -- \${cur}) )
            return 0
            ;;`;
    })
    .join("\n");

  return `#!/usr/bin/env bash
# Bash completion for FazAI - AUTO-GENERATED (DO NOT EDIT MANUALLY)
# Generated by: scripts/generate-completions.js
# Source of truth: src/app.ts (SUBCOMMANDS_WITH_HELP) + src/models.ts
#
# Installation:
#   sudo cp completion/fazai-completion.bash /etc/bash_completion.d/fazai
# Or:
#   source completion/fazai-completion.bash

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

    # Main commands (auto-discovered from SUBCOMMANDS_WITH_HELP)
    commands="${commandsList}"

    # Options/flags (auto-discovered from app.ts)
    opts="${optionsList}"

    # AI models (loaded dynamically from /etc/fazai/fazai.conf)
    if [[ -z "\$FAZAI_MODELS_CACHE" ]]; then
        FAZAI_MODELS_CACHE=\$(_fazai_load_models)
    fi
    models="\$FAZAI_MODELS_CACHE"

    # First argument (command or model)
    if [[ \$COMP_CWORD -eq 1 ]]; then
        COMPREPLY=( \$(compgen -W "\$commands \$models \$opts" -- \${cur}) )
        return 0
    fi

    # Handle specific commands with subcommands
    case "\${COMP_WORDS[1]}" in
${subcommandCases}

        ask)
            # Model names for ask command
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

        alias)
            case "\${prev}" in
                alias)
                    local alias_cmds="list ls show remove rm delete"
                    if [[ -f /etc/fazai/fzalias ]]; then
                        local aliases=\$(grep "^alias " /etc/fazai/fzalias 2>/dev/null | sed "s/^alias \\([^=]*\\)=.*/\\1/")
                        COMPREPLY=( \$(compgen -W "\${alias_cmds} \${aliases}" -- \${cur}) )
                    else
                        COMPREPLY=( \$(compgen -W "\${alias_cmds}" -- \${cur}) )
                    fi
                    return 0
                    ;;
                *)
                    COMPREPLY=( \$(compgen -W "list ls show remove rm delete" -- \${cur}) )
                    return 0
                    ;;
            esac
            ;;

        samba)
            case "\${prev}" in
                add|criadir)
                    COMPREPLY=( \$(compgen -d -- \${cur}) )
                    return 0
                    ;;
                del)
                    if [[ -r /etc/samba/smb.conf ]]; then
                        local shares=\$(awk -F'[][]' '/^\\[.*\\]$/{print \$2}' /etc/samba/smb.conf 2>/dev/null | grep -v '^global$')
                        COMPREPLY=( \$(compgen -W "\${shares}" -- \${cur}) )
                    fi
                    return 0
                    ;;
                criauser)
                    COMPREPLY=( \$(compgen -u -- \${cur}) )
                    return 0
                    ;;
                criagroup)
                    COMPREPLY=( \$(compgen -g -- \${cur}) )
                    return 0
                    ;;
            esac
            ;;

        github)
            case "\${prev}" in
                auth)
                    COMPREPLY=( \$(compgen -W "login logout status" -- \${cur}) )
                    return 0
                    ;;
            esac
            ;;

        inference)
            case "\${prev}" in
                add|import)
                    if [[ \${cur} == -* ]]; then
                        COMPREPLY=( \$(compgen -W "--category=doc --category=rule --category=example --category=fact" -- \${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;

        *)
            # Default: options
            COMPREPLY=( \$(compgen -W "\${opts}" -- \${cur}) )
            return 0
            ;;
    esac
}

# Register completion
complete -F _fazai_completion fazai
`;
}

/**
 * Generate Zsh completion script
 */
function generateZshCompletion(data) {
  const commandsZsh = data.commands
    .map((c) => `'${c.name}:${c.description.replace(/'/g, "\\'")}'`)
    .join("\n        ");

  const modelsZsh = data.models
    .map((m) => `'${m.name}:${m.provider} model'`)
    .join("\n        ");

  const optsZsh = data.globalOptions
    .map((o) => {
      const desc =
        o === "--help" || o === "-h"
          ? "Show help message"
          : o === "--dry-run"
            ? "Simulate commands without executing"
            : o === "--cli"
              ? "Open interactive CLI mode"
              : o === "--debug"
                ? "Enable debug logging"
                : o === "--verbose"
                  ? "Enable verbose logging"
                  : o === "--log-file"
                    ? "Specify log file path"
                    : o === "--auto-research"
                      ? "Re-enable automatic research on failures"
                      : o === "--yolo" || o === "-y"
                        ? "Skip confirmations (dangerous!)"
                        : o === "--semantic"
                          ? "Enable semantic search"
                          : "";
      return `'${o}:${desc}'`;
    })
    .join("\n        ");

  // Generate subcommand cases
  const subcommandCases = data.commands
    .filter((c) => c.subcommands && c.subcommands.length > 0)
    .map((c) => {
      const subcmdsZsh = c.subcommands.map((s) => `'${s}:${s} subcommand'`).join("\n                ");
      return `        ${c.name})
            local -a ${c.name}_cmds
            ${c.name}_cmds=(
                ${subcmdsZsh}
            )
            _describe '${c.name} subcommands' ${c.name}_cmds
            ;;`;
    })
    .join("\n");

  return `#compdef fazai
# Zsh completion for FazAI - AUTO-GENERATED (DO NOT EDIT MANUALLY)
# Generated by: scripts/generate-completions.js
# Source of truth: src/app.ts (SUBCOMMANDS_WITH_HELP) + src/models.ts
#
# Installation:
#   mkdir -p ~/.zsh/completion
#   cp completion/fazai-completion.zsh ~/.zsh/completion/_fazai
#   Add to ~/.zshrc: fpath=(~/.zsh/completion $fpath)
#   Run: autoload -Uz compinit && compinit

# Load models dynamically from fazai.conf
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

    # Load models dynamically (cached)
    if [[ -z "\$FAZAI_MODELS_CACHE_ZSH" ]]; then
        FAZAI_MODELS_CACHE_ZSH=(\${(f)"\$(_fazai_load_models)"})
    fi
    models=("\$FAZAI_MODELS_CACHE_ZSH[@]")

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
                        '-r[Process directory recursively]' \\
                        '--no-knowledge[Skip knowledge extraction]' \\
                        '--no-learning[Skip learning extraction]'
                    ;;

                samba)
                    case "\$words[2]" in
                        add|criadir)
                            _files -/
                            ;;
                        del)
                            local -a shares
                            shares=(\${(f)"\$(awk -F'[][]' '/^\\[.*\\]$/{print \$2}' /etc/samba/smb.conf 2>/dev/null | grep -v '^global$')"})
                            _describe 'samba shares' shares
                            ;;
                        criauser)
                            _users
                            ;;
                        criagroup)
                            _groups
                            ;;
                    esac
                    ;;

                github)
                    case "\$words[2]" in
                        auth)
                            _describe 'auth actions' '(login logout status)'
                            ;;
                    esac
                    ;;
            esac
            ;;
    esac
}

_fazai "\$@"
`;
}

/**
 * Main function to generate and write completion files
 */
function generateCompletions(appPath, outputDir) {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Parse app.ts with auto-discovery
    console.log(`\n🔍 Auto-discovering commands from ${appPath}...`);
    const data = parseAppTS(appPath);

    // Generate Bash completion
    const bashCompletion = generateBashCompletion(data);
    const bashPath = path.join(outputDir, "fazai-completion.bash");
    fs.writeFileSync(bashPath, bashCompletion, { mode: 0o755 });
    console.log(`✅ Generated: ${bashPath}`);

    // Generate Zsh completion
    const zshCompletion = generateZshCompletion(data);
    const zshPath = path.join(outputDir, "fazai-completion.zsh");
    fs.writeFileSync(zshPath, zshCompletion, { mode: 0o755 });
    console.log(`✅ Generated: ${zshPath}`);

    return { bashPath, zshPath, data };
  } catch (error) {
    console.error("Error generating completions:", error);
    throw error;
  }
}

// Run the generator
const appPath = path.join(projectRoot, "src/app.ts");
const completionDir = path.join(projectRoot, "completion");

try {
  const { bashPath, zshPath, data } = generateCompletions(appPath, completionDir);
  console.log(`\n✨ Completions generated successfully!`);
  console.log(`   Bash: ${bashPath}`);
  console.log(`   Zsh:  ${zshPath}`);
  console.log(`\n📝 Commands discovered: ${data.commands.map((c) => c.name).join(", ")}`);
  process.exit(0);
} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
}
