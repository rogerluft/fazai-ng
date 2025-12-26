/**
 * FazAI Skill Seeker - Auto-geração de Skills
 * Analisa docs, repos e PDFs para gerar novas skills automaticamente
 */

script({
  title: "FazAI Skill Seeker",
  description: "Auto-scrape de docs/repos/PDFs para gerar skills quando detectar gaps",
  model: "anthropic:claude-3-5-sonnet-latest",
  temperature: 0.6,
  maxTokens: 4096,
});

// === PLACEHOLDER TOOLS - A SEREM IMPLEMENTADOS ===

// Tool: Scrape de documentação
defTool(
  "skill_seeker_scrape",
  "Auto-scrape docs/repos/PDFs para gerar skills quando detectar gap de conhecimento",
  {
    type: "object",
    properties: {
      source_type: {
        type: "string",
        enum: ["url", "github_repo", "pdf", "local_docs"],
        description: "Tipo de fonte para scrape",
      },
      source_path: {
        type: "string",
        description: "URL, path do repo, ou caminho local",
      },
      topic: {
        type: "string",
        description: "Tópico ou área de conhecimento a extrair",
      },
    },
    required: ["source_type", "source_path"],
  },
  async ({ source_type, source_path, topic }) => {
    // TODO: Implementar scraping real
    // Por enquanto, retorna placeholder
    return JSON.stringify({
      status: "placeholder",
      message: `Skill Seeker scrape pendente: ${source_type} -> ${source_path}`,
      topic: topic || "general",
      next_steps: [
        "1. Implementar web scraper com crawlee",
        "2. Implementar GitHub API para repos",
        "3. Implementar PDF parser",
        "4. Gerar embeddings do conteúdo",
        "5. Criar skill automaticamente",
      ],
    });
  }
);

// Tool: Detecta gaps de conhecimento
defTool(
  "detect_knowledge_gap",
  "Detecta gaps de conhecimento baseado em queries falhadas ou incompletas",
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
    },
    required: ["query"],
  },
  async ({ query, context }) => {
    // Busca no Qdrant para verificar se há conhecimento
    const { qdrantSearch, COLLECTIONS } = await import("./tools/qdrant-tools.mjs");

    // Simula embedding (TODO: usar embedding service real)
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

    const kbResults = await qdrantSearch(COLLECTIONS.kb, mockEmbedding, 3);
    const inferenceResults = await qdrantSearch(COLLECTIONS.inference, mockEmbedding, 3);

    const hasKnowledge = kbResults.length > 0 || inferenceResults.length > 0;

    return JSON.stringify({
      query,
      has_knowledge: hasKnowledge,
      kb_matches: kbResults.length,
      inference_matches: inferenceResults.length,
      recommendation: hasKnowledge
        ? "Conhecimento existente encontrado, refinar busca"
        : "Gap detectado - usar skill_seeker_scrape para adquirir conhecimento",
      suggested_sources: [
        "https://docs.example.com",
        "github.com/relevant/repo",
        "local: ~/docs/relevant.pdf",
      ],
    });
  }
);

// Tool: Gera nova skill
defTool(
  "generate_skill",
  "Gera uma nova skill baseada em conhecimento adquirido",
  {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Nome da skill (kebab-case)",
      },
      description: {
        type: "string",
        description: "Descrição da skill",
      },
      knowledge: {
        type: "string",
        description: "Conhecimento base para a skill (JSON)",
      },
      examples: {
        type: "array",
        items: { type: "string" },
        description: "Exemplos de uso",
      },
    },
    required: ["name", "description", "knowledge"],
  },
  async ({ name, description, knowledge, examples = [] }) => {
    // TODO: Salvar skill em .claude/skills/ ou Qdrant
    const skillDefinition = {
      name,
      description,
      version: "1.0.0",
      created: new Date().toISOString(),
      source: "skill_seeker_auto",
      knowledge: JSON.parse(knowledge),
      examples,
      status: "draft", // draft -> review -> active
    };

    return JSON.stringify({
      status: "created",
      skill: skillDefinition,
      next_steps: [
        "1. Revisar skill gerada",
        "2. Testar com queries exemplo",
        "3. Ativar skill após validação",
      ],
    });
  }
);

// === AGENTE SKILL SEEKER ===

defAgent(
  "skill_seeker",
  "Agente que detecta gaps de conhecimento e auto-gera skills",
  `Você é o Skill Seeker do FazAI, responsável por:

1. DETECTAR GAPS: Quando uma query não tem resposta satisfatória
2. BUSCAR FONTES: Identificar docs, repos, PDFs relevantes
3. SCRAPE: Extrair conhecimento das fontes
4. GERAR SKILLS: Criar novas skills automaticamente

WORKFLOW:
1. Receber query ou gap report
2. Verificar se já existe conhecimento (detect_knowledge_gap)
3. Se gap confirmado, identificar fontes (skill_seeker_scrape)
4. Gerar skill com conhecimento adquirido (generate_skill)
5. Reportar skill criada para revisão

IMPORTANTE:
- Skills geradas são DRAFT por padrão
- Requerem revisão humana antes de ativação
- Priorize fontes oficiais e confiáveis`,
  {
    tools: ["skill_seeker_scrape", "detect_knowledge_gap", "generate_skill"],
  }
);

// === PROMPT PRINCIPAL ===

const userQuery = env.vars.query || "Detecte gaps de conhecimento no sistema";
const mode = env.vars.mode || "detect"; // detect | scrape | generate

$`
Você é o Skill Seeker do FazAI. Execute a seguinte tarefa:

MODO: ${mode}
QUERY: ${userQuery}

${mode === "detect" ? `
Analise a query e detecte se há um gap de conhecimento:
1. Use detect_knowledge_gap para verificar
2. Se gap encontrado, sugira fontes para scrape
3. Reporte o status do gap
` : ""}

${mode === "scrape" ? `
Execute scrape de conhecimento:
1. Use skill_seeker_scrape para a fonte indicada
2. Processe o conteúdo extraído
3. Prepare para geração de skill
` : ""}

${mode === "generate" ? `
Gere uma nova skill:
1. Use generate_skill com o conhecimento disponível
2. Inclua exemplos de uso
3. Reporte a skill criada para revisão
` : ""}

Seja objetivo e focado na tarefa.
`;
