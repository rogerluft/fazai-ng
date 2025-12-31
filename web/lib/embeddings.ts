/**
 * Embeddings Service for Next.js Web API Routes
 * 
 * Provides embedding generation using OpenAI or Ollama
 * with proper error handling and retry logic for web context.
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
}

/**
 * Simple retry wrapper for web context
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 30000 } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Generate embedding using OpenAI API
 */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embedding using Ollama
 */
async function generateOllamaEmbedding(text: string): Promise<number[]> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  
  const response = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  const embedding = data.embedding;
  
  // Pad to 1536 dimensions if needed (nomic-embed-text is 768 dim)
  if (embedding.length < 1536) {
    const padding = new Array(1536 - embedding.length).fill(0);
    return [...embedding, ...padding];
  }
  
  return embedding;
}

/**
 * Generate embedding for a single text in web API context
 * 
 * Tries Ollama first, falls back to OpenAI
 * 
 * @param text - Text to generate embedding for
 * @returns Embedding vector (1536 dimensions)
 * @throws Error if embedding generation fails after retries
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  // Try Ollama first (local, free)
  try {
    return await withRetry(() => generateOllamaEmbedding(text), {
      maxRetries: 2,
      initialDelay: 500,
    });
  } catch (ollamaError) {
    console.debug("Ollama embedding failed, trying OpenAI:", ollamaError);
    
    // Fallback to OpenAI
    return await withRetry(() => generateOpenAIEmbedding(text), {
      maxRetries: 3,
      initialDelay: 1000,
    });
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * 
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of embedding vectors
 * @throws Error if embedding generation fails after retries
 */
export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // Generate embeddings sequentially to avoid rate limits
  const embeddings: number[][] = [];
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  }
  
  return embeddings;
}

