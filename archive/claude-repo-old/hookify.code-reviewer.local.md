---
name: code-reviewer-before-commit
enabled: false
event: bash
pattern: git\s+commit|git\s+push
action: block
---

# Code Review Obrigatório!

Antes de commit/push, o código precisa ser revisado.

## Use o Agente code-reviewer:

```
Use Task tool com subagent_type='code-reviewer'
```

## Checklist de Revisão:

### Qualidade:
- [ ] Código segue padrões TypeScript do projeto
- [ ] Sem `any` types (usar `unknown` se necessário)
- [ ] Funções documentadas com JSDoc
- [ ] Nomes descritivos para variáveis/funções

### Segurança:
- [ ] Sem secrets hardcoded
- [ ] Inputs sanitizados
- [ ] Sem vulnerabilidades OWASP (XSS, injection, etc.)

### Performance:
- [ ] Sem loops desnecessários
- [ ] Async/await usado corretamente
- [ ] Imports dinâmicos para código pesado

### Testes:
- [ ] Testes existem para novo código
- [ ] `npm test` passa sem erros

**Ação:** Execute revisão de código antes de continuar.
