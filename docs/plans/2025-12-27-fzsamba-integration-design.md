# FZSamba Integration - Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrar o script `fzsamba` (gerenciador Samba) como comando nativo do FazAI CLI + Dashboard Web.

**Architecture:** Wrapper TypeScript + REST API + Página Web React

**Tech Stack:** TypeScript, Express, React, Next.js, Tailwind CSS, shadcn/ui

**Status:** EM IMPLEMENTAÇÃO (agentes trabalhando)

---

## Arquivos Criados pelos Agentes

### 1. CLI Command - `src/commands/samba.ts` ✅
- Handler principal `handleSambaCommand()`
- Subcomandos: list, add, del, criauser, criadir, criagroup, completion
- Help formatado com chalk
- Delegação para script bash `/opt/fazai/scripts/fzsamba`

### 2. REST API - `src/dashboard/routes/samba.ts` ✅
Endpoints implementados:
- `GET /api/samba/shares` - Lista compartilhamentos
- `POST /api/samba/shares` - Adiciona share
- `DELETE /api/samba/shares/:name` - Remove share
- `GET /api/samba/status` - Status smb/nmb services
- `POST /api/samba/users` - Cria usuário (informativo)
- `POST /api/samba/groups` - Cria grupo (informativo)
- `POST /api/samba/restart` - Reinicia serviços

### 3. Web Page - `web/app/(dashboard)/samba/page.tsx` ✅
- Tabela de shares com ações
- Formulário de criação
- Status do serviço (running/stopped)
- Delete com confirmação
- React Query para cache/refresh

### 4. CLI Interactive - `src/commands/samba/samba-ui.ts` ✅
- Menu interativo com inquirer
- Suporte a `/samba` e `/samba <cmd>` no cli-mode

### 5. App.ts Integration ✅
- Rota `fazai samba` adicionada
- SUBCOMMANDS_WITH_HELP atualizado
- Completion atualizado
- Help atualizado

---

## Pendências

### A Integrar:
1. [ ] Integrar sambaRouter no `src/dashboard/routes/api.ts`
2. [ ] Adicionar handler `/samba` no `cli-mode.ts`
3. [ ] Atualizar `install.sh` com cópia do fzsamba
4. [ ] Atualizar `generate-completions.js`
5. [ ] Atualizar CHANGELOG.md

### A Testar:
1. [ ] `fazai samba --help`
2. [ ] `fazai samba list`
3. [ ] `fazai --cli` → `/samba`
4. [ ] Dashboard web → `/samba`
5. [ ] API REST endpoints

---

## Código de Integração Pendente

### api.ts
```typescript
import { sambaRouter } from "./samba";
// ...
apiRouter.use("/samba", sambaRouter);
```

### cli-mode.ts
```typescript
// Adicionar em SLASH_COMMANDS
"/samba",

// Adicionar handler
} else if (line === "/samba" || line.startsWith("/samba ")) {
  const { SambaUI } = await import("./commands/samba/samba-ui");
  const sambaUI = new SambaUI();
  const args = line.replace(/^\/samba\s*/, "").trim().split(/\s+/).filter(Boolean);
  if (args.length === 0) {
    await sambaUI.showMainMenu();
  } else {
    await sambaUI.executeCommand(args);
  }
```

---

## CHANGELOG Entry

```markdown
### 🔧 FZSamba Integration - Samba Server Management

#### ✨ Features - Sistema Administration

- **Novo comando `fazai samba`**:
  - `fazai samba list` - Lista compartilhamentos configurados
  - `fazai samba add <path>` - Adiciona novo compartilhamento
  - `fazai samba del <share>` - Remove compartilhamento
  - `fazai samba criauser <username>` - Cria usuário Samba
  - `fazai samba criadir <path>` - Cria diretório compartilhado
  - `fazai samba criagroup <groupname>` - Cria grupo com permissões

- **Slash Command `/samba`** (CLI Interativo):
  - Menu interativo com inquirer
  - Execução direta: `/samba list`, `/samba add <path>`

- **REST API Endpoints** (`/api/samba/*`):
  - CRUD de compartilhamentos
  - Status do serviço
  - Restart do Samba

- **Dashboard Web** (`/dashboard/samba`):
  - Interface visual para gerenciamento
  - Tabela de compartilhamentos
  - Formulários de criação
```

---

**Criado por:** Agentes Especializados (backend-architect, frontend-developer, typescript-pro)
**Data:** 2025-12-27
