/**
 * FazAI Skill Seeker - Auto-geração de Skills COMPLETA
 * Analisa docs, repos e PDFs para gerar novas skills automaticamente
 *
 * IMPLEMENTAÇÃO COMPLETA - SEM PLACEHOLDERS
 */

script({
  title: "FazAI Skill Seeker",
  description: "Auto-scrape de docs/repos/PDFs para gerar skills quando detectar gaps",
  // Sonnet 4.5 para extração (balanceado). Para tarefas complexas: opus
  model: "anthropic:claude-sonnet-4-5-20250929",
  temperature: 0.6,
  maxTokens: 8192,
});

// === IMPORTS DOS TOOLS ===
import { scrapeSource } from "./tools/web-scraper.mjs";
import {
  extractAndSaveSkills,
  exportSkillsAsScript,
  setRunPrompt,
} from "./tools/skill-extractor.mjs";
import {
  qdrantSearch,
  qdrantUpsert,
  COLLECTIONS,
} from "./tools/qdrant-tools.mjs";
import {
  upsertWithDeduplication,
  promoteKnowledge,
} from "./tools/knowledge-persistence.mjs";

// === EMBEDDING: ONNX BGE-base-en-v1.5 via adapter-bridge ===
import { embed as adapterEmbed } from "./tools/adapter-bridge.mjs";

// Injeta runPrompt global do GenAIScript no skill-extractor
// (runPrompt só existe como global em .genai.mjs, não em módulos .mjs)
setRunPrompt(runPrompt);

async function generateEmbedding(text) {
  return adapterEmbed(text);
}

// === TOOL 1: SCRAPE DE DOCUMENTAÇÃO ===
defTool(
  "skill_seeker_scrape",
  "Scrape real de docs/repos/PDFs para adquirir conhecimento",
  {
    type: "object",
    properties: {
      source_type: {
        type: "string",
        enum: ["url", "github_repo", "pdf", "spa"],
        description: "Tipo de fonte para scrape",
      },
      source_path: {
        type: "string",
        description: "URL, path do repo GitHub, ou caminho de arquivo",
      },
      topic: {
        type: "string",
        description: "Tópico ou área de conhecimento a extrair",
      },
      force_spa: {
        type: "boolean",
        description: "Forçar scraping de SPA (Single Page Application)",
      },
    },
    required: ["source_type", "source_path"],
  },
  async ({ source_type, source_path, topic = "general", force_spa = false }) => {
    try {
      // Executa scraping usando web-scraper.mjs
      const result = await scrapeSource(source_path, {
        type: source_type,
        forceSpa: force_spa,
        topic,
      });

      if (!result.success) {
        return JSON.stringify({
          success: false,
          error: result.error,
          source: source_path,
        });
      }

      // Salva conteúdo bruto no Qdrant (fazai_kb)
      const embedding = await generateEmbedding(result.content);

      await upsertWithDeduplication(
        COLLECTIONS.kb,
        result.content,
        embedding,
        {
          type: "scraped_content",
          source: source_path,
          source_type,
          topic,
          title: result.title,
          method: result.method,
          status: "raw", // raw -> processed -> skill_extracted
        }
      );

      return JSON.stringify({
        success: true,
        source: source_path,
        source_type,
        topic,
        title: result.title,
        content_length: result.contentLength,
        method: result.method,
        scraped_at: result.scrapedAt,
        next_step: "Use extract_skills_from_content para processar",
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
        source: source_path,
      });
    }
  }
);

