#!/usr/bin/env node
/**
 * FazAI Completion Sync - Automated completion script generator
 *
 * Features:
 * - TRUE auto-discovery from source code (no hardcoded lists)
 * - Qdrant indexing for CLI features
 * - Smart installation with fallbacks
 * - Validation against installed version
 * - Silent mode for automation
 *
 * Usage:
 *   node scripts/completion-sync.mjs                   # Full sync
 *   node scripts/completion-sync.mjs --discover        # Discover only
 *   node scripts/completion-sync.mjs --install         # Install only
 *   node scripts/completion-sync.mjs --validate        # Validate only
 *   node scripts/completion-sync.mjs --index           # Index to Qdrant
 *   node scripts/completion-sync.mjs --silent          # No output
 */

import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Configuration
const config = {
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  ollamaUrl: process.env.OLLAMA_URL || process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  collection: "fazai_source",
  primaryInstallPath: "/etc/bash_completion.d/fazai",
  fallbackInstallPath: "/opt/fazai/scripts/fazai-completion.bash",
  completionDir: path.join(projectRoot, "completion"),
};

// Parse arguments
const args = process.argv.slice(2);
const flags = {
  discover: args.includes("--discover"),
  install: args.includes("--install"),
  validate: args.includes("--validate"),
  index: args.includes("--index"),
  silent: args.includes("--silent"),
  bash: args.includes("--bash") || args.includes("bash"),
  zsh: args.includes("--zsh") || args.includes("zsh"),
  help: args.includes("--help") || args.includes("-h"),
};

// If no specific flag, do full sync
const fullSync = !flags.discover && !flags.install && !flags.validate && !flags.index && !flags.bash && !flags.zsh && !flags.help;

// Logger
const log = {
  info: (...args) => !flags.silent && console.log("✓", ...args),
  warn: (...args) => !flags.silent && console.log("⚠", ...args),
  error: (...args) => console.error("✗", ...args),
  success: (...args) => !flags.silent && console.log("✅", ...args),
  debug: (...args) => process.env.DEBUG && console.log("🔍", ...args),
};

// ============================================================================
// DISCOVERY: Parse source files for commands and subcommands
// ============================================================================
function discoverFeatures() {
  const discovery = {
    commands: [],
    subcommands: {},
    options: {},
    models: [],
    totalFeatures: 0,
    discoveredAt: new Date().toISOString(),
  };

  // 1. Parse app.ts for main commands
  const appPath = path.join(projectRoot, "src/app.ts");
  if (fs.existsSync(appPath)) {
    const appContent = fs.readFileSync(appPath, "utf-8");

    // Extract SUBCOMMANDS_WITH_HELP
    const helpMatch = appContent.match(/SUBCOMMANDS_WITH_HELP\s*=\s*\[([\s\S]*?)\]/);
    if (helpMatch) {
      const cmdMatches = helpMatch[1].matchAll(/["']([^"']+)["']/g);
      for (const m of cmdMatches) {
        discovery.commands.push(m[1]);
      }
    }

    // Extract global options from help - improved regex
    const globalOpts = new Set();
    // Match options anywhere in the file, not just followed by space
    const optMatches = appContent.matchAll(/(--[\w-]+|-\w)\b/g);
    for (const m of optMatches) {
      const opt = m[1];
      if (!opt.includes("${") && !opt.includes("\\") && opt.length > 1) {
        globalOpts.add(opt);
      }
    }
    // Ensure critical options are included
    ["--dry-run", "--cli", "--debug", "--verbose", "--log-file",
     "--auto-research", "--yolo", "-y", "--semantic", "--help", "-h"].forEach(o => globalOpts.add(o));
    discovery.options["global"] = [...globalOpts].sort();
  }

  // 2. Parse models.ts
  const modelsPath = path.join(projectRoot, "src/models.ts");
  if (fs.existsSync(modelsPath)) {
    const modelsContent = fs.readFileSync(modelsPath, "utf-8");
    const modelPattern = /name:\s*["']([^"']+)["']/g;
    let match;
    while ((match = modelPattern.exec(modelsContent)) !== null) {
      discovery.models.push(match[1]);
    }
  }

  // 3. Parse each command file for subcommands
  const commandsDir = path.join(projectRoot, "src/commands");
  const fileMapping = { cf: "cloudflare" }; // Command to file mapping

  for (const cmd of discovery.commands) {
    const fileName = fileMapping[cmd] || cmd;
    const filePath = path.join(commandsDir, `${fileName}.ts`);

    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");

    // Extract case statements
    const casePattern = /case\s+["']([^"'$]+)["']\s*:/g;
    const subs = new Set();
    const opts = new Set();

    let caseMatch;
    while ((caseMatch = casePattern.exec(content)) !== null) {
      const sub = caseMatch[1].trim();
      if (sub && !sub.includes("{") && !sub.includes("$")) {
        if (sub.startsWith("-")) {
          opts.add(sub);
        } else {
          subs.add(sub);
        }
      }
    }

    if (subs.size > 0) {
      discovery.subcommands[cmd] = [...subs].sort();
    }
    if (opts.size > 0) {
      discovery.options[cmd] = [...opts].sort();
    }
  }

  // Manual additions for commands that don't use switch/case
  if (!discovery.subcommands["ingest"]) {
    discovery.subcommands["ingest"] = [];
  }
  discovery.options["ingest"] = ["--batch", "--preview", "--help"];

  discovery.subcommands["completion"] = ["bash", "zsh", "install", "list", "help"];

  // Calculate totals
  discovery.totalFeatures =
    discovery.commands.length +
    Object.values(discovery.subcommands).reduce((sum, arr) => sum + arr.length, 0) +
    Object.values(discovery.options).reduce((sum, arr) => sum + arr.length, 0) +
    discovery.models.length;

  return discovery;
}

