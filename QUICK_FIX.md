# FazAI Memory Persistence - Quick Fix Guide

**Problem**: Model cannot recall memories because Qdrant collections are EMPTY.

**Verified**:
```bash
curl -s http://localhost:6333/collections
# ✅ Collections exist: fazai_personality, fazai_memory, etc.

curl -s -X POST http://localhost:6333/collections/fazai_personality/points/scroll \
  -H "Content-Type: application/json" -d '{"limit": 10}'
# ❌ "points": [] - EMPTY!
```

---

## Root Cause (Updated)

**TWO PROBLEMS**:

1. ✅ **Collections are empty** - No personality data has been imported
2. ✅ **Integration layer missing** - Even if data existed, CLI wouldn't load it

**Priority**: Fix BOTH issues.

---

## Quick Fix: Phase 0 - Import Personality Data

**BEFORE** implementing the integration layer, you need to populate the collections.

### Option 1: Import from Claude Desktop Conversations

The `import-personality.ts` script exists but may not have been run:

```bash
cd /home/rluft/fazai-ng

# Check if you have Claude Desktop conversations.json
ls -lh ~/Library/Application\ Support/Claude/conversations.json

# If exists, import:
npx tsx scripts/import-personality.ts ~/Library/Application\ Support/Claude/conversations.json
```

**Expected Output**:
```
🧠 Importing personality from conversations.json...
✅ Extracted 13 personality traits
✅ Generated embeddings (768-dim via Ollama)
✅ Stored in fazai_personality collection
```

### Option 2: Manually Create Personality Traits

If you don't have Claude Desktop conversations, create personality manually:

```bash
cd /home/rluft/fazai-ng
npx tsx -e "
import { getQdrantClient } from './src/database/qdrant-pool.js';
import { createEmbeddingService } from './src/services/embeddings.js';

async function createPersonality() {
  const client = await getQdrantClient();
  const embeddingService = await createEmbeddingService();

  const traits = [
    {
      trait_name: 'Linux Expertise',
      category: 'expertise',
      value: 'Expert',
      intensity: 0.9,
      context: 'Specializes in Linux system administration',
      tags: ['linux', 'administration', 'troubleshooting']
    },
    {
      trait_name: 'Methodical Approach',
      category: 'style',
      value: 'High',
      intensity: 0.85,
      context: 'Prefers systematic, step-by-step solutions',
      tags: ['methodical', 'systematic']
    },
    {
      trait_name: 'Practical Focus',
      category: 'style',
      value: 'High',
      intensity: 0.88,
      context: 'Prefers tested, production-ready solutions over experimental ones',
      tags: ['practical', 'production']
    },
    {
      trait_name: 'Security-Conscious',
      category: 'expertise',
      value: 'High',
      intensity: 0.82,
      context: 'Always considers security implications',
      tags: ['security', 'best-practices']
    }
  ];

  for (let i = 0; i < traits.length; i++) {
    const trait = traits[i];
    const text = \`\${trait.trait_name}: \${trait.value}. \${trait.context}\`;
    const embedding = await embeddingService.generate(text);

    await client.upsert('fazai_personality', {
      points: [
        {
          id: i + 1,
          vector: embedding,
          payload: trait
        }
      ]
    });

    console.log(\`✅ Created: \${trait.trait_name}\`);
  }

  console.log(\`\n✅ Created \${traits.length} personality traits\`);
}

createPersonality().catch(console.error);
"
```

**Verify**:
```bash
curl -s -X POST http://localhost:6333/collections/fazai_personality/points/scroll \
  -H "Content-Type: application/json" -d '{"limit": 10, "with_payload": true}' \
  | python3 -m json.tool

# Should show traits now!
```

### Option 3: Use Web API

If web server is running:

```bash
curl -X POST http://localhost:3000/api/personality/traits \
  -H "Content-Type: application/json" \
  -d '{
    "trait_name": "Linux Expertise",
    "category": "expertise",
    "value": "Expert",
    "intensity": 0.9,
    "context": "Specializes in Linux system administration",
    "tags": ["linux", "administration"]
  }'
```

Repeat for each trait you want to add.

---

## Quick Fix: Phase 1 - Minimal Integration (2-3 hours)

After populating personality data, implement the integration layer.

### File 1: Create personality-loader.ts

Copy from **IMPLEMENTATION_GUIDE.md** - Step 1 (200 lines)

### File 2: Modify cli-mode.ts

Add these lines in `runCliMode()` function (around line 246):