// === TOOL 2: DETECTA GAPS DE CONHECIMENTO ===
defTool(
  "detect_knowledge_gap",
  "Detecta gaps de conhecimento baseado em queries falhadas",
  {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Query que não teve resposta satisfatória",
      },
      context: {
        type: "string",
        description: "Contexto adicional sobre o gap",
      },
      min_confidence: {
        type: "number",
        description: "Confiança mínima para considerar match (0.0-1.0)",
      },
    },
    required: ["query"],
  },
  async ({ query, context = "", min_confidence = 0.7 }) => {
    try {
      // Gera embedding da query
      const queryText = `${query} ${context}`;
      const embedding = await generateEmbedding(queryText);

      // Busca em múltiplas collections
      const kbResults = await qdrantSearch(COLLECTIONS.kb, embedding, 5);
      const inferenceResults = await qdrantSearch(COLLECTIONS.inference, embedding, 3);
      const learningResults = await qdrantSearch(COLLECTIONS.learning, embedding, 3);

      // Filtra por confiança mínima
      const allResults = [
        ...kbResults.map((r) => ({ ...r, source: "kb" })),
        ...inferenceResults.map((r) => ({ ...r, source: "inference" })),
        ...learningResults.map((r) => ({ ...r, source: "learning" })),
      ];

      const highConfidence = allResults.filter((r) => r.score >= min_confidence);

      const hasKnowledge = highConfidence.length > 0;

      // Sugere fontes baseado no tópico da query
      const suggestedSources = [];

      if (query.toLowerCase().includes("docker")) {
        suggestedSources.push("https://docs.docker.com");
      }
      if (query.toLowerCase().includes("kubernetes") || query.toLowerCase().includes("k8s")) {
        suggestedSources.push("https://kubernetes.io/docs");
      }
      if (query.toLowerCase().includes("systemd")) {
        suggestedSources.push("https://systemd.io");
      }
      if (query.toLowerCase().includes("nginx")) {
        suggestedSources.push("https://nginx.org/en/docs");
      }
      if (query.toLowerCase().includes("postgres")) {
        suggestedSources.push("https://www.postgresql.org/docs");
      }

      // Fallback genérico
      if (suggestedSources.length === 0) {
        suggestedSources.push(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
      }

      return JSON.stringify({
        query,
        has_knowledge: hasKnowledge,
        confidence_threshold: min_confidence,
        matches: {
          kb: kbResults.length,
          inference: inferenceResults.length,
          learning: learningResults.length,
          high_confidence: highConfidence.length,
        },
        top_matches: highConfidence.slice(0, 3).map((m) => ({
          source: m.source,
          score: m.score,
          content_preview: m.payload.content?.substring(0, 100) + "...",
        })),
        recommendation: hasKnowledge
          ? "Conhecimento existente encontrado. Considere refinar busca ou usar conhecimento atual."
          : "GAP DETECTADO - Use skill_seeker_scrape para adquirir novo conhecimento.",
        suggested_sources: suggestedSources,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
        query,
      });
    }
  }
);