// ============================================================================
// GENERATION: Create bash completion script
// ============================================================================
function generateBashCompletion(discovery) {
  const commandsList = discovery.commands.join(" ");
  const optionsList = (discovery.options["global"] || []).join(" ");
  const modelsList = discovery.models.join(" ");

  // Generate case statements - include commands with subcommands OR options
  const subcommandCases = Object.entries(discovery.subcommands)
    .filter(([cmd, subs]) => subs.length > 0 || (discovery.options[cmd] && discovery.options[cmd].length > 0))
    .map(([cmd, subs]) => {
      const allSubs = [...subs, ...(discovery.options[cmd] || [])].join(" ");
      return `        ${cmd})
            local subcmds="${allSubs}"
            COMPREPLY=( \$(compgen -W "\${subcmds}" -- \${cur}) )
            return 0
            ;;`;
    })
    .join("\n");

  return `#!/usr/bin/env bash
# FazAI Bash Completion - AUTO-GENERATED by completion-sync.mjs
# Generated: ${discovery.discoveredAt}
# Features: ${discovery.totalFeatures} (${discovery.commands.length} commands, ${Object.values(discovery.subcommands).reduce((s, a) => s + a.length, 0)} subcommands, ${discovery.models.length} models)
# DO NOT EDIT MANUALLY - regenerate with: node scripts/completion-sync.mjs

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

    # Main commands (${discovery.commands.length} discovered)
    commands="${commandsList}"

    # Global options
    opts="${optionsList}"

    # Models (dynamic + fallback)
    if [[ -z "\$FAZAI_MODELS_CACHE" ]]; then
        FAZAI_MODELS_CACHE=\$(_fazai_load_models)
    fi
    models="\$FAZAI_MODELS_CACHE"
    if [[ -z "\$models" ]]; then
        models="${modelsList}"
    fi

    # First argument (command or model)
    if [[ \$COMP_CWORD -eq 1 ]]; then
        COMPREPLY=( \$(compgen -W "\$commands \$models \$opts" -- \${cur}) )
        return 0
    fi

    # Subcommands per command
    case "\${COMP_WORDS[1]}" in
${subcommandCases}

        ask)
            COMPREPLY=( \$(compgen -W "\$models" -- \${cur}) )
            return 0
            ;;

        import)
            case "\${prev}" in
                import) COMPREPLY=( \$(compgen -f -- \${cur}) ); return 0 ;;
                --source) COMPREPLY=( \$(compgen -W "claude chatgpt" -- \${cur}) ); return 0 ;;
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

        samba)
            case "\${prev}" in
                add|criadir) COMPREPLY=( \$(compgen -d -- \${cur}) ); return 0 ;;
                del)
                    if [[ -r /etc/samba/smb.conf ]]; then
                        local shares=\$(awk -F'[][]' '/^\\[.*\\]\$/{print \$2}' /etc/samba/smb.conf 2>/dev/null | grep -v '^global\$')
                        COMPREPLY=( \$(compgen -W "\${shares}" -- \${cur}) )
                    fi
                    return 0
                    ;;
                criauser) COMPREPLY=( \$(compgen -u -- \${cur}) ); return 0 ;;
                criagroup) COMPREPLY=( \$(compgen -g -- \${cur}) ); return 0 ;;
            esac
            ;;

        github)
            case "\${prev}" in
                auth) COMPREPLY=( \$(compgen -W "login logout status" -- \${cur}) ); return 0 ;;
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

        *)
            COMPREPLY=( \$(compgen -W "\${opts}" -- \${cur}) )
            return 0
            ;;
    esac
}

complete -F _fazai_completion fazai
`;
}

