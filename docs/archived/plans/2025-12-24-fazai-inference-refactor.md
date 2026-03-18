# FazAI Inference Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refatorar o sistema de inferência do FazAI para suportar injeção de conhecimento pelo usuário, separação de chats/execuções, e corrigir gaps de UX nos helps de subcomandos.

**Architecture:** O FazAI usa Qdrant para memória vetorial com 6 collections principais. A refatoração adiciona comando `fazai inference` para popular a collection de conhecimento do usuário, corrige o roteamento de --help para subcomandos, e prepara a estrutura para o "coração agêntico" futuro.

**Tech Stack:** TypeScript, Qdrant, Node.js, Vitest

---

## Contexto do Projeto

### Collections Qdrant (dimensão 1536)
| Collection | Propósito | Operação |
|------------|-----------|----------|
| `fazai_personality` | Estilo de fala, traços | READ (sistema) |
| `fazai_memory` | Conversas permanentes | READ/WRITE |
| `fazai_learning` | Procedimentos que funcionaram/falharam | READ/WRITE |
| `fazai_kb` | RAGs, docs técnicos (aprendizado automático) | READ/WRITE |
| `fazai_inference` | Conhecimento injetado pelo USUÁRIO | READ-ONLY (usuário popula) |
| `fazai_source` | Metacognição (código fonte indexado) | READ/WRITE |

### Arquivos Principais
- `src/app.ts` - CLI principal, roteamento de comandos
- `src/commands/` - Handlers de subcomandos
- `src/services/personality-loader.ts` - Carrega personalidade do Qdrant
- `src/rag/neural-flow.ts` - Busca multi-collection com fusion scoring
- `src/askAI.ts` - Ferramentas [[WEB]], [[SAVE]], [[READ]]

---

## Task 1: Fix --help routing para subcomandos

**Files:**
- Modify: `src/app.ts:168-175`
- Test: `tests/cli-help.test.ts` (criar)

**Step 1: Criar teste para --help de subcomando**

```typescript
// tests/cli-help.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "child_process";

describe("CLI --help routing", () => {
  it("fazai qdrant --help should show qdrant-specific help", () => {
    const output = execSync("node dist/app.cjs qdrant --help 2>&1", {
      encoding: "utf-8",
    });
    expect(output).toContain("QDRANT MANAGEMENT COMMANDS");
    expect(output).not.toContain("fazai [options]");
  });

  it("fazai vector --help should show vector-specific help", () => {
    const output = execSync("node dist/app.cjs vector --help 2>&1", {
      encoding: "utf-8",
    });
    expect(output).toContain("VECTOR");
  });

  it("fazai --help should show general help", () => {
    const output = execSync("node dist/app.cjs --help 2>&1", {
      encoding: "utf-8",
    });
    expect(output).toContain("fazai [options]");
  });
});
```

**Step 2: Rodar teste para verificar que falha**

Run: `npm test -- tests/cli-help.test.ts`
Expected: FAIL - "fazai qdrant --help" mostra help geral

**Step 3: Implementar fix no app.ts**

Modificar `src/app.ts` linhas 168-175:

```typescript
// ANTES:
if (
  inputs.length === 0 ||
  inputs.includes("--help") ||
  inputs.includes("-h")
) {
  displayHelp();
  process.exit(0);
}

// DEPOIS:
const SUBCOMMANDS_WITH_HELP = ["qdrant", "vector", "ask", "import", "alias", "cloudflare", "cf", "github", "index", "sync"];
const firstArg = inputs[0];

// Só mostra help geral se não for subcomando OU se for apenas --help
if (inputs.length === 0) {
  displayHelp();
  process.exit(0);
}

// Se é --help sozinho ou -h sozinho, mostra help geral
if ((inputs.length === 1 && (firstArg === "--help" || firstArg === "-h"))) {
  displayHelp();
  process.exit(0);
}

// Se primeiro arg é subcomando, deixa o handler do subcomando processar o --help
// (não intercepta aqui)
```

**Step 4: Rodar teste para verificar que passa**

Run: `npm test -- tests/cli-help.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app.ts tests/cli-help.test.ts
git commit -m "fix(cli): route --help to subcommand handlers instead of global help"
```

---

## Task 2: Criar comando `fazai inference`

**Files:**
- Create: `src/commands/inference.ts`
- Modify: `src/app.ts` (adicionar roteamento)
- Modify: `scripts/generate-completions.js` (adicionar completion)
- Test: `tests/inference.test.ts`

**Step 1: Criar teste para comando inference**

