#!/usr/bin/env tsx
/**
 * Universal Local Embedder - Example Usage
 *
 * This example demonstrates how to use the UniversalLocalEmbedder
 * for generating embeddings and integrating with Qdrant.
 *
 * Prerequisites:
 * 1. Ollama running with nomic-embed-text model
 * 2. Qdrant running (optional, for integration example)
 *
 * Run: npx tsx examples/universal-embedder-example.ts
 */

import { UniversalLocalEmbedder, padVector } from "../src/services/universal-embedder";
import { QdrantClient } from "@qdrant/js-client-rest";

// --------------------- Example 1: Basic Usage ---------------------
async function example1_basicUsage() {
  console.log("\n=== Example 1: Basic Usage ===\n");

  const embedder = new UniversalLocalEmbedder();

  // Single embedding
  const text = "Machine learning is a subset of artificial intelligence";
  const embedding = await embedder.embed(text);

  console.log(`Text: "${text}"`);
  console.log(`Embedding dimension: ${embedding.length}`);
  console.log(`First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(", ")}]`);
  console.log(`Last 5 values (padded): [${embedding.slice(-5).map(v => v.toFixed(4)).join(", ")}]`);
}

// --------------------- Example 2: Batch Processing ---------------------
async function example2_batchProcessing() {
  console.log("\n=== Example 2: Batch Processing ===\n");

  const embedder = new UniversalLocalEmbedder();

  const documents = [
    "Kubernetes is a container orchestration platform",
    "Docker enables containerization of applications",
    "Microservices architecture improves scalability",
    "CI/CD pipelines automate software deployment",
    "Infrastructure as Code enables reproducible environments"
  ];

  console.log(`Processing ${documents.length} documents...`);
  const startTime = Date.now();

  const embeddings = await embedder.embedBatch(documents);

  const duration = Date.now() - startTime;
  console.log(`\nCompleted in ${duration}ms`);
  console.log(`Average time per document: ${(duration / documents.length).toFixed(2)}ms`);

  embeddings.forEach((emb, i) => {
    console.log(`  Document ${i + 1}: ${emb.length}d vector`);
  });
}

// --------------------- Example 3: Semantic Similarity ---------------------
async function example3_semanticSimilarity() {
  console.log("\n=== Example 3: Semantic Similarity ===\n");

  const embedder = new UniversalLocalEmbedder();

  // Calculate cosine similarity
  const cosineSimilarity = (a: number[], b: number[]): number => {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  };

  const texts = [
    "cat",
    "kitten",
    "dog",
    "airplane"
  ];

  console.log("Generating embeddings...");
  const embeddings = await embedder.embedBatch(texts);

  console.log("\nSimilarity Matrix:");
  console.log("                cat      kitten    dog       airplane");

  texts.forEach((text1, i) => {
    const similarities = embeddings.map((_, j) => {
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      return sim.toFixed(4);
    });
    console.log(`  ${text1.padEnd(12)} ${similarities.join("   ")}`);
  });
}

// --------------------- Example 4: Zero Padding Demonstration ---------------------
async function example4_zeroPadding() {
  console.log("\n=== Example 4: Zero Padding Demonstration ===\n");

  // Create a small vector
  const smallVector = new Array(768).fill(0.5);
  console.log(`Original vector: ${smallVector.length}d`);
  console.log(`Values: all 0.5`);

  // Pad to 1536 dimensions
  const paddedVector = padVector(smallVector, 1536);
  console.log(`\nPadded vector: ${paddedVector.length}d`);

  const nonZeroCount = paddedVector.filter(v => v !== 0).length;
  const zeroCount = paddedVector.filter(v => v === 0).length;

  console.log(`Non-zero values: ${nonZeroCount} (original)`);
  console.log(`Zero values: ${zeroCount} (padding)`);

  // Verify magnitude is preserved
  const magnitude = (v: number[]) => Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));

  console.log(`\nOriginal magnitude: ${magnitude(smallVector).toFixed(6)}`);
  console.log(`Padded magnitude: ${magnitude(paddedVector).toFixed(6)}`);
  console.log(`Magnitude preserved: ${Math.abs(magnitude(smallVector) - magnitude(paddedVector)) < 0.0001}`);
}

