/**
 * FazAI Completion Sync Agent
 *
 * Automated completion system that:
 * 1. Auto-discovers ALL commands, subcommands, options from source code
 * 2. Indexes discovered features in Qdrant fazai_source collection
 * 3. Smart installation with fallbacks (/etc/bash_completion.d/ -> /opt/fazai/scripts/)
 * 4. Validates against code AND vector DB
 * 5. Auto-rediscovers if discrepancies found
 * 6. Integrates with systemd, .bashrc, /etc/profile
 *
 * Usage:
 *   genaiscript run completion-sync
 *   genaiscript run completion-sync --vars "mode=validate"
 *   genaiscript run completion-sync --vars "mode=install"
 *   genaiscript run completion-sync --vars "mode=full"
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const mode = env.vars.mode || "full"; // full | discover | validate | install | index
const projectRoot = env.vars.project_root || process.cwd();
const qdrantUrl = env.vars.qdrant_url || "http://localhost:6333";
const ollamaUrl = env.vars.ollama_url || process.env.OLLAMA_BASE_URL || "http://localhost:11434";

script({
  title: "FazAI Completion Sync",
  description: "Auto-discover, validate, and sync CLI completions",
  model: "ollama:llama3.2", // Local model for efficiency
  temperature: 0.1,
  maxTokens: 4096,
});

// ============================================================================
// TOOL: Discover Commands from Source Code
// ============================================================================
defTool(
  "discover_commands",
  "Parse all TypeScript files in src/commands/ to discover commands and subcommands",
  {
    type: "object",
    properties: {
      srcDir: {
        type: "string",
        description: "Source directory path",
        default: "src/commands",
      },
    },
  },
  async ({ srcDir = "src/commands" }) => {
    const commandsDir = path.join(projectRoot, srcDir);
    const discovery = {
      commands: [],
      subcommands: {},
      options: {},
      totalFeatures: 0,
      discoveredAt: new Date().toISOString(),
    };

    if (!fs.existsSync(commandsDir)) {
      return JSON.stringify({ error: `Directory not found: ${commandsDir}` });
    }

    // Parse app.ts for main commands
    const appPath = path.join(projectRoot, "src/app.ts");
    if (fs.existsSync(appPath)) {
      const appContent = fs.readFileSync(appPath, "utf-8");

      // Extract SUBCOMMANDS_WITH_HELP array
      const helpMatch = appContent.match(/SUBCOMMANDS_WITH_HELP\s*=\s*\[([\s\S]*?)\]/);
      if (helpMatch) {
        const cmdMatches = helpMatch[1].matchAll(/["']([^"']+)["']/g);
        for (const m of cmdMatches) {
          discovery.commands.push(m[1]);
        }
      }

      // Extract global options from help text
      const optionsMatch = appContent.match(/Options:([\s\S]*?)(?:Examples:|$)/);
      if (optionsMatch) {
        const optMatches = optionsMatch[1].matchAll(/(--[\w-]+|-\w)\b/g);
        const globalOpts = new Set();
        for (const m of optMatches) {
          globalOpts.add(m[1]);
        }
        discovery.options["global"] = [...globalOpts];
      }
    }

    // Parse each command file for subcommands
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith(".ts") && !f.includes("test"));

    for (const file of files) {
      const cmdName = file.replace(/[-_]?command\.ts$/, "").replace(".ts", "").replace(/-/g, "");
      const filePath = path.join(commandsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");

      // Extract case statements
      const casePattern = /case\s+["']([^"'$]+)["']\s*:/g;
      const subs = new Set();
      const opts = new Set();

      let match;
      while ((match = casePattern.exec(content)) !== null) {
        const sub = match[1].trim();
        if (sub && !sub.includes("{") && !sub.includes("$")) {
          if (sub.startsWith("-")) {
            opts.add(sub);
          } else {
            subs.add(sub);
          }
        }
      }

      if (subs.size > 0 || opts.size > 0) {
        discovery.subcommands[cmdName] = [...subs].sort();
        if (opts.size > 0) {
          discovery.options[cmdName] = [...opts].sort();
        }
      }
    }

    // Parse models.ts
    const modelsPath = path.join(projectRoot, "src/models.ts");
    if (fs.existsSync(modelsPath)) {
      const modelsContent = fs.readFileSync(modelsPath, "utf-8");
      const modelPattern = /name:\s*["']([^"']+)["']/g;
      discovery.models = [];
      let modelMatch;
      while ((modelMatch = modelPattern.exec(modelsContent)) !== null) {
        discovery.models.push(modelMatch[1]);
      }
    }

    // Calculate totals
    discovery.totalFeatures =
      discovery.commands.length +
      Object.values(discovery.subcommands).reduce((sum, arr) => sum + arr.length, 0) +
      Object.values(discovery.options).reduce((sum, arr) => sum + arr.length, 0) +
      (discovery.models?.length || 0);

    return JSON.stringify(discovery, null, 2);
  }
);

// ============================================================================
// TOOL: Index Features in Qdrant
// ============================================================================
defTool(
  "index_to_qdrant",
  "Index discovered features to fazai_source collection in Qdrant",
  {
    type: "object",
    properties: {
      discovery: {
        type: "string",
        description: "JSON string with discovery results",
      },
    },
    required: ["discovery"],
  },
  async ({ discovery }) => {
    const data = JSON.parse(discovery);
    const points = [];
    let pointId = Date.now();

    // Create points for commands
    for (const cmd of data.commands) {
      const subs = data.subcommands[cmd] || [];
      const opts = data.options[cmd] || [];
      const content = `Command: ${cmd}\nSubcommands: ${subs.join(", ")}\nOptions: ${opts.join(", ")}`;

      // Generate embedding via Ollama
      try {
        const embedRes = await fetch(`${ollamaUrl}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "nomic-embed-text", prompt: content }),
        });
        const embedData = await embedRes.json();

        if (embedData.embedding) {
          // Truncate to 768 dimensions (nomic-embed-text native)
          const vector = embedData.embedding;
          // nomic-embed-text já produz 768d nativo - sem padding necessário

          points.push({
            id: pointId++,
            vector: vector.slice(0, 768),
            payload: {
              type: "cli_command",
              command: cmd,
              subcommands: subs,
              options: opts,
              content: content,
              indexed_at: new Date().toISOString(),
              source: "completion-sync",
            },
          });
        }
      } catch (e) {
        console.error(`Failed to embed ${cmd}: ${e.message}`);
      }
    }

    // Upsert to Qdrant
    if (points.length > 0) {
      try {
        const upsertRes = await fetch(`${qdrantUrl}/collections/fazai_source/points?wait=true`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points }),
        });
        const result = await upsertRes.json();
        return JSON.stringify({
          success: true,
          indexed: points.length,
          result: result,
        });
      } catch (e) {
        return JSON.stringify({ error: e.message });
      }
    }

    return JSON.stringify({ indexed: 0 });
  }
);

// ============================================================================
// TOOL: Validate Against Qdrant
// ============================================================================
defTool(
  "validate_with_qdrant",
  "Compare discovered features with what is indexed in Qdrant",
  {
    type: "object",
    properties: {
      discovery: {
        type: "string",
        description: "JSON string with discovery results",
      },
    },
    required: ["discovery"],
  },
  async ({ discovery }) => {
    const data = JSON.parse(discovery);
    const validation = {
      status: "valid",
      discrepancies: [],
      indexed_commands: [],
      missing_commands: [],
      extra_commands: [],
    };

    try {
      // Scroll through indexed CLI commands
      const scrollRes = await fetch(`${qdrantUrl}/collections/fazai_source/points/scroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: { must: [{ key: "type", match: { value: "cli_command" } }] },
          limit: 100,
          with_payload: true,
        }),
      });
      const scrollData = await scrollRes.json();

      if (scrollData.result?.points) {
        for (const point of scrollData.result.points) {
          validation.indexed_commands.push(point.payload.command);
        }
      }

      // Find discrepancies
      const discoveredSet = new Set(data.commands);
      const indexedSet = new Set(validation.indexed_commands);

      for (const cmd of discoveredSet) {
        if (!indexedSet.has(cmd)) {
          validation.missing_commands.push(cmd);
          validation.discrepancies.push(`Missing in Qdrant: ${cmd}`);
        }
      }

      for (const cmd of indexedSet) {
        if (!discoveredSet.has(cmd)) {
          validation.extra_commands.push(cmd);
          validation.discrepancies.push(`Extra in Qdrant (not in code): ${cmd}`);
        }
      }

      if (validation.discrepancies.length > 0) {
        validation.status = "invalid";
      }
    } catch (e) {
      validation.status = "error";
      validation.error = e.message;
    }

    return JSON.stringify(validation, null, 2);
  }
);

// ============================================================================
// TOOL: Generate Completion Script
// ============================================================================
defTool(
  "generate_completion_script",
  "Generate bash completion script from discovery data",
  {
    type: "object",
    properties: {
      discovery: {
        type: "string",
        description: "JSON string with discovery results",
      },
      shell: {
        type: "string",
        description: "Shell type (bash or zsh)",
        default: "bash",
      },
    },
    required: ["discovery"],
  },
  async ({ discovery, shell = "bash" }) => {
    const data = JSON.parse(discovery);
    const commandsList = data.commands.join(" ");
    const optionsList = (data.options["global"] || []).join(" ");
    const modelsList = (data.models || []).join(" ");

    // Generate case statements for subcommands
    const subcommandCases = Object.entries(data.subcommands)
      .filter(([, subs]) => subs.length > 0)
      .map(([cmd, subs]) => {
        const allSubs = [...subs, ...(data.options[cmd] || [])].join(" ");
        return `        ${cmd})
            local subcmds="${allSubs}"
            COMPREPLY=( \$(compgen -W "\${subcmds}" -- \${cur}) )
            return 0
            ;;`;
      })
      .join("\n");

    const bashScript = `#!/usr/bin/env bash
# FazAI Bash Completion - AUTO-GENERATED by completion-sync.genai.mjs
# Generated: ${new Date().toISOString()}
# Features: ${data.totalFeatures} (${data.commands.length} commands, ${Object.values(data.subcommands).reduce((s, a) => s + a.length, 0)} subcommands)
#
# Installation paths (in priority order):
#   1. /etc/bash_completion.d/fazai
#   2. /opt/fazai/scripts/fazai-completion.bash (fallback)

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

    # Commands (${data.commands.length} discovered)
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

    # First argument
    if [[ \$COMP_CWORD -eq 1 ]]; then
        COMPREPLY=( \$(compgen -W "\$commands \$models \$opts" -- \${cur}) )
        return 0
    fi

    # Subcommands (${Object.keys(data.subcommands).length} commands have subcommands)
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

        *)
            COMPREPLY=( \$(compgen -W "\${opts}" -- \${cur}) )
            return 0
            ;;
    esac
}

complete -F _fazai_completion fazai
`;

    return bashScript;
  }
);

// ============================================================================
// TOOL: Smart Install Completion
// ============================================================================
defTool(
  "smart_install_completion",
  "Install completion script with fallbacks and system integration",
  {
    type: "object",
    properties: {
      script: {
        type: "string",
        description: "The completion script content",
      },
    },
    required: ["script"],
  },
  async ({ script }) => {
    const result = {
      installed: false,
      path: null,
      fallback_used: false,
      integrations: [],
      errors: [],
    };

    const primaryPath = "/etc/bash_completion.d/fazai";
    const fallbackDir = "/opt/fazai/scripts";
    const fallbackPath = `${fallbackDir}/fazai-completion.bash`;

    // Try primary location first
    try {
      fs.accessSync("/etc/bash_completion.d", fs.constants.W_OK);
      fs.writeFileSync(primaryPath, script, { mode: 0o644 });
      result.installed = true;
      result.path = primaryPath;
    } catch (e) {
      // Primary failed, try sudo
      try {
        execSync(`echo '${script.replace(/'/g, "'\\''")}' | sudo tee ${primaryPath} > /dev/null`, {
          stdio: "pipe",
        });
        result.installed = true;
        result.path = primaryPath;
      } catch (e2) {
        // Try fallback location
        try {
          if (!fs.existsSync(fallbackDir)) {
            execSync(`sudo mkdir -p ${fallbackDir}`, { stdio: "pipe" });
          }
          execSync(`echo '${script.replace(/'/g, "'\\''")}' | sudo tee ${fallbackPath} > /dev/null`, {
            stdio: "pipe",
          });
          result.installed = true;
          result.path = fallbackPath;
          result.fallback_used = true;
        } catch (e3) {
          result.errors.push(`Install failed: ${e3.message}`);
        }
      }
    }

    if (result.installed && result.fallback_used) {
      // Add to .bashrc if using fallback
      const bashrcPath = path.join(process.env.HOME, ".bashrc");
      const sourceCmd = `\n# FazAI Completion\n[ -f ${fallbackPath} ] && source ${fallbackPath}\n`;

      try {
        const bashrc = fs.readFileSync(bashrcPath, "utf-8");
        if (!bashrc.includes(fallbackPath)) {
          fs.appendFileSync(bashrcPath, sourceCmd);
          result.integrations.push("~/.bashrc");
        }
      } catch (e) {
        result.errors.push(`Failed to update .bashrc: ${e.message}`);
      }

      // Add to /etc/profile
      try {
        execSync(`grep -q "${fallbackPath}" /etc/profile || echo '${sourceCmd}' | sudo tee -a /etc/profile > /dev/null`, {
          stdio: "pipe",
        });
        result.integrations.push("/etc/profile");
      } catch (e) {
        // Silently ignore - not critical
      }
    }

    // Create systemd service for silent reload (optional)
    const systemdService = `[Unit]
Description=FazAI Completion Loader
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c "source ${result.path} 2>/dev/null || true"
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
`;

    try {
      const servicePath = "/etc/systemd/system/fazai-completion.service";
      execSync(`echo '${systemdService}' | sudo tee ${servicePath} > /dev/null && sudo systemctl daemon-reload`, {
        stdio: "pipe",
      });
      result.integrations.push("systemd:fazai-completion.service");
    } catch (e) {
      // Optional, don't fail
    }

    return JSON.stringify(result, null, 2);
  }
);

// ============================================================================
// TOOL: Full Sync Workflow
// ============================================================================
defTool(
  "full_sync",
  "Execute complete sync: discover -> validate -> index -> install",
  {
    type: "object",
    properties: {},
  },
  async () => {
    const workflow = {
      steps: [],
      success: false,
      summary: {},
    };

    // Step 1: Discover
    workflow.steps.push({ step: "discover", status: "running" });
    const discovery = await env.tools.discover_commands({});
    const discoveryData = JSON.parse(discovery);
    workflow.steps[0].status = "completed";
    workflow.steps[0].features = discoveryData.totalFeatures;

    // Step 2: Validate against Qdrant
    workflow.steps.push({ step: "validate", status: "running" });
    const validation = await env.tools.validate_with_qdrant({ discovery });
    const validationData = JSON.parse(validation);
    workflow.steps[1].status = "completed";
    workflow.steps[1].discrepancies = validationData.discrepancies.length;

    // Step 3: Re-index if needed
    if (validationData.status !== "valid") {
      workflow.steps.push({ step: "index", status: "running" });
      const indexResult = await env.tools.index_to_qdrant({ discovery });
      workflow.steps[2].status = "completed";
      workflow.steps[2].indexed = JSON.parse(indexResult).indexed;
    }

    // Step 4: Generate and install
    workflow.steps.push({ step: "generate", status: "running" });
    const script = await env.tools.generate_completion_script({ discovery });
    workflow.steps[workflow.steps.length - 1].status = "completed";

    workflow.steps.push({ step: "install", status: "running" });
    const installResult = await env.tools.smart_install_completion({ script });
    const installData = JSON.parse(installResult);
    workflow.steps[workflow.steps.length - 1].status = installData.installed ? "completed" : "failed";

    // Summary
    workflow.success = installData.installed;
    workflow.summary = {
      commands: discoveryData.commands.length,
      subcommands: Object.values(discoveryData.subcommands).reduce((s, a) => s + a.length, 0),
      models: discoveryData.models?.length || 0,
      totalFeatures: discoveryData.totalFeatures,
      installPath: installData.path,
      integrations: installData.integrations,
      qdrantSynced: validationData.status === "valid" || workflow.steps.some(s => s.step === "index"),
    };

    return JSON.stringify(workflow, null, 2);
  }
);

// ============================================================================
// MAIN PROMPT
// ============================================================================
if (mode === "full") {
  $`
Execute the full completion sync workflow:

1. Call full_sync to perform complete synchronization
2. Report the results in a structured format

This will:
- Discover all CLI commands, subcommands, and options from source code
- Validate against Qdrant fazai_source collection
- Re-index if discrepancies are found
- Generate and install the completion script with smart fallbacks
- Integrate with systemd, .bashrc, and /etc/profile
`;
} else if (mode === "discover") {
  $`
Call discover_commands to find all CLI features.
Report the total count of commands, subcommands, options, and models.
`;
} else if (mode === "validate") {
  $`
1. Call discover_commands to get current features
2. Call validate_with_qdrant to compare with indexed data
3. Report any discrepancies found
`;
} else if (mode === "install") {
  $`
1. Call discover_commands to get current features
2. Call generate_completion_script to create the bash script
3. Call smart_install_completion to install with fallbacks
4. Report the installation path and integrations
`;
} else if (mode === "index") {
  $`
1. Call discover_commands to get current features
2. Call index_to_qdrant to update the vector database
3. Report how many features were indexed
`;
}
