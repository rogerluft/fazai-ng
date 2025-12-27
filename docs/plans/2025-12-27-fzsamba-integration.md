# FZSamba Integration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrar o script `fzsamba` (gerenciador Samba) como comando nativo do FazAI CLI.

**Architecture:** Criar wrapper TypeScript (`src/commands/samba.ts`) que delega operações para o script bash existente, adicionando validação de entrada, logging estruturado e integração com o sistema de help/completion do FazAI.

**Tech Stack:** TypeScript, child_process (execSync/spawn), bash, Samba (smb.conf)

---

## Análise do Script Existente

O `scripts/fzsamba` oferece 7 comandos:

| Comando | Função | Requer Root |
|---------|--------|-------------|
| `criauser <user>` | Cria usuário Unix + Samba, define senha | Sim |
| `criadir <path>` | Cria diretório + share no smb.conf | Sim |
| `criagroup <group>` | Cria grupo + aplica em diretório | Sim |
| `add <path>` | Adiciona diretório existente como share | Sim |
| `del <share>` | Remove share do smb.conf (backup) | Sim |
| `list` | Lista shares com cores (não modifica) | Não |
| `completion` | Gera bash completion | Não |

**Bugs Conhecidos (do dump):**
- `del` usava `sed -i` que falha sem permissão - **já corrigido com awk**

---

## Task 1: Criar arquivo de comando samba.ts

**Files:**
- Create: `src/commands/samba.ts`
- Modify: `src/app.ts` (adicionar rota)

**Step 1: Criar estrutura base do comando**

```typescript
// src/commands/samba.ts
import { execSync, spawnSync } from 'child_process';
import chalk from 'chalk';
import { logger } from '../logger';
import path from 'path';

const FZSAMBA_PATH = '/opt/fazai/scripts/fzsamba';

interface SambaCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

function displayHelp(): void {
  const helpText = `
${chalk.bold('fazai samba')} - Gerenciador de compartilhamentos Samba

${chalk.yellow('Uso:')}
  fazai samba <comando> [argumentos]

${chalk.yellow('Comandos:')}
  ${chalk.green('list')}                    Lista todos os compartilhamentos
  ${chalk.green('add')} <path>              Adiciona diretório existente como share
  ${chalk.green('del')} <share>             Remove share do smb.conf (com backup)
  ${chalk.green('criauser')} <user>         Cria usuário Unix + Samba
  ${chalk.green('criadir')} <path>          Cria diretório + share
  ${chalk.green('criagroup')} <group>       Cria grupo e aplica em diretório
  ${chalk.green('completion')}              Gera bash completion

${chalk.yellow('Exemplos:')}
  fazai samba list
  fazai samba add /dados/projetos
  fazai samba del projetos
  fazai samba criauser joao

${chalk.yellow('Notas:')}
  - Comandos que modificam (add, del, cria*) requerem sudo
  - O script reinicia automaticamente o Samba após alterações
`;
  logger.info(helpText);
}

export async function handleSambaCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  // Help
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    displayHelp();
    return;
  }

  // Validar subcomandos
  const validCommands = ['list', 'add', 'del', 'criauser', 'criadir', 'criagroup', 'completion'];
  if (!validCommands.includes(subcommand)) {
    logger.error(chalk.red(`Comando inválido: ${subcommand}`));
    logger.info(`Comandos válidos: ${validCommands.join(', ')}`);
    displayHelp();
    process.exit(1);
  }

  // Executar
  const result = executeSambaCommand(subcommand, subArgs);

  if (!result.success) {
    logger.error(chalk.red(`Erro: ${result.error}`));
    process.exit(1);
  }

  logger.info(result.output);
}

function executeSambaCommand(cmd: string, args: string[]): SambaCommandResult {
  try {
    const fullCmd = `${FZSAMBA_PATH} ${cmd} ${args.join(' ')}`.trim();

    logger.debug(`Executando: ${fullCmd}`);

    const output = execSync(fullCmd, {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    return { success: true, output };
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: Buffer };
    return {
      success: false,
      output: '',
      error: err.stderr?.toString() || err.message || 'Erro desconhecido',
    };
  }
}
```

**Step 2: Verificar se compila**

