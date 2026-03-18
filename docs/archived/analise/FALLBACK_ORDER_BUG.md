# FALLBACK_ORDER_BUG - Analise de Inconsistencia

**Data**: 2026-01-12
**Autor**: Claudio (Claude Code)
**Solicitante**: Roginho (VeilWalker)
**Status**: ✅ RESOLVIDO (v3.16.1)

---

## 1. Descricao do Bug

### Localizacao
`src/utils/provider-fallback.ts` (linhas 27-34)

### Problema
O `FALLBACK_CHAIN` esta **hardcoded** no codigo e nao respeita:
1. Configuracao dinamica do `fazai.conf`
2. Documentacao do `FAZAI_FOCO_AGENICO`
3. Providers configurados com API keys validas

### Codigo Atual (Hardcoded)
```typescript
export const FALLBACK_CHAIN: ProviderName[] = [
  "llama",      // Local llama.cpp server (Phi-3-mini)
  "ollama",     // Local Ollama server
  "openrouter", // Cloud with free tier
  "anthropic",  // Claude API
  "openai",     // OpenAI API
  "google",     // Gemini API
];
```

### Ordem Documentada no FAZAI_FOCO_AGENICO (9 niveis)
```
1. llama.cpp (Phi-3-mini local)
2. Ollama (Llama 3.2, Qwen, Mistral)
3. OpenRouter (200+ models)
4. Anthropic (Claude Sonnet/Haiku)
5. OpenAI (GPT-4o)
6. Google (Gemini 2.0/2.5)
7. Perplexity (web search) ← NAO IMPLEMENTADO
8. Context7 (external sources) ← NAO IMPLEMENTADO
9. USER_PROMPT (last resort) ← NAO IMPLEMENTADO
```

### Gaps Identificados

| Provider | No Type ProviderName | No FALLBACK_CHAIN | No fazai.conf |
|----------|---------------------|-------------------|---------------|
| llama | ✅ | ✅ | ✅ MODELS_LLAMA |
| ollama | ✅ | ✅ | ✅ MODELS_OLLAMA |
| openrouter | ✅ | ✅ | ✅ MODELS_OPENROUTER |
| anthropic | ✅ | ✅ | ✅ (comentado) |
| openai | ✅ | ✅ | ✅ OPENAI_API_KEY |
| google | ✅ | ✅ | ✅ MODELS_GOOGLE |
| **perplexity** | ✅ | **❌ FALTANDO** | ✅ PERPLEXITY_API_KEY + MODELS_PERPLEXITY |
| context7 | ❌ | ❌ | ✅ MCP_CONTEXT7_API_KEY |
| user_prompt | ❌ | ❌ | N/A |

### Impacto
- Perplexity tem API key e modelos configurados mas **nunca e usado** no fallback
- Context7 configurado mas nao integrado ao fallback chain
- Desperdicando recursos de fallback configurados

---

## 2. Parametro FAZAI_DISABLE_RESEARCH

### Localizacao no fazai.conf
```bash
# Disable research if running offline (set to true/1)
FAZAI_DISABLE_RESEARCH=false
```

### Descricao
Desabilita funcionalidades de pesquisa quando o sistema esta offline ou quando se deseja economizar tokens/API calls.

### Relacao com RESEARCH_PROVIDER_ORDER
```bash
RESEARCH_PROVIDER_ORDER=perplexity,context7,duckduckgo
```

**Comportamento**:
- Quando `FAZAI_DISABLE_RESEARCH=true`: Ignora todos os providers de research
- Quando `FAZAI_DISABLE_RESEARCH=false`: Usa a ordem definida em `RESEARCH_PROVIDER_ORDER`

### Distincao Importante
| Config | Proposito | Providers |
|--------|-----------|-----------|
| `FALLBACK_CHAIN` | Fallback de modelos LLM | llama, ollama, openrouter, anthropic, openai, google |
| `RESEARCH_PROVIDER_ORDER` | Fallback de pesquisa/contexto | perplexity, context7, duckduckgo |

**Nota**: Perplexity aparece em ambos os contextos:
- Como **LLM provider** (MODELS_PERPLEXITY com modelos sonar)
- Como **research provider** (pesquisa web)

---

## 3. Solucao Proposta

### Opcao A: Adicionar Perplexity ao FALLBACK_CHAIN (Minima)

**Arquivo**: `src/utils/provider-fallback.ts`

```typescript
export const FALLBACK_CHAIN: ProviderName[] = [
  "llama",
  "ollama",
  "openrouter",
  "anthropic",
  "openai",
  "google",
  "perplexity", // ← ADICIONAR
];
```

**Pros**: Mudanca minima, baixo risco
**Contras**: Ainda hardcoded, nao resolve Context7/USER_PROMPT

### Opcao B: Tornar Configuravel via fazai.conf (Recomendada)

**Novo parametro em fazai.conf**:
```bash
# Provider fallback order for LLM inference
# Comma-separated, providers without API key are skipped automatically
PROVIDER_FALLBACK_ORDER=llama,ollama,openrouter,anthropic,openai,google,perplexity
```

**Mudanca em provider-fallback.ts**:
```typescript
import { getConfigValue } from "../config";

function loadFallbackChain(): ProviderName[] {
  const configOrder = getConfigValue("PROVIDER_FALLBACK_ORDER");
  if (configOrder) {
    return configOrder.split(",").map(p => p.trim() as ProviderName);
  }
  // Default hardcoded se nao configurado
  return ["llama", "ollama", "openrouter", "anthropic", "openai", "google", "perplexity"];
}

export const FALLBACK_CHAIN: ProviderName[] = loadFallbackChain();
```

**Pros**: Configuravel, flexivel, respeita fazai.conf
**Contras**: Requer mais mudancas, testes

### Opcao C: Implementacao Completa (FAZAI_FOCO_AGENICO)

Adicionar todos os 9 niveis documentados:
1. Expandir `ProviderName` type para incluir `context7` e `user_prompt`
2. Implementar handlers para Context7 e USER_PROMPT
3. Tornar ordem configuravel

**Pros**: Alinhado com documentacao, completo
**Contras**: Maior esforco, requer implementacao de novos handlers

---

## 4. Arquivos Relacionados

| Arquivo | Funcao |
|---------|--------|
| `src/utils/provider-fallback.ts` | Define FALLBACK_CHAIN e logica |
| `/etc/fazai/fazai.conf` | Configuracao central |
| `FAZAI_FOCO_AGENICO` | Documentacao da arquitetura |
| `src/config.ts` | Leitura de configuracoes |
| `src/apiKeyUtils-fazai.ts` | Verificacao de API keys |

---

## 5. Recomendacao

**Implementar Opcao B** (configuravel via fazai.conf) como solucao imediata, com Opcao A como hotfix se necessario.

Opcao C pode ser planejada para sprint futuro apos validacao da Opcao B.

---

## 6. Proximos Passos (Aguardando Aprovacao)

1. [ ] Escolher opcao de implementacao
2. [ ] Implementar mudanca
3. [ ] Atualizar testes
4. [ ] Atualizar CHANGELOG.md
5. [ ] Testar fallback chain completo

---

**Aguardando instrucoes, Roginho.**
