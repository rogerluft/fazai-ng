/**
 * FazAI Maestro Cleaner - Faxineiro Semântico
 *
 * Identifica e move arquivos desnecessários, órfãos, obsoletos (Milvus)
 * ou substituídos para a pasta 'archive/'.
 *
 * Autor: GeGe (Gemini 3 Pro) + Claudio (Claude Opus 4.5)
 * Data: 31 de Dezembro de 2025
 * Versão: 1.0.0
 *
 * Uso:
 *   genaiscript run cleaner                    # Modo análise (gera relatório)
 *   genaiscript run cleaner --vars "mode=exec" # Modo execução (move arquivos)
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, renameSync, readFileSync, writeFileSync } from "fs";
import { join, dirname, basename } from "path";

const mode = env.vars.mode || "analyze";
const dryRun = env.vars.dry_run !== "false";

script({
  title: "FazAI Maestro Cleaner",
  description: "Faxineiro Semântico - Identifica e arquiva arquivos obsoletos",
  model: env.vars.model || "ollama:llama3.2",
  temperature: 0.1,
  maxTokens: 4096,
});

// Constantes de configuração
const PROJECT_ROOT = process.cwd();
const ARCHIVE_DIR = join(PROJECT_ROOT, "archive");
const REPORT_FILE = join(PROJECT_ROOT, "archive", "cleaner-report.json");

// Pastas protegidas - NUNCA analisar
const PROTECTED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "archive",
  "genaisrc",
  "src/agentic",
  ".claude",
];

// Tecnologias deprecadas a detectar
const DEPRECATED_PATTERNS = [
  { name: "Milvus", pattern: /milvus|Milvus|MILVUS/gi },
  { name: "Jarvis", pattern: /jarvis|Jarvis|JARVIS/gi },
  { name: "LegacyAPI", pattern: /api\.legacy|legacyApi/gi },
];

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Lista todos os arquivos fonte do projeto
 */
defTool(
  "list_source_files",
  "Lista todos os arquivos .ts/.js do projeto (exceto protegidos)",
  {
    type: "object",
    properties: {
      extensions: {
        type: "string",
        description: "Extensões a buscar (ex: ts,js,sh)",
        default: "ts",
      },
    },
  },
  async ({ extensions = "ts" }) => {
    try {
      const extList = extensions.split(",").map((e) => `-name "*.${e.trim()}"`).join(" -o ");
      const excludes = PROTECTED_DIRS.map((d) => `-path "./${d}/*"`).join(" -o ");

      const cmd = `find . -type f \\( ${extList} \\) ! \\( ${excludes} \\) 2>/dev/null | sort`;
      const result = execSync(cmd, { cwd: PROJECT_ROOT, encoding: "utf-8" });

      const files = result.trim().split("\n").filter(Boolean);
      return JSON.stringify({
        count: files.length,
        files: files.slice(0, 100), // Limita para não sobrecarregar
        truncated: files.length > 100,
      });
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }
);

/**
 * Analisa dependências de um arquivo (quem importa ele)
 */
defTool(
  "analyze_imports",
  "Verifica quantos arquivos importam um determinado módulo",
  {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Caminho do arquivo a verificar (ex: src/utils/helper.ts)",
      },
    },
    required: ["filePath"],
  },
  async ({ filePath }) => {
    try {
      const fileName = basename(filePath).replace(/\.(ts|js|tsx|jsx)$/, "");
      const dirName = dirname(filePath);

      // Busca imports desse arquivo
      const patterns = [
        `from ['"].*${fileName}['"]`,
        `from ['"]./${fileName}['"]`,
        `require\\(['"].*${fileName}['"]\\)`,
      ];

      const grepPattern = patterns.join("\\|");
      const excludes = PROTECTED_DIRS.map((d) => `--exclude-dir=${d}`).join(" ");

      const cmd = `grep -rl "${grepPattern}" ${excludes} --include="*.ts" --include="*.tsx" --include="*.js" . 2>/dev/null | wc -l`;
      const count = parseInt(execSync(cmd, { cwd: PROJECT_ROOT, encoding: "utf-8" }).trim(), 10);

      return JSON.stringify({
        file: filePath,
        importedBy: count,
        isOrphan: count === 0,
      });
    } catch (error) {
      return JSON.stringify({ file: filePath, importedBy: 0, isOrphan: true, note: "Análise falhou" });
    }
  }
);

/**
 * Detecta tecnologias deprecadas em um arquivo
 */
