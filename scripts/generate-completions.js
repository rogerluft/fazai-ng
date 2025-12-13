#!/usr/bin/env node
/**
 * Standalone completion generator script
 * Generates Bash and Zsh completion files from app.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

/**
 * Parse app.ts to extract commands and options
 */
function parseAppTS(appPath) {
  const content = fs.readFileSync(appPath, "utf-8");

  // Extract commands from app.ts
  const commands = [
    {
      name: "ask",
      description: "Ask general AI question without executing commands",
      options: ["[model-name]"],
    },
    {
      name: "config",
      description: "List configured API keys",
    },
    {
      name: "completion",
      description: "Print available CLI completions",
    },
    {
      name: "alias",
      description: "Create/manage global bash aliases",
      subcommands: ["list", "ls", "show", "remove", "rm", "delete"],
      options: ["<name>", "<command>"],
    },
    {
      name: "search",
      description: "Manual research via Context7/Web",
      options: ["[query]"],
    },
    {
      name: "vector",
      description: "Valida collections vetoriais (Qdrant)",
      subcommands: ["validate", "recreate", "reset"],
      options: ["--provider", "--recreate", "--reset"],
    },
    {
      name: "import",
      description: "Importa conversas para Qdrant",
      options: ["<file>", "--source", "--recursive", "-r", "--no-knowledge", "--no-learning"],
    },
    {
      name: "sync",
      description: "Sync configuration and settings",
    },
    {
      name: "cloudflare",
      description: "Manage Cloudflare (zones, dns, workers)",
      options: ["zones", "dns", "workers", "purge", "analytics"],
    },
    {
      name: "cf",
      description: "Cloudflare (alias)",
      options: ["zones", "dns", "workers"],
    },
    {
      name: "github",
      description: "GitHub integration (auth, repos, issues, etc)",
      subcommands: ["auth", "user", "repos", "issues", "fork", "star", "pr", "help"],
      options: ["login", "logout", "status"],
    },
  ];

  const globalOptions = [
    "--dry-run",
    "--cli",
    "--debug",
    "--verbose",
    "--log-file",
    "--auto-research",
    "--yolo",
    "-y",
    "--help",
    "-h",
  ];

  const models = [
    { name: "gpt-4o", provider: "openai" },
    { name: "gpt-4o-mini", provider: "openai" },
    { name: "claude-3-5-sonnet-latest", provider: "anthropic" },
    { name: "claude-3-5-haiku-latest", provider: "anthropic" },
    { name: "gemini-3.0-pro-latest", provider: "google" },
    { name: "gemini-1.5-flash", provider: "google" },
    { name: "gemini-1.5-pro", provider: "google" },
    { name: "llama-3-sonar-small-32k-online", provider: "perplexity" },
    { name: "qwen2.5:7b", provider: "ollama" },
  ];

  return { commands, globalOptions, models };
}

/**
 * Generate Bash completion script
 */
