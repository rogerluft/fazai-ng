# TacticalBrain - Phi-3 Mini Integration

**Version:** 1.0.0
**Status:** Production Ready
**Module:** `src/services/tactical-brain.ts`

---

## Overview

TacticalBrain é um serviço de inferência rápida usando o modelo Phi-3 Mini da Microsoft. Ele fornece raciocínio tático local com fallback automático para cloud em caso de falhas.

### Características Principais

- **Primary**: Ollama Phi-3 (local, rápido, 4K context)
- **Fallback**: OpenRouter cloud (128K context)
- **Timeout**: 45s por tentativa (configurável)
- **Retry**: 3 tentativas antes do fallback (3-Strike Rule)
- **Streaming**: AsyncGenerator para respostas em tempo real
- **TypeScript**: Full type safety com strict mode

---

## Quick Start

### Installation

```typescript
import { createTacticalBrain } from './services/tactical-brain';

// Create instance with defaults
const brain = createTacticalBrain();
```

### Basic Usage

```typescript
// Streaming response
for await (const chunk of brain.think("What is 2+2?")) {
  process.stdout.write(chunk);
}

// Complete result
const result = await brain.execute("Generate regex for email");
console.log(result.output);
```

---

## API Reference

### `TacticalBrain`

#### Constructor

```typescript
new TacticalBrain(options?: TacticalBrainOptions)
```

**Options:**

```typescript
interface TacticalBrainOptions {
  ollamaBaseUrl?: string;        // Default: from config or 192.168.0.101:11434
  ollamaModel?: string;           // Default: phi3
  openrouterApiKey?: string;      // Default: from config
  openrouterModel?: string;       // Default: microsoft/phi-3-mini-128k-instruct:free
  timeout?: number;               // Default: 45000ms
  maxRetries?: number;            // Default: 3
  verbose?: boolean;              // Default: false
}
```

#### Methods

##### `think(prompt: string, context?: string): AsyncGenerator<string>`

Stream thinking process with Chain-of-Thought.

**Parameters:**
- `prompt`: User question/task
- `context`: Optional context to include

**Returns:** AsyncGenerator yielding text chunks

**Example:**

```typescript
for await (const chunk of brain.think("Explain closures", "JavaScript context")) {
  process.stdout.write(chunk);
}
```

##### `execute(task: string): Promise<TaskResult>`

Execute task and return complete result.

**Parameters:**
- `task`: Task description

**Returns:** `TaskResult` object

```typescript
interface TaskResult {
  success: boolean;
  output: string;
  usedFallback: boolean;
  provider: "ollama" | "openrouter";
  executionTimeMs: number;
  error?: string;
}
```

**Example:**

```typescript
const result = await brain.execute("Fix this TypeScript error");
if (result.success) {
  console.log(result.output);
}
```

##### `resetStrikes(): void`

Reset strike counter to 0.

**Example:**

```typescript
brain.resetStrikes();
console.log(brain.getStrikes()); // 0
```

##### `getStrikes(): number`

Get current strike count.

**Returns:** Number of consecutive failures

**Example:**

```typescript
const strikes = brain.getStrikes();
console.log(`Current strikes: ${strikes}/3`);
```

---

## Factory Function

### `createTacticalBrain(options?: TacticalBrainOptions): TacticalBrain`

Create TacticalBrain instance with automatic configuration.

**Example:**

```typescript
const brain = createTacticalBrain({
  verbose: true,
  timeout: 60000,
});
```

---

## Configuration

### Environment Variables

Configuration is loaded from `/etc/fazai/fazai.conf`:

```bash
# Ollama (primary)
OLLAMA_BASE_URL=http://192.168.0.101:11434
PHI3_MODEL=phi3

# OpenRouter (fallback)
OPENROUTER_API_KEY=your-api-key-here
PHI3_OPENROUTER_MODEL=microsoft/phi-3-mini-128k-instruct:free
```

### Runtime Override

```typescript
const brain = createTacticalBrain({
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "phi3:latest",
  openrouterApiKey: process.env.OPENROUTER_KEY,
  timeout: 30000,
});
```

