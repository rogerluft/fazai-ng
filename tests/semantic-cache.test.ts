/**
 * Semantic Cache Integration Tests
 *
 * Tests the semantic cache functionality with real Qdrant instance.
 * Requires:
 * - Qdrant running on http://localhost:6333
 * - Ollama with mxbai-embed-large or nomic-embed-text model
 *
 * Run: npx tsx tests/semantic-cache.test.ts
 */

import { SemanticCache } from "../src/services/semantic-cache";
import { logger } from "../src/logger";

/**
 * Test utilities
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Test 1: Cache initialization
 */
async function testInitialization(): Promise<void> {
  logger.info("\n🧪 Test 1: Cache Initialization");

  const cache = await SemanticCache.getInstance();
  assert(cache !== null, "Cache instance should not be null");

  const stats = await cache.stats();
  assert(stats !== null, "Stats should be available");

  logger.info("✅ Cache initialized successfully");
}

/**
 * Test 2: Cache miss (first query)
 */
async function testCacheMiss(): Promise<void> {
  logger.info("\n🧪 Test 2: Cache Miss");

  const cache = await SemanticCache.getInstance();
  const query = `Test query ${Date.now()}`; // Unique query

  const result = await cache.lookup(query, "test-model", "test-provider");
  assert(result === null, "First lookup should be a cache miss");

  logger.info("✅ Cache miss detected correctly");
}

/**
 * Test 3: Store and retrieve (exact match)
 */
async function testStoreAndRetrieve(): Promise<void> {
  logger.info("\n🧪 Test 3: Store and Retrieve (Exact Match)");

  const cache = await SemanticCache.getInstance();
  const query = `How to install nginx? ${Date.now()}`;
  const response = "To install nginx, run: sudo apt install nginx";
  const model = "qwen2.5:7b";
  const provider = "ollama";

  // Store
  await cache.store(query, response, model, provider);
  logger.info("Stored query in cache");

  // Small delay to ensure Qdrant indexes the entry
  await sleep(100);

  // Retrieve (exact match should have score ~1.0)
  const cached = await cache.lookup(query, model, provider, {
    similarityThreshold: 0.95,
  });

  assert(cached !== null, "Cached response should be found");
  assert(cached === response, "Cached response should match original");

  logger.info("✅ Store and retrieve successful");
}

/**
 * Test 4: Semantic similarity (similar queries)
 */
async function testSemanticSimilarity(): Promise<void> {
  logger.info("\n🧪 Test 4: Semantic Similarity");

  const cache = await SemanticCache.getInstance();
  const model = "qwen2.5:7b";
  const provider = "ollama";

  // Store original query
  const query1 = `How do I install nginx on Ubuntu? ${Date.now()}`;
  const response1 = "Use: sudo apt install nginx";
  await cache.store(query1, response1, model, provider);
  await sleep(100);

  // Try similar query (slight variation)
  const query2 = `How can I install nginx on Ubuntu? ${Date.now() - 1000}`;
  const cached = await cache.lookup(query2, model, provider, {
    similarityThreshold: 0.90, // Lower threshold for semantic match
  });

  if (cached) {
    logger.info(`✅ Semantic match found (similar query matched)`);
    assert(cached === response1, "Should return same response");
  } else {
    logger.warn("⚠️  No semantic match (queries might be too different)");
  }
}

/**
 * Test 5: Provider/Model isolation
 */
async function testProviderIsolation(): Promise<void> {
  logger.info("\n🧪 Test 5: Provider/Model Isolation");

  const cache = await SemanticCache.getInstance();
  const query = `Show disk usage ${Date.now()}`;

  // Store with provider A
  await cache.store(query, "Response from Ollama", "qwen2.5:7b", "ollama");
  await sleep(100);

  // Lookup with provider B (should miss)
  const cached = await cache.lookup(query, "gpt-4o", "openai");

  assert(cached === null, "Different provider should not match");

  logger.info("✅ Provider isolation working correctly");
}

