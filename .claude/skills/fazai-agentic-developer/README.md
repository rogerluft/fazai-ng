# FazAI Agentic Developer Skill

## O que e esta skill?

Uma skill para o Claude CLI que ensina o agente a trabalhar no projeto FazAI-NG de forma inteligente:

1. **Economia de tokens** - Usa Qdrant antes de ler arquivos (~94% economia)
2. **Quebra de tarefas** - Divide tarefas complexas em passos verificaveis
3. **Local-first AI** - Usa Phi-3/Llama quando possivel
4. **Reflexao automatica** - Lembra de atualizar CHANGELOG, README, etc.

## Como usar

### Carregar a skill

A skill e carregada automaticamente quando voce menciona trabalhar no FazAI-NG.

### Prompt para aplicar patches V2.1

```
Usando a skill fazai-agentic-developer, aplique os patches de Autoconsciencia V2.1.

Os diffs estao em docs/analise/:
- .1-config.ts.diff -> src/config.ts (adiciona getLocalInferenceModel)
- .2-system-info.ts.diff -> src/system-info.ts (firewall, users, packages)
- .3-reflect.genai.mjs.diff -> genaisrc/reflect.genai.mjs (modo plan + reflect)
- .4-watchdog.ts -> src/services/watchdog.ts (novo arquivo)
- .5-logger.ts.diff -> src/logger.ts (structured logging)

Siga o modo EXEC:
1. Backup: git status
2. Aplique cada patch com verificacao
3. Copie watchdog.ts para src/services/
4. Rode npm run build
5. Smoke test: genaiscript run reflect --help
6. Atualize CHANGELOG.md
7. Commit: "feat: coracao agentico v2.1 - maestro unificado no reflect + watchdog configuravel + system-info hibrido + logger seguro"
```

## Checklist de reflexao

Apos qualquer mudanca, o Claude deve verificar:

- [ ] CHANGELOG.md atualizado?
- [ ] README.md precisa de update?
- [ ] CLI help atualizado?
- [ ] bash_completion atualizado?
- [ ] install.sh precisa de mudanca?
- [ ] Interface web afetada?
- [ ] Systemd scripts afetados?

## Agentes relacionados

- `changelog-generator` - Gera entradas do changelog
- `documentation-expert` - Atualiza documentacao
- `devops-engineer` - Scripts systemd e install
- `task-decomposition-expert` - Quebra tarefas complexas
