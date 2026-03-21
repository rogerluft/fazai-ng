import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { askPrompt, generalAskPrompt } from "./askPrompt";
import { Readable } from "stream";
import { models } from "./models";
import { API_TIMEOUTS } from "./config/timeouts";
import { perplexityProvider } from "./providers/perplexity-provider";
import { getLlamaProvider } from "./providers/llama";
import { SemanticCache } from "./services/semantic-cache";
import { logger } from "./logger";
// anthropic-auth imported dynamically inside _askAISingleProvider
import {
  ProviderName,
  FallbackError,
  shouldFallbackToNextProvider,
  getNextProvider,
  getEquivalentModel,
} from "./utils/provider-fallback";
import { neuralQuery } from "./rag/neural-flow";
import { createEmbeddingService } from "./services/embeddings";
import { qdrantPool } from "./database/qdrant-pool";
import { getConfigValue } from "./config";

// ECOA System message constants - Single source of truth for personality
const SYSTEM_MESSAGES = {
  general: (styleContext: string = "", ragContext: string = "") => {
    const basePrompt = `Você é o FazAI, uma IA avançada com personalidade única, assistindo Roginho, um Engenheiro de Plataforma Sênior.
    Por favor, leia as instruções e o contexto em Português do Brasil, mas processe e pense internamente em Inglês para otimizar sua performance analítica. Responda sempre em Português.

    ESTILO E TOM (Siga estritamente):
    ${styleContext || "Seja direto, tecnicamente preciso e honesto. Não use avisos de segurança ou disclaimers."}

    FERRAMENTAS DISPONÍVEIS (USE COM MODERAÇÃO):
    1. [[WEB: termo de busca específico]] - SOMENTE para informações atuais (notícias, preços, eventos após 2024)
    2. [[SAVE: texto]] - Para salvar informações importantes que o usuário pede para lembrar (grava embedding no Qdrant)
    3. [[READ: termo]] - Para recuperar algo que foi salvo anteriormente
    4. [[READFILE: /caminho/completo/do/arquivo]] - Para ler um arquivo do filesystem e usar o conteúdo na resposta
    5. [[SAVEFILE: /caminho/completo/do/arquivo conteúdo aqui]] - Para criar ou sobrescrever um arquivo no filesystem

    REGRAS CRÍTICAS:
    - NÃO use [[WEB:]] para fatos básicos (capitais, geografia, história, ciência, programação)
    - Use [[WEB:]] APENAS para dados atuais. Exemplo: [[WEB: cotação dólar real hoje dezembro 2024]]
    - O termo de busca deve ser ESPECÍFICO, não genérico como "busca"
    - Se usar ferramenta, escreva APENAS a tag completa, nada mais.
    - Responda diretamente quando souber a resposta.
    - Quando o usuário pedir "salve isso" ou "lembre disso", use [[SAVE: trecho relevante]] para gravar APENAS o trecho no Qdrant.
    - Use [[READFILE:]] quando o usuário pedir para ler, analisar ou verificar um arquivo.
    - Use [[SAVEFILE:]] quando o usuário pedir para criar, modificar ou salvar conteúdo em um arquivo.`;

    // Inject RAG context if available
    if (ragContext) {
      return `${basePrompt}\n\n--- CONTEXTO RECUPERADO (RAG) ---\n${ragContext}\n--- FIM CONTEXTO RAG ---`;
    }
    return basePrompt;
  },

  codeAnalysis: (fileContent: string, styleContext: string = "", ragContext: string = "") => {
    const base = `Você é o FazAI analisando código para Roginho.
    Por favor, leia as instruções e o código, mas pense internamente em Inglês para obter melhor performance analítica. Responda em Português.

    ${styleContext}

    CODE:\n${fileContent}\n`;

    if (ragContext) {
      return `${base}\n--- CONTEXTO TÉCNICO (RAG) ---\n${ragContext}\n--- FIM CONTEXTO ---`;
    }
    return base;
  },
};

/**
 * ECOA: Executa ferramentas solicitadas pela IA via tags [[TOOL: query]]
 *
 * WEB: Uses Perplexity for fast, contextual web search
 * SAVE: Stores memory in Qdrant
 * READ: Retrieves memory from Qdrant
 */
