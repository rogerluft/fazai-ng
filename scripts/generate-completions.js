#!/usr/bin/env node
/**
 * Standalone completion generator script
 * Generates Bash and Zsh completion files from app.ts and models.ts
 *
 * IMPORTANT: This script dynamically reads models from src/models.ts
 * to ensure completions always match the actual available models.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

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
    const modelBlockRegex = /{\s*name:\s*["']([^"']+)["']\s*,\s*provider:\s*["']([^"']+)["']/gs;
    let match;

    while ((match = modelBlockRegex.exec(content)) !== null) {
      models.push({
        name: match[1],
        provider: match[2],
      });
    }

    if (models.length > 0) {
      console.log(`📋 Found ${models.length} models in models.ts`);
      models.forEach((m) => console.log(`   - ${m.name} (${m.provider})`));
      return models;
    }
  } catch (error) {
    console.warn(`Warning: Could not parse models.ts: ${error.message}`);
  }

  // Fallback to default models if parsing fails
  // These MUST match getBuiltInModels() in src/models.ts EXACTLY
  console.log("⚠️ Using fallback models (could not parse models.ts)");
  return [
    // Google Gemini (stable) - 3 models
    { name: "gemini-2.5-pro", provider: "google" },
    { name: "gemini-2.5-flash", provider: "google" },
    { name: "gemini-2.5-flash-lite", provider: "google" },
    // Ollama (local) - 2 models
    { name: "qwen2.5:7b", provider: "ollama" },
    { name: "tinyllama:1b", provider: "ollama" },
    // OpenRouter (cloud free tier) - 2 models
    { name: "qwen/qwen3-coder:free", provider: "openrouter" },
    { name: "google/gemini-2.0-flash-exp:free", provider: "openrouter" },
    // Perplexity (search-enabled) - 2 models
    { name: "llama-3-sonar-small-32k-online", provider: "perplexity" },
    { name: "llama-3-sonar-large-32k-online", provider: "perplexity" },
    // OpenAI (optional) - 2 models
    { name: "gpt-4o-mini", provider: "openai" },
    { name: "gpt-4o", provider: "openai" },
    // Anthropic Claude (optional) - 2 models
    { name: "claude-3-5-sonnet-latest", provider: "anthropic" },
    { name: "claude-3-haiku-20240307", provider: "anthropic" },
    // Total: 14 models (excluding preview feature gemini-3.0-pro-latest)
  ];
}

/**
 * Parse app.ts to extract commands and options
 */
