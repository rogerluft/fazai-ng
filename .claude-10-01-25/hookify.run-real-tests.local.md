---
name: run-real-tests-before-release
enabled: true
event: bash
pattern: git\s+tag|npm\s+version|git\s+push.*master
action: block
---

# Testes Reais Obrigatórios Antes de Release!

Você está fazendo uma operação de release. Execute os testes reais.

## Testes Obrigatórios:

### 1. Teste de Pergunta Básica
```bash
fazai ask "qual é a capital do Brasil?"
# Esperado: Resposta correta (Brasília)
```

### 2. Teste de Personalidade
```bash
fazai ask "quem é o andarilho dos véus?"
# Esperado: Reconhecer Roger Luft / VeilWalker
```

### 3. Teste de Ação Admin
```bash
fazai "leia a configuração do samba e liste compartilhamentos"
# Esperado: Gerar comandos para ler smb.conf
```

### 4. Teste da CLI Interativa
```bash
fazai --cli
# Testar: /help, fazer uma pergunta, /exit
```

### 5. Teste de Novo Comando (se aplicável)
```bash
fazai inference --help
fazai inference list
```

## Testes Unitários:
```bash
npm test
# Todos devem passar (exceto testes de mock de qdrant que podem falhar)
```

## Testes de Build:
```bash
npm run build
fazai --version  # Verificar versão correta
```

**Ação:** Execute os testes acima antes de continuar com a release.
