
import { checkAllAPIs } from "../src/services/api-status-checker";

async function run() {
  console.log("Verifying API Status Checker...");
  try {
    const results = await checkAllAPIs();
    console.log("Results received:");
    results.forEach(r => {
      console.log(`- ${r.name}: ${r.status} (${r.responseTime}ms)`);
    });
    console.log("Verification SUCCESS");
  } catch (error) {
    console.error("Verification FAILED:", error);
    process.exit(1);
  }
}

run();
