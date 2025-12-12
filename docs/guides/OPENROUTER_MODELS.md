# 🌐 OpenRouter - Acesso a 200+ Modelos

## Por Que OpenRouter?

**OpenRouter** é um proxy unificado que dá acesso a **200+ modelos** de diferentes providers através de uma **única API key** e **único formato de requisição**.

### Vantagens:
- ✅ **1 API key** → 200+ modelos (Claude, GPT, Gemini, Mistral, Llama...)
- ✅ **Preço competitivo** (geralmente mais barato que ir direto)
- ✅ **Fallback automático** se um modelo estiver indisponível
- ✅ **Rate limit unificado** (melhor controle)
- ✅ **Billing consolidado** (uma fatura só)

---

## Modelos Disponíveis (Principais)

### Anthropic Claude (via OpenRouter)
| Model | OpenRouter ID | Preço | Quando Usar |
|-------|---------------|-------|-------------|
| Claude 3.5 Sonnet | `anthropic/claude-3.5-sonnet` | $3/$15 (1M tokens) | Tarefas complexas |
| Claude 3 Haiku | `anthropic/claude-3-haiku` | $0.25/$1.25 | Rápido e barato |
| Claude 3 Opus | `anthropic/claude-3-opus` | $15/$75 | Máxima qualidade |

### OpenAI (via OpenRouter)
| Model | OpenRouter ID | Preço | Quando Usar |
|-------|---------------|-------|-------------|
| GPT-4o | `openai/gpt-4o` | $2.50/$10 | Tarefas gerais |
| GPT-4o Mini | `openai/gpt-4o-mini` | $0.15/$0.60 | Rápido e econômico |
| GPT-4 Turbo | `openai/gpt-4-turbo` | $10/$30 | Alta capacidade |

### Google Gemini (via OpenRouter)
| Model | OpenRouter ID | Preço | Quando Usar |
|-------|---------------|-------|-------------|
| Gemini 1.5 Pro | `google/gemini-pro-1.5` | $1.25/$5 | Multimodal |
| Gemini Flash | `google/gemini-flash-1.5` | $0.075/$0.30 | Ultra rápido |

### Mistral (via OpenRouter)
| Model | OpenRouter ID | Preço | Quando Usar |
|-------|---------------|-------|-------------|
| Mistral Large | `mistralai/mistral-large` | $3/$9 | Europa-based |
| Mixtral 8x7B | `mistralai/mixtral-8x7b` | $0.24/$0.24 | Open source |

### Meta Llama (via OpenRouter)
| Model | OpenRouter ID | Preço | Quando Usar |
|-------|---------------|-------|-------------|
| Llama 3.1 405B | `meta-llama/llama-3.1-405b` | $2.70/$2.70 | Maior modelo open |
| Llama 3.1 70B | `meta-llama/llama-3.1-70b` | $0.59/$0.79 | Balanceado |
| Llama 3.2 11B Vision | `meta-llama/llama-3.2-11b-vision` | $0.055/$0.055 | Multimodal |

### Outros Destaques
| Provider | Model | OpenRouter ID | Preço |
|----------|-------|---------------|-------|
| DeepSeek | DeepSeek V2 | `deepseek/deepseek-chat` | $0.14/$0.28 |
| Qwen | Qwen 2.5 72B | `qwen/qwen-2.5-72b` | $0.35/$0.35 |
| Command R+ | Cohere | `cohere/command-r-plus` | $2.50/$10 |

**Lista completa:** https://openrouter.ai/models

---

## Configuração FazAI

### 1. Obter API Key
```bash
# Acessar: https://openrouter.ai/keys
# Criar nova key
# Copiar: sk-or-v1-xxxxx
```

### 2. Adicionar ao fazai.conf
```ini
# OpenRouter - Acesso unificado a 200+ modelos
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Modelos configuráveis (usa OpenRouter IDs)
DEFAULT_MODEL=openai/gpt-4o-mini
COMPLEX_MODEL=anthropic/claude-3.5-sonnet
FAST_MODEL=anthropic/claude-3-haiku
MULTIMODAL_MODEL=google/gemini-pro-1.5

# Preferir modelo local quando possível
PREFER_LOCAL=false
LOCAL_MODEL=ollama/llama3.2
```

### 3. Usar no FazAI
```bash
# Modelo via OpenRouter (automático se configurado)
fazai "instalar nginx"

# Força modelo específico via OpenRouter
GENKIT_MODEL=anthropic/claude-3.5-sonnet fazai "tarefa complexa"

# Modelo local (Ollama)
GENKIT_MODEL=ollama/llama3.2 fazai "tarefa offline"
```

