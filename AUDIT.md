# FazAI CLI TypeScript Codebase - Comprehensive Code Audit Report

**Audit Date:** 2025-11-14
**Codebase:** FazAI CLI (19 TypeScript files, ~3514 lines)
**Scope:** Security, performance, error handling, type safety, best practices

---

## CRITICAL Issues (Must Fix - Security/Stability Risk)

### 1. Command Injection Vulnerability via Shell=True
**File:** `/home/user/fazai-ng/src/linux-executor.ts`
**Lines:** 88-92
**Severity:** CRITICAL
**Category:** Security Vulnerability

```typescript
// VULNERABLE CODE
const [cmd, ...args] = command.command.split(' ');
const child = spawn(cmd, args, {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});
```

**Issues:**
- `shell: true` combined with user input enables shell injection attacks
- `.split(' ')` breaks with quoted arguments: `echo "hello world"` becomes two args
- Commands with pipes, redirects, or variables are mishandled
- User-controlled task strings directly passed to spawn

**Risk:** Attacker could inject arbitrary shell commands

**Recommended Fix:**
```typescript
// Use shell: false and proper argument parsing
const args = require('shell-quote').parse(command.command);
const child = spawn(args[0], args.slice(1), {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: false,  // Disable shell
  timeout: 30000  // Add timeout
});

// OR: Use exec with escaping for complex commands
const { execFile } = require('child_process');
execFile('/bin/bash', ['-c', sanitizeCommand(command.command)], ...);
```

**Priority:** CRITICAL - Fix immediately

---

### 2. Plain-Text API Key Storage
**File:** `/home/user/fazai-ng/src/apiKeyUtils-fazai.ts` & `/home/user/fazai-ng/src/config.ts`
**Lines:** 49, 68, 124
**Severity:** CRITICAL
**Category:** Security Vulnerability

```typescript
// INSECURE: API keys stored in plain text
function saveAPIKeyToConfig(provider: string, apiKey: string): void {
  const envVar = getEnvVarName(provider);
  setConfigValue(envVar, apiKey);  // Stored unencrypted
  logger.info(chalk.green(`✅ Chave API salva em ${configFileLabel()}`));
}

// config.ts - Line 95: No encryption, plain text file
fs.writeFileSync(configPath, content.endsWith("\n") ? content : `${content}\n`);
```

**Issues:**
- API keys written to disk in plain text at `~/.config/fazai/fazai.conf`
- File permissions not set (likely world-readable on shared systems)
- Keys exposed in process memory without cleanup
- `process.env` modified with raw key values (environment visible to child processes)

**Risk:** Any user/process on system can steal all configured API keys

**Recommended Fix:**
```typescript
import crypto from 'crypto';
import { keytar } from 'keytar';  // Use system credential store

// Use OS credential storage (macOS Keychain, Windows Credential Manager, Linux Secret Service)
async function saveAPIKeySecurely(provider: string, apiKey: string) {
  try {
    await keytar.setPassword('fazai', provider, apiKey);
  } catch {
    // Fallback: encrypt with user password/system key
    const encrypted = encryptWithSystemKey(apiKey);
    setConfigValue(`${provider}_encrypted`, encrypted);
  }
}

// Encrypt sensitive config values
function encryptWithSystemKey(value: string): string {
  const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, IV);
  return cipher.update(value, 'utf8', 'hex') + cipher.final('hex');
}
```

**Priority:** CRITICAL - Fix immediately

---

### 3. Unvalidated Command Execution Risk Assessment
**File:** `/home/user/fazai-ng/src/types-linux.ts`
**Lines:** 41-67
**Severity:** CRITICAL
**Category:** Security Vulnerability

```typescript
// WEAK: Simple regex-based risk detection can be bypassed
export const CRITICAL_COMMANDS = [
  /^rm\s+(-rf|--force)/,  // rm -rf
  /^dd\s/,                // dd (perigoso)
  // ... more patterns
];

// Can be bypassed with:
// 1. Extra spaces: "rm  -rf" (doesn't match /^rm\s+/)
// 2. Variable expansion: "$DELETE_FLAG" instead of "-rf"
// 3. Command substitution: "rm $(echo -rf)"
// 4. Hex encoding: printf "\x72\x6d -rf" | bash
// 5. Indirection: alias rm="/bin/rm -rf"
```

**Issues:**
- Regex patterns easily bypassed with spaces, variables, or encoding
- No AST parsing or proper shell command analysis
- Risk level assessment ignored by executor (line 70 in linux-executor.ts)
- Safety checks never actually executed

**Risk:** Malicious commands bypass risk assessment