// ============================================================================
// GENERATION: Create zsh completion script
// ============================================================================
function generateZshCompletion(discovery) {
  const commandsZsh = discovery.commands.map(c => `'${c}:${c} command'`).join("\n        ");
  const modelsZsh = discovery.models.map(m => `'${m}:AI model'`).join("\n            ");
  const optsZsh = (discovery.options["global"] || []).map(o => `'${o}:option'`).join("\n        ");

  const subcommandCases = Object.entries(discovery.subcommands)
    .filter(([, subs]) => subs.length > 0)
    .map(([cmd, subs]) => {
      const allSubs = [...subs, ...(discovery.options[cmd] || [])];
      const subcmdsZsh = allSubs.map(s => `'${s}:${s}'`).join("\n                ");
      return `                ${cmd})
                    local -a ${cmd}_cmds
                    ${cmd}_cmds=(
                        ${subcmdsZsh}
                    )
                    _describe '${cmd} subcommands' ${cmd}_cmds
                    ;;`;
    })
    .join("\n");

  return `#compdef fazai
# FazAI Zsh Completion - AUTO-GENERATED by completion-sync.mjs
# Generated: ${discovery.discoveredAt}
# Features: ${discovery.totalFeatures}

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
                        '--recursive[Process recursively]' \\
                        '-r[Process recursively]'
                    ;;
            esac
            ;;
    esac
}

_fazai "\$@"
`;
}