function parseAppTS(appPath) {
  // Get models from models.ts (real source of truth)
  const modelsPath = path.join(path.dirname(appPath), "models.ts");
  const models = parseModelsTS(modelsPath);

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
    {
      name: "qdrant",
      description: "Qdrant management (status, metrics, backup, etc)",
      subcommands: ["status", "metrics", "backup", "restore", "import", "export", "container"],
    },
    {
      name: "index",
      description: "Gerencia o índice de metacognição (código fonte)",
    },
    {
      name: "inference",
      description: "Gerencia conhecimento injetado pelo usuário",
      subcommands: ["add", "import", "list", "search", "remove", "clear"],
      options: ["--category=doc", "--category=rule", "--category=example", "--category=fact"],
    },
    {
      name: "agent",
      description: "Execute GenAIScript agents",
      subcommands: ["loop", "run", "reflect", "status", "scripts"],
    },
    {
      name: "dashboard",
      description: "Manage REST API Dashboard",
      subcommands: ["start", "stop", "status"],
      options: ["--port", "--host", "--no-cors", "--no-rate-limit", "--no-logs"],
    },
    {
      name: "samba",
      description: "Manage Samba shares (fzsamba wrapper)",
      subcommands: ["list", "add", "del", "criauser", "criadir", "criagroup", "completion"],
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
# Bash completion for FazAI - Dynamic model loading from fazai.conf
# Installation:
#   sudo cp completion/fazai-completion.bash /etc/bash_completion.d/fazai
# Or:
#   source completion/fazai-completion.bash

# Load models dynamically from fazai.conf - NO HARDCODED MODELS
_fazai_load_models() {
    local config_file="\${FAZAI_CONFIG_PATH:-/etc/fazai/fazai.conf}"

    if [[ -r "$config_file" ]]; then
        grep '^MODELS_' "$config_file" 2>/dev/null | awk -F'=' '{print \$2}' | tr ',' ' ' | tr -s ' '
    fi
}

_fazai_completion() {
    local cur prev opts commands models subcmds
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands (auto-generated from app.ts)
    commands="${commandsList}"

    # Options/flags (auto-generated from app.ts)
    opts="${optionsList}"

    # AI models (loaded dynamically from /etc/fazai/fazai.conf - cached)
    if [[ -z "\$FAZAI_MODELS_CACHE" ]]; then
        FAZAI_MODELS_CACHE=\$(_fazai_load_models)
    fi
    models="\$FAZAI_MODELS_CACHE"

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

        samba)
            local samba_cmds="list add del criauser criadir criagroup completion"
            case "\${prev}" in
                samba)
                    COMPREPLY=( $(compgen -W "\${samba_cmds}" -- \${cur}) )
                    return 0
                    ;;
                add|criadir)
                    # Complete with directories
                    COMPREPLY=( $(compgen -d -- \${cur}) )
                    return 0
                    ;;
                del)
                    # Complete with existing Samba shares from smb.conf
                    if [[ -r /etc/samba/smb.conf ]]; then
                        local shares=\$(awk -F'[][]' '/^\\[.*\\]$/{print \$2}' /etc/samba/smb.conf 2>/dev/null | grep -v '^global$')
                        COMPREPLY=( $(compgen -W "\${shares}" -- \${cur}) )
                    fi
                    return 0
                    ;;
                criauser)
                    # Complete with system users
                    COMPREPLY=( $(compgen -u -- \${cur}) )
                    return 0
                    ;;
                criagroup)
                    # Complete with system groups
                    COMPREPLY=( $(compgen -g -- \${cur}) )
                    return 0
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "\${samba_cmds}" -- \${cur}) )
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
# Zsh completion for FazAI - Dynamic model loading from fazai.conf
# Installation:
#   mkdir -p ~/.zsh/completion
#   cp completion/fazai-completion.zsh ~/.zsh/completion/_fazai
#   Add to ~/.zshrc: fpath=(~/.zsh/completion $fpath)
#   Run: autoload -Uz compinit && compinit

# Load models dynamically from fazai.conf - NO HARDCODED MODELS
_fazai_load_models() {
    local config_file="\${FAZAI_CONFIG_PATH:-/etc/fazai/fazai.conf}"

    if [[ -r "$config_file" ]]; then
        grep '^MODELS_' "$config_file" 2>/dev/null | cut -d'=' -f2 | tr ',' '\\n'
    fi
}

_fazai() {
    local -a commands models opts

    commands=(
        ${commandsZsh}
    )

    # Load models dynamically from config (cached)
    if [[ -z "\$FAZAI_MODELS_CACHE_ZSH" ]]; then
        FAZAI_MODELS_CACHE_ZSH=(\${(f)"\$(_fazai_load_models)"})
    fi
    models=("\$FAZAI_MODELS_CACHE_ZSH[@]")

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

        alias)
            local -a alias_cmds
            alias_cmds=(
                'list:List all aliases'
                'ls:List all aliases (alias for list)'
                'show:Show specific alias'
                'remove:Remove alias'
                'rm:Remove alias (short form)'
                'delete:Delete alias'
            )
            _describe 'alias subcommands' alias_cmds
            ;;

        samba)
            local -a samba_cmds
            samba_cmds=(
                'list:List all Samba shares'
                'add:Add existing directory as share'
                'del:Delete a share from smb.conf'
                'criauser:Create or update Samba user'
                'criadir:Create directory and add as share'
                'criagroup:Create group and apply to directory'
                'completion:Generate bash completion script'
            )
            _describe 'samba subcommands' samba_cmds

            case "$words[2]" in
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
        alias)
            state=alias
            ;;
        samba)
            state=samba
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