**Recommended Fix:**
```typescript
// Implement proper command validation
class CommandValidator {
  private blacklistPatterns = [
    // Match with word boundaries and variable expansion
    /\brm\s+.*-rf|\brm\s+.*-r\b/,
    /\bdd\b/,
    /\bmkfs\b/,
  ];
  
  validate(command: string): { safe: boolean; reason?: string } {
    // Parse with shell parser, not regex
    const parsed = shellParse(command);
    
    // Check binary name and arguments separately
    const binary = parsed[0];
    
    for (const pattern of this.blacklistPatterns) {
      if (pattern.test(binary)) {
        return { safe: false, reason: `Blocked command: ${binary}` };
      }
    }
    
    // Validate arguments don't contain dangerous patterns
    for (const arg of parsed.slice(1)) {
      if (this.containsDangerousPattern(arg)) {
        return { safe: false, reason: `Dangerous argument: ${arg}` };
      }
    }
    
    return { safe: true };
  }
}
```

**Priority:** CRITICAL - Fix immediately

---

### 4. Shell Command Injection in Context7
**File:** `/home/user/fazai-ng/src/mcp/context7.ts`
**Lines:** 116-139
**Severity:** CRITICAL
**Category:** Security Vulnerability

```typescript
// VULNERABLE: User query directly in shell command
async searchViaCommand(query: string): Promise<Context7Result | null> {
  const escapedQuery = query.replace(/"/g, '\\"');  // Insufficient escaping
  const command = commandTemplate.includes("{query}")
    ? commandTemplate.replace(/\{query\}/g, escapedQuery)
    : `${commandTemplate} "${escapedQuery}"`;  // Shell injection possible
  
  const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024, shell: true });
}
```

**Issues:**
- Only escaping `"` characters is insufficient
- Still vulnerable to: `$()`, `` ` ``, `\`, variable expansion
- `shell: true` enables interpretation of special characters
- No timeout on execAsync

**Risk:** Query containing `$(rm -rf /)` or similar payload executes arbitrary commands

**Recommended Fix:**
```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

async searchViaCommand(query: string): Promise<Context7Result | null> {
  // Parse template and extract format
  const templateArgs = this.parseCommandTemplate(this.options.command);
  
  // Use execFile with array args - no shell interpretation
  const { stdout } = await execFileAsync('/bin/sh', 
    ['-c', templateArgs.base, '--', query],  // Query as separate argument
    { 
      maxBuffer: 1024 * 1024,
      timeout: 5000,  // Add timeout
      shell: false,
      env: { QUERY: query }  // Pass as env var instead
    }
  );
}
```

**Priority:** CRITICAL - Fix immediately

---

### 5. Unencrypted Data Transmission (MCP Server)
**File:** `/home/user/fazai-ng/src/mcp/server.ts`
**Lines:** 29-66
**Severity:** CRITICAL
**Category:** Security Vulnerability

```typescript
// INSECURE: HTTP without auth, no HTTPS
this.server = http.createServer(async (req, res) => {
  if (method !== "POST" || url !== "/context7/search") {
    // No authentication
    // No rate limiting
    // No input validation (body size)
  }
});
```

**Issues:**
- No authentication/authorization
- HTTP transmission (not HTTPS)
- No request body size limits (DoS vulnerability)
- No rate limiting
- No CORS validation
- Accepts any research query from any source

**Risk:** Unauthorized access to research function, DoS attacks, data sniffing

**Recommended Fix:**
```typescript
import https from 'https';
import rateLimit from 'express-rate-limit';

