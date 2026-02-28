/**
 * Skill Extractor - Extrai skills de documentação
 *
 * Usa LLM para:
 * 1. Analisar conteúdo scraped
 * 2. Identificar comandos, APIs, padrões
 * 3. Gerar JSON schema para defTool()
 * 4. Deduplicate skills existentes
 */

import { qdrantSearch, qdrantUpsert, COLLECTIONS } from "./qdrant-tools.mjs";

// runPrompt não é exportado por @genaiscript/core — é uma global de .genai.mjs.
// Recebemos via parâmetro ou fallback para null (caller deve fornecer).
let _runPromptFn = null;

/**
 * Configura a função runPrompt (deve ser chamado do .genai.mjs que tem acesso à global).
 * @param {Function} fn - A função runPrompt do contexto GenAIScript
 */
export function setRunPrompt(fn) {
  _runPromptFn = fn;
}

/**
 * Template de prompt para extração de skills
 */
const SKILL_EXTRACTION_PROMPT = `Você é um especialista em análise de documentação técnica.

TAREFA: Analise o conteúdo fornecido e extraia SKILLS úteis para um sistema de AI.

Uma SKILL é:
- Um comando, ferramenta ou API específica
- Com parâmetros claros e JSON schema
- Executável ou consultável
- Útil para automação

FORMATO DE SAÍDA (JSON estrito):
{
  "skills": [
    {
      "name": "skill_name_kebab_case",
      "category": "devops|database|network|api|cli|config",
      "description": "Descrição clara e concisa",
      "parameters": {
        "type": "object",
        "properties": {
          "param1": {
            "type": "string|number|boolean|array|object",
            "description": "Descrição do parâmetro",
            "enum": ["opcional", "valores", "fixos"]
          }
        },
        "required": ["param1"]
      },
      "examples": [
        {
          "input": { "param1": "value1" },
          "output": "Expected result",
          "description": "What this example demonstrates"
        }
      ],
      "implementation_hints": [
        "Como implementar (bash command, API call, config change)"
      ],
      "related_tools": ["tool1", "tool2"],
      "confidence": 0.85
    }
  ],
  "metadata": {
    "source_url": "URL da documentação",
    "source_type": "url|github_repo|pdf",
    "extracted_at": "ISO timestamp",
    "total_skills": 3,
    "language": "bash|javascript|python|api"
  }
}

REGRAS:
1. Extraia apenas skills CONCRETAS e EXECUTÁVEIS
2. Evite skills genéricas ou vagas
3. Inclua exemplos REAIS da documentação
4. JSON schema VÁLIDO para cada skill
5. Confidence score baseado em:
   - Clareza da documentação (0.0-0.4)
   - Presença de exemplos (0.0-0.3)
   - Completude dos parâmetros (0.0-0.3)

CONTEÚDO A ANALISAR:
---
{{CONTENT}}
---

METADATA:
- Source: {{SOURCE}}
- Type: {{TYPE}}
- Topic: {{TOPIC}}

Retorne APENAS o JSON, sem texto adicional.`;

/**
 * Extrai skills de conteúdo usando LLM
 */
export async function extractSkillsFromContent(content, metadata = {}, runPromptFn = null) {
  const { source = "unknown", type = "url", topic = "general", model = "anthropic:claude-sonnet-4-5-20250929" } = metadata;
  const runPrompt = runPromptFn || _runPromptFn;
  if (!runPrompt) {
    return { success: false, error: "runPrompt not available — call setRunPrompt() first or pass runPromptFn" };
  }

  // Trunca conteúdo se muito longo (limite do modelo)
  const maxContentLength = 100000; // ~25k tokens
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + "\n... [TRUNCATED]"
    : content;

  // Prepara prompt
  const prompt = SKILL_EXTRACTION_PROMPT
    .replace("{{CONTENT}}", truncatedContent)
    .replace("{{SOURCE}}", source)
    .replace("{{TYPE}}", type)
    .replace("{{TOPIC}}", topic);

  try {
    // Executa LLM via GenAIScript runPrompt (string + options)
    const result = await runPrompt(prompt, {
      model,
      temperature: 0.3,
      maxTokens: 8192,
      responseType: "json",
    });

    // Parse JSON response
    const responseText = result.text || result.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("LLM did not return valid JSON");
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Valida estrutura
    if (!extracted.skills || !Array.isArray(extracted.skills)) {
      throw new Error("Invalid skills structure");
    }

    // Enriquece metadata
    extracted.metadata = {
      ...extracted.metadata,
      source,
      type,
      topic,
      extracted_at: new Date().toISOString(),
      content_length: content.length,
      truncated: content.length > maxContentLength,
    };

    return {
      success: true,
      ...extracted,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      source,
      type,
      topic,
    };
  }
}

/**
 * Verifica se skill já existe no Qdrant
 */
