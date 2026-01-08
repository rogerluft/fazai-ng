/**
 * Query Normalization Utilities
 *
 * Provides text normalization for semantic cache lookups.
 * Level: MEDIUM - balances hit rate with semantic preservation.
 *
 * Normalization rules:
 * - lowercase
 * - trim whitespace
 * - remove duplicate punctuation (!!! → !, ??? → ?)
 * - remove Portuguese stopwords (articles, prepositions, conjunctions)
 * - normalize multiple spaces to single space
 *
 * @module utils/normalize
 */

/**
 * Portuguese stopwords to remove during normalization
 * Includes: articles, prepositions, conjunctions, common pronouns
 */
const PT_STOPWORDS = new Set([
  // Artigos definidos
  "o", "a", "os", "as",
  // Artigos indefinidos
  "um", "uma", "uns", "umas",
  // Preposições
  "de", "do", "da", "dos", "das",
  "em", "no", "na", "nos", "nas",
  "para", "pra", "pro", "pras", "pros",
  "por", "pelo", "pela", "pelos", "pelas",
  "com", "sem",
  "ao", "aos", "à", "às",
  // Conjunções
  "e", "ou", "mas", "porém",
  // Pronomes comuns
  "eu", "tu", "ele", "ela", "nós", "vós", "eles", "elas",
  "me", "te", "se", "nos", "vos",
  "meu", "minha", "meus", "minhas",
  "seu", "sua", "seus", "suas",
  "esse", "essa", "esses", "essas",
  "este", "esta", "estes", "estas",
  "isso", "isto", "aquilo",
  // Advérbios/partículas comuns
  "que", "como", "qual", "quais",
  "muito", "pouco", "mais", "menos",
  "já", "ainda", "sempre", "nunca",
  "aqui", "ali", "lá", "aí",
  // Verbos auxiliares comuns
  "é", "são", "era", "eram", "foi", "foram",
  "está", "estão", "estava", "estavam",
  "ser", "estar", "ter", "haver",
  "faço", "faz", "fazer", "fez",
  "posso", "pode", "poder",
  "quero", "quer", "querer",
  "preciso", "precisa", "precisar",
]);

/**
 * Normalize query for semantic cache lookup
 *
 * Applies MEDIUM level normalization:
 * 1. Lowercase conversion
 * 2. Trim whitespace
 * 3. Remove duplicate punctuation
 * 4. Remove Portuguese stopwords
 * 5. Normalize multiple spaces
 *
 * @param query - Raw user query
 * @returns Normalized query string
 *
 * @example
 * ```typescript
 * normalizeQuery("Como eu faço pra instalar o NGINX???")
 * // Returns: "instalar nginx"
 *
 * normalizeQuery("  Qual é a melhor forma de configurar firewall?  ")
 * // Returns: "melhor forma configurar firewall"
 * ```
 */
export function normalizeQuery(query: string): string {
  if (!query || typeof query !== "string") {
    return "";
  }

  let normalized = query
    // Step 1: Lowercase
    .toLowerCase()
    // Step 2: Trim
    .trim();

  // Step 3: Remove duplicate punctuation (!!! → !, ??? → ?, ... → .)
  normalized = normalized
    .replace(/!+/g, "!")
    .replace(/\?+/g, "?")
    .replace(/\.+/g, ".")
    .replace(/,+/g, ",")
    .replace(/-+/g, "-");

  // Step 4: Remove stopwords
  // Split by word boundaries, filter stopwords, rejoin
  const words = normalized
    .split(/\s+/)
    .filter((word) => {
      // Remove empty strings
      if (!word) return false;

      // Remove punctuation-only tokens
      if (/^[^\w]+$/.test(word)) return false;

      // Clean word (remove leading/trailing punctuation for comparison)
      const cleanWord = word.replace(/^[^\w]+|[^\w]+$/g, "");

      // Keep if not a stopword
      return !PT_STOPWORDS.has(cleanWord);
    })
    // Remove punctuation from individual words for cleaner cache keys
    .map((word) => word.replace(/[^\wáàâãéèêíìîóòôõúùûç-]/gi, ""));

  // Step 5: Join with single spaces
  normalized = words.join(" ");

  // Final cleanup: remove any remaining multiple spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Generate a cache key from normalized query + model + provider
 *
 * @param query - Normalized query
 * @param model - Model name
 * @param provider - Provider name
 * @returns Unique cache key
 */
export function generateCacheKey(
  query: string,
  model: string,
  provider: string
): string {
  const normalizedQuery = normalizeQuery(query);
  return `${provider}:${model}:${normalizedQuery}`;
}

/**
 * Check if two queries are semantically similar based on normalization
 *
 * Simple heuristic: if normalized forms match, they're similar.
 * For deeper similarity, use embedding comparison.
 *
 * @param query1 - First query
 * @param query2 - Second query
 * @returns True if normalized forms are identical
 */
export function areQueriesSimilar(query1: string, query2: string): boolean {
  return normalizeQuery(query1) === normalizeQuery(query2);
}

/**
 * Calculate Jaccard similarity between two normalized queries
 *
 * Useful for fuzzy matching when exact match fails.
 *
 * @param query1 - First query
 * @param query2 - Second query
 * @returns Similarity score 0.0 to 1.0
 */
export function jaccardSimilarity(query1: string, query2: string): number {
  const words1 = new Set(normalizeQuery(query1).split(" "));
  const words2 = new Set(normalizeQuery(query2).split(" "));

  if (words1.size === 0 && words2.size === 0) {
    return 1.0; // Both empty = identical
  }

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