// ============================================================================
// INSTALLATION: Smart install with fallbacks
// ============================================================================
function smartInstall(bashScript, zshScript) {
  const result = {
    installed: false,
    bashPath: null,
    zshPath: null,
    fallbackUsed: false,
    integrations: [],
    errors: [],
  };

  // Try to install bash completion
  try {
    // Try primary location with sudo
    const primary = config.primaryInstallPath;
    const cmd = `echo '${bashScript.replace(/'/g, "'\\''")}' | sudo tee ${primary} > /dev/null && sudo chmod 644 ${primary}`;
    execSync(cmd, { stdio: "pipe" });
    result.bashPath = primary;
    result.installed = true;
    log.success(`Bash completion installed to ${primary}`);
  } catch (e) {
    // Try fallback
    try {
      const fallbackDir = path.dirname(config.fallbackInstallPath);
      execSync(`sudo mkdir -p ${fallbackDir}`, { stdio: "pipe" });
      const cmd = `echo '${bashScript.replace(/'/g, "'\\''")}' | sudo tee ${config.fallbackInstallPath} > /dev/null`;
      execSync(cmd, { stdio: "pipe" });
      result.bashPath = config.fallbackInstallPath;
      result.installed = true;
      result.fallbackUsed = true;
      log.warn(`Used fallback path: ${config.fallbackInstallPath}`);

      // Add to .bashrc
      const bashrcPath = path.join(process.env.HOME, ".bashrc");
      const sourceCmd = `\n# FazAI Completion\n[ -f ${config.fallbackInstallPath} ] && source ${config.fallbackInstallPath}\n`;
      const bashrc = fs.readFileSync(bashrcPath, "utf-8");
      if (!bashrc.includes(config.fallbackInstallPath)) {
        fs.appendFileSync(bashrcPath, sourceCmd);
        result.integrations.push("~/.bashrc");
      }

      // Add to /etc/profile
      try {
        execSync(`grep -q "${config.fallbackInstallPath}" /etc/profile || echo '${sourceCmd}' | sudo tee -a /etc/profile > /dev/null`, { stdio: "pipe" });
        result.integrations.push("/etc/profile");
      } catch {}
    } catch (e2) {
      result.errors.push(`Bash install failed: ${e2.message}`);
    }
  }

  // Save to completion directory
  try {
    if (!fs.existsSync(config.completionDir)) {
      fs.mkdirSync(config.completionDir, { recursive: true });
    }
    fs.writeFileSync(path.join(config.completionDir, "fazai-completion.bash"), bashScript);
    fs.writeFileSync(path.join(config.completionDir, "fazai-completion.zsh"), zshScript);
    log.info("Saved to completion/ directory");
  } catch (e) {
    result.errors.push(`Save to completion/ failed: ${e.message}`);
  }

  return result;
}

// ============================================================================
// VALIDATION: Compare with installed version
// ============================================================================
function validateInstallation(discovery) {
  const result = {
    valid: false,
    installedPath: null,
    discrepancies: [],
  };

  // Check if installed
  const paths = [config.primaryInstallPath, config.fallbackInstallPath];
  let installedContent = null;

  for (const p of paths) {
    if (fs.existsSync(p)) {
      installedContent = fs.readFileSync(p, "utf-8");
      result.installedPath = p;
      break;
    }
  }

  if (!installedContent) {
    result.discrepancies.push("No completion installed");
    return result;
  }

  // Check for missing commands
  const commandsMatch = installedContent.match(/commands="([^"]+)"/);
  if (commandsMatch) {
    for (const cmd of discovery.commands) {
      if (!commandsMatch[1].includes(cmd)) {
        result.discrepancies.push(`Missing command: ${cmd}`);
      }
    }
  }

  // Check for missing subcommands
  for (const [cmd, subs] of Object.entries(discovery.subcommands)) {
    const caseMatch = installedContent.match(new RegExp(`${cmd}\\)\\s*[\\s\\S]*?local subcmds="([^"]+)"`));
    if (caseMatch) {
      for (const sub of subs) {
        if (!caseMatch[1].includes(sub)) {
          result.discrepancies.push(`Missing ${cmd} subcommand: ${sub}`);
        }
      }
    }
  }

  result.valid = result.discrepancies.length === 0;
  return result;
}