---

## 3-Strike Rule

TacticalBrain implements a 3-strike rule for automatic fallback:

1. **Strike 1**: First Ollama failure (retry with backoff)
2. **Strike 2**: Second Ollama failure (retry with backoff)
3. **Strike 3**: Third Ollama failure (trigger fallback to cloud)

After 3 strikes, all subsequent requests go directly to OpenRouter until:
- Manual reset: `brain.resetStrikes()`
- Successful local request (resets counter)

### Example

```typescript
// Check strikes before important operations
if (brain.getStrikes() >= 3) {
  console.warn("Using cloud fallback (local unavailable)");
}

// Reset if you know local is back up
brain.resetStrikes();
```

---

## Error Handling

### Timeout

```typescript
const brain = createTacticalBrain({ timeout: 10000 }); // 10s

try {
  const result = await brain.execute("Complex task");
} catch (error) {
  console.error("Timeout or error:", error.message);
}
```

### Network Errors

```typescript
const result = await brain.execute("Task");

if (!result.success) {
  console.error("Error:", result.error);
  console.log("Provider:", result.provider);
  console.log("Used fallback:", result.usedFallback);
}
```

### Retries

TacticalBrain uses exponential backoff via `withRetry`:

```typescript
// Automatic retry logic (internal)
// Attempt 1: immediate
// Attempt 2: ~2s delay
// Attempt 3: ~4s delay
// Attempt 4: ~8s delay (maxRetries=3)
```

---

## Use Cases

### 1. Quick Code Generation

```typescript
const brain = createTacticalBrain();

const result = await brain.execute(`
Create a TypeScript function that validates email addresses.
Include JSDoc and error handling.
`);

console.log(result.output);
```

### 2. Command Generation

```typescript
const task = "Generate bash command to find large files in /var/log";
const result = await brain.execute(task);

console.log("Command:", result.output);
```

### 3. Code Review

```typescript
const context = `
function getUserById(id) {
  return users.find(u => u.id == id); // BUG: == instead of ===
}
`;

const result = await brain.execute("Find bugs in this code", context);
console.log(result.output);
```

### 4. Interactive Chat

```typescript
const brain = createTacticalBrain();

const questions = [
  "What is a closure?",
  "Give me a JavaScript example",
  "How does this relate to scope?",
];

for (const question of questions) {
  console.log(`\nQ: ${question}`);
  console.log("A: ");

  for await (const chunk of brain.think(question)) {
    process.stdout.write(chunk);
  }

  console.log("\n");
}
```

---

## Performance

### Benchmarks

| Operation | Ollama (local) | OpenRouter (cloud) |
|-----------|----------------|-------------------|
| Simple query | ~500ms | ~2000ms |
| Code generation | ~2000ms | ~5000ms |
| Complex task | ~5000ms | ~10000ms |

**Note:** Times vary based on network, model load, and task complexity.

### Optimization Tips

1. **Reuse instances**: Create one `TacticalBrain` and reuse it
2. **Use streaming**: For better UX on long responses
3. **Keep prompts concise**: Phi-3 has 4K context (local)
4. **Monitor strikes**: Check `getStrikes()` before critical operations
5. **Configure timeout**: Adjust based on your use case

---

## Comparison with Other Models

| Model | Context | Speed | Cost | Best For |
|-------|---------|-------|------|----------|
| Phi-3 Mini | 4K | Fast | Free (local) | Quick tasks, code snippets |
| Phi-3 Medium | 128K | Medium | Low (cloud) | Longer context, detailed analysis |
| GPT-4 | 128K | Slow | High | Complex reasoning, accuracy |
| Claude | 200K | Medium | Medium | Long documents, creativity |

**TacticalBrain uses Phi-3 Mini for:**
- Fast local inference
- Low latency responses
- Cost-effective operations
- Privacy (local first)

---

## Troubleshooting

### Ollama Not Responding

