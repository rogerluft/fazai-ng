---
name: help-sync-check
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/commands/[^/]+\.ts$
  - field: new_text
    operator: regex_match
    pattern: export\s+(async\s+)?function\s+handle
action: block
---

# Novo Handler de Comando Detectado!

Você criou/modificou um handler de comando. O help precisa estar sincronizado.

## Verificações Obrigatórias:

### 1. Help Geral (`src/app.ts`)
O comando aparece na função `displayHelp()`?

```typescript
  fazai novocomando <action>                         # Descrição do comando
```

### 2. Help Específico do Comando
O handler tem uma função `showHelp()` ou trata `--help`?

```typescript
if (args.includes("--help") || args.includes("-h")) {
  showCommandHelp();
  return;
}
```

### 3. Lista de Subcomandos
O comando está em `SUBCOMMANDS_WITH_HELP`?

```typescript
const SUBCOMMANDS_WITH_HELP = [
  // ...outros comandos...
  "novocomando",  // <-- Adicionar aqui
];
```

### 4. Generate Completions
O comando está em `scripts/generate-completions.js`?

## Teste Rápido:
```bash
npm run build
fazai novocomando --help
fazai --help | grep novocomando
```

**Ação:** Sincronize o help antes de continuar.
