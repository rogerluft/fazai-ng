/**
 * TacticalBrain Usage Examples
 *
 * This file demonstrates how to use the TacticalBrain service for
 * fast local inference with Phi-3 Mini.
 *
 * Run: npx tsx examples/tactical-brain-example.ts
 */

import { createTacticalBrain } from "../src/services/tactical-brain";

// Example 1: Streaming response (live output)
async function example1_streaming() {
  console.log("\n=== Example 1: Streaming Response ===\n");

  const brain = createTacticalBrain({ verbose: true });

  console.log("Q: Generate a regex for validating email addresses\n");
  console.log("A: ");

  for await (const chunk of brain.think(
    "Generate a regex pattern for validating email addresses. Explain briefly."
  )) {
    process.stdout.write(chunk);
  }

  console.log("\n");
}

// Example 2: Complete result (wait for full response)
async function example2_execute() {
  console.log("\n=== Example 2: Complete Result ===\n");

  const brain = createTacticalBrain();

  const result = await brain.execute(
    "Write a bash command to find all files larger than 100MB in /var/log"
  );

  console.log("Task:", "Find large files");
  console.log("Success:", result.success);
  console.log("Provider:", result.provider);
  console.log("Used Fallback:", result.usedFallback);
  console.log("Execution Time:", `${result.executionTimeMs}ms`);
  console.log("\nOutput:");
  console.log(result.output);
}

// Example 3: With context
async function example3_withContext() {
  console.log("\n=== Example 3: With Context ===\n");

  const brain = createTacticalBrain();

  const context = `
// Current TypeScript code
interface User {
  id: number;
  name: string;
}

function getUser(id: number): User {
  // TODO: implement
}
  `;

  const task = "Complete the getUser function implementation with proper error handling";

  console.log("Context:");
  console.log(context);
  console.log("\nTask:", task);
  console.log("\nResponse:");

  for await (const chunk of brain.think(task, context)) {
    process.stdout.write(chunk);
  }

  console.log("\n");
}

// Example 4: Error handling
async function example4_errorHandling() {
  console.log("\n=== Example 4: Error Handling ===\n");

  // Create brain with invalid config to trigger errors
  const brain = createTacticalBrain({
    ollamaBaseUrl: "http://invalid-host:11434",
    timeout: 5000,
    maxRetries: 1,
  });

  const result = await brain.execute("Test task");

  console.log("Success:", result.success);
  console.log("Error:", result.error);
  console.log("Used Fallback:", result.usedFallback);
  console.log("Strikes:", brain.getStrikes());
}

// Example 5: Strike counter and reset
async function example5_strikes() {
  console.log("\n=== Example 5: Strike Counter ===\n");

  const brain = createTacticalBrain();

  console.log("Initial strikes:", brain.getStrikes());

  // Simulate some failures (would happen in real usage)
  // In this example, we just show the API

  console.log("After some operations...");
  console.log("Current strikes:", brain.getStrikes());

  // Reset strikes manually if needed
  brain.resetStrikes();
  console.log("After reset:", brain.getStrikes());
}

// Example 6: Custom configuration
async function example6_customConfig() {
  console.log("\n=== Example 6: Custom Configuration ===\n");

  const brain = createTacticalBrain({
    ollamaBaseUrl: "http://192.168.0.101:11434",
    ollamaModel: "phi3:latest",
    openrouterModel: "microsoft/phi-3-mini-128k-instruct:free",
    timeout: 60000, // 60 seconds
    maxRetries: 5,
    verbose: true,
  });

  const result = await brain.execute("What is 2+2?");

  console.log("Output:", result.output);
  console.log("Provider:", result.provider);
}

// Example 7: Code generation
async function example7_codeGeneration() {
  console.log("\n=== Example 7: Code Generation ===\n");

  const brain = createTacticalBrain();

  const task = `
Create a TypeScript function that:
1. Takes an array of numbers
2. Returns the sum of all even numbers
3. Has proper type annotations
4. Includes JSDoc comments
  `;

  console.log("Generating code...\n");

  for await (const chunk of brain.think(task)) {
    process.stdout.write(chunk);
  }

  console.log("\n");
}

// Example 8: Multiple queries (reusing instance)
async function example8_multipleQueries() {
  console.log("\n=== Example 8: Multiple Queries ===\n");

  const brain = createTacticalBrain();

  const queries = [
    "What is the capital of France?",
    "Calculate 15 * 23",
    "Explain what is a closure in JavaScript",
  ];

  for (const query of queries) {
    console.log(`\nQ: ${query}`);
    console.log("A: ");

    const result = await brain.execute(query);
    console.log(result.output);
  }
}

// Main: Run all examples
async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║   TacticalBrain - Phi-3 Mini Examples   ║");
  console.log("╚═══════════════════════════════════════════╝");

  try {
    // Uncomment the examples you want to run

    await example1_streaming();
    // await example2_execute();
    // await example3_withContext();
    // await example4_errorHandling();
    // await example5_strikes();
    // await example6_customConfig();
    // await example7_codeGeneration();
    // await example8_multipleQueries();

    console.log("\n✓ Examples completed successfully");
  } catch (error: any) {
    console.error("\n❌ Error running examples:", error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_streaming,
  example2_execute,
  example3_withContext,
  example4_errorHandling,
  example5_strikes,
  example6_customConfig,
  example7_codeGeneration,
  example8_multipleQueries,
};