defTool(
  "find_deprecated_tech",
  "Busca por padrões de tecnologias deprecadas (Milvus, Jarvis legado, etc)",
  {
    type: "object",
    properties: {
      scope: {
        type: "string",
        description: "Escopo da busca: all, src, scripts, docs",
        default: "all",
      },
    },
  },
  async ({ scope = "all" }) => {
    try {
      const results = [];
      const excludes = PROTECTED_DIRS.map((d) => `--exclude-dir=${d}`).join(" ");

      let searchPath = ".";
      if (scope === "src") searchPath = "./src";
      else if (scope === "scripts") searchPath = "./scripts";
      else if (scope === "docs") searchPath = "./docs";

      for (const dep of DEPRECATED_PATTERNS) {
        const cmd = `grep -ril "${dep.pattern.source}" ${excludes} --include="*.ts" --include="*.js" --include="*.sh" --include="*.md" ${searchPath} 2>/dev/null || true`;
        const output = execSync(cmd, { cwd: PROJECT_ROOT, encoding: "utf-8" });
        const files = output.trim().split("\n").filter(Boolean);

        if (files.length > 0) {
          results.push({
            technology: dep.name,
            files: files,
            count: files.length,
          });
        }
      }

      return JSON.stringify({
        deprecated_found: results,
        total_files: results.reduce((sum, r) => sum + r.count, 0),
      });
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }
);

/**
 * Identifica arquivos órfãos (não importados por ninguém)
 */
defTool(
  "find_orphan_files",
  "Identifica arquivos que não são importados por nenhum outro",
  {
    type: "object",
    properties: {
      directory: {
        type: "string",
        description: "Diretório a analisar (ex: src/services)",
        default: "src",
      },
    },
  },
  async ({ directory = "src" }) => {
    try {
      const excludes = PROTECTED_DIRS.map((d) => `-path "./${d}/*"`).join(" -o ");
      const cmd = `find ./${directory} -type f -name "*.ts" ! \\( ${excludes} \\) 2>/dev/null`;
      const files = execSync(cmd, { cwd: PROJECT_ROOT, encoding: "utf-8" })
        .trim()
        .split("\n")
        .filter(Boolean);

      const orphans = [];
      const excludeFromOrphan = [
        "app.ts",
        "index.ts",
        "main.ts",
        "cli.ts",
        ".test.ts",
        ".spec.ts",
        ".d.ts",
      ];

      for (const file of files.slice(0, 50)) {
        // Limita análise
        const base = basename(file);
        if (excludeFromOrphan.some((e) => base.includes(e))) continue;

        const fileName = base.replace(/\.(ts|js)$/, "");
        const grepCmd = `grep -rl "from.*${fileName}" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v "${file}" | wc -l`;

        try {
          const count = parseInt(execSync(grepCmd, { cwd: PROJECT_ROOT, encoding: "utf-8" }).trim(), 10);
          if (count === 0) {
            orphans.push({ file, reason: "No imports found" });
          }
        } catch {
          orphans.push({ file, reason: "Analysis failed (likely orphan)" });
        }
      }

      return JSON.stringify({
        directory,
        analyzed: Math.min(files.length, 50),
        total_files: files.length,
        orphans,
      });
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }
);

/**
 * Gera relatório JSON completo
 */
defTool(
  "generate_report",
  "Gera relatório JSON com todos os arquivos candidatos a arquivamento",
  {
    type: "object",
    properties: {
      deprecated: {
        type: "string",
        description: "JSON com tecnologias deprecadas encontradas",
      },
      orphans: {
        type: "string",
        description: "JSON com arquivos órfãos encontrados",
      },
    },
    required: ["deprecated", "orphans"],
  },
  async ({ deprecated, orphans }) => {
    try {
      const depData = JSON.parse(deprecated);
      const orphData = JSON.parse(orphans);

      const report = {
        generated_at: new Date().toISOString(),
        version: "1.0.0",
        mode: mode,
        summary: {
          deprecated_files: depData.total_files || 0,
          orphan_files: orphData.orphans?.length || 0,
          total_candidates: (depData.total_files || 0) + (orphData.orphans?.length || 0),
        },
        deprecated_tech: depData.deprecated_found || [],
        orphan_files: orphData.orphans || [],
        recommendations: [],
      };

      // Adiciona recomendações
      for (const dep of report.deprecated_tech) {
        for (const file of dep.files) {
          // Não recomendar docs históricos
          if (file.includes("CHANGELOG") || file.includes("SESSION_STATUS")) continue;
          if (file.includes("docs/planning")) continue;

          report.recommendations.push({
            file,
            reason: `Contains deprecated ${dep.technology} references`,
            action: "review_and_archive",
            priority: dep.technology === "Milvus" ? "high" : "medium",
          });
        }
      }

      for (const orphan of report.orphan_files) {
        report.recommendations.push({
          file: orphan.file,
          reason: orphan.reason,
          action: "review_and_archive",
          priority: "low",
        });
      }

      // Salva relatório
      if (!existsSync(ARCHIVE_DIR)) {
        mkdirSync(ARCHIVE_DIR, { recursive: true });
      }
      writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

      return JSON.stringify({
        saved_to: REPORT_FILE,
        summary: report.summary,
        recommendations_count: report.recommendations.length,
      });
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }
);

/**
 * Move arquivos para archive/ (modo exec)
 */
defTool(
  "archive_files",
  "Move arquivos listados para archive/ (requer mode=exec)",
  {
    type: "object",
    properties: {
      files: {
        type: "string",
        description: "JSON array com caminhos dos arquivos a arquivar",
      },
    },
    required: ["files"],
  },
  async ({ files }) => {
    if (mode !== "exec") {
      return JSON.stringify({
        error: "Modo exec não ativado. Use --vars 'mode=exec' para executar movimentações.",
        mode: mode,
      });
    }

    try {
      const fileList = JSON.parse(files);
      const results = [];

      if (!existsSync(ARCHIVE_DIR)) {
        mkdirSync(ARCHIVE_DIR, { recursive: true });
      }

      for (const filePath of fileList) {
        const fullPath = join(PROJECT_ROOT, filePath.replace(/^\.\//, ""));
        const archivePath = join(ARCHIVE_DIR, basename(filePath));

        if (!existsSync(fullPath)) {
          results.push({ file: filePath, status: "not_found" });
          continue;
        }

        if (dryRun) {
          results.push({ file: filePath, status: "would_move", destination: archivePath });
        } else {
          renameSync(fullPath, archivePath);
          results.push({ file: filePath, status: "moved", destination: archivePath });
        }
      }

      return JSON.stringify({
        dry_run: dryRun,
        results,
        moved_count: results.filter((r) => r.status === "moved").length,
      });
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }
);

// ============================================================================
// MAIN PROMPT
// ============================================================================

if (mode === "analyze") {
  $`
Você é o FazAI Maestro Cleaner - um faxineiro semântico especializado.

Sua missão é identificar arquivos que devem ser arquivados no repositório FazAI-NG.

## PASSOS OBRIGATÓRIOS:

1. **Detectar Tecnologias Deprecadas**
   Use find_deprecated_tech com scope="all" para encontrar:
   - Referências a Milvus (substituído por Qdrant)
   - Código Jarvis legado (já migrado para FazAI)

2. **Identificar Arquivos Órfãos**
   Use find_orphan_files no diretório "src" para encontrar:
   - Arquivos TypeScript que não são importados por ninguém
   - Código morto que pode ser arquivado

3. **Gerar Relatório**
   Use generate_report para criar um JSON com:
   - Lista de arquivos candidatos
   - Motivo de cada recomendação
   - Prioridade (high/medium/low)

## REGRAS DE SEGURANÇA:

- ❌ NUNCA incluir arquivos de genaisrc/ ou src/agentic/
- ❌ NUNCA incluir CHANGELOG.md, README.md ou docs de planejamento
- ❌ NUNCA recomendar arquivar arquivos de teste (.test.ts, .spec.ts)
- ✅ SOMENTE analisar e gerar relatório
- ✅ O relatório será revisado por humano antes de qualquer ação

## OUTPUT ESPERADO:

Apresente um resumo claro do que foi encontrado:
- Quantos arquivos com tecnologias deprecadas
- Quantos arquivos órfãos
- Arquivo do relatório gerado

Seja conciso e objetivo.
`;
} else {
  $`
Você é o FazAI Maestro Cleaner em modo EXECUÇÃO.

⚠️ MODO DE EXECUÇÃO ATIVO - Arquivos serão movidos!

1. Leia o relatório existente em archive/cleaner-report.json
2. Confirme com o usuário quais arquivos devem ser movidos
3. Use archive_files para mover os arquivos confirmados

ATENÇÃO: Este modo requer aprovação explícita do usuário.
Apresente a lista de arquivos e aguarde confirmação.
`;
}