// --------------------- Example 5: Qdrant Integration ---------------------
async function example5_qdrantIntegration() {
  console.log("\n=== Example 5: Qdrant Integration ===\n");

  try {
    const embedder = new UniversalLocalEmbedder();
    const qdrant = new QdrantClient({ url: "http://localhost:6333" });

    const collectionName = "example_universal_embeddings";

    // Check if collection exists
    try {
      await qdrant.getCollection(collectionName);
      console.log(`Collection "${collectionName}" already exists. Deleting...`);
      await qdrant.deleteCollection(collectionName);
    } catch {
      // Collection doesn't exist, proceed
    }

    // Create collection with 1536 dimensions
    console.log(`Creating collection "${collectionName}"...`);
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: 1536,
        distance: "Cosine"
      }
    });

    // Prepare documents
    const documents = [
      { id: 1, text: "Docker is a containerization platform" },
      { id: 2, text: "Kubernetes orchestrates containers" },
      { id: 3, text: "Linux is an open-source operating system" }
    ];

    // Generate embeddings
    console.log("\nGenerating embeddings for documents...");
    const embeddings = await embedder.embedBatch(documents.map(d => d.text));

    // Upsert to Qdrant
    console.log("Upserting to Qdrant...");
    await qdrant.upsert(collectionName, {
      points: documents.map((doc, i) => ({
        id: doc.id,
        vector: embeddings[i],
        payload: { text: doc.text }
      }))
    });

    console.log(`✅ Inserted ${documents.length} documents`);

    // Search example
    console.log("\nSearching for: 'container technology'");
    const queryEmbedding = await embedder.embed("container technology");

    const searchResults = await qdrant.search(collectionName, {
      vector: queryEmbedding,
      limit: 3
    });

    console.log("\nSearch Results:");
    searchResults.forEach((result, i) => {
      console.log(`  ${i + 1}. Score: ${result.score?.toFixed(4)} - ${result.payload?.text}`);
    });

    // Cleanup
    console.log("\nCleaning up...");
    await qdrant.deleteCollection(collectionName);
    console.log(`✅ Collection "${collectionName}" deleted`);

  } catch (error) {
    console.error("\n⚠️  Qdrant integration failed:", error instanceof Error ? error.message : error);
    console.log("Make sure Qdrant is running at http://localhost:6333");
  }
}

// --------------------- Example 6: Custom Configuration ---------------------
async function example6_customConfiguration() {
  console.log("\n=== Example 6: Custom Configuration ===\n");

  // Custom Ollama URL
  const customEmbedder = new UniversalLocalEmbedder(
    "http://localhost:11434",  // Custom Ollama URL
    "nomic-embed-text",        // Model name
    768,                       // Native dimension
    1536                       // Target dimension
  );

  const info = customEmbedder.getInfo();
  console.log("Embedder Configuration:");
  console.log(`  Model: ${info.model}`);
  console.log(`  Native Dimension: ${info.nativeDimension}`);
  console.log(`  Target Dimension: ${info.targetDimension}`);
  console.log(`  Ollama URL: ${info.ollamaUrl}`);

  const text = "Custom configuration example";
  const embedding = await customEmbedder.embed(text);

  console.log(`\nGenerated ${embedding.length}d embedding for: "${text}"`);
}

// --------------------- Main ---------------------
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     Universal Local Embedder - Example Demonstrations     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  try {
    await example1_basicUsage();
    await example2_batchProcessing();
    await example3_semanticSimilarity();
    await example4_zeroPadding();
    await example5_qdrantIntegration();
    await example6_customConfiguration();

    console.log("\n✅ All examples completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Error running examples:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
