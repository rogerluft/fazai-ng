/**
 * FazAI Model Migration Test Suite
 * Valida migração para Claude Opus 4.5 / Sonnet 4.5 + Gemini 2.x
 *
 * Testa:
 * 1. Configuração de modelos
 * 2. Aliases do GenAIScript
 * 3. Fallback chain
 * 4. Conexão com Qdrant
 * 5. Provider availability
 *
 * @usage npx genaiscript run model-migration-test
 */

script({
  title: "FazAI Model Migration Test",
  description: "Valida migração para Claude 4.5 + Gemini 2.x",
  // Usa phi3 no servidor Ollama remoto (192.168.0.101)
  model: "ollama:phi3:latest",
  temperature: 0.1,
  maxTokens: 4096,
});

// === CONSTANTES DE TESTE ===
const EXPECTED_MODELS = {
  anthropic: {
    opus: "claude-opus-4-5-20251101",
    sonnet: "claude-sonnet-4-5-20250929",
    haiku: "claude-haiku-4-5",
  },
  google: {
    pro: "gemini-2.5-pro",
    flash: "gemini-2.5-flash",
    lite: "gemini-2.5-flash-lite",
  },
};

const EXPECTED_ALIASES = {
  opus: "anthropic:claude-opus-4-5-20251101",
  premium: "anthropic:claude-opus-4-5-20251101",
  sonnet: "anthropic:claude-sonnet-4-5-20250929",
  fast: "anthropic:claude-sonnet-4-5-20250929",
  smart: "anthropic:claude-sonnet-4-5-20250929",
  small: "anthropic:claude-haiku-4-5",
  haiku: "anthropic:claude-haiku-4-5",
  gemini: "google:gemini-2.5-pro",
  "gemini-fast": "google:gemini-2.5-flash",
  local: "ollama:phi3",
  fallback: "openai:gpt-4o-mini",
};

// === TEST RESULTS STORAGE ===
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  details: [],
};

function logTest(name, passed, message) {
  testResults.details.push({ name, passed, message });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  console.log(`${passed ? "✅" : "❌"} ${name}: ${message}`);
}