class MCPServer {
  private limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  });
  
  async start() {
    const httpsServer = https.createServer({
      key: fs.readFileSync(this.options.keyPath),
      cert: fs.readFileSync(this.options.certPath),
    }, async (req, res) => {
      // Check auth token
      const token = req.headers.authorization?.split(' ')[1];
      if (!this.validateToken(token)) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
      
      // Limit body size
      if (req.headers['content-length'] && 
          parseInt(req.headers['content-length']) > 1024 * 10) {
        res.writeHead(413);
        res.end();
        return;
      }
      
      // Rate limit
      await this.limiter(req, res, () => { /* ... */ });
    });
  }
}
```

**Priority:** CRITICAL - Fix immediately

---

## HIGH Issues (Should Fix - Significant Risk)

### 6. Missing Timeout on Long-Running Commands
**File:** `/home/user/fazai-ng/src/linux-executor.ts`
**Lines:** 70-155
**Severity:** HIGH
**Category:** Performance/Stability

```typescript
// NO TIMEOUT: Command could hang indefinitely
async executeCommand(command: LinuxCommand): Promise<{ success: boolean; output: string }> {
  const result = await new Promise<{ success: boolean; output: string }>((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    });
    
    child.on('close', (code) => {
      // No timeout - waits forever if command hangs
    });
  });
}
```

**Issues:**
- No timeout on spawn
- No timeout on Promise
- Long-running commands block entire CLI
- Process cleanup on timeout not implemented

**Risk:** User processes hang, DOS via slow commands

**Recommended Fix:**
```typescript
async executeCommand(command: LinuxCommand): Promise<{ success: boolean; output: string }> {
  const COMMAND_TIMEOUT = 60000; // 60 seconds
  
  const result = await Promise.race([
    new Promise<{ success: boolean; output: string }>((resolve) => {
      const child = spawn(cmd, args, {
        timeout: COMMAND_TIMEOUT,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: false
      });
      
      child.on('close', (code) => {
        resolve({ success: code === 0, output });
      });
      
      child.on('error', (error) => {
        resolve({ success: false, output: error.message });
      });
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Command timeout')), COMMAND_TIMEOUT + 1000)
    )
  ]);
  
  return result;
}
```

**Priority:** HIGH

---

### 7. No Input Validation on CLI Arguments
**File:** `/home/user/fazai-ng/src/app.ts`
**Lines:** 428-431, 360-368, 362-368
**Severity:** HIGH
**Category:** Input Validation

```typescript
// NO VALIDATION: Direct user input to AI
const task = directCommand || await input({
  message: "O que você precisa fazer? ",
  validate: (input: string) => input.trim() !== "" || "Tarefa não pode estar vazia",
  // Only checks if empty, not if dangerous
});

// Line 350: Search query directly to research without validation
const query = inputs.slice(1).join(" ");
```

**Issues:**
- Task string not validated for length (could DOS AI API)
- No sanitization of special characters
- Search query not limited in size
- Ask question not limited in length
- No detection of potentially malicious patterns

**Risk:** DOS attacks, prompt injection, memory exhaustion

**Recommended Fix:**
```typescript
function validateUserInput(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input');
  }
  
  const trimmed = input.trim();
  
  if (trimmed.length === 0) {
    throw new Error('Input cannot be empty');
  }
  
  if (trimmed.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength}`);
  }
  
  // Detect potential prompt injection attempts
  const dangerousPatterns = [
    /ignore previous instructions/i,
    /system prompt:/i,
    /assistant:/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      logger.warn(`⚠️  Potential prompt injection detected`);
    }
  }
  
  return trimmed;
}

// Usage:
const task = directCommand || 
  validateUserInput(
    await input({ message: "O que você precisa fazer? " }),
    5000  // Max 5000 chars
  );
```

**Priority:** HIGH

---

### 8. Synchronous System Calls Can Hang Process
**File:** `/home/user/fazai-ng/src/system-info.ts`
**Lines:** 23-81
**Severity:** HIGH
**Category:** Performance/Reliability

```typescript
// BLOCKING CALLS: No timeout, can hang entire process
systemInfo.os = execSync("uname -s", { encoding: "utf8" }).trim();
systemInfo.kernel = execSync("uname -r", { encoding: "utf8" }).trim();
systemInfo.architecture = execSync("uname -m", { encoding: "utf8" }).trim();

// Complex shell pipeline - no timeout
const services = execSync(
  "systemctl list-units --type=service --state=running --no-pager --no-legend | head -10 | awk '{print $1}'",
  { encoding: "utf8" }
).split("\n");
```

**Issues:**
- `execSync` blocks entire Node process
- No timeout parameter
- Long pipeline (systemctl + pipes) could take seconds
- One command hanging blocks all others
- No error recovery - throws if command fails

**Risk:** CLI becomes unresponsive during system info collection

**Recommended Fix:**
```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function collectSystemInfo(): Promise<string> {
  const systemInfo: Partial<SystemInfo> = {};
  const TIMEOUT = 5000; // 5 seconds per command
  
  try {
    // Parallel execution with timeouts
    const [os, kernel, arch] = await Promise.all([
      execFileAsync('uname', ['-s'], { timeout: TIMEOUT })
        .then(r => r.stdout.trim())
        .catch(() => 'Unknown'),
      execFileAsync('uname', ['-r'], { timeout: TIMEOUT })
        .then(r => r.stdout.trim())
        .catch(() => 'Unknown'),
      execFileAsync('uname', ['-m'], { timeout: TIMEOUT })
        .then(r => r.stdout.trim())
        .catch(() => 'Unknown'),
    ]);
    
    systemInfo.os = os;
    systemInfo.kernel = kernel;
    systemInfo.architecture = arch;
  } catch (error) {
    logger.warn("Error collecting system info:", error);
  }
  
  return formatSystemInfo(systemInfo);
}
```

**Priority:** HIGH

---

### 9. No Error Handling in Async Generators
**File:** `/home/user/fazai-ng/src/askAI.ts`
**Lines:** 7-80
**Severity:** HIGH
**Category:** Error Handling

```typescript
// NO ERROR HANDLING: Unhandled promise rejections possible
export async function* askAI(
  fileContent: string,
  question: string,
  model: string,
  provider: string,
  isGeneralQuestion: boolean = false
): AsyncGenerator<string, void, undefined> {
  const stream = await anthropic.messages.create({  // Could throw - not caught
    // ...
  });
  
  for await (const chunk of stream) {  // Stream errors not handled
    yield chunk.delta.text;  // Could throw if delta is undefined
  }
}
```

**Issues:**
- API call errors not caught
- Stream iteration errors not caught
- Chunk structure not validated (delta?.text could be undefined)
- Generator throws to consumer without notice
- No retry logic for transient failures

**Risk:** Unhandled promise rejections, application crashes

**Recommended Fix:**
```typescript
export async function* askAI(
  fileContent: string,
  question: string,
  model: string,
  provider: string,
  isGeneralQuestion: boolean = false
): AsyncGenerator<string, void, undefined> {
  try {
    const stream = await anthropic.messages.create({
      // ...
    }).catch(error => {
      throw new Error(`API error: ${error.message}`);
    });
    
    for await (const chunk of stream) {
      try {
        if (chunk.type === "content_block_delta" && 
            chunk.delta?.type === "text_delta" && 
            typeof chunk.delta.text === 'string') {
          yield chunk.delta.text;
        }
      } catch (error) {
        logger.error("Error processing chunk:", error);
        // Don't yield, continue to next chunk
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get AI response: ${message}`);
    yield `\n❌ Error: ${message}`;
  }
}
```

**Priority:** HIGH

---

### 10. Memory Leak: File Streams Not Properly Cleaned
**File:** `/home/user/fazai-ng/src/logger.ts`
**Lines:** 44-79, 142-147
**Severity:** HIGH
**Category:** Resource Management

```typescript
// MEMORY LEAK: Streams not closed on exit
let logStream: fs.WriteStream | null = null;

