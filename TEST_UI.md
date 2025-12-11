# Teste Rápido da Interface Visual

## Como Testar

### 1. Testar Demo Completa (Recomendado)

```bash
cd /home/rluft/fazai-ng
npx tsx examples/ui-demo.ts
```

**O que será exibido:**
1. Logo FazAI em gradiente
2. Banners com diferentes estilos
3. Tabelas formatadas (servidores, DNS)
4. Spinners de loading
5. Prompts interativos (você precisará interagir)
6. Menus com ícones
7. Dashboard completo
8. Mini dashboard

### 2. Testar Modo CLI Interativo

```bash
cd /home/rluft/fazai-ng
npm run dev -- --cli
```

**Comandos para testar:**

#### a) Ver Help
```
fazai@hostname:~/path $ /help
```

#### b) Ver Dashboard
```
fazai@hostname:~/path $ /dashboard
```

#### c) Menu de APIs
```
fazai@hostname:~/path $ /api
```
Selecione uma API (Cloudflare, SpamExperts, OPNsense)

#### d) Cloudflare Direto
```
fazai@hostname:~/path $ /cloudflare
```
ou
```
fazai@hostname:~/path $ /cf
```

#### e) SpamExperts Direto
```
fazai@hostname:~/path $ /spamexperts
```
ou
```
fazai@hostname:~/path $ /spam
```

#### f) OPNsense Direto
```
fazai@hostname:~/path $ /opnsense
```
ou
```
fazai@hostname:~/path $ /ops
```

### 3. Testar Componentes Individuais

Crie um arquivo de teste:

```typescript
// test-component.ts
import { showBanner, renderTable, Spinner } from "./src/ui";

// Teste banner
showBanner("Teste", "Testando componentes", {
  gradient: true,
  gradientColors: ["cyan", "blue"],
});

// Teste tabela
const data = [
  { id: 1, name: "Item 1", status: "online" },
  { id: 2, name: "Item 2", status: "offline" },
];

renderTable(data, [
  { header: "ID", key: "id", width: 5 },
  { header: "Nome", key: "name", width: 20 },
  { header: "Status", key: "status", width: 10 },
]);

// Teste spinner
const spinner = new Spinner();
spinner.start("Testando spinner...");
setTimeout(() => spinner.succeed("Sucesso!"), 2000);
```

Execute:
```bash
npx tsx test-component.ts
```

## Verificação de Funcionalidades

### Checklist de Testes

- [ ] Logo FazAI exibe corretamente
- [ ] Banners com gradiente funcionam
- [ ] Tabelas formatam colunas automaticamente
- [ ] Spinners mostram estados (start, succeed, fail)
- [ ] Prompts aceitam input do usuário
- [ ] Menus navegam com setas
- [ ] Dashboard mostra todas as seções
- [ ] Comandos `/cloudflare`, `/spam`, `/ops` abrem UIs
- [ ] Menu `/api` lista todas as APIs
- [ ] Comando `/dashboard` exibe métricas
- [ ] Prompt visual mostra `user@fazai:path $`
- [ ] Auto-complete funciona para comandos `/`

### Testes de Navegação

#### Cloudflare UI
1. Execute `/cloudflare`
2. Selecione "Zonas DNS" → Deve listar zonas mock
3. Volte e selecione "Registros DNS"
4. Digite um Zone ID válido (32 chars)
5. Deve listar registros DNS mock
6. Tente adicionar um registro → Wizard completo
7. Selecione "Sair" → Deve voltar ao prompt

#### SpamExperts UI
1. Execute `/spamexperts`
2. Selecione "Domínios" → Lista domínios mock
3. Selecione "Quarentena" → Lista emails em quarentena
4. Selecione "Relatórios" → Escolha período → Mostra estatísticas
5. Selecione "Sair"

#### OPNsense UI
1. Execute `/opnsense`
2. Selecione "Regras de Firewall" → Lista regras
3. Selecione "Adicionar Regra" → Wizard completo
4. Selecione "Status do Sistema" → Mostra métricas
5. Selecione "Sair"

## Problemas Conhecidos e Soluções