// === TOOL 1: Verificar Configuração de Modelos ===
defTool(
  "verify_model_config",
  "Verifica se os modelos estão configurados corretamente em genaiscript.config.mjs",
  { type: "object", properties: {} },
  async () => {
    try {
      const config = await import("./genaiscript.config.mjs");
      const modelAliases = config.default?.modelAliases || {};

      const results = [];

      // Verifica cada alias esperado
      for (const [alias, expected] of Object.entries(EXPECTED_ALIASES)) {
        const actual = modelAliases[alias];
        const passed = actual === expected;
        results.push({
          alias,
          expected,
          actual: actual || "NOT FOUND",
          passed,
        });
        logTest(`Alias '${alias}'`, passed, passed ? "OK" : `Expected ${expected}, got ${actual}`);
      }

      // Verifica modelo default
      const defaultModel = config.default?.model;
      const defaultPassed = defaultModel === "anthropic:claude-sonnet-4-5-20250929";
      results.push({
        alias: "default",
        expected: "anthropic:claude-sonnet-4-5-20250929",
        actual: defaultModel,
        passed: defaultPassed,
      });
      logTest("Default model", defaultPassed, defaultPassed ? "OK" : `Expected Sonnet 4.5, got ${defaultModel}`);

      return JSON.stringify({
        success: true,
        totalAliases: Object.keys(EXPECTED_ALIASES).length,
        verified: results.filter((r) => r.passed).length,
        failed: results.filter((r) => !r.passed).length,
        results,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }
);

// === TOOL 2: Verificar Provider Fallback ===
defTool(
  "verify_provider_fallback",
  "Verifica se o mapeamento de fallback entre providers está correto",
  { type: "object", properties: {} },
  async () => {
    try {
      // Lê o arquivo de fallback
      const fs = await import("fs");
      const path = await import("path");
      const fallbackPath = path.resolve("./src/utils/provider-fallback.ts");

      if (!fs.existsSync(fallbackPath)) {
        return JSON.stringify({
          success: false,
          error: "provider-fallback.ts not found",
        });
      }

      const content = fs.readFileSync(fallbackPath, "utf8");

      const checks = [
        { pattern: "claude-opus-4-5-20251101", name: "Opus 4.5 in mappings" },
        { pattern: "claude-sonnet-4-5-20250929", name: "Sonnet 4.5 in mappings" },
        { pattern: "gemini-2.5-pro", name: "Gemini 2.5 Pro in mappings" },
        { pattern: "gemini-2.5-flash", name: "Gemini 2.5 Flash in mappings" },
        { pattern: 'opus:', name: "Opus mapping key" },
      ];

      const results = checks.map((check) => {
        const found = content.includes(check.pattern);
        logTest(check.name, found, found ? "Found" : "Not found");
        return { ...check, passed: found };
      });

      return JSON.stringify({
        success: true,
        checks: results,
        allPassed: results.every((r) => r.passed),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }
);

// === TOOL 3: Verificar Qdrant Connection ===
defTool(
  "verify_qdrant_connection",
  "Verifica conexão com Qdrant e collections disponíveis",
  { type: "object", properties: {} },
  async () => {
    try {
      const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";

      const response = await fetch(`${qdrantUrl}/collections`);
      if (!response.ok) {
        throw new Error(`Qdrant returned ${response.status}`);
      }

      const data = await response.json();
      const collections = data.result?.collections || [];

      const expectedCollections = [
        "fazai_source",
        "fazai_learning",
        "fazai_memory",
        "fazai_kb",
        "fazai_inference",
        "fazai_semantic_cache",
      ];

      const found = collections.map((c) => c.name);
      const results = expectedCollections.map((name) => {
        const exists = found.includes(name);
        logTest(`Collection '${name}'`, exists, exists ? "Exists" : "Missing");
        return { name, exists };
      });

      return JSON.stringify({
        success: true,
        qdrantUrl,
        totalCollections: collections.length,
        expectedFound: results.filter((r) => r.exists).length,
        results,
      });
    } catch (error) {
      logTest("Qdrant Connection", false, error.message);
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }
);

// === TOOL 4: Verificar Scripts GenAIScript ===
defTool(
  "verify_genai_scripts",
  "Verifica se os scripts GenAIScript foram atualizados para novos modelos",
  { type: "object", properties: {} },
  async () => {
    try {
      const fs = await import("fs");
      const path = await import("path");

      const scriptsToCheck = [
        { file: "reflect.genai.mjs", expected: "claude-sonnet-4-5-20250929" },
        { file: "skill-seeker.genai.mjs", expected: "claude-sonnet-4-5-20250929" },
        { file: "genaiscript.config.mjs", expected: "claude-sonnet-4-5-20250929" },
      ];

      const results = [];

      for (const script of scriptsToCheck) {
        const scriptPath = path.resolve(`./genaisrc/${script.file}`);
        if (!fs.existsSync(scriptPath)) {
          results.push({ file: script.file, passed: false, reason: "File not found" });
          logTest(script.file, false, "File not found");
          continue;
        }

        const content = fs.readFileSync(scriptPath, "utf8");
        const hasNewModel = content.includes(script.expected);
        const hasOldModel = content.includes("claude-3-5-sonnet-latest");

        const passed = hasNewModel && !hasOldModel;
        results.push({
          file: script.file,
          passed,
          hasNewModel,
          hasOldModel,
          reason: passed ? "Updated" : hasOldModel ? "Still has old model" : "Missing new model",
        });
        logTest(script.file, passed, passed ? "Updated to 4.5" : "Needs update");
      }

      return JSON.stringify({
        success: true,
        results,
        allUpdated: results.every((r) => r.passed),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }
);

// === TOOL 5: Gerar Relatório Final ===
defTool(
  "generate_test_report",
  "Gera relatório final da migração em Markdown",
  { type: "object", properties: {} },
  async () => {
    const report = `# Relatório de Migração - Claude Opus 4.5

## Resumo
- **Testes Passados**: ${testResults.passed}
- **Testes Falharam**: ${testResults.failed}
- **Taxa de Sucesso**: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%

## Modelos Migrados
| Tier | Modelo Antigo | Modelo Novo |
|------|---------------|-------------|
| Premium | claude-3-5-sonnet-latest | claude-opus-4-5-20251101 |
| Balanced | claude-3-5-sonnet-latest | claude-sonnet-4-5-20250929 |
| Fast | claude-3-haiku-20240307 | claude-haiku-4-5 |

## Gemini Updates
| Modelo Antigo | Modelo Novo |
|---------------|-------------|
| gemini-1.5-pro | gemini-2.5-pro |
| gemini-1.5-flash | gemini-2.5-flash |

## Detalhes dos Testes
${testResults.details.map((t) => `- ${t.passed ? "✅" : "❌"} **${t.name}**: ${t.message}`).join("\n")}

## Próximos Passos
1. Executar \`npm run build\` para validar TypeScript
2. Testar conexão com Anthropic API usando nova chave
3. Validar fallback chain com \`fazai --model opus "teste"\`

---
*Gerado por: model-migration-test.genai.mjs*
*Data: ${new Date().toISOString()}*
`;

    // Salva relatório
    const fs = await import("fs");
    const reportPath = "./tests/migration-report.md";
    fs.writeFileSync(reportPath, report);

    return JSON.stringify({
      success: true,
      reportPath,
      summary: {
        passed: testResults.passed,
        failed: testResults.failed,
        successRate: ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1) + "%",
      },
    });
  }
);

// === PROMPT PRINCIPAL ===
$`
Você é o Test Runner do FazAI. Execute a suíte de testes de migração Opus 4.5.

## WORKFLOW DE TESTE

Execute os testes na ordem:

1. **verify_model_config** - Valida aliases e modelo default
2. **verify_provider_fallback** - Valida mapeamentos de fallback
3. **verify_qdrant_connection** - Verifica conexão com Qdrant
4. **verify_genai_scripts** - Verifica scripts atualizados
5. **generate_test_report** - Gera relatório final

## DIRETRIZES

- Execute TODOS os testes
- Colete resultados de cada tool
- Gere relatório consolidado
- Identifique problemas críticos
- Sugira correções se necessário

## OUTPUT ESPERADO

Após executar todos os testes, apresente:
1. Resumo de pass/fail
2. Lista de problemas encontrados
3. Recomendações de correção
4. Confirmação de migração bem-sucedida (ou não)

Inicie os testes agora.
`;