async function checkSkillDuplication(skillName, embedding) {
  // Busca similares em fazai_kb
  const similar = await qdrantSearch(COLLECTIONS.kb, embedding, 5, {
    must: [
      {
        key: "type",
        match: { value: "skill" },
      },
    ],
  });

  // Threshold de similaridade (0.9 = muito similar)
  const duplicates = similar.filter((s) => s.score > 0.9);

  if (duplicates.length > 0) {
    return {
      isDuplicate: true,
      similarSkills: duplicates.map((s) => ({
        name: s.payload.name,
        score: s.score,
      })),
    };
  }

  return {
    isDuplicate: false,
    similarSkills: [],
  };
}

/**
 * Gera embedding de skill via ONNX BGE-base-en-v1.5 (adapter-bridge)
 */
async function generateSkillEmbedding(skillText) {
  const { embed } = await import("./adapter-bridge.mjs");
  return embed(skillText);
}

/**
 * Salva skills no Qdrant (fazai_kb)
 */
export async function saveSkillsToKnowledgeBase(skills, metadata = {}) {
  const savedSkills = [];
  const duplicates = [];
  const errors = [];

  for (const skill of skills) {
    try {
      // Gera embedding
      const skillText = `${skill.name} ${skill.description} ${JSON.stringify(skill.parameters)}`;
      const embedding = await generateSkillEmbedding(skillText);

      // Verifica duplicação
      const dupCheck = await checkSkillDuplication(skill.name, embedding);

      if (dupCheck.isDuplicate) {
        duplicates.push({
          skill: skill.name,
          similar: dupCheck.similarSkills,
        });
        continue; // Skip duplicados
      }

      // Prepara ponto para Qdrant
      const point = {
        id: `skill_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        vector: embedding,
        payload: {
          type: "skill",
          name: skill.name,
          category: skill.category,
          description: skill.description,
          parameters: skill.parameters,
          examples: skill.examples || [],
          implementation_hints: skill.implementation_hints || [],
          related_tools: skill.related_tools || [],
          confidence: skill.confidence || 0.5,
          source: metadata.source || "unknown",
          source_type: metadata.source_type || "unknown",
          topic: metadata.topic || "general",
          status: "draft", // draft -> reviewed -> active
          created_at: new Date().toISOString(),
        },
      };

      // Salva no Qdrant
      const result = await qdrantUpsert(COLLECTIONS.kb, [point]);

      if (result.success) {
        savedSkills.push({
          name: skill.name,
          id: point.id,
          confidence: skill.confidence,
        });
      } else {
        errors.push({
          skill: skill.name,
          error: result.error,
        });
      }
    } catch (error) {
      errors.push({
        skill: skill.name,
        error: error.message,
      });
    }
  }

  return {
    success: true,
    saved: savedSkills,
    duplicates,
    errors,
    summary: {
      total: skills.length,
      saved: savedSkills.length,
      duplicated: duplicates.length,
      failed: errors.length,
    },
  };
}

/**
 * Pipeline completo: extrai e salva skills
 */
export async function extractAndSaveSkills(content, metadata = {}) {
  // 1. Extrai skills do conteúdo
  const extraction = await extractSkillsFromContent(content, metadata);

  if (!extraction.success) {
    return extraction;
  }

  // 2. Salva no Qdrant
  const save = await saveSkillsToKnowledgeBase(extraction.skills, extraction.metadata);

  return {
    success: true,
    extraction: {
      total_skills: extraction.skills.length,
      metadata: extraction.metadata,
    },
    persistence: save,
  };
}

/**
 * Gera código defTool() a partir de skill
 */
export function generateDefToolCode(skill) {
  const code = `defTool(
  "${skill.name}",
  "${skill.description}",
  ${JSON.stringify(skill.parameters, null, 2)},
  async (params) => {
    // TODO: Implement skill logic
    // Hints: ${skill.implementation_hints.join(", ")}

    // Example usage:
    // ${skill.examples.map(ex => JSON.stringify(ex.input)).join("\n    // ")}

    return {
      success: true,
      result: "Implementation pending",
      skill: "${skill.name}",
      category: "${skill.category}"
    };
  }
);`;

  return code;
}

/**
 * Exporta skills como arquivo .genai.mjs
 */
export function exportSkillsAsScript(skills, metadata = {}) {
  const { source = "unknown", topic = "general" } = metadata;

  const header = `/**
 * Auto-generated skills from: ${source}
 * Topic: ${topic}
 * Generated at: ${new Date().toISOString()}
 * Total skills: ${skills.length}
 */

script({
  title: "Skills: ${topic}",
  description: "Auto-generated skills from ${source}",
  model: "anthropic:claude-sonnet-4-5-20250929",
});
`;

  const toolsCode = skills
    .map((skill) => generateDefToolCode(skill))
    .join("\n\n");

  return header + "\n" + toolsCode;
}

export default {
  extractSkillsFromContent,
  saveSkillsToKnowledgeBase,
  extractAndSaveSkills,
  generateDefToolCode,
  exportSkillsAsScript,
  checkSkillDuplication,
  generateSkillEmbedding,
};
