# Repository Guidelines

## Project Structure & Module Organization
FazAI is a TypeScript CLI that translates natural-language requests into guarded Linux commands. Core sources live in `src/` (`app.ts` orchestrates the CLI, `linux-admin.ts` wraps model calls, `linux-executor.ts` executes confirmed commands, `cli-mode.ts` implementa o modo chat/terminal com memória persistente, `memory.ts` gerencia armazenamento, `research.ts` coordena pesquisas MCP/web). MCP helpers live under `src/mcp/` (`client.ts`, `context7.ts`, `server.ts`). Bundled output lands in `dist/` via `tsup`, and the published binary loads from `dist/app.cjs`. Integration harnesses and fixtures stay in `tests/`; keep AI prompt samples beside their spec (e.g., `tests/call-ai.test.ts`). Configuration templates live in `fazai.conf.example`; store real keys in `fazai.conf` and keep it out of version control. Older experiments rest in `archive/`.

## Build, Test, and Development Commands
- `npm install` installs production and development dependencies for Node ≥18.17.
- `npm run dev` launches the CLI through `tsx`, ideal for iterative development with TypeScript source.
- `npm run build` invokes `tsup` to emit CommonJS bundles and type declarations into `dist/`.
- `npm start` executes the built binary (`node dist/app.cjs`) mirroring the global `fazai` entrypoint.
- `npx tsx tests/call-ai.test.ts` runs the current streaming integration check; add any required sample prompt files under `tests/` before executing.

## Coding Style & Naming Conventions
The project targets strict TypeScript with CommonJS output; keep new code compatible with the ESM-style imports used across `src/`. Prefer two-space indentation, stick to `const` unless mutation is required, and reserve template literals for interpolated strings. File names follow kebab-case (`linux-prompt.ts`) while classes and types use PascalCase (`LinuxCommandExecutor`). Export named helpers so bundling stays tree-shakable.

## Testing Guidelines
Tests currently rely on lightweight streaming checks; treat them as integration smoke tests until broader coverage exists. Place new specs under `tests/` with the `.test.ts` suffix, and import from `src/` rather than `dist/` to exercise TypeScript source. Provide deterministic fixtures alongside each test and run `npx tsx tests/<name>.test.ts` before submitting.

## Commit & Pull Request Guidelines
Git history favours short, imperative subjects (`Add safety prompt parser`, `verbump`); follow that format and add concise body notes for rationale and tests. Pull requests should summarise behaviour changes, list manual verification (`fazai --dry-run`, `npm run build`), and flag configuration updates. Include CLI transcripts or screenshots when prompts or output change, and state whether `dist/` artifacts need regeneration.

---

## 🔒 Sacred Coding Protocols

**These protocols are MANDATORY and must be followed religiously:**

### 1. Binary & Path Management
- **NO binaries in `/usr/local/bin/`** - pollutes system
- **ONLY `/opt/fazai/`** for installation
- **PATH via `/opt/fazai/bin`** added to shell rc files
- Symlinks only when absolutely necessary (document why)

### 2. Configuration Hierarchy
- **System-wide**: `/etc/fazai/fazai.conf` (root installs)
- **User-local**: `~/.config/fazai/fazai.conf` (normal users) # REMOVER DEIXAR APENAS GLOBAL E /OPT/FAZAI
- **Template**: `fazai.conf.example` (git-tracked, no secrets)
- **Priority**: User config overrides system config

### 3. Consistency Matrix
**Every change MUST update ALL of these (no exceptions):**

1. **`--help` output** (`src/app.ts` or relevant command)
2. **Bash completion** (`completion/fazai.bash`)
3. **Config files** (`fazai.conf.example` AND `/etc/fazai/fazai.conf`)
4. **Installer** (`install.sh`)
5. **Documentation** (`README.md`, `QUICK-START.md`, `MANUAL.md`)
6. **Changelog** (`CHANGELOG.md`)

**Checklist before commit:**
```bash
# Did you update all 6 items above?
grep -r "new-feature" completion/ docs/ *.md install.sh src/
fazai --help | grep "new-feature"
cat fazai.conf.example | grep "new-feature"
```

### 4. Feature Addition Protocol
When adding **any** new feature:

1. **Code** → Implement in `src/`
2. **Help** → Update `--help` text
3. **Completion** → Add to `completion/fazai.bash`
4. **Config** → Add to `fazai.conf.example` with comments
5. **Install** → Update `install.sh` if needed
6. **Docs** → Update README + relevant guides
7. **Changelog** → Add entry with version bump
8. **Test** → Run `fazai sync` and verify all paths
9. **Commit** → Use format: `feat: Add <feature> with full integration`

### 5. Forbidden Practices
- ❌ **Placeholder code** ("TODO: implement later")
- ❌ **Half-documented features** (code without help text)
- ❌ **Silent config changes** (not reflected in example)
- ❌ **Completion drift** (bash completion out of sync)
- ❌ **Installer omissions** (feature not in install.sh)
- ❌ **Changelog skipping** (changes without CHANGELOG entry)

### 6. Sync & Integrity
- **Repository**: `~/fazai-ng` (development)
- **Production**: `/opt/fazai/` (system-wide)
- **Sync command**: `fazai sync` (repo → production)
- **After every change**: Run sync + test all commands
- **Session logs**: `SESSION_*.md` with integrity hash

### 7. Dependency Management
- **Lock versions** in `package.json` for stability
- **No global npm packages** (except tooling: tsup, tsx)
- **Ollama models**: Remote server (192.168.0.101:11434)
- **Cloud APIs**: OpenRouter (fallback), Cloudflare Workers

### 8. Code Quality Standards
- **TypeScript strict mode**: No `any` types
- **Error handling**: Always wrap API calls in try-catch
- **Logging**: Use consistent format (emoji + message)
- **Security**: No secrets in code/logs (use config files)
- **Performance**: Cache API responses when possible

---

**Remember: These protocols exist because we were persistent, didn't use placeholders, and earned respect through consistency. Keep it that way.**

## YOU NEED DO UNDERSTAND AND ADAPT/ TRANSLATING TO PORTUGUESE BRAZIL.

## FOLLOW CHANGES IN TODO.md THEN APPLY CHANGES IN ALL DOCUMENTATION FILES INCLUDING AGENTS.md    