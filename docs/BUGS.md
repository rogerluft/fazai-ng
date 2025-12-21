# FazAI - Bug Tracker

**Projeto:** FazAI - Administrador Linux Inteligente com IA
**Responsável:** Dr. Roger Luft - Engenheiro Responsável e Fundador

---

## BUG-001: Loop infinito no CLI durante busca web (DevDocs/Playwright)

**Data:** 2025-12-20
**Severidade:** Alta
**Status:** ✅ Resolvido (v3.8.1)
**Componente:** `src/research/web-crawler.ts`

### Resolução
Implementada estratégia híbrida de mitigação:
1. **Preferência por Context7:** Se disponível, usa MCP Context7 em vez de scraping direto.
2. **Timeout Rígido:** `Promise.race` força aborto do crawler após 45s.
3. **Resource Cleanup:** `crawler.teardown()` garantido no bloco `finally`.
4. **Concurrency:** Reduzido para 1 thread para estabilidade em low-resource.

**Fix Merge:** Commit `feature/spa-web-scraper` (v3.8.0-ecoa)
**Build:** Validado em 2025-12-20T15:50Z

---

### Descrição
O comando `fazai --cli` entra em loop/trava quando o usuário faz uma busca que aciona o `AgenticWebCrawler` com fonte "docs" (DevDocs).

### Reprodução
```bash
fazai --cli
> pesquise sobre "qualquer termo"
# Processo trava indefinidamente
```

### Causa Raiz
O método `parseDevDocs()` (linha 317-409) usa `PlaywrightCrawler` do Crawlee para scraping de SPA. Problemas identificados:

1. **Sem timeout global no `crawler.run()`** - pode ficar pendurado indefinidamente
2. **DevDocs é SPA complexo** - o selector `.entry` pode nunca aparecer ou o layout mudou
3. **Playwright não fecha corretamente** - browsers ficam em estado inconsistente
4. **Event loop preso** - Node.js fica esperando recursos não liberados

### Stack Trace (Log)
```
2025-12-20T05:53:43.419Z [INFO] 🔍 Iniciando busca multi-fonte: "informacoes sobre roger luft"
# Processo nunca retorna após isso
```

### Código Problemático
```typescript
// src/research/web-crawler.ts:317-409
private async parseDevDocs(searchUrl: string): Promise<SearchResult[]> {
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 1,
    maxConcurrency: 5,
    requestHandlerTimeoutSecs: 60,  // <- muito alto
    headless: true,
    navigationTimeoutSecs: 30,
    requestHandler: async ({ page, request }) => {
      // ...
      await page.waitForSelector('.entry', { timeout: 15000 }); // <- pode falhar silenciosamente
      // ...
    }
  });

  await crawler.run([searchUrl]); // <- SEM TIMEOUT EXTERNO!
  // ...
}
```

### Soluções Propostas

#### Opção A: Timeout wrapper (rápido mas não elegante)
```typescript
const results = await Promise.race([
  this.parseDevDocsInternal(url),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('DevDocs timeout')), 30000)
  )
]);
```

#### Opção B: Remover DevDocs das fontes default
```typescript
// Mudar de:
sources = ["web", "forums", "docs"]
// Para:
sources = ["web", "forums"]
```

#### Opção C: Refatorar com AbortController + cleanup
```typescript
private async parseDevDocs(searchUrl: string): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const crawler = new PlaywrightCrawler({
      // ... config
    });

    await crawler.run([searchUrl]);
    // ...
  } finally {
    clearTimeout(timeoutId);
    await crawler.teardown(); // Garantir cleanup
  }
}
```

#### Opção D: Usar Context7 MCP ao invés de scraping
Substituir DevDocs scraping por chamada ao Context7 que já está configurado como MCP e tem documentação de libs.

### Recomendação
**Opção D** é a mais robusta - usar Context7 para docs elimina necessidade de Playwright para este caso específico. DevDocs scraping pode ser mantido como fallback opcional com Opção C implementada.

### Arquivos Afetados
- `src/research/web-crawler.ts` - Código do crawler
- `src/cli-mode.ts` - Onde a busca é acionada (linha 362-425)

### Processo Afetado
```
PID: 3604525 (exemplo)
CMD: node /opt/fazai/dist/app.cjs --cli
```

---

### Incidentes Registrados

| Data | Hora | PID | Query | RAM | Ação |
|------|------|-----|-------|-----|------|
| 2025-12-20 | 05:53:43 | 3604525 | "informacoes sobre roger luft" | ~700MB | kill -9 |
| 2025-12-20 | 15:42:07 | 4059262 | "informacoes sobre roger luft" | ~1GB | kill -9 |

### Fix Aplicado (Gemini 3)

**Data:** 2025-12-20
**Status:** Código atualizado, aguardando build/deploy

A Gemini implementou combinação das Opções C + D:
1. **Context7 como preferência** - tenta MCP primeiro
2. **Timeout wrapper** - `Promise.race` com 45s
3. **Cleanup garantido** - `crawler.teardown()` no finally
4. **Timeouts reduzidos** - requestHandler: 30s, navigation: 15s, selector: 10s

```typescript
// Arquivo: src/research/web-crawler.ts
// Mudanças principais:
- checkContext7Availability() // Novo método
- parseDevDocs() refatorado com Context7 + fallback seguro
- maxConcurrency: 1 (era 5)
- Promise.race com timeout de 45s
- crawler.teardown() no finally
```

### Fluxo de Build e Deploy

**Ambiente de Desenvolvimento:** `/home/rluft/fazai-ng/`
**Ambiente de Produção:** `/opt/fazai/`

```bash
# 1. Navegar para o diretório de desenvolvimento
cd /home/rluft/fazai-ng

# 2. Build do projeto (compila TS → JS, gera completions)
npm run build

# 3. Copiar build para produção
sudo cp -r dist/* /opt/fazai/

# 4. (Opcional) Verificar versão deployada
fazai --version

# 5. Testar fix
fazai --cli
> pesquise sobre "teste"
```

**Scripts relevantes (package.json):**
- `npm run build` - Compila TypeScript e gera completions
- `npm run postbuild` - Executa após build (source-indexer, etc.)

**Arquivos gerados:**
- `dist/app.cjs` - CLI principal compilado
- `completion/fazai-completion.bash` - Bash completion

**Observações:**
- O código em `src/` só entra em efeito após build + deploy
- Processos `fazai --cli` já rodando continuam com código antigo
- Sempre matar processos antigos antes de testar fix

---

*Relatado por: Claudio (Claude Opus 4.5)*
*Para análise de: Dr. Roger Luft*
