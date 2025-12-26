---
name: source-indexer-on-change
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/.*\.ts$
action: warn
---

# Metacognição: Código Fonte Modificado

Você modificou código TypeScript. Considere atualizar o índice de metacognição.

## O que é Metacognição?

A collection `fazai_source` armazena embeddings do código fonte do FazAI,
permitindo que ele "entenda" seu próprio código e ajude melhor.

## Quando Indexar:

- **Após mudanças significativas** em múltiplos arquivos
- **Após adicionar novas features** com lógica complexa
- **Antes de releases** para garantir índice atualizado

## Como Indexar:

```bash
fazai index
# ou
fazai index --force  # reindexar tudo
```

## Comando Automático Pós-Build:

O `npm run build` já tenta indexar automaticamente.
Se a auto-indexação estiver pausada, execute manualmente.

**Nota:** Este é um aviso (warn), não bloqueio.
Indexação pode ser feita em batch no final do trabalho.