function ensureStream(targetPath: string): void {
  if (logFilePath === targetPath && logStream) {
    return;  // Reuses stream, fine
  }
  
  closeStream();  // Closes previous stream
  
  try {
    logStream = fs.createWriteStream(targetPath, { flags: "a" });
    // Stream error handler exists but doesn't cleanup properly
  }
}

// initLogger() called at module import - stream never cleaned up
initLogger();
```

**Issues:**
- logStream never closed on process exit
- Log file may not flush on exit
- Stream kept open for lifetime of process
- Error handler doesn't fully cleanup
- No graceful shutdown hook

**Risk:** Log data loss, file descriptor exhaustion

**Recommended Fix:**
```typescript
// Add process exit handlers
function setupExitHandlers() {
  const cleanup = () => {
    if (logStream) {
      logStream.end(() => {
        process.exit(0);
      });
      // Timeout to force exit if stream hangs
      setTimeout(() => process.exit(0), 1000);
    }
  };
  
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

export function initLogger(options: LoggerInitOptions = {}): void {
  // ... existing code ...
  setupExitHandlers();
  
  ensureStream(logPathCandidate);
  
  if (!logStream) {
    ensureStream(fallbackLogPath);
  }
}
```

**Priority:** HIGH

---

### 11. Hardcoded Credentials in Vector Store
**File:** `/home/user/fazai-ng/src/vector-store.ts`
**Lines:** 417-420
**Severity:** HIGH
**Category:** Security/Configuration

```typescript
// HARDCODED DEFAULTS: Security risk
const username = options.milvusUsername ?? 
  process.env.MILVUS_USERNAME ?? 
  getConfigValue("MILVUS_USERNAME") ?? 
  "root";  // Hardcoded default username
  
const password = options.milvusPassword ?? 
  process.env.MILVUS_PASSWORD ?? 
  getConfigValue("MILVUS_PASSWORD") ?? 
  "Milvus";  // Hardcoded default password!
```

**Issues:**
- Default username/password "root"/"Milvus" is Milvus default
- Will allow unauthenticated access if user doesn't override
- Credentials used for database authentication
- Password visible in code

**Risk:** Unauthorized database access if defaults used

**Recommended Fix:**
```typescript
function resolveMilvusCredentials(options: MilvusValidationContext) {
  const username = options.milvusUsername ?? 
    process.env.MILVUS_USERNAME ?? 
    getConfigValue("MILVUS_USERNAME");
    
  const password = options.milvusPassword ?? 
    process.env.MILVUS_PASSWORD ?? 
    getConfigValue("MILVUS_PASSWORD");
  
  // Don't use hardcoded defaults - require explicit config
  if (!username || !password) {
    throw new Error(
      'Milvus credentials required. Set MILVUS_USERNAME and MILVUS_PASSWORD.'
    );
  }
  
  return { username, password };
}
```

**Priority:** HIGH

---

### 12. No Validation of API Responses
**File:** `/home/user/fazai-ng/src/linux-admin.ts`
**Lines:** 73-125
**Severity:** HIGH
**Category:** Error Handling

```typescript
// NO RESPONSE VALIDATION: AI response could be malformed
let collectedCommands: LinuxCommand[] = [];

oboe(jsonStream)
  .node("!.*", (command: any) => {
    try {
      const validatedCommand = LinuxCommandSchema.parse(command);
      collectedCommands.push(validatedCommand);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn("⚠️  Comando Linux inválido encontrado:", error.issues);
        // Invalid command silently dropped - no fallback
      }
    }
  })
  .on("fail", (error: any) => {
    logger.error("❌ Erro ao fazer parse dos comandos:", error);
    reject(error);
  });

