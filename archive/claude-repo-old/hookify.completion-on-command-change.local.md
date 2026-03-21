---
name: completion-on-command-change
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/commands/.*\.ts$|src/app\.ts$
action: block
---

# Completion Scripts Precisam Atualizar!

Você modificou um arquivo de comando. Os scripts de completion precisam ser atualizados.

## Arquivos que Disparam Este Hook:
- `src/commands/*.ts` - Handlers de comandos
- `src/app.ts` - Roteamento principal

## Ações Obrigatórias:

1. **Rebuild para gerar completions:**
   ```bash
   npm run build
   ```

2. **Verificar se completion foi atualizado:**
   - `completion/fazai-completion.bash`
   - `completion/fazai-completion.zsh`

3. **Se adicionou novo comando:**
   - Adicionar em `scripts/generate-completions.js`
   - Adicionar na lista `SUBCOMMANDS_WITH_HELP` em `src/app.ts`
   - Adicionar no help geral (`displayHelp()`)

4. **Testar completion:**
   ```bash
   exec bash  # recarrega completions
   fazai <TAB><TAB>
   ```

**Ação:** Execute `npm run build` após suas modificações.