### Problema: Cores não aparecem
**Solução:** Verifique se o terminal suporta cores (bash/zsh modernos)
```bash
echo $TERM  # Deve ser xterm-256color ou similar
```

### Problema: Bordas das tabelas quebradas
**Solução:** Use terminal com suporte UTF-8
```bash
export LANG=en_US.UTF-8
```

### Problema: Menu não responde a setas
**Solução:** Terminal precisa suportar input interativo. Não funciona em pipes.

### Problema: Gradientes não aparecem
**Solução:** `gradient-string` requer terminal com suporte a cores true color.

## Logs de Teste

Crie um arquivo para registrar seus testes:

```bash
# test-log.txt
echo "=== Teste UI FazAI - $(date) ===" > test-log.txt

echo "1. Testando demo..." >> test-log.txt
npx tsx examples/ui-demo.ts 2>&1 | tee -a test-log.txt

echo "2. Testando CLI..." >> test-log.txt
# Teste manual (interativo)

echo "3. Testando build..." >> test-log.txt
npm run build 2>&1 | tee -a test-log.txt

echo "=== Fim dos testes ===" >> test-log.txt
```

## Performance

### Métricas Esperadas

- **Bundle size:** ~150KB (normal, inclui todas as dependências)
- **Load time:** < 1s (para abrir CLI)
- **Render time:** < 100ms (para tabelas até 100 linhas)
- **Menu navigation:** Instantâneo (< 50ms)

### Testar Performance

```bash
# Tempo de build
time npm run build

# Tempo de inicialização CLI
time (echo "/quit" | npm run dev -- --cli)

# Memory usage
/usr/bin/time -v npm run dev -- --cli
```

## Próximos Passos Após Teste

1. **Se tudo funcionar:**
   - Adicionar entrada no CHANGELOG.md
   - Atualizar completion/fazai.bash com novos comandos
   - Fazer commit seguindo convenção: `feat: add visual UI for CLI mode`

2. **Se encontrar bugs:**
   - Documentar no test-log.txt
   - Criar issue ou fix imediatamente
   - Não fazer commit até resolver

3. **Para produção:**
   - Substituir mock methods por APIs reais
   - Adicionar tratamento de erros de rede
   - Implementar cache para respostas de API
   - Adicionar retry automático com exponential backoff

## Exemplo de Sessão de Teste

```bash
$ cd /home/rluft/fazai-ng

# 1. Build
$ npm run build
✓ Build success in 128ms

# 2. Demo
$ npx tsx examples/ui-demo.ts
[Logo em gradiente aparece]
[Banners aparecem]
[Tabelas formatadas aparecem]
[Prompts solicitam input]
[Menu navegável com setas]
[Dashboard completo]

# 3. CLI interativo
$ npm run dev -- --cli
[Logo FazAI]
🤖 FazAI CLI interativo
✅ API key configurada (ollama)

rluft@fazai:~/fazai-ng $ /help
[Lista de comandos]

rluft@fazai:~/fazai-ng $ /dashboard
[Dashboard visual completo]

rluft@fazai:~/fazai-ng $ /cloudflare
[Menu Cloudflare]
> Selecionando "Zonas DNS"
[Tabela de zonas]

rluft@fazai:~/fazai-ng $ /quit
Até breve!
```

## Validação Final

Execute este checklist antes de considerar DONE:

```bash
# 1. Build sem erros
npm run build && echo "✓ Build OK" || echo "✗ Build FAILED"

# 2. TypeScript sem erros
npx tsc --noEmit && echo "✓ TypeScript OK" || echo "✗ TypeScript FAILED"

# 3. Imports resolvem
node -e "require('./dist/app.cjs')" && echo "✓ Bundle OK" || echo "✗ Bundle FAILED"

# 4. CLI inicia
timeout 5 bash -c 'echo "/quit" | npm run dev -- --cli' && echo "✓ CLI OK" || echo "✗ CLI FAILED"
```

**Resultado esperado:**
```
✓ Build OK
✓ TypeScript OK
✓ Bundle OK
✓ CLI OK
```

Se todos os checks passarem, a implementação está **PRODUCTION READY**.