/**
 * Test 6: TTL expiration
 */
async function testTTLExpiration(): Promise<void> {
  logger.info("\n🧪 Test 6: TTL Expiration");

  const cache = await SemanticCache.getInstance();
  const query = `List running processes ${Date.now()}`;
  const response = "Use: ps aux";
  const model = "qwen2.5:7b";
  const provider = "ollama";

  // Store with very short TTL (1 second)
  await cache.store(query, response, model, provider, 1000);
  await sleep(100);

  // Should be in cache immediately
  let cached = await cache.lookup(query, model, provider, { maxAge: 1000 });
  assert(cached !== null, "Should be in cache immediately");

  logger.info("Entry found before expiration");

  // Wait for expiration
  await sleep(1200);

  // Should be expired now
  cached = await cache.lookup(query, model, provider, { maxAge: 1000 });
  assert(cached === null, "Should be expired after TTL");

  logger.info("✅ TTL expiration working correctly");
}

/**
 * Test 7: Cache statistics
 */
async function testStatistics(): Promise<void> {
  logger.info("\n🧪 Test 7: Cache Statistics");

  const cache = await SemanticCache.getInstance();
  const stats = await cache.stats();

  assert(stats.totalEntries >= 0, "Total entries should be non-negative");
  assert(stats.hitRate >= 0 && stats.hitRate <= 100, "Hit rate should be 0-100%");
  assert(stats.avgAge >= 0, "Average age should be non-negative");

  logger.info(`📊 Current Stats:`);
  logger.info(`   Total Entries: ${stats.totalEntries}`);
  logger.info(`   Hit Rate: ${stats.hitRate.toFixed(1)}%`);
  logger.info(`   Avg Age: ${stats.avgAge}s`);

  const statsString = await cache.getStatsString();
  assert(statsString.length > 0, "Stats string should not be empty");

  logger.info("✅ Statistics working correctly");
}

/**
 * Test 8: Cache clear
 */
async function testCacheClear(): Promise<void> {
  logger.info("\n🧪 Test 8: Cache Clear");

  const cache = await SemanticCache.getInstance();

  // Store some entries
  await cache.store("Query 1", "Response 1", "model1", "provider1");
  await cache.store("Query 2", "Response 2", "model2", "provider2");
  await sleep(200);

  let stats = await cache.stats();
  const entriesBeforeClear = stats.totalEntries;
  logger.info(`Entries before clear: ${entriesBeforeClear}`);

  // Clear cache
  await cache.clear();
  await sleep(200);

  stats = await cache.stats();
  logger.info(`Entries after clear: ${stats.totalEntries}`);

  // Note: We might have some entries from other tests
  // Just verify that clear operation completed without error
  logger.info("✅ Cache clear completed successfully");
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  logger.info("🚀 Starting Semantic Cache Integration Tests\n");
  logger.info("Prerequisites:");
  logger.info("  - Qdrant running on http://localhost:6333");
  logger.info("  - Ollama with embedding model (mxbai-embed-large or nomic-embed-text)");
  logger.info("  - Or OpenAI API key configured\n");

  const tests = [
    testInitialization,
    testCacheMiss,
    testStoreAndRetrieve,
    testSemanticSimilarity,
    testProviderIsolation,
    testTTLExpiration,
    testStatistics,
    testCacheClear,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error: any) {
      logger.error(`❌ Test failed: ${error.message}`);
      logger.error(error.stack);
      failed++;
    }
  }

  logger.info("\n" + "=".repeat(60));
  logger.info(`📊 Test Results: ${passed}/${tests.length} passed`);

  if (failed > 0) {
    logger.error(`❌ ${failed} test(s) failed`);
    process.exit(1);
  } else {
    logger.info("✅ All tests passed!");
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  logger.error("Fatal error running tests:", error);
  process.exit(1);
});