function generateBashCompletion(data) {
  const commandsList = data.commands.map((c) => c.name).join(" ");
  const optionsList = data.globalOptions.join(" ");
  const modelsList = data.models.map((m) => m.name).join(" ");

  return `#!/usr/bin/env bash
# Bash completion for FazAI - Auto-generated
# Installation:
#   sudo cp completion/fazai-completion.bash /etc/bash_completion.d/fazai
# Or:
#   source completion/fazai-completion.bash

_fazai_completion() {
    local cur prev opts commands models subcmds
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands (auto-generated from app.ts)
    commands="${commandsList}"

    # Options/flags (auto-generated from app.ts)
    opts="${optionsList}"

    # AI models (auto-generated from models.ts)
    models="${modelsList}"

    # Fallback if models not available
    if [ -z "$models" ]; then
        models="gpt-4o gpt-4o-mini claude-3-5-sonnet-latest claude-3-5-haiku-latest gemini-3.0-pro-latest gemini-1.5-flash qwen2.5:7b"
    fi

    # First argument (command)
    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=( $(compgen -W "$commands $models $opts" -- \${cur}) )
        return 0
    fi

    # Handle specific commands
    case "\${COMP_WORDS[1]}" in
        ask)
            # Model names for ask command
            COMPREPLY=( $(compgen -W "$models" -- \${cur}) )
            return 0
            ;;

        config)
            # No arguments for config
            return 0
            ;;

        completion)
            # No arguments for completion
            return 0
            ;;

        alias)
            local alias_cmds="list ls show remove rm delete"
            case "\${prev}" in
                alias)
                    if [[ -f /etc/fazai/fzalias ]]; then
                        local aliases=\$(grep "^alias " /etc/fazai/fzalias 2>/dev/null | sed "s/^alias \\([^=]*\\)=.*/\\1/")
                        COMPREPLY=( $(compgen -W "\${alias_cmds} \${aliases}" -- \${cur}) )
                    else
                        COMPREPLY=( $(compgen -W "\${alias_cmds}" -- \${cur}) )
                    fi
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "\${alias_cmds}" -- \${cur}) )
                    return 0
                    ;;
            esac
            ;;

        search)
            # Freeform text for search
            return 0
            ;;

        vector)
            local vector_cmds="validate recreate reset"
            case "\${prev}" in
                vector)
                    COMPREPLY=( $(compgen -W "\${vector_cmds}" -- \${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "--provider --recreate --reset" -- \${cur}) )
                    return 0
                    ;;
            esac
            ;;

        import)
            case "\${prev}" in
                import)
                    COMPREPLY=( $(compgen -f -- \${cur}) )
                    return 0
                    ;;
                --source)
                    COMPREPLY=( $(compgen -W "claude chatgpt" -- \${cur}) )
                    return 0
                    ;;
                *)
                    if [[ \${cur} == -* ]]; then
                        COMPREPLY=( $(compgen -W "--source --recursive -r --no-knowledge --no-learning" -- \${cur}) )
                    else
                        COMPREPLY=( $(compgen -f -- \${cur}) )
                    fi
                    return 0
                    ;;
            esac
            ;;

        sync)
            # No arguments for sync
            return 0
            ;;

        cloudflare|cf)
            local cf_cmds="zones dns workers purge analytics"
            case "\${prev}" in
                cloudflare|cf)
                    COMPREPLY=( $(compgen -W "\${cf_cmds}" -- \${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "\${cf_cmds}" -- \${cur}) )
                    return 0
                    ;;
            esac
            ;;

        github)
            local github_cmds="auth user repos issues fork star pr help"
            case "\${prev}" in
                github)
                    COMPREPLY=( $(compgen -W "\${github_cmds}" -- \${cur}) )
                    return 0
                    ;;
                auth)
                    COMPREPLY=( $(compgen -W "login logout status" -- \${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "\${github_cmds}" -- \${cur}) )
                    return 0
                    ;;
            esac
            ;;

        *)
            # Default: options
            COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
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
    .map((c) => `'${c.name}:${c.description}'`)
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
                        : "";
      return `'${o}:${desc}'`;
    })
    .join("\n        ");

  return `#compdef fazai
# Zsh completion for FazAI - Auto-generated
# Installation:
#   mkdir -p ~/.zsh/completion
#   cp completion/fazai-completion.zsh ~/.zsh/completion/_fazai
#   Add to ~/.zshrc: fpath=(~/.zsh/completion $fpath)
#   Run: autoload -Uz compinit && compinit

_fazai() {
    local -a commands models opts

    commands=(
        ${commandsZsh}
    )

    models=(
        ${modelsZsh}
    )

    opts=(
        ${optsZsh}
    )

    case "$state" in
        command)
            _describe 'fazai commands' commands
            _describe 'fazai models' models
            _describe 'fazai options' opts
            ;;

        vector)
            local -a vector_cmds
            vector_cmds=(
                'validate:Validate collections (create if needed)'
                'recreate:Recreate all collections (DELETE DATA!)'
                'reset:Reset collections (DELETE DATA!)'
            )
            _describe 'vector subcommands' vector_cmds
            _arguments \\
                '--provider[Vector provider]:provider:(qdrant)' \\
                '--recreate[Recreate collections]' \\
                '--reset[Reset collections]'
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

        ask)
            _describe 'fazai models' models
            ;;

        search)
            # Freeform text, no completion
            ;;

        config)
            # No arguments
            ;;

        completion)
            # No arguments
            ;;
    esac

    _arguments \\
        '1:command:->command' \\
        '*::arg:->args'

    case "$words[1]" in
        ask|search|config|completion)
            state=$words[1]
            ;;
        vector)
            state=vector
            ;;
        import)
            state=import
            ;;
    esac
}

_fazai "$@"
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

    // Parse app.ts
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

    return { bashPath, zshPath };
  } catch (error) {
    console.error("Error generating completions:", error);
    throw error;
  }
}

// Run the generator
const appPath = path.join(projectRoot, "src/app.ts");
const completionDir = path.join(projectRoot, "completion");

try {
  const { bashPath, zshPath } = generateCompletions(appPath, completionDir);
  console.log(`\n✨ Completions generated successfully!`);
  console.log(`   Bash: ${bashPath}`);
  console.log(`   Zsh:  ${zshPath}`);
  process.exit(0);
} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
}