```typescript
// tests/inference.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do Qdrant client
vi.mock("../src/database/qdrant-pool", () => ({
  getQdrantClient: vi.fn().mockResolvedValue({
    upsert: vi.fn().mockResolvedValue({}),
    scroll: vi.fn().mockResolvedValue({ points: [] }),
    delete: vi.fn().mockResolvedValue({}),
  }),
  qdrantPool: { isAvailable: () => true },
}));

describe("Inference Command", () => {
  it("should add knowledge to inference collection", async () => {
    const { handleInferenceCommand } = await import("../src/commands/inference");
    // Test será implementado após o comando existir
    expect(handleInferenceCommand).toBeDefined();
  });
});
```

**Step 2: Rodar teste para verificar que falha**

Run: `npm test -- tests/inference.test.ts`
Expected: FAIL - módulo não existe

**Step 3: Implementar comando inference**

```typescript
// src/commands/inference.ts
/**
 * Inference Command - Gerencia conhecimento injetado pelo usuário
 *
 * A collection fazai_inference armazena conhecimento que o USUÁRIO
 * ensina explicitamente ao FazAI, diferente do kb que é aprendizado
 * automático.
 *
 * @module commands/inference
 */

import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../logger";
import { getQdrantClient } from "../database/qdrant-pool";
import { createEmbeddingService } from "../services/embeddings";
import { randomUUID } from "crypto";

const INFERENCE_COLLECTION = "fazai_inference";

interface InferenceEntry {
  id: string;
  content: string;
  category: "doc" | "rule" | "example" | "fact";
  source?: string;
  timestamp: string;
}

/**
 * Handler principal do comando inference
 */
export async function handleInferenceCommand(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    showInferenceHelp();
    return;
  }

  const subcommand = args[0];

  switch (subcommand) {
    case "add":
      await handleAdd(args.slice(1));
      break;
    case "import":
      await handleImportFile(args.slice(1));
      break;
    case "list":
      await handleList(args.slice(1));
      break;
    case "search":
      await handleSearch(args.slice(1));
      break;
    case "remove":
      await handleRemove(args.slice(1));
      break;
    case "clear":
      await handleClear();
      break;
    default:
      logger.error(chalk.red(`Subcomando desconhecido: ${subcommand}`));
      showInferenceHelp();
      process.exit(1);
  }
}

/**
 * Adiciona conhecimento inline
 */
async function handleAdd(args: string[]): Promise<void> {
  if (args.length < 2) {
    logger.error(chalk.red("Uso: fazai inference add <category> <content>"));
    logger.info("Categorias: doc, rule, example, fact");
    return;
  }

  const category = args[0] as InferenceEntry["category"];
  const content = args.slice(1).join(" ");

  if (!["doc", "rule", "example", "fact"].includes(category)) {
    logger.error(chalk.red(`Categoria inválida: ${category}`));
    logger.info("Categorias válidas: doc, rule, example, fact");
    return;
  }

  try {
    const client = await getQdrantClient();
    const embedService = createEmbeddingService();
    const embedding = await embedService.embed(content);

    const entry: InferenceEntry = {
      id: randomUUID(),
      content,
      category,
      timestamp: new Date().toISOString(),
    };

    await client.upsert(INFERENCE_COLLECTION, {
      wait: true,
      points: [
        {
          id: entry.id,
          vector: embedding,
          payload: entry,
        },
      ],
    });

    logger.info(chalk.green(`✓ Conhecimento adicionado (${category}): "${content.substring(0, 50)}..."`));
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao adicionar: ${error.message}`));
  }
}

/**
 * Importa conhecimento de arquivo (txt, md, json)
 */