// === TOOL 3: EXTRAI SKILLS DE CONTEÚDO ===
defTool(
  "extract_skills_from_content",
  "Extrai skills de conteúdo scraped usando LLM",
  {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "Conteúdo para extrair skills (pode ser resultado de scrape)",
      },
      source: {
        type: "string",
        description: "Fonte original do conteúdo",
      },
      topic: {
        type: "string",
        description: "Tópico do conteúdo",
      },
    },
    required: ["content", "source"],
  },
  async ({ content, source, topic = "general" }) => {
    try {
      // Usa skill-extractor.mjs
      const result = await extractAndSaveSkills(content, {
        source,
        type: "scraped",
        topic,
      });

      if (!result.success) {
        return JSON.stringify({
          success: false,
          error: result.error || "Extraction failed",
        });
      }

      return JSON.stringify({
        success: true,
        extraction: result.extraction,
        persistence: result.persistence,
        next_step: "Use review_and_activate_skill para revisar skills",
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }
);

// === TOOL 4: GERA CÓDIGO DE SKILL ===
defTool(
  "generate_skill_code",
  "Gera código defTool() para uma skill",
  {
    type: "object",
    properties: {
      skill_name: {
        type: "string",
        description: "Nome da skill no Qdrant",
      },
      export_path: {
        type: "string",
        description: "Caminho para exportar código (opcional)",
      },
    },
    required: ["skill_name"],
  },
  async ({ skill_name, export_path = null }) => {
    try {
      // Busca skill no Qdrant
      const embedding = await generateEmbedding(skill_name);
      const results = await qdrantSearch(COLLECTIONS.kb, embedding, 5, {
        must: [
          { key: "type", match: { value: "skill" } },
          { key: "name", match: { value: skill_name } },
        ],
      });

      if (results.length === 0) {
        return JSON.stringify({
          success: false,
          error: `Skill not found: ${skill_name}`,
        });
      }

      const skill = results[0].payload;

      // Gera código usando skill-extractor
      const { generateDefToolCode } = await import("./tools/skill-extractor.mjs");
      const code = generateDefToolCode(skill);

      return JSON.stringify({
        success: true,
        skill_name,
        code,
        export_path: export_path || "Not exported",
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }
);

// === TOOL 5: ATIVA SKILL (draft -> active) ===
defTool(
  "review_and_activate_skill",
  "Revisa e ativa uma skill (status: draft -> active)",
  {
    type: "object",
    properties: {
      skill_name: {
        type: "string",
        description: "Nome da skill a ativar",
      },
      review_notes: {
        type: "string",
        description: "Notas de revisão",
      },
    },
    required: ["skill_name"],
  },
  async ({ skill_name, review_notes = "" }) => {
    try {
      // Busca skill
      const embedding = await generateEmbedding(skill_name);
      const results = await qdrantSearch(COLLECTIONS.kb, embedding, 5, {
        must: [
          { key: "type", match: { value: "skill" } },
          { key: "name", match: { value: skill_name } },
        ],
      });

      if (results.length === 0) {
        return JSON.stringify({
          success: false,
          error: `Skill not found: ${skill_name}`,
        });
      }

      const skillId = results[0].id;

      // Promove para active
      await promoteKnowledge(COLLECTIONS.kb, skillId);

      return JSON.stringify({
        success: true,
        skill_name,
        id: skillId,
        new_status: "active",
        review_notes,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }
);

// === AGENTE SKILL SEEKER ===
defAgent(
  "skill_seeker",
  "Agente autônomo que detecta gaps e auto-gera skills",
  `Você é o Skill Seeker do FazAI, um agente autônomo responsável por:

1. DETECTAR GAPS: Identificar lacunas de conhecimento
2. BUSCAR FONTES: Localizar documentação relevante
3. SCRAPE: Extrair conhecimento das fontes
4. EXTRAIR SKILLS: Gerar skills automaticamente
5. REVISAR: Validar e ativar skills

WORKFLOW COMPLETO:
1. Receber query ou detectar gap automaticamente
2. detect_knowledge_gap(query) - Verificar conhecimento existente
3. Se gap confirmado:
   a. skill_seeker_scrape(source) - Scrape da fonte
   b. extract_skills_from_content(content) - Extrair skills
   c. generate_skill_code(skill_name) - Gerar código
   d. review_and_activate_skill(skill_name) - Ativar skill

DIRETRIZES:
- Skills geradas são DRAFT por padrão
- Requerem revisão antes de ativação
- Priorize fontes oficiais (docs, GitHub repos oficiais)
- Evite scraping agressivo (rate limits)
- Deduplicação automática de conteúdo`,
  {
    tools: [
      "skill_seeker_scrape",
      "detect_knowledge_gap",
      "extract_skills_from_content",
      "generate_skill_code",
      "review_and_activate_skill",
    ],
  }
);

// === PROMPT PRINCIPAL ===

const userQuery = env.vars.query || "Detecte gaps de conhecimento no sistema";
const mode = env.vars.mode || "auto"; // auto | detect | scrape | extract | activate
const source = env.vars.source || "";

$`
Você é o Skill Seeker do FazAI. Execute a seguinte operação:

MODO: ${mode}
QUERY: ${userQuery}
${source ? `SOURCE: ${source}` : ""}

${mode === "detect" ? `
# MODO: DETECÇÃO DE GAPS

Analise a query e detecte se há um gap de conhecimento:
1. Use detect_knowledge_gap para verificar conhecimento existente
2. Se gap encontrado, sugira fontes específicas para scrape
3. Reporte confiança dos matches encontrados
4. Priorize fontes oficiais de documentação
` : ""}

${mode === "scrape" ? `
# MODO: SCRAPING DE FONTE

Execute scrape da fonte indicada:
1. Use skill_seeker_scrape para a fonte: ${source}
2. Valide conteúdo extraído
3. Reporte estatísticas (tamanho, método usado)
4. Sugira próximo passo (extração de skills)
` : ""}

${mode === "extract" ? `
# MODO: EXTRAÇÃO DE SKILLS

Extraia skills do conteúdo fornecido:
1. Use extract_skills_from_content
2. Valide skills geradas (JSON schema, exemplos)
3. Reporte skills salvas no Qdrant
4. Liste skills duplicadas (se houver)
` : ""}

${mode === "activate" ? `
# MODO: ATIVAÇÃO DE SKILL

Revise e ative a skill:
1. Busque skill pelo nome
2. Verifique qualidade (confidence, exemplos)
3. Use review_and_activate_skill se aprovada
4. Gere código defTool() para referência
` : ""}

${mode === "auto" ? `
# MODO: AUTOMÁTICO (WORKFLOW COMPLETO)

Execute o pipeline completo:
1. detect_knowledge_gap("${userQuery}")
2. Se gap detectado:
   - Identifique melhor fonte
   - skill_seeker_scrape(fonte)
   - extract_skills_from_content(conteúdo)
3. Reporte skills geradas para revisão humana
4. NÃO ative automaticamente (requer revisão)

Seja autônomo mas cauteloso. Reporte cada etapa.
` : ""}

Execute a tarefa de forma sistemática e detalhada.
`;