// If all commands are invalid, collectedCommands is empty
// No indication to user that no valid commands were generated
```

**Issues:**
- Invalid commands silently dropped
- No warning if ALL commands invalid
- fullJSON variable collected but never used
- No fallback if parsing completely fails
- Parser errors could mask real issues

**Risk:** Users execute with empty command list, no action taken

**Recommended Fix:**
```typescript
async function* getLinuxCommandsFromClaude(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  // ... setup code ...
  
  let collectedCommands: LinuxCommand[] = [];
  let invalidCount = 0;
  let fullJSON = jsonStart;
  
  const parsePromise = new Promise<void>((resolve, reject) => {
    oboe(jsonStream)
      .node("!.*", (command: any) => {
        try {
          const validatedCommand = LinuxCommandSchema.parse(command);
          collectedCommands.push(validatedCommand);
        } catch (error) {
          invalidCount++;
          logger.debug(`Invalid command ${invalidCount}:`, error);
        }
      })
      .on("done", () => {
        if (collectedCommands.length === 0 && invalidCount > 0) {
          reject(new Error(`No valid commands found (${invalidCount} invalid)`));
        } else {
          resolve();
        }
      })
      .on("fail", reject);
  });
  
  try {
    await parsePromise;
  } catch (error) {
    logger.error("Failed to parse commands:", error);
    yield { 
      type: "error", 
      error: `Command generation failed: ${error instanceof Error ? error.message : String(error)}`
    };
    return;
  }
  
  if (collectedCommands.length === 0) {
    yield {
      type: "error",
      error: "No commands were generated. Please refine your request."
    };
    return;
  }
  
  // Yield commands...
}
```

**Priority:** HIGH

---

## MEDIUM Issues (Nice to Fix)

### 13. Code Duplication: Identical Provider Logic
**Files:** `/home/user/fazai-ng/src/linux-admin.ts` (lines 27-125), `/home/user/fazai-ng/src/askAI.ts` (lines 16-79)
**Severity:** MEDIUM
**Category:** Code Quality

```typescript
// DUPLICATED: Same logic for OpenAI/Ollama in both files
// linux-admin.ts getLinuxCommandsFromOpenAI (127-215)
// askAI.ts provider === "openai" (38-55)

// Common pattern:
const stream = await openai.chat.completions.create({
  model,
  messages: [...],
  stream: true,
  temperature: 0,
});

for await (const chunk of stream) {
  const token = chunk.choices[0]?.delta?.content || "";
  if (token) {
    // Process token
  }
}
```

**Issues:**
- Same OpenAI stream handling in 3 places
- Same Ollama stream handling in 3 places
- Changes to one must be applied to all
- Increases maintenance burden

**Recommended Fix:**
```typescript
// Create shared abstraction
async function* streamFromOpenAI(options: {
  model: string;
  messages: any[];
  systemMessage?: string;
}): AsyncGenerator<string> {
  const openai = new OpenAI();
  const stream = await openai.chat.completions.create({
    model: options.model,
    messages: options.systemMessage 
      ? [{ role: "system", content: options.systemMessage }, ...options.messages]
      : options.messages,
    stream: true,
    temperature: 0,
  });
  
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || "";
    if (token) yield token;
  }
}