---

## Genkit Integration

### Código (src/genkit-orchestrator.ts)
```typescript
import { openrouter } from 'genkitx-openrouter';

const ai = configureGenkit({
  plugins: [
    openrouter({ 
      apiKey: getConfigValue("OPENROUTER_API_KEY"),
      defaultModel: getConfigValue("DEFAULT_MODEL") || "openai/gpt-4o-mini"
    }),
  ]
});

// Usar qualquer modelo do OpenRouter
const response = await generate({
  model: 'anthropic/claude-3.5-sonnet', // ou qualquer outro
  prompt: 'Instalar nginx'
});
```

---

## Estratégia de Modelos Recomendada

### Desenvolvimento/Teste
```ini
DEFAULT_MODEL=openai/gpt-4o-mini        # Barato ($0.15/$0.60)
COMPLEX_MODEL=anthropic/claude-3-haiku  # Médio ($0.25/$1.25)
```

### Produção
```ini
DEFAULT_MODEL=openai/gpt-4o             # Balanceado ($2.50/$10)
COMPLEX_MODEL=anthropic/claude-3.5-sonnet # Premium ($3/$15)
FAST_MODEL=google/gemini-flash-1.5      # Ultra-rápido ($0.075/$0.30)
```

### Budget Limitado
```ini
DEFAULT_MODEL=google/gemini-flash-1.5   # Ultra barato
COMPLEX_MODEL=mistralai/mixtral-8x7b    # Open source ($0.24)
PREFER_LOCAL=true                       # Usa Ollama sempre que possível
```

### Privacidade Máxima
```ini
PREFER_LOCAL=true
LOCAL_MODEL=ollama/llama3.2
# Só usa cloud quando absolutamente necessário
```

---

## Custos Comparados

**Exemplo: 1M tokens input/output**

| Via | Claude 3.5 Sonnet | GPT-4o | GPT-4o Mini |
|-----|-------------------|--------|-------------|
| Direto | $3/$15 | $5/$15 | $0.15/$0.60 |
| OpenRouter | $3/$15 | $2.50/$10 | $0.15/$0.60 |
| **Economia** | Igual | **50% output** | Igual |

**Vantagem:** Além de economia em alguns modelos, você tem **200+ opções** com 1 key só.

---

## Features Avançadas OpenRouter

### 1. Fallback Automático
```typescript
// Se Claude falhar, tenta GPT automaticamente
const models = [
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o',
  'google/gemini-pro-1.5'
];
```

### 2. Model Routing por Custo
```typescript
// OpenRouter escolhe modelo mais barato que atende requisitos
const response = await generate({
  route: 'fallback',
  models: ['anthropic/claude-3-haiku', 'openai/gpt-4o-mini'],
  prompt: 'Task'
});
```

### 3. Rate Limit Management
- OpenRouter gerencia rate limits de todos providers
- Reduz erros de quota exceeded
- Melhor UX

---

## FAQ

**P: OpenRouter é mais caro?**  
R: Geralmente **não**. Alguns modelos são mais baratos, outros iguais. Vantagem é a conveniência.

**P: Preciso de keys dos providers originais?**  
R: **Não**. Apenas 1 key do OpenRouter dá acesso a tudo.

**P: OpenRouter vê meus dados?**  
R: Sim (é um proxy). Para privacidade máxima, use `PREFER_LOCAL=true` e Ollama.

**P: Posso misturar direto + OpenRouter?**  
R: **Sim!** FazAI permite:
- OpenAI direto (via `genkitx-openai`)
- OpenRouter (200+ modelos via `genkitx-openrouter`)
- Ollama local (via `genkitx-ollama`)

**P: Como testar modelos diferentes?**  
R: Edite `DEFAULT_MODEL` no `fazai.conf` ou use:
```bash
GENKIT_MODEL=anthropic/claude-3.5-sonnet fazai "task"
```

---

## Links Úteis

- **OpenRouter:** https://openrouter.ai
- **Models List:** https://openrouter.ai/models
- **Pricing:** https://openrouter.ai/docs#models
- **API Docs:** https://openrouter.ai/docs
- **Status:** https://status.openrouter.ai

---

**Recomendação FazAI:**  
Usar **OpenRouter como default** e **Ollama como fallback local** para máxima flexibilidade e economia.