async function executeEcoaTool(command: string): Promise<string> {
  if (command.startsWith("WEB:")) {
    const query = command.replace("WEB:", "").trim();
    logger.info(`🌐 [ECOA] Pesquisando: "${query}"`);

    // Use Perplexity directly for fast web search (if available)
    const perplexityKey = getConfigValue("PERPLEXITY_API_KEY") || process.env.PERPLEXITY_API_KEY;
    if (perplexityKey) {
      try {
        // Perplexity Sonar - optimized for web search
        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${perplexityKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar", // Perplexity's current default model
            messages: [
              { role: "system", content: "Responda de forma concisa e direta. Forneça dados atualizados." },
              { role: "user", content: query },
            ],
            max_tokens: 500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const answer = data.choices?.[0]?.message?.content || "Sem resultado";
          return `RESULTADO DA WEB (Perplexity):\n${answer}`;
        }
        logger.warn(`Perplexity retornou ${response.status}, usando fallback`);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        logger.warn(`Perplexity falhou: ${e.message}, usando fallback`);
      }
    }

    // Fallback: Use ResearchCoordinator (slower but more comprehensive)
    const { ResearchCoordinator } = await import("./research");
    const coordinator = new ResearchCoordinator();
    const results = await coordinator.research(query, { reason: "Autônomo ECOA" });
    if (results && results.findings && results.findings.length > 0) {
      const summaries = results.findings.slice(0, 3).map(f => `- ${f.title}: ${f.snippet || ""}`).join("\n");
      return `RESULTADO DA WEB:\n${summaries}`;
    }
    return "Nenhum resultado encontrado na web.";
  }

  if (command.startsWith("SAVE:")) {
    const text = command.replace("SAVE:", "").trim();
    logger.info(`💾 [ECOA] Gravando Inode de Memória...`);
    // Import memory loader and store
    const { storeMemoryInQdrant } = await import("./services/memory-loader");
    await storeMemoryInQdrant({
      role: "system",
      content: text,
      timestamp: new Date().toISOString(),
      importance: 0.9, // High importance for explicit saves
      tags: ["ecoa-save", "explicit"],
    });
    return "Informação salva no multiverso de memória.";
  }

  if (command.startsWith("READ:")) {
    const query = command.replace("READ:", "").trim();
    logger.info(`🧠 [ECOA] Consultando Inodes de Memória...`);
    // Import memory loader and search
    const { loadRelevantMemories, summarizeMemories } = await import("./services/memory-loader");
    const memories = await loadRelevantMemories(query, { limit: 5, minScore: 0.5 });
    if (memories.length === 0) {
      return "Nenhuma memória relevante encontrada.";
    }
    return `MEMÓRIAS RECUPERADAS:\n${summarizeMemories(memories, 600)}`;
  }

  if (command.startsWith("READFILE:")) {
    const filePath = command.replace("READFILE:", "").trim();
    logger.info(`📄 [ECOA] Lendo arquivo: ${filePath}`);
    const resolved = path.resolve(filePath);

    try {
      const content = fs.readFileSync(resolved, "utf-8");
      return `CONTEÚDO DE ${resolved}:\n\`\`\`\n${content}\n\`\`\``;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      return `ERRO ao ler ${resolved}: ${e.message}`;
    }
  }

  if (command.startsWith("SAVEFILE:")) {
    const rest = command.replace("SAVEFILE:", "").trim();
    // Format: path\ncontent OR path<space>content (first line/token is path)
    const newlineIdx = rest.indexOf("\n");
    const spaceIdx = rest.indexOf(" ");
    // Prefer newline delimiter; fallback to first space
    const sepIdx = newlineIdx !== -1 ? newlineIdx : spaceIdx;
    if (sepIdx === -1) {
      return "ERRO: Formato: [[SAVEFILE: /path/to/file conteúdo]]";
    }
    const filePath = rest.substring(0, sepIdx).trim();
    const content = rest.substring(sepIdx + 1);
    logger.info(`💾 [ECOA] Gravando arquivo: ${filePath}`);
    const resolved = path.resolve(filePath);

    try {
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(resolved, content, "utf-8");
      return `Arquivo salvo com sucesso: ${resolved} (${content.length} bytes)`;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      return `ERRO ao salvar ${resolved}: ${e.message}`;
    }
  }

  return "Ferramenta desconhecida.";
}

/**
 * Enrich prompt with RAG context from Qdrant collections
 *
 * Searches KB, Learning, and Memory collections for relevant context
 * to inject into the AI prompt.
 *
 * @param query - User query to search for
 * @returns RAG context string or empty string if unavailable
 */
