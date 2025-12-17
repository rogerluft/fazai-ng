#!/usr/bin/env tsx
/**
 * Teste manual do api-status-checker
 */

import { checkAllAPIs, formatStatus, formatResponseTime } from "./src/services/api-status-checker";

async function main() {
  console.log("🔍 Testando API Status Checker...\n");

  try {
    const results = await checkAllAPIs();

    console.log("📊 Resultados:\n");

    for (const result of results) {
      console.log(`${result.name}:`);
      console.log(`  Status: ${formatStatus(result.status)}`);
      if (result.responseTime) {
        console.log(`  Response Time: ${formatResponseTime(result.responseTime)}`);
      }
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      console.log("");
    }

    console.log("✅ Teste concluído!");
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("❌ Erro:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
