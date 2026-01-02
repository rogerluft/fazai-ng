
import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL;

// Note: It is expected that some collections may have 0 points.
// The purpose of this check is to ensure all collections are created
// and that at least some data has been persisted overall.
const COLLECTIONS = [
  "fazai_personality",
  "fazai_memory",
  "fazai_kb",
  "fazai_learning",
  "fazai_inference",
];

async function verifyQdrant() {
  if (!QDRANT_URL) {
    console.error("❌ QDRANT_URL environment variable is not set.");
    process.exit(1);
  }

  console.log(`Connecting to Qdrant at: ${QDRANT_URL}`);
  const client = new QdrantClient({ url: QDRANT_URL });

  let totalPoints = 0;
  let collectionsFound = 0;

  for (const collectionName of COLLECTIONS) {
    try {
      const collectionInfo = await client.getCollection(collectionName);
      if (collectionInfo) {
        console.log(`✅ Collection '${collectionName}' exists.`);
        const pointsCount = collectionInfo.points_count;
        console.log(`   - Points: ${pointsCount}`);
        totalPoints += pointsCount;
        collectionsFound++;
      }
    } catch (error) {
      if (error.message.includes("Not found")) {
        console.log(`❌ Collection '${collectionName}' does not exist.`);
      } else {
        console.error(`❌ Error checking collection '${collectionName}':`, error.message);
        // Exit immediately on unexpected errors (e.g., connection issues)
        process.exit(1);
      }
    }
  }

  console.log("\n--- Verification Summary ---");
  if (collectionsFound === COLLECTIONS.length && totalPoints > 0) {
    console.log(`✅ Success: Found all ${COLLECTIONS.length} collections with a total of ${totalPoints} points. Persistence is working.`);
  } else {
    console.log(`❌ Failure: Verification failed. Found ${collectionsFound}/${COLLECTIONS.length} collections and ${totalPoints} total points.`);
    process.exit(1);
  }
}

verifyQdrant().catch((error) => {
  console.error("Verification script failed:", error);
  process.exit(1);
});
