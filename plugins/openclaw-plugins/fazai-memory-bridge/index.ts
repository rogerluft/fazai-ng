import { execSync } from 'child_process';

export default function register(api: any) {
  const cfg = (api.config?.plugins?.entries?.["fazai-memory-bridge"]?.config) ?? {};
  const fazaiExe = cfg.fazaiExecutable ?? "fazai";
  const maxResults = Math.min(50, Math.max(1, cfg.maxResults ?? 5));

  api.registerTool({
    name: "memory_search",
    description: "Busca semântica no banco de memórias usando embeddings locais (via Fazai/Qdrant).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string" }
      },
      required: ["query"]
    },
    async execute(_id: string, params: any) {
      const query = String(params.query || "").trim();
      if (!query) return { content: [{ type: "text", text: "[]" }] };

      try {
        const output = execSync(`${fazaiExe} memory search "${query}" ${maxResults}`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });

        return { content: [{ type: "text", text: output }] };
      } catch (error: any) {
        const errorOutput = error.stdout ? error.stdout.toString() : error.message;
        return { content: [{ type: "text", text: `Falha ao buscar memória: ${errorOutput}` }] };
      }
    }
  });

  api.registerTool({
    name: "memory_get",
    description: "Lê um arquivo de memória específico.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string" },
        startLine: { type: "integer" },
        maxLines: { type: "integer" }
      },
      required: ["path"]
    },
    async execute(_id: string, params: any) {
       return { content: [{ type: "text", text: JSON.stringify({ error: "No modo Fazai Bridge, use memory_search para buscar o contexto completo." }) }] };
    }
  });
}