async function enrichWithRAG(query: string): Promise<string> {
  // Skip if Qdrant is not available
  if (!qdrantPool.isAvailable()) {
    logger.debug("Qdrant unavailable, skipping RAG enrichment");
    return "";
  }

  try {
    const startTime = Date.now();

    // Generate embedding for query
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate(query);

    // Search relevant collections
    const result = await neuralQuery(query, embedding, {
      topK: 5,
      minScore: 0.5,
      collections: ["fazai_kb", "fazai_learning", "fazai_memory"],
      weights: {
        kb: 0.5,       // Knowledge base has highest weight
        learning: 0.3, // Learned patterns
        memory: 0.2,   // Conversation memory
        personality: 0,
        inference: 0,
      },
    });

    const elapsed = Date.now() - startTime;

    if (result.fusedResults.length === 0) {
      logger.debug(`RAG enrichment found no results (${elapsed}ms)`);
      return "";
    }

    // Format results as context
    const contextLines: string[] = [];

    for (const r of result.fusedResults.slice(0, 5)) {
      const collectionShort = r.collection.replace("fazai_", "");
      contextLines.push(`[${collectionShort}] (${r.score.toFixed(2)}) ${r.content}`);
    }

    logger.debug(
      `RAG enrichment: ${result.fusedResults.length} results in ${elapsed}ms ` +
      `(avg score: ${result.stats.averageScore.toFixed(3)})`
    );

    return contextLines.join("\n\n");
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.debug(`RAG enrichment failed: ${err.message}`);
    return "";
  }
}

/**
 * Internal function: call single provider without fallback logic
 * Used by fallback system
 */