```bash
cd /home/rluft/fazai-ng && npx tsc --noEmit src/commands/samba.ts
```

**Step 3: Commit**

```bash
git add src/commands/samba.ts
git commit -m "feat(samba): add samba command wrapper structure"
```

---

## Task 2: Integrar rota no app.ts

**Files:**
- Modify: `src/app.ts`

**Step 1: Adicionar import dinâmico**

Localizar onde estão os outros comandos (por volta da linha 260) e adicionar:

```typescript
// Samba command - Gerenciador de compartilhamentos Samba
if (inputs[0] === "samba") {
  const { handleSambaCommand } = await import("./commands/samba");
  await handleSambaCommand(inputs.slice(1));
  process.exit(0);
}
```

**Step 2: Adicionar ao help**

Na função `displayHelp()`, adicionar linha:

```typescript
  fazai samba <command>                             # Gerenciador Samba (shares, users, groups)
```

**Step 3: Adicionar ao SUBCOMMANDS_WITH_HELP**

```typescript
const SUBCOMMANDS_WITH_HELP = [
  "qdrant", "vector", "ask", "import", "alias",
  "cloudflare", "cf", "github", "index", "sync",
  "config", "search", "inference", "agent", "ingest",
  "samba", "skill-seeker", "dashboard"  // Adicionar samba
];
```

**Step 4: Adicionar ao completion**

Na seção de `completion`, adicionar "samba" à lista:

```typescript
const suggestions = [
  "ask", "alias", "config", "completion", "search",
  "vector", "import", "ingest", "sync", "cf", "cloudflare",
  "github", "qdrant", "inference", "agent", "dashboard",
  "samba",  // Adicionar aqui
  ...
];
```

**Step 5: Testar compilação**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/app.ts
git commit -m "feat(samba): integrate samba command into CLI"
```

---

## Task 3: Copiar script para /opt/fazai/scripts/

**Files:**
- Modify: `install.sh` (se existir)
- Deploy: `scripts/fzsamba` → `/opt/fazai/scripts/fzsamba`

**Step 1: Verificar estrutura de instalação**

```bash
ls -la /opt/fazai/
```

**Step 2: Criar diretório scripts se não existir**

```bash
sudo mkdir -p /opt/fazai/scripts
```

**Step 3: Copiar e dar permissão**

```bash
sudo cp scripts/fzsamba /opt/fazai/scripts/fzsamba
sudo chmod +x /opt/fazai/scripts/fzsamba
```

**Step 4: Testar execução**

```bash
/opt/fazai/scripts/fzsamba list
```

**Step 5: Commit (se modificou install.sh)**

```bash
git add install.sh
git commit -m "chore(install): add fzsamba to installation script"
```

---

## Task 4: Gerar bash completion para samba

**Files:**
- Modify: `scripts/generate-completions.js`

**Step 1: Adicionar completion para samba**

No arquivo `generate-completions.js`, adicionar cases para samba:

```javascript
// Na seção de subcomandos
'samba)': `
      local samba_cmds="list add del criauser criadir criagroup completion"
      case "\${prev}" in
        samba)
          COMPREPLY=( $(compgen -W "\${samba_cmds}" -- "\${cur}") )
          return 0
          ;;
        add|criadir)
          COMPREPLY=( $(compgen -d -- "\${cur}") )
          return 0
          ;;
        criauser)
          COMPREPLY=( $(compgen -u -- "\${cur}") )
          return 0
          ;;
        criagroup)
          COMPREPLY=( $(compgen -g -- "\${cur}") )
          return 0
          ;;
        del)
          # Lista shares do smb.conf
          local shares=$(awk -F'[][]' '/^\[.*\]$/{print $2}' /etc/samba/smb.conf 2>/dev/null)
          COMPREPLY=( $(compgen -W "\${shares}" -- "\${cur}") )
          return 0
          ;;
        *)
          ;;
      esac
      ;;
`,
```

**Step 2: Rebuildar completions**

```bash
npm run build
```

**Step 3: Verificar arquivo gerado**

```bash
grep -A20 "samba" completion/fazai-completion.bash
```

**Step 4: Commit**

```bash
git add scripts/generate-completions.js completion/fazai-completion.bash
git commit -m "feat(completion): add samba subcommand completions"
```

---

## Task 5: Adicionar testes unitários

**Files:**
- Create: `tests/unit/samba-command.test.ts`

**Step 1: Criar arquivo de teste**

```typescript
// tests/unit/samba-command.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