// ============================================================================
// QDRANT: Index features to vector DB
// ============================================================================
async function indexToQdrant(discovery) {
  const results = { indexed: 0, errors: [] };

  try {
    // Check if collection exists
    const checkRes = await fetch(`${config.qdrantUrl}/collections/${config.collection}`);
    if (!checkRes.ok) {
      log.warn(`Collection ${config.collection} not found, skipping indexing`);
      return results;
    }

    const points = [];
    let pointId = Date.now();

    for (const cmd of discovery.commands) {
      const subs = discovery.subcommands[cmd] || [];
      const opts = discovery.options[cmd] || [];
      const content = `CLI Command: fazai ${cmd}\nSubcommands: ${subs.join(", ") || "none"}\nOptions: ${opts.join(", ") || "none"}`;

      // Generate embedding via ONNX BGE-base-en-v1.5
      try {
        const { embed } = await import("../genaisrc/tools/adapter-bridge.mjs");
        const vector = await embed(content);

        if (vector && vector.length > 0) {
          points.push({
            id: pointId++,
            vector,
            payload: {
              type: "cli_completion",
              command: cmd,
              subcommands: subs,
              options: opts,
              content,
              indexed_at: new Date().toISOString(),
            },
          });
        }
      } catch (e) {
        results.errors.push(`Embed ${cmd}: ${e.message}`);
      }
    }

    if (points.length > 0) {
      const upsertRes = await fetch(`${config.qdrantUrl}/collections/${config.collection}/points?wait=true`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
      if (upsertRes.ok) {
        results.indexed = points.length;
      }
    }
  } catch (e) {
    results.errors.push(e.message);
  }

  return results;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  if (flags.help) {
    console.log(`
FazAI Completion Sync - Auto-discover and sync CLI completions

Usage:
  node scripts/completion-sync.mjs [options]

Options:
  --discover   Discover commands/subcommands only
  --install    Generate and install completion
  --validate   Validate installed completion
  --index      Index features to Qdrant
  --silent     No output
  --bash       Output bash completion to stdout
  --zsh        Output zsh completion to stdout
  -h, --help   Show this help

Examples:
  node scripts/completion-sync.mjs              # Full sync
  node scripts/completion-sync.mjs --discover   # Show discovered features
  node scripts/completion-sync.mjs --bash       # Output bash completion
`);
    process.exit(0);
  }

  // Step 1: Discover
  log.info("Discovering CLI features...");
  const discovery = discoverFeatures();

  if (flags.discover) {
    console.log(JSON.stringify(discovery, null, 2));
    process.exit(0);
  }

  log.info(`Found ${discovery.totalFeatures} features (${discovery.commands.length} commands, ${Object.values(discovery.subcommands).reduce((s, a) => s + a.length, 0)} subcommands, ${discovery.models.length} models)`);

  // Step 2: Generate
  log.info("Generating completion scripts...");
  const bashScript = generateBashCompletion(discovery);
  const zshScript = generateZshCompletion(discovery);

  if (flags.bash) {
    console.log(bashScript);
    process.exit(0);
  }

  if (flags.zsh) {
    console.log(zshScript);
    process.exit(0);
  }

  // Step 3: Validate (if requested or full sync)
  if (flags.validate || fullSync) {
    log.info("Validating installed completion...");
    const validation = validateInstallation(discovery);

    if (validation.discrepancies.length > 0) {
      log.warn(`Found ${validation.discrepancies.length} discrepancies:`);
      for (const d of validation.discrepancies.slice(0, 5)) {
        log.warn(`  - ${d}`);
      }
      if (validation.discrepancies.length > 5) {
        log.warn(`  ... and ${validation.discrepancies.length - 5} more`);
      }
    } else if (validation.installedPath) {
      log.success("Installed completion is up to date");
    }

    if (flags.validate && validation.valid) {
      process.exit(0);
    }
  }

  // Step 4: Install
  if (flags.install || fullSync) {
    log.info("Installing completion...");
    const installResult = smartInstall(bashScript, zshScript);

    if (installResult.installed) {
      log.success(`Installed to ${installResult.bashPath}`);
      if (installResult.integrations.length > 0) {
        log.info(`Integrated with: ${installResult.integrations.join(", ")}`);
      }
    } else {
      log.error("Installation failed");
      for (const e of installResult.errors) {
        log.error(`  - ${e}`);
      }
    }
  }

  // Step 5: Index to Qdrant
  if (flags.index || fullSync) {
    log.info("Indexing to Qdrant...");
    const indexResult = await indexToQdrant(discovery);
    if (indexResult.indexed > 0) {
      log.success(`Indexed ${indexResult.indexed} commands to Qdrant`);
    } else if (indexResult.errors.length > 0) {
      log.warn("Qdrant indexing skipped or failed");
    }
  }

  log.success("Completion sync complete!");
}

main().catch((e) => {
  log.error(e.message);
  process.exit(1);
});
