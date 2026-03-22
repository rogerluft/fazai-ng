# Phase 4: Gateway-Ready Multi-Input + New Skills

Phase 4 expands the FazAI architecture by introducing new physical and virtual gateways for interacting with the Agentic Loop, alongside utility endpoints for the Web UI. 

This phase focuses on **Gateway Flexibility** and **Extensibility**.

## 1. Claude-Import Converter Skill
The `claude-import` skill provides an automated bridge to import AI skills formatted for Anthropic's Claude into the FazAI `.genai.mjs` native format.

- **CLI Usage**: `fazai agent claude-import <path-to-skill-dir>`
- **Parsing**: Reads `.claude/SKILL.md` files extracting YAML frontmatter (Name, Description, Model) and Markdown instructional bodies.
- **Generation**: Auto-generates a standardized GenAIScript file in `genaisrc/` which is immediately discoverable by the SkillRegistry on the next boot (or via runtime re-discovery).
- **Idempotency**: Safely skips the conversion if the `.genai.mjs` file already exists.

## 2. New Communication Gateways (Telegram + Voice)
FazAI can now be operated outside of the standard terminal or web interfaces.

### Telegram Bot Skill
A lightweight, polling-based Telegram integration.
- **Skill execution**: Starts a background listener using `node-telegram-bot-api`.
- **Security**: Validates incoming messages against `TELEGRAM_ALLOWED_USERS` in `fazai.conf`.
- **Routing**: Incoming natural language messages are routed directly to the autonomous `AgenticLoop`.
- **Feedback**: Provides "Thinking..." status updates and edits the message with the final AI output.

### Voice STT/TTS Skill
Enables audio-based interaction relying on robust local binaries.
- **STT (Speech-to-Text)**: Uses `whisper.cpp` to locally transcribe audio files into text without cloud dependencies.
- **TTS (Text-to-Speech)**: Uses `gtts-cli` to synthesize text responses back into listenable audio files.

## 3. Web Dashboard Endpoints
The backend Express server (`src/dashboard/`) was extended with dedicated routers to power the next-generation FazAI Web UI:

- **Config Router** (`/api/config`): Enables listing and safely updating `fazai.conf` parameters directly from the UI. Sensitive keys (like `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `QDRANT_API_KEY`) are dynamically masked to prevent exposure.
- **Prompts Router** (`/api/prompts`): Provides full CRUD (Create, Read, Update, Delete) capabilities over system prompts stored in the `system-prompts/` directory.
- **Terminal Router** (`/api/terminal`): Integrates with `ttyd` (Terminal over HTTP), allowing the dashboard to embed a live shell session directly via an iframe, bringing raw terminal power to the browser interface.

All these capabilities bring FazAI closer to a seamless, universally accessible autonomous platform.