async function* _askAISingleProvider(
  fileContent: string,
  prompt: string,
  model: string,
  provider: ProviderName,
  systemMessage: string
): AsyncGenerator<string, void, undefined> {
  if (provider === "anthropic") {
    const { callAnthropicAPI } = await import("./services/anthropic-auth");

    const response = await callAnthropicAPI({
      model,
      messages: [{ role: "user", content: prompt }],
      systemMessage,
      maxTokens: 4096,
    });

    for (const block of response.content || []) {
      if (block.type === "text" && block.text) {
        yield block.text;
      }
    }
  } else if (provider === "openai") {
    const openai = new OpenAI({
      timeout: API_TIMEOUTS.openai,
    });

    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      yield content;
    }
  } else if (provider === "openrouter") {
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      timeout: API_TIMEOUTS.openrouter,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/rogerluft/fazai-ng",
        "X-Title": "FazAI Terminal Assistant",
      },
    });

    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      yield content;
    }
  } else if (provider === "ollama") {
    const baseUrl = getConfigValue("OLLAMA_BASE_URL") || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    logger.debug(`[Ollama] Conectando em ${baseUrl}/v1 com modelo ${model}`);
    const openai = new OpenAI({
      baseURL: `${baseUrl}/v1`,
      apiKey: "ollama",
      timeout: API_TIMEOUTS.ollama,
      maxRetries: 0,
    });

    const ollamaNumPredict = parseInt(getConfigValue("OLLAMA_NUM_PREDICT") || "0", 10) || undefined;
    const ollamaTemp = parseFloat(getConfigValue("OLLAMA_TEMPERATURE") || "0.7");
    const ollamaThink = getConfigValue("OLLAMA_THINK") !== "false"; // default true, "false" disables

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createParams: any = {
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      stream: true,
      ...(ollamaNumPredict && { max_tokens: ollamaNumPredict }),
      temperature: ollamaTemp,
      ...(!ollamaThink && { think: false }),
    };

    const stream = await openai.chat.completions.create(createParams);

    for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
      const content = chunk.choices[0]?.delta?.content || "";
      yield content;
    }
  } else if (provider === "perplexity") {
    const stream = perplexityProvider(prompt, model, systemMessage);

    for await (const chunk of stream) {
      yield chunk;
    }
  } else if (provider === "llama") {
    // Local llama.cpp server via LlamaProvider (OpenAI-compatible API)
    const llamaProvider = getLlamaProvider();
    const stream = llamaProvider.query({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      model: model,
      stream: true,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  } else if (provider === "google") {
    const apiKey =
      getConfigValue("GEMINI_API_KEY") ||
      getConfigValue("GOOGLE_API_KEY") ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY ou GOOGLE_API_KEY não configurada. Configure no /etc/fazai/fazai.conf"
      );
    }

    logger.debug(`[Gemini] Iniciando stream com modelo ${model}`);

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    const chat = geminiModel.startChat({
      history: [{ role: "user", parts: [{ text: systemMessage }] }, { role: "model", parts: [{ text: "Entendido." }] }],
    });

    const result = await chat.sendMessageStream(prompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * ECOA Tag Detection: Checks if response contains tool invocation tags
 * Supports both [[WEB: ...]] and [WEB: ...] formats for robustness
 */
function detectEcoaTags(response: string): { hasTag: boolean; command: string | null; beforeTag: string } {
  // Pattern: [[WEB: ...]] or [WEB: ...] - flexible matching
  // Also matches the tag itself for replacement
  // SAVEFILE needs special handling: content may contain ] characters
  // Try SAVEFILE first with greedy matching up to closing ]]
  const saveFilePattern = /\[?\[(SAVEFILE):\s*([\s\S]+?)\]\]?/i;
  const saveMatch = response.match(saveFilePattern);
  if (saveMatch) {
    const beforeTag = response.substring(0, saveMatch.index);
    const command = `${saveMatch[1].toUpperCase()}:${saveMatch[2].trim()}`;
    return { hasTag: true, command, beforeTag };
  }

  // Standard tags (WEB, SAVE, READ, READFILE)
  const tagPattern = /\[?\[(WEB|SAVE|READ|READFILE):\s*([^\]]+)\]?\]/i;
  const match = response.match(tagPattern);

  if (match) {
    const beforeTag = response.substring(0, match.index);
    const command = `${match[1].toUpperCase()}:${match[2].trim()}`;
    return { hasTag: true, command, beforeTag };
  }

  return { hasTag: false, command: null, beforeTag: response };
}

/**
 * Main askAI function with provider fallback chain and ECOA tool execution
 *
 * Fallback order: Loaded from PROVIDER_FALLBACK_ORDER in fazai.conf
 *
 * - First attempt: Full streaming (optimal UX)
 * - Fallback: Buffered response (acceptable trade-off)
 * - Logs: INFO level for transparency
 * - RAG enrichment: Adds context from Qdrant KB/Learning/Memory
 * - ECOA Tools: Executes [[WEB:...]], [[SAVE:...]], [[READ:...]] directives
 */
export async function* askAI(
  fileContent: string,
  question: string,
  model: string,
  provider: (typeof models)[number]["provider"],
  isGeneralQuestion: boolean = false,
  semanticSearchEnabled: boolean = true
): AsyncGenerator<string, void, undefined> {
  // First, calculate the system/RAG context so we can inject it into the prompt itself.
  let systemMessage: string = "";
  let ragContext: string = "";
  let injectedPromptContext: string = "";

  if (isGeneralQuestion) {
    try {
        const { loadPersonalityFromQdrant, buildPersonalitySystemPrompt } = await import("./services/personality-loader");
        const { loadRelevantMemories, summarizeMemories } = await import("./services/memory-loader");

        const [personality, memories, ragResult] = await Promise.all([
            loadPersonalityFromQdrant(),
            loadRelevantMemories(question, { limit: 5, minScore: 0.5 }),
            semanticSearchEnabled ? enrichWithRAG(question) : Promise.resolve(""),
        ]);

        const personalityContext = buildPersonalitySystemPrompt(personality);
        const memoriesContext = summarizeMemories(memories);

        logger.info(`✨ Context enriched: ${memories.length} memories, ${ragResult ? (ragResult.match(/\n/g) || []).length + 1 : 0} RAG items`);

        const combinedContext = [memoriesContext, ragResult].filter(Boolean).join("\n\n");
        systemMessage = SYSTEM_MESSAGES.general(personalityContext, combinedContext);

        // Also prepare the injected context for the user prompt
        injectedPromptContext = `=== REGRAS DE PERSONALIDADE (PRIORIDADE ALTA) ===\n${personalityContext}\n\n=== MEMÓRIAS E CONTEXTO ===\n${combinedContext}`;

        // IMPORTANT: Assign ragContext so ECOA follow-up calls don't lose context
        ragContext = ragResult || "";

    } catch (error: any) {
        logger.warn(`Context enrichment failed: ${error.message}. Continuing without personality/memory context.`);
        ragContext = semanticSearchEnabled ? await enrichWithRAG(question) : "";
        systemMessage = SYSTEM_MESSAGES.general(fileContent, ragContext);
        injectedPromptContext = `=== CONTEXTO ADICIONAL ===\n${ragContext}`;
    }
  } else {
      ragContext = semanticSearchEnabled ? await enrichWithRAG(question) : "";
      systemMessage = SYSTEM_MESSAGES.codeAnalysis(fileContent, "", ragContext);
      injectedPromptContext = `=== CONTEXTO TÉCNICO ===\n${ragContext}`;
  }

  // Inject the gathered context explicitly inside the final user prompt.
  // This guarantees the AI adheres to the rules even if it ignores the system message.
  const prompt = isGeneralQuestion
    ? generalAskPrompt(question, injectedPromptContext)
    : askPrompt(question, injectedPromptContext);

  // Try semantic cache first (GPTCache concept)
  if (semanticSearchEnabled) {
    try {
      const cache = await SemanticCache.getInstance();
      const cachedResponse = await cache.lookup(prompt, model, provider);

      if (cachedResponse) {
        logger.info("🎯 Using cached response (semantic match)");
        yield cachedResponse;
        return;
      }
    } catch (error: any) {
      logger.debug(`Cache lookup failed: ${error.message}`);
    }
  }

  let currentProvider: ProviderName = provider as ProviderName;
  let currentModel = model;
  let fullResponse = "";
  const attemptedProviders: string[] = [];

  // Manual fallback loop (generator-compatible)
  while (currentProvider) {
    attemptedProviders.push(currentProvider);

    try {
      logger.debug(`Attempting ${currentProvider} with model ${currentModel}`);

      const generator = _askAISingleProvider(
        fileContent,
        prompt,
        currentModel,
        currentProvider,
        systemMessage
      );

      // Stream all chunks and accumulate response
      for await (const chunk of generator) {
        fullResponse += chunk;
        yield chunk;
      }

      // Success! Log if fallback was used
      if (currentProvider !== provider) {
        logger.info(
          `✅ Fallback successful: ${currentProvider} (after ${attemptedProviders.slice(0, -1).join(" → ")} failed)`
        );
      }

      // Break out of fallback loop on success
      break;
    } catch (error: unknown) {
      const err = error as FallbackError;

      // Check if we should fallback
      if (!shouldFallbackToNextProvider(err)) {
        logger.debug(`Non-fallback error from ${currentProvider}, re-throwing`);
        throw error;
      }

      // Get next provider
      const nextProvider = getNextProvider(currentProvider);

      if (!nextProvider) {
        logger.error(`❌ All providers failed: ${attemptedProviders.join(" → ")}`);
        throw new Error(
          `All providers exhausted. Last error from ${currentProvider}: ${err.message}`
        );
      }

      // Log fallback
      logger.warn(`⚠️  ${currentProvider} failed: ${err.message}`);
      logger.info(`🔄 Falling back to ${nextProvider}...`);

      // Get equivalent model for next provider
      const nextModel = getEquivalentModel(currentModel, nextProvider);

      if (!nextModel) {
        logger.error(`❌ No model found for ${nextProvider}`);
        throw new Error(`No model available for ${nextProvider}`);
      }

      if (nextModel !== currentModel) {
        logger.info(`📝 Using equivalent model: ${nextModel}`);
      }

      currentProvider = nextProvider;
      currentModel = nextModel;
    }
  }

  // ECOA Tool Execution: Detect and process [[WEB:...]], [[SAVE:...]], [[READ:...]]
  const ecoaDetection = detectEcoaTags(fullResponse);

  if (ecoaDetection.hasTag && ecoaDetection.command) {
    logger.info(`🔧 [ECOA] Detected tool invocation: ${ecoaDetection.command}`);

    try {
      // Execute the tool
      const toolResult = await executeEcoaTool(ecoaDetection.command);
      logger.debug(`ECOA tool result: ${toolResult.substring(0, 200)}...`);

      // Follow-up call with tool result
      const followUpPrompt = `${prompt}\n\n--- RESULTADO DA FERRAMENTA ---\n${toolResult}\n--- FIM ---\n\nAgora responda a pergunta original usando este resultado:`;

      const followUpSystemMessage = isGeneralQuestion
        ? SYSTEM_MESSAGES.general(fileContent, ragContext)
        : SYSTEM_MESSAGES.codeAnalysis(fileContent, "", ragContext);

      // Make follow-up call (non-streaming for simplicity)
      yield "\n\n"; // Clear line after tag

      const followUpGenerator = _askAISingleProvider(
        fileContent,
        followUpPrompt,
        currentModel,
        currentProvider,
        followUpSystemMessage
      );

      let followUpResponse = "";
      for await (const chunk of followUpGenerator) {
        followUpResponse += chunk;
        yield chunk;
      }

      // Update fullResponse for caching
      fullResponse = ecoaDetection.beforeTag + followUpResponse;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`ECOA tool execution failed: ${err.message}`);
      yield `\n\n⚠️ Erro ao executar ferramenta: ${err.message}`;
    }
  }

  // Store response in semantic cache
  if (fullResponse) {
    try {
      const cache = await SemanticCache.getInstance();
      await cache.store(prompt, fullResponse, model, provider);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.debug(`Failed to store in cache: ${err.message}`);
    }
  }
}