// Reuse in askAI.ts and linux-admin.ts
if (provider === "openai") {
  yield* streamFromOpenAI({
    model,
    messages: [{ role: "user", content: prompt }],
    systemMessage,
  });
}
```

**Priority:** MEDIUM

---

### 14. No Retry Logic for Transient API Failures
**Files:** `/home/user/fazai-ng/src/askAI.ts`, `/home/user/fazai-ng/src/linux-admin.ts`
**Severity:** MEDIUM
**Category:** Reliability

```typescript
// NO RETRY: API call fails once - no recovery
const stream = await anthropic.messages.create({
  messages,
  model,
  max_tokens: tokens,
  stream: true,
  temperature: 0,
  system: systemMessage,
});
```

**Issues:**
- Network glitches cause immediate failure
- No exponential backoff
- No jitter between retries
- No circuit breaker pattern
- Affects both AI providers (Claude, OpenAI, Ollama)

**Recommended Fix:**
```typescript
async function callAIWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      logger.debug(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage:
const stream = await callAIWithRetry(() =>
  anthropic.messages.create({...})
);
```

**Priority:** MEDIUM

---

### 15. Weak Type Safety: Excessive Use of `any`
**Files:** `/home/user/fazai-ng/src/vector-store.ts` (lines 427-429), `/home/user/fazai-ng/src/mcp/context7.ts` (lines 141-202)
**Severity:** MEDIUM
**Category:** Type Safety

```typescript
// WEAK TYPING
let milvusClient: any;
let DataType: any;
let MetricType: any;

const milvusModule = await import("@zilliz/milvus2-sdk-node");
milvusClient = new milvusModule.MilvusClient({ ... });

// No type checking - errors only at runtime
const has = await milvusClient.hasCollection({ collection_name: schema.name });

// In context7.ts
private normalizeResults(payload: any): Context7Finding[] {
  if (Array.isArray(payload?.results)) { ... }
  if (Array.isArray(payload)) { ... }
}
```

**Issues:**
- Dynamic import loses type information
- Runtime errors instead of compile-time
- IDE cannot provide autocomplete
- Refactoring harder without type info

**Recommended Fix:**
```typescript
// Create type definitions
interface MilvusClient {
  hasCollection(options: { collection_name: string }): Promise<{ value: boolean }>;
  dropCollection(options: { collection_name: string }): Promise<void>;
  createCollection(options: { collection_name: string; fields: any[] }): Promise<void>;
  // ... other methods
}

interface MilvusModule {
  MilvusClient: new (options: any) => MilvusClient;
  DataType: Record<string, number>;
  MetricType: Record<string, string>;
}

// Import with type assertion
const milvusModule = await import("@zilliz/milvus2-sdk-node") as unknown as MilvusModule;
const milvusClient: MilvusClient = new milvusModule.MilvusClient({ ... });
```

**Priority:** MEDIUM

---

### 16. Missing Null/Undefined Checks
**File:** `/home/user/fazai-ng/src/system-info.ts`
**Lines:** 108-133
**Severity:** MEDIUM
**Category:** Error Handling

```typescript
// NO CHECKS: Could return undefined
function detectDistribution(): string {
  try {
    const commandPath = findExecutable([...]);
    if (commandPath) {
      const result = spawnSync(commandPath, ["-d", "-s"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      const output = result.stdout?.trim();  // stdout could be null
      if (result.status === 0 && output) {
        return output;
      }
    }
  } catch {
    // Ignores and moves to next method
  }
  
  try {
    const contents = fs.readFileSync("/etc/os-release", "utf8");
    for (const line of contents.split("\n")) {
      if (line.startsWith("PRETTY_NAME=")) {
        return line.split("=")[1]?.replace(/^"+|"+$/g, "").trim() || "Unknown";  // Could be empty string
      }
    }
  } catch {
    // Falls through
  }
  
  return "Unknown";  // Fine fallback, but above code could fail silently
}
```

**Issues:**
- spawnSync result.stdout could be null
- split("=") could result in empty array element
- No validation of file format

**Recommended Fix:**
```typescript
function detectDistribution(): string {
  // Try lsb_release first
  const lsbRelease = tryLsbRelease();
  if (lsbRelease) return lsbRelease;
  
  // Try /etc/os-release
  const osRelease = tryOsRelease();
  if (osRelease) return osRelease;
  
  // Final fallback
  return "Unknown";
}

function tryLsbRelease(): string | null {
  try {
    const commandPath = findExecutable([...]);
    if (!commandPath) return null;
    
    const result = spawnSync(commandPath, ["-d", "-s"], { 
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5000 
    });
    
    if (result.status === 0 && result.stdout) {
      return result.stdout.trim();
    }
  } catch (error) {
    logger.debug("lsb_release failed:", error);
  }
  return null;
}

function tryOsRelease(): string | null {
  try {
    const contents = fs.readFileSync("/etc/os-release", "utf8");
    const prettyNameLine = contents.split("\n").find(line => 
      line.startsWith("PRETTY_NAME=")
    );
    
    if (!prettyNameLine) return null;
    
    const parts = prettyNameLine.split("=");
    if (parts.length < 2) return null;
    
    const value = parts.slice(1).join("=").trim();
    const cleaned = value.replace(/^"+|"+$/g, "").trim();
    
    return cleaned || null;
  } catch (error) {
    logger.debug("os-release read failed:", error);
  }
  return null;
}
```

**Priority:** MEDIUM

---

### 17. Configuration File Permissions Not Set
**File:** `/home/user/fazai-ng/src/config.ts`
**Lines:** 88-96
**Severity:** MEDIUM
**Category:** Security

```typescript
// NO PERMISSION CONTROL: File may be world-readable
function writeConfigLines(lines: string[]): void {
  const configPath = resolveConfigPath();
  const content = lines.join("\n").replace(/\n+$/g, "\n");
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });  // Default permissions
  }
  fs.writeFileSync(configPath, content.endsWith("\n") ? content : `${content}\n`, { encoding: "utf-8" });
  // No chmod(600) on file!
}
```

**Issues:**
- Config file created with default umask (often 644)
- API keys readable by all users on shared systems
- Directory permissions not controlled

**Risk:** Privilege escalation on shared systems

**Recommended Fix:**
```typescript
function writeConfigLines(lines: string[]): void {
  const configPath = resolveConfigPath();
  const content = lines.join("\n").replace(/\n+$/g, "\n");
  const configDir = path.dirname(configPath);
  
  if (!fs.existsSync(configDir)) {
    // Create directory with restricted permissions (owner only)
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
  
  // Write file with restricted permissions (owner only)
  fs.writeFileSync(
    configPath,
    content.endsWith("\n") ? content : `${content}\n`,
    { encoding: "utf-8", mode: 0o600 }
  );
  
  // Ensure correct permissions even if file already exists
  fs.chmodSync(configPath, 0o600);
}
```

**Priority:** MEDIUM

---

### 18. Race Condition in HTTP Server
**File:** `/home/user/fazai-ng/src/mcp/server.ts`
**Lines:** 68-74, 82
**Severity:** MEDIUM
**Category:** Concurrency

```typescript
// POTENTIAL RACE: server! with assertion
async start(): Promise<void> {
  if (this.server) {
    return;  // Race condition here?
  }
  
  this.server = http.createServer(async (req, res) => { ... });
  
  await new Promise<void>((resolve) => {
    this.server!.listen(this.options.port, this.options.host, () => {  // Non-null assertion
      logger.info(chalk.green(`...`));
      resolve();
    });
  });
}

async stop(): Promise<void> {
  if (!this.server) {
    return;
  }
  
  await new Promise<void>((resolve) => {
    this.server!.close(() => resolve());  // Non-null assertion
  });
}
```

**Issues:**
- Non-null assertions (!) indicate potential null dereference
- Race condition if start/stop called concurrently
- No error handling for listen failures

**Recommended Fix:**
```typescript
private serverStarting = false;

async start(): Promise<void> {
  if (this.server || this.serverStarting) {
    return;  // Already started or starting
  }
  
  this.serverStarting = true;
  
  try {
    this.server = http.createServer(async (req, res) => { ... });
    
    await new Promise<void>((resolve, reject) => {
      const server = this.server;
      if (!server) {
        reject(new Error('Server not initialized'));
        return;
      }
      
      server.listen(this.options.port, this.options.host, () => {
        logger.info(chalk.green(`...`));
        resolve();
      });
      
      server.on('error', reject);
    });
  } finally {
    this.serverStarting = false;
  }
}
```

**Priority:** MEDIUM

---

### 19. Unbounded Memory Growth in CLI Mode
**File:** `/home/user/fazai-ng/src/cli-mode.ts`
**Lines:** 29, 75-80, 172-177
**Severity:** MEDIUM
**Category:** Memory Management

```typescript
// UNBOUNDED: History grows without limit during session
const trimmedHistory = history.slice(-10);  // OK

// But in readline:
const historyBuffer: string[] = loadCommandHistory();
if (historyBuffer.length) {
  rl.history = [...historyBuffer].reverse();  // All history loaded
}

// During session:
rl.on("line", async (input) => {
  // ...
  if (line.length > 0) {
    historyBuffer.push(line);  // Grows without limit
    appendCommandHistory(line);
  }
});
```

**Issues:**
- historyBuffer grows unbounded during session
- readline.history could grow very large
- Memory not released until process exit
- Long sessions could exhaust memory

**Recommended Fix:**
```typescript
const MAX_SESSION_HISTORY = 1000;

rl.on("line", async (input) => {
  const line = input.trim();
  if (line.length > 0) {
    historyBuffer.push(line);
    
    // Trim in-memory history
    if (historyBuffer.length > MAX_SESSION_HISTORY) {
      historyBuffer.shift();
    }
    
    appendCommandHistory(line);
  }
  // ...
});
```

**Priority:** MEDIUM

---

## LOW Issues (Informational)

### 20. Hardcoded Directory Paths
**File:** `/home/user/fazai-ng/src/logger.ts`
**Line:** 138
**Severity:** LOW
**Category:** Configuration

```typescript
// HARDCODED: /var/log path not accessible to regular users
const defaultLogPath = "/var/log/fazai/fazai.log";
```

**Issue:** Regular users don't have write permission to /var/log

**Fix:** Use platform-aware logging directory
```typescript
import os from 'os';
import path from 'path';

const defaultLogPath = path.join(
  process.env.FAZAI_LOG_DIR || 
  (process.platform === 'win32' 
    ? path.join(os.homedir(), 'AppData', 'Local', 'fazai')
    : path.join(os.homedir(), '.local', 'share', 'fazai')),
  'fazai.log'
);
```

**Priority:** LOW

---

### 21. Inconsistent Error Logging
**Files:** Multiple files
**Severity:** LOW
**Category:** Debugging

```typescript
// INCONSISTENT: Different error logging patterns
logger.warn("⚠️  ...", error);  // Logs with prefix
logger.error(`❌ Erro: ${error}`);  // Logs inline
logger.warn(chalk.yellow(`⚠️  ...`));  // Pre-colored

// Should use consistent format:
logger.error('Context', error);  // Always structured
```

**Priority:** LOW

---

### 22. Unused Configuration Variables
**File:** `/home/user/fazai-ng/src/app.ts`
**Lines:** 244-245
**Severity:** LOW
**Category:** Code Quality

```typescript
// REDUNDANT: verboseFlag set but never used
const debugFlag = rawArgs.includes("--debug") || rawArgs.includes("--verbose");
const verboseFlag = rawArgs.includes("--verbose");  // Never used

// debugFlag already covers it
initLogger({
  levelOverride: debugFlag || verboseFlag ? "debug" : undefined,  // Could just use debugFlag
});
```

**Priority:** LOW

---

### 23. Missing JSDoc Comments
**File:** All files
**Severity:** LOW
**Category:** Documentation

```typescript
// NO DOCS: Public functions lack documentation
export async function* askAI(
  fileContent: string,
  question: string,
  model: string,
  provider: string,
  isGeneralQuestion: boolean = false
): AsyncGenerator<string, void, undefined> {
  // What does this do? What are the parameters?
}
```

**Fix:** Add JSDoc to public APIs
```typescript
/**
 * Streams AI responses based on a question or code context
 * @param fileContent - Code content to analyze (empty for general questions)
 * @param question - User's question
 * @param model - Model name (e.g., 'claude-3-5-sonnet-latest')
 * @param provider - AI provider ('anthropic' | 'openai' | 'ollama')
 * @param isGeneralQuestion - If true, question is general, not code-specific
 * @yields String chunks of the AI response
 */
export async function* askAI(...)
```

**Priority:** LOW

---

### 24. String Replacement Could Use Template Literals
**File:** `/home/user/fazai-ng/src/mcp/context7.ts`
**Lines:** 124-125
**Severity:** LOW
**Category:** Code Style

```typescript
// VERBOSE: String manipulation instead of templates
const command = commandTemplate.includes("{query}")
  ? commandTemplate.replace(/\{query\}/g, escapedQuery)
  : `${commandTemplate} "${escapedQuery}"`;

// Could be clearer:
const queryPlaceholder = "{query}";
const command = commandTemplate.includes(queryPlaceholder)
  ? commandTemplate.split(queryPlaceholder).join(escapedQuery)
  : `${commandTemplate} "${escapedQuery}"`;
```

**Priority:** LOW

---

## Summary Table

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 5     | Require immediate action |
| HIGH     | 8     | Should fix soon |
| MEDIUM   | 7     | Nice to fix |
| LOW      | 4     | Informational |
| **TOTAL** | **24** | — |

---

## Recommendations by Priority

### Phase 1: Critical Fixes (Do Immediately)
1. Fix command injection (spawn shell=true, split issues)
2. Encrypt API keys in storage
3. Validate commands with proper parsing
4. Fix Context7 shell injection
5. Add HTTPS and auth to MCP server

**Estimated Effort:** 4-6 hours

### Phase 2: High Priority Fixes (Next Sprint)
6. Add timeouts to command execution
7. Add input validation
8. Replace execSync with async calls
9. Add error handling to async generators
10. Fix stream cleanup and resource management
11. Remove hardcoded Milvus credentials
12. Add response validation

**Estimated Effort:** 6-8 hours

### Phase 3: Medium Priority (Refactor)
13. Extract shared provider logic
14. Add retry logic for API calls
15. Add proper TypeScript types
16. Fix null/undefined checks
17. Set file permissions on config
18. Fix race conditions
19. Limit memory growth

**Estimated Effort:** 8-12 hours

### Phase 4: Low Priority (Polish)
20. Use platform-aware paths
21. Consistent logging format
22. Remove unused variables
23. Add JSDoc comments
24. Clean up string operations

**Estimated Effort:** 2-3 hours

---

## Testing Recommendations

1. **Fuzzing:** Test with malicious/unusual command inputs
2. **Security:** Scan config files for exposed keys
3. **Integration:** Test with actual AI APIs
4. **Load:** Test with large command sequences
5. **Cleanup:** Verify streams/processes are properly closed

---

## Additional Notes

- Consider adding a security policy document
- Implement OWASP security practices
- Use npm audit regularly
- Add pre-commit hooks for eslint/prettier
- Consider using a secrets management library
- Implement input sanitization library consistently