```typescript
// Check strikes
console.log("Strikes:", brain.getStrikes());

// If >= 3, using cloud fallback
if (brain.getStrikes() >= 3) {
  // Verify Ollama is running:
  // curl http://192.168.0.101:11434/api/tags

  // If fixed, reset:
  brain.resetStrikes();
}
```

### OpenRouter API Key Missing

```bash
# Add to /etc/fazai/fazai.conf
OPENROUTER_API_KEY=your-key-here
```

### Timeout Too Short

```typescript
// Increase timeout for complex tasks
const brain = createTacticalBrain({
  timeout: 120000, // 2 minutes
});
```

### Model Not Found

```bash
# Pull Phi-3 model on Ollama server
ollama pull phi3

# Or use different model
const brain = createTacticalBrain({
  ollamaModel: "phi3:latest",
});
```

---

## Integration Examples

### With Express.js

```typescript
import express from 'express';
import { createTacticalBrain } from './services/tactical-brain';

const app = express();
const brain = createTacticalBrain();

app.post('/api/ask', async (req, res) => {
  const { question } = req.body;

  const result = await brain.execute(question);

  res.json({
    answer: result.output,
    provider: result.provider,
    time: result.executionTimeMs,
  });
});

app.listen(3000);
```

### With CLI

```typescript
import { createTacticalBrain } from './services/tactical-brain';

async function cli() {
  const brain = createTacticalBrain({ verbose: true });

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  readline.question('Ask: ', async (question: string) => {
    console.log('\nThinking...\n');

    for await (const chunk of brain.think(question)) {
      process.stdout.write(chunk);
    }

    console.log('\n');
    readline.close();
  });
}

cli();
```

### With Discord Bot

```typescript
import { Client } from 'discord.js';
import { createTacticalBrain } from './services/tactical-brain';

const client = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });
const brain = createTacticalBrain();

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!ask ')) {
    const question = message.content.slice(5);

    const result = await brain.execute(question);

    await message.reply(result.output);
  }
});

client.login(process.env.DISCORD_TOKEN);
```

---

## Best Practices

### 1. Instance Management

```typescript
// ✅ Good: Reuse instance
const brain = createTacticalBrain();
for (const task of tasks) {
  await brain.execute(task);
}

// ❌ Bad: Create new instance each time
for (const task of tasks) {
  const brain = createTacticalBrain();
  await brain.execute(task);
}
```

### 2. Error Handling

```typescript
// ✅ Good: Check result.success
const result = await brain.execute(task);
if (result.success) {
  process(result.output);
} else {
  console.error(result.error);
}

// ❌ Bad: Assume success
const result = await brain.execute(task);
process(result.output); // May be empty string
```

### 3. Prompt Engineering

```typescript
// ✅ Good: Clear, specific task
const task = "Generate TypeScript function to validate email. Include types and JSDoc.";

// ❌ Bad: Vague task
const task = "Do something with email";
```

### 4. Context Management

```typescript
// ✅ Good: Provide relevant context
const context = "Current file: user.ts\nFramework: Express.js";
brain.think(task, context);

// ❌ Bad: Too much irrelevant context (wastes tokens)
const context = fs.readFileSync('entire-codebase.txt', 'utf8');
```

---

## Testing

### Unit Tests

See `tests/unit/tactical-brain.test.ts` for comprehensive examples.

```bash
npm test -- tactical-brain.test.ts
```

### Manual Testing

```bash
# Run examples
npx tsx examples/tactical-brain-example.ts
```

---

## Roadmap

- [ ] Multi-turn conversation support
- [ ] Token usage tracking
- [ ] Response caching
- [ ] Multiple model support (Phi-3.5, Gemma, etc.)
- [ ] Streaming to file/database
- [ ] Performance profiling tools

---

## See Also

- [Phi-3 Model Card](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct)
- [Ollama Documentation](https://github.com/ollama/ollama)
- [OpenRouter API](https://openrouter.ai/docs)
- [FazAI AGENTS.md](../AGENTS.md)

---

**Last Updated:** 2025-12-27
**Maintainer:** FazAI Team