async function handleImportFile(args: string[]): Promise<void> {
  if (args.length < 1) {
    logger.error(chalk.red("Uso: fazai inference import <arquivo> [--category=doc]"));
    return;
  }

  const filePath = args[0];
  const categoryArg = args.find((a) => a.startsWith("--category="));
  const category = (categoryArg?.split("=")[1] || "doc") as InferenceEntry["category"];

  if (!fs.existsSync(filePath)) {
    logger.error(chalk.red(`Arquivo não encontrado: ${filePath}`));
    return;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const ext = path.extname(filePath).toLowerCase();

    let entries: string[] = [];

    if (ext === ".json") {
      const data = JSON.parse(content);
      entries = Array.isArray(data) ? data.map((d) => (typeof d === "string" ? d : JSON.stringify(d))) : [content];
    } else {
      // Para txt/md, divide por parágrafos ou linhas duplas
      entries = content.split(/\n\n+/).filter((e) => e.trim().length > 20);
    }

    const client = await getQdrantClient();
    const embedService = createEmbeddingService();
    let count = 0;

    for (const entry of entries) {
      const trimmed = entry.trim();
      if (trimmed.length < 10) continue;

      const embedding = await embedService.embed(trimmed);
      const id = randomUUID();

      await client.upsert(INFERENCE_COLLECTION, {
        wait: true,
        points: [
          {
            id,
            vector: embedding,
            payload: {
              id,
              content: trimmed,
              category,
              source: filePath,
              timestamp: new Date().toISOString(),
            },
          },
        ],
      });
      count++;
    }

    logger.info(chalk.green(`✓ Importados ${count} entries de ${filePath}`));
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao importar: ${error.message}`));
  }
}

/**
 * Lista conhecimento armazenado
 */
async function handleList(args: string[]): Promise<void> {
  const limit = parseInt(args[0]) || 20;

  try {
    const client = await getQdrantClient();
    const result = await client.scroll(INFERENCE_COLLECTION, {
      limit,
      with_payload: true,
    });

    if (result.points.length === 0) {
      logger.info(chalk.yellow("Nenhum conhecimento armazenado na collection inference."));
      return;
    }

    console.log(chalk.bold.cyan("\nCONHECIMENTO ARMAZENADO (fazai_inference)\n"));
    for (const point of result.points) {
      const payload = point.payload as InferenceEntry;
      const preview = payload.content?.substring(0, 60) || "(sem conteúdo)";
      console.log(`  [${chalk.cyan(payload.category || "?")}] ${preview}...`);
    }
    console.log(`\nTotal: ${result.points.length} entries\n`);
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao listar: ${error.message}`));
  }
}

/**
 * Busca semântica no conhecimento
 */
async function handleSearch(args: string[]): Promise<void> {
  if (args.length < 1) {
    logger.error(chalk.red("Uso: fazai inference search <query>"));
    return;
  }

  const query = args.join(" ");

  try {
    const client = await getQdrantClient();
    const embedService = createEmbeddingService();
    const embedding = await embedService.embed(query);

    const results = await client.search(INFERENCE_COLLECTION, {
      vector: embedding,
      limit: 5,
      with_payload: true,
    });

    if (results.length === 0) {
      logger.info(chalk.yellow("Nenhum resultado encontrado."));
      return;
    }

    console.log(chalk.bold.cyan(`\nResultados para: "${query}"\n`));
    for (const result of results) {
      const payload = result.payload as InferenceEntry;
      const score = (result.score * 100).toFixed(1);
      console.log(`  [${chalk.green(score + "%")}] [${payload.category}] ${payload.content?.substring(0, 80)}...`);
    }
    console.log();
  } catch (error: any) {
    logger.error(chalk.red(`Erro na busca: ${error.message}`));
  }
}

/**
 * Remove entry específico
 */