```typescript
// ✅ ADD THESE IMPORTS AT TOP:
import { loadPersonalityFromQdrant, buildPersonalitySystemPrompt } from "./services/personality-loader";

// ✅ ADD AFTER API KEY CHECK (line 260):
logger.info(chalk.cyan("🧠 Loading personality from Qdrant..."));
const personality = await loadPersonalityFromQdrant();
const personalityPrompt = buildPersonalitySystemPrompt(personality);
logger.info(chalk.green(`✅ Personality loaded: ${personality.traits.length} traits`));
```

### File 3: Modify askAI.ts

Add personality to system prompts (see IMPLEMENTATION_GUIDE.md - Step 4 for full code).

Quick version:

```typescript
// ✅ ADD IMPORT:
import { loadPersonalityFromQdrant, buildPersonalitySystemPrompt } from "./services/personality-loader";

// ✅ MODIFY SYSTEM MESSAGE (line 44):
const personality = await loadPersonalityFromQdrant();
const personalityContext = buildPersonalitySystemPrompt(personality);

const systemMessage = isGeneralQuestion
  ? `${personalityContext}\n\nYou are an intelligent and well-informed assistant.`
  : `CODE:\n${fileContent}\n`;
```

---

## Testing

### Test 1: Verify Qdrant Has Data

```bash
curl -s -X POST http://localhost:6333/collections/fazai_personality/points/scroll \
  -H "Content-Type: application/json" -d '{"limit": 10, "with_payload": true}' \
  | python3 -m json.tool | grep -A 5 "trait_name"

# Should show traits like "Linux Expertise", etc.
```

### Test 2: Verify CLI Loads Personality

```bash
cd /home/rluft/fazai-ng
npm run build
fazai --cli

# Expected output:
# 🧠 Loading personality from Qdrant...
# ✅ Personality loaded: 4 traits (or however many you created)
```

### Test 3: Verify Personality in Responses

```bash
fazai --cli
> What are your expertise areas?

# Expected: Should mention "Linux", "system administration", etc.
```

---

## Troubleshooting

### Problem: "No personality traits found in Qdrant"

**Solution**: Collections are still empty. Run Phase 0 first.

### Problem: "Failed to load personality from Qdrant: ECONNREFUSED"

**Solution**: Qdrant is not running.

```bash
# Check Qdrant status
curl http://localhost:6333/health

# If fails, start Qdrant:
docker start qdrant  # or systemctl start qdrant
```

### Problem: "Embedding service failed"

**Solution**: Ollama is not running or model not pulled.

```bash
# Check Ollama
curl http://192.168.0.101:11434/api/version

# Pull embedding model
ollama pull nomic-embed-text
```

### Problem: TypeScript errors after adding imports

**Solution**: Rebuild the project.

```bash
cd /home/rluft/fazai-ng
rm -rf dist
npm run build
```

---

## Quick Verification Script

Save this as `test-personality.sh`:

```bash
#!/bin/bash

echo "=== FazAI Personality Test ==="
echo ""

# 1. Check Qdrant
echo "1. Checking Qdrant..."
curl -s http://localhost:6333/health | python3 -m json.tool
echo ""

# 2. Check collections
echo "2. Checking collections..."
curl -s http://localhost:6333/collections | python3 -m json.tool | grep -A 20 "collections"
echo ""

# 3. Check personality points
echo "3. Checking personality points..."
POINTS=$(curl -s -X POST http://localhost:6333/collections/fazai_personality/points/scroll \
  -H "Content-Type: application/json" -d '{"limit": 10}' \
  | python3 -m json.tool | grep -c "trait_name")

echo "Found $POINTS personality traits"
echo ""

if [ "$POINTS" -eq 0 ]; then
  echo "❌ FAIL: No personality traits found"
  echo "   Run: npx tsx scripts/import-personality.ts <conversations.json>"
else
  echo "✅ PASS: Personality data exists"
fi

# 4. Check embedding service
echo ""
echo "4. Checking Ollama (embedding service)..."
curl -s http://192.168.0.101:11434/api/version | python3 -m json.tool
echo ""

echo "=== Test Complete ==="
```

Run it:
```bash
chmod +x test-personality.sh
./test-personality.sh
```

---

## Next Steps

1. ✅ Run Phase 0 to populate personality data
2. ✅ Verify data exists with test script
3. ✅ Implement Phase 1 integration (personality-loader + cli-mode + askAI)
4. ✅ Test with `fazai --cli`
5. ✅ If works, proceed to Phase 2 (memory storage)

**Estimated Time**:
- Phase 0 (data import): 30 minutes
- Phase 1 (integration): 2-3 hours
- Testing: 30 minutes

**Total**: 3-4 hours for basic working personality system.

---

**References**:
- Full implementation: `IMPLEMENTATION_GUIDE.md`
- Architecture: `MEMORY_ARCHITECTURE.md`
- Diagnosis: `MEMORY_PERSISTENCE_DIAGNOSIS.md`
