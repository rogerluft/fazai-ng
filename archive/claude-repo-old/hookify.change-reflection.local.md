---
name: change-reflection-reminder
description: Lembra de verificar artefatos relacionados apos mudancas no codigo
trigger: post-commit
---

# Change Reflection Hook

Apos cada commit significativo, lembre o usuario de verificar:

## Checklist Automatico

Se o commit incluiu mudancas em:

### Codigo fonte (src/)
- [ ] CHANGELOG.md atualizado com a mudanca?
- [ ] README.md precisa refletir nova funcionalidade?

### Novos comandos CLI (src/commands/)
- [ ] fazai --help mostra o novo comando?
- [ ] bash_completion.sh inclui o novo comando?
- [ ] README.md documenta o uso?

### Configuracao (src/config.ts, fazai.conf)
- [ ] install.sh copia a nova config?
- [ ] README.md documenta a variavel?
- [ ] fazai.conf.example atualizado?

### GenAIScript (genaisrc/)
- [ ] genaiscript run [script] --help funciona?
- [ ] CHANGELOG.md menciona a mudanca?

### Servicos (src/services/)
- [ ] Novo servico precisa de systemd unit?
- [ ] install.sh cria paths necessarios?

### Interface Web (web/)
- [ ] cd web && npm run build passa?
- [ ] README.md documenta nova feature?

## Mensagem ao Usuario

Apos commit, pergunte:

> "Commit realizado! Verifiquei que voce alterou [arquivos]. 
> Precisa atualizar algum destes artefatos?
> - CHANGELOG.md
> - README.md  
> - CLI help
> - install.sh
> - systemd scripts"