async function handleRemove(args: string[]): Promise<void> {
  if (args.length < 1) {
    logger.error(chalk.red("Uso: fazai inference remove <id>"));
    return;
  }

  const id = args[0];

  try {
    const client = await getQdrantClient();
    await client.delete(INFERENCE_COLLECTION, {
      wait: true,
      points: [id],
    });
    logger.info(chalk.green(`✓ Entry ${id} removido`));
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao remover: ${error.message}`));
  }
}

/**
 * Limpa toda a collection
 */
async function handleClear(): Promise<void> {
  logger.warn(chalk.yellow("⚠️  Isso vai apagar TODO o conhecimento da collection inference!"));
  logger.info("Pressione Ctrl+C para cancelar ou aguarde 3 segundos...");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    const client = await getQdrantClient();
    await client.delete(INFERENCE_COLLECTION, {
      wait: true,
      filter: { must: [] }, // Deleta tudo
    });
    logger.info(chalk.green("✓ Collection inference limpa"));
  } catch (error: any) {
    logger.error(chalk.red(`Erro ao limpar: ${error.message}`));
  }
}

/**
 * Exibe help do comando
 */
function showInferenceHelp(): void {
  const help = `
${chalk.bold.cyan("INFERENCE - Gerenciamento de Conhecimento")}

${chalk.bold("Uso:")}
  fazai inference <comando> [opções]

${chalk.bold("Comandos:")}
  ${chalk.cyan("add <category> <content>")}    Adiciona conhecimento inline
  ${chalk.cyan("import <arquivo>")}            Importa de arquivo (txt, md, json)
  ${chalk.cyan("list [limit]")}                Lista conhecimento armazenado
  ${chalk.cyan("search <query>")}              Busca semântica
  ${chalk.cyan("remove <id>")}                 Remove entry específico
  ${chalk.cyan("clear")}                       Limpa toda a collection

${chalk.bold("Categorias:")}
  ${chalk.yellow("doc")}       Documentação, tutoriais
  ${chalk.yellow("rule")}      Regras operacionais
  ${chalk.yellow("example")}   Exemplos de uso
  ${chalk.yellow("fact")}      Fatos, dados específicos

${chalk.bold("Exemplos:")}
  fazai inference add doc "O nginx deve sempre usar worker_processes auto"
  fazai inference import ~/docs/linux-tips.md --category=doc
  fazai inference search "como configurar nginx"
  fazai inference list 10
`;
  console.log(help);
}
```

**Step 4: Adicionar roteamento no app.ts**

Adicionar em `src/app.ts` após o bloco do qdrant (~linha 217):

```typescript
// Inference command
if (inputs[0] === "inference") {
  const { handleInferenceCommand } = await import("./commands/inference");
  await handleInferenceCommand(inputs.slice(1));
  process.exit(0);
}
```

**Step 5: Adicionar no generate-completions.js**

Adicionar "inference" na lista de comandos em `scripts/generate-completions.js`.

**Step 6: Rodar testes**

Run: `npm test -- tests/inference.test.ts`
Expected: PASS

**Step 7: Build e testar manualmente**

```bash
npm run build
fazai inference --help
fazai inference add doc "Teste de conhecimento"
fazai inference list
fazai inference search "teste"
```

**Step 8: Commit**

```bash
git add src/commands/inference.ts src/app.ts scripts/generate-completions.js tests/inference.test.ts
git commit -m "feat(cli): add inference command for user knowledge injection"
```

---

## Task 3: Atualizar help geral com novo comando

**Files:**
- Modify: `src/app.ts` (função displayHelp)

**Step 1: Adicionar inference no help**

Em `src/app.ts`, na função `displayHelp()`, adicionar linha:

```typescript
  fazai inference <command>                        # Gerencia conhecimento injetado pelo usuário
```

**Step 2: Commit**

```bash
git add src/app.ts
git commit -m "docs(cli): add inference command to --help output"
```

---

## Task 4: Integrar inference no Neural Flow

**Files:**
- Modify: `src/rag/neural-flow.ts:127` (ajustar peso)

**Step 1: Verificar peso atual do inference**

O inference já está com peso 0.10 (10%). Manter assim por enquanto.

**Step 2: Documentar no README do RAG**

Atualizar `src/rag/README.md` explicando a diferença entre kb e inference.

**Step 3: Commit**

```bash
git add src/rag/README.md
git commit -m "docs(rag): document kb vs inference collection differences"
```

---

## Task 5: Atualizar CHANGELOG e documentação

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md` (se necessário)

**Step 1: Adicionar entrada no CHANGELOG**

```markdown
## [3.8.2-beta] - 2025-12-24

### Features
- **Comando `fazai inference`**: Gerenciamento de conhecimento injetado pelo usuário
  - `add`: Adiciona conhecimento inline com categoria
  - `import`: Importa de arquivos txt/md/json
  - `list`: Lista conhecimento armazenado
  - `search`: Busca semântica
  - `remove/clear`: Gerenciamento de entries

### Fixes
- **CLI --help routing**: Subcomandos agora exibem help específico (`fazai qdrant --help`)

### Merges
- feat-sync-cli-help-completion: Sincroniza comandos, help e completion
- feat-embedding-disk-cache: Cache em disco para embeddings
- feat-cli-test-suite: Suite de testes CLI + timeout
- docs-align-readme-and-docs: Documentação atualizada
```

**Step 2: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: update changelog for v3.8.2-beta"
```

---

## Task 6: Push final e tag

**Step 1: Push para master**

```bash
git push origin master
```

**Step 2: Criar tag de versão**

```bash
git tag -a v3.8.2-beta -m "feat: inference command, cli help fix, merged Jules PRs"
git push origin v3.8.2-beta
```

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/app.ts` | Modificar (fix --help, add inference route) |
| `src/commands/inference.ts` | Criar (novo comando) |
| `scripts/generate-completions.js` | Modificar (add inference) |
| `tests/cli-help.test.ts` | Criar (testes de --help) |
| `tests/inference.test.ts` | Criar (testes do comando) |
| `src/rag/README.md` | Modificar (documentar kb vs inference) |
| `CHANGELOG.md` | Modificar (nova versão) |

---

## Próximos Passos (Fora deste plano)

1. **Coração Agêntico**: Implementar loop agêntico com modelo local (Phi-3/Gemma-2B)
2. **Skill_Seekers Integration**: Auto-geração de skills a partir de docs
3. **Watcher Assíncrono**: chokidar + BullMQ para indexação em tempo real
4. **MCP Keepalive**: Integração com Claude Desktop

---

*Plano gerado em 2025-12-24 por Claude (superpowers:writing-plans)*