describe('Samba Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSambaCommand', () => {
    it('should display help when no arguments', async () => {
      const loggerSpy = vi.spyOn(console, 'log');
      const { handleSambaCommand } = await import('../../src/commands/samba');

      await handleSambaCommand([]);

      // Verifica que o help foi exibido
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should display help with --help flag', async () => {
      const loggerSpy = vi.spyOn(console, 'log');
      const { handleSambaCommand } = await import('../../src/commands/samba');

      await handleSambaCommand(['--help']);

      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should reject invalid subcommands', async () => {
      const { handleSambaCommand } = await import('../../src/commands/samba');

      await expect(handleSambaCommand(['invalid'])).rejects.toThrow();
    });

    it('should execute list command', async () => {
      const { execSync } = await import('child_process');
      const mockedExec = vi.mocked(execSync);
      mockedExec.mockReturnValue('--- Compartilhamentos ---\n');

      const { handleSambaCommand } = await import('../../src/commands/samba');

      await handleSambaCommand(['list']);

      expect(mockedExec).toHaveBeenCalledWith(
        expect.stringContaining('fzsamba list'),
        expect.any(Object)
      );
    });
  });
});
```

**Step 2: Rodar testes**

```bash
npm test -- tests/unit/samba-command.test.ts
```

**Step 3: Ajustar até passar**

Corrigir mocks conforme necessário.

**Step 4: Commit**

```bash
git add tests/unit/samba-command.test.ts
git commit -m "test(samba): add unit tests for samba command"
```

---

## Task 6: Atualizar CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Adicionar entrada no Unreleased**

```markdown
### 🔧 Samba Management - FZSamba Integration

#### ✨ Features - Samba Shares

- **Novo comando `fazai samba`**:
  - `fazai samba list` - Lista compartilhamentos Samba
  - `fazai samba add <path>` - Adiciona diretório como share
  - `fazai samba del <share>` - Remove share (com backup)
  - `fazai samba criauser <user>` - Cria usuário Unix + Samba
  - `fazai samba criadir <path>` - Cria diretório + share
  - `fazai samba criagroup <group>` - Cria grupo + permissões

- **Bash Completion**:
  - Autocomplete para subcomandos
  - Autocomplete de diretórios para add/criadir
  - Autocomplete de usuários para criauser
  - Autocomplete de shares existentes para del
```

**Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add samba integration feature"
```

---

## Task 7: Atualizar install.sh

**Files:**
- Modify: `install.sh` (ou script de instalação equivalente)

**Step 1: Adicionar cópia do fzsamba**

Adicionar ao script de instalação:

```bash
# Samba management script
echo "Installing fzsamba..."
mkdir -p /opt/fazai/scripts
cp scripts/fzsamba /opt/fazai/scripts/fzsamba
chmod +x /opt/fazai/scripts/fzsamba
```

**Step 2: Commit**

```bash
git add install.sh
git commit -m "chore(install): include fzsamba in installation"
```

---

## Ordem de Execução

1. **Task 1** - Criar `src/commands/samba.ts` (core do wrapper)
2. **Task 2** - Integrar no `app.ts` (routing)
3. **Task 3** - Deploy do script para `/opt/fazai/`
4. **Task 4** - Bash completion
5. **Task 5** - Testes unitários
6. **Task 6** - CHANGELOG
7. **Task 7** - install.sh

---

## Critérios de Sucesso

- [ ] `fazai samba --help` mostra ajuda formatada
- [ ] `fazai samba list` lista compartilhamentos
- [ ] `fazai samba add <path>` funciona (requer sudo)
- [ ] Bash completion funciona para todos subcomandos
- [ ] Testes passando (196+ testes)
- [ ] CHANGELOG atualizado
- [ ] install.sh inclui fzsamba

---

## Considerações de Segurança

- O script requer root para operações de escrita
- Backup automático antes de deletar shares
- Validação de paths antes de operações
- Logging de todas operações para auditoria

