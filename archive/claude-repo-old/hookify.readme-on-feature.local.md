---
name: readme-on-feature
enabled: true
event: stop
pattern: .*
action: warn
---

# Verificação de Documentação Antes de Finalizar

Antes de encerrar, verifique se a documentação está atualizada.

## Checklist de Documentação:

### Se adicionou/modificou features:
- [ ] **README.md** atualizado com nova funcionalidade?
- [ ] **CHANGELOG.md** com entrada para a versão?
- [ ] **--help** reflete as mudanças? (`fazai --help`)

### Se modificou comandos:
- [ ] **Help do subcomando** atualizado? (`fazai <cmd> --help`)
- [ ] **Completion scripts** regenerados? (`npm run build`)
- [ ] **generate-completions.js** inclui o comando?

### Se modificou configurações:
- [ ] **fazai.conf.example** atualizado?
- [ ] **install.sh** reflete as mudanças?

### Se modificou collections Qdrant:
- [ ] **src/rag/README.md** documenta a collection?
- [ ] Pesos de fusion atualizados se necessário?

## Arquivos Comuns para Atualizar:
- `README.md` - Documentação principal
- `CHANGELOG.md` - Histórico de versões
- `docs/` - Documentação detalhada
- `install.sh` - Script de instalação
