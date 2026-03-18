# 📋 Status de Integração - FazAI v3.1-beta

**Data:** 15/11/2024  
**Versão:** 3.1.0-beta

> **NOTA IMPORTANTE:** Framework Python beta (`beta/fazai_genai_framework/`) está fora do escopo atual.  
> Esta análise foca APENAS no código TypeScript principal (`src/`) e instalador.

---

## 🔍 Análise do Código Principal (TypeScript)

### ✅ Implementado e Funcional (TypeScript Core)

#### 1. Collections Qdrant (Schema Definido)
- ✅ **fazai_personality** - Schema completo em `src/vector-store.ts`
  - Campos: `trait_name`, `category`, `value`, `intensity`, `context`, `tags`
  - Estrutura preparada para traços de personalidade com pesos
- ✅ **fazai_memory** - Memória operacional e histórico
- ✅ **fazai_learning** - Aprendizado técnico e padrões
- ✅ **fazai_kb** - Base de conhecimento Linux/Redes
- ✅ **fazai_inference** - Regras e políticas operacionais

#### 2. Funcionalidades Core
- ✅ Vector store abstraction com Qdrant
- ✅ Sistema de segurança 5 camadas
- ✅ Modo CLI interativo com memória (`src/cli-mode.ts`)
- ✅ Multi-modelo IA (Claude, GPT, Ollama)
- ✅ MCP Context7 + fallback web (`src/research.ts`)
- ✅ Importador de conversas (`src/conversation-importer.ts`)
- ✅ Sistema de logging robusto (`src/logger.ts`)

#### 3. Instalador (`install.sh`)
- ✅ Verificação de dependências (Node.js 18+, npm, git)
- ✅ Clonagem e build automático
- ✅ Configuração de diretórios
- ✅ Setup de symlinks
- ✅ Configuração interativa de API keys
- ✅ Instalação opcional do Qdrant

---

## ❌ Lacunas Identificadas (Escopo Atual)

### 1. Cache de Respostas LLM
**Status:** ❌ **NÃO IMPLEMENTADO**

**Situação Atual:**
- Nenhum sistema de cache no código TypeScript
- Requisições repetidas sempre atingem a API
- Sem otimização de custos/performance

**Impacto:**
- ❌ Requisições repetidas custam dinheiro
- ❌ Performance degradada (latência sempre alta)
- ❌ Usuário não economiza tokens

**Soluções Possíveis (TypeScript):**
- **Opção A:** Implementar cache em memória simples (Map/LRU)
- **Opção B:** Usar Redis como cache externo
- **Opção C:** Usar `keyv` (npm) com múltiplos adapters
- **Opção D:** Implementar cache em SQLite local

> **NOTA:** Framework Python beta tem GPTCache mas está fora do escopo atual.

---

### 2. Peso/Modelo com Personalidade
**Status:** ❌ **NÃO INTEGRADO**

**Problemas:**
- Collection `fazai_personality` existe mas **não é consultada**
- Nenhum código em `src/` lê traits de personalidade
- Campo `intensity` (0.0-1.0) definido mas **não aplicado**
- Nenhuma lógica de modulação de comportamento

**Impacto:**
- ❌ Personalidade não influencia respostas do agente
- ❌ Trait weights não afetam decisões
- ❌ Sistema ignora expertise técnica configurada
- ❌ Preferências operacionais não são aplicadas

**Exemplo do que DEVERIA acontecer:**
```typescript
// Trait com intensity alta modula o prompt:
trait_name: "conservative_operations"
intensity: 0.9  // <- Alto peso

// Deveria resultar em:
"Você é EXTREMAMENTE cauteloso. Sempre prefira dry-run primeiro..."

// VS intensity baixa:
intensity: 0.2
"Você equilibra cautela com eficiência..."
```

**Solução Necessária:**
1. Criar `src/personality-loader.ts`
2. Consultar `fazai_personality` no Qdrant
3. Injetar traits no system prompt
4. Aplicar `intensity` como peso multiplicador



---

## 📊 Resumo Executivo (Escopo Atual)

| Item | Status | Criticidade | Esforço | Prazo |
|------|--------|-------------|---------|-------|
| **Cache LLM (TypeScript)** | ❌ Ausente | ⚠️ **Médio** | 🔨 Médio (4-6h) | 1 dia |
| **Personality → Behavior** | ❌ Não integrado | 🔴 **ALTO** | 🔨 Médio (4-6h) | 1 dia |

**Total estimado:** 8-12 horas de desenvolvimento

> **NOTA:** Itens relacionados ao framework Python beta foram removidos desta análise.

---

## 🎯 Plano de Ação Recomendado (Escopo Atual)

### Fase 1: Personality Integration (1 dia)
**Objetivo:** Fazer personality traits influenciarem comportamento

1. ✅ **Criar `src/personality-loader.ts`**
   - Consultar collection `fazai_personality` no Qdrant
   - Retornar traits ordenados por `intensity`
   - Cache em memória por 5 minutos
   - Fallback gracioso se collection não existir

2. ✅ **Modificar `src/linux-prompt.ts`**
   - Carregar traits ao gerar prompt
   - Injetar contexto de personalidade
   - Aplicar `intensity` como peso modificador
   - Top 5 traits mais relevantes

3. ✅ **Adicionar ao `src/askPrompt.ts`**
   - Mesma lógica para modo Ask
   - Personalidade influencia respostas gerais

**Resultado:** Traits funcionais e aplicados

**Esforço:** 4-6 horas

---

### Fase 2: Cache Simples (1 dia)
**Objetivo:** Reduzir custos e melhorar performance

4. ✅ **Criar `src/llm-cache.ts`**
   - Cache em memória (LRU ou Map)
   - TTL configurável (5-30 minutos)
   - Hash de prompt + modelo como key
   - Limite de tamanho (100-500 entradas)

5. ✅ **Integrar nos wrappers LLM**
   - `src/linux-admin.ts` - Verificar cache antes de API call
   - `src/askAI.ts` - Cache de respostas ask
   - Logs de cache hit/miss

6. ✅ **Adicionar configuração**
   - `CACHE_ENABLED=true/false` no fazai.conf
   - `CACHE_TTL_MINUTES=10`
   - `CACHE_MAX_ENTRIES=200`

**Resultado:** Cache funcional sem dependências externas

**Esforço:** 4-6 horas

---

### Opcional: Melhorias Futuras

7. ⭐ **Cache persistente** (SQLite/Redis)
8. ⭐ **Dashboard web** para gerenciar traits
9. ⭐ **Auto-tuning** de intensity baseado em feedback

---

## 💡 Implementação Rápida (MVP)

### Arquivo 1: `src/personality-loader.ts`

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";
import { getConfigValue } from "./config";
import { logger } from "./logger";

export interface PersonalityTrait {
  trait_name: string;
  category: string;
  value: string;
  intensity: number;
  context?: string;
  tags?: string[];
}

let cachedTraits: PersonalityTrait[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function loadPersonalityTraits(): Promise<PersonalityTrait[]> {
  const now = Date.now();
  
  // Cache válido?
  if (cachedTraits && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedTraits;
  }
  
  try {
    const qdrantUrl = getConfigValue("QDRANT_URL") || "http://localhost:6333";
    const qdrantKey = getConfigValue("QDRANT_API_KEY");
    
    const client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantKey || undefined,
    });
    
    // Query todos os traits
    const result = await client.scroll("fazai_personality", {
      limit: 100,
      with_payload: true,
      with_vector: false,
    });
    
    const traits: PersonalityTrait[] = result.points.map((point: any) => ({
      trait_name: point.payload.trait_name,
      category: point.payload.category,
      value: point.payload.value,
      intensity: point.payload.intensity || 0.5,
      context: point.payload.context,
      tags: point.payload.tags,
    }));
    
    // Ordenar por intensity (mais importante primeiro)
    traits.sort((a, b) => b.intensity - a.intensity);
    
    cachedTraits = traits;
    cacheTimestamp = now;
    
    logger.info(`Loaded ${traits.length} personality traits`);
    return traits;
    
  } catch (error) {
    logger.warn(`Failed to load personality traits: ${error}`);
    return cachedTraits || []; // Fallback para cache antigo
  }
}

export function clearPersonalityCache() {
  cachedTraits = null;
  cacheTimestamp = 0;
}
```

### Arquivo 2: `src/linux-prompt.ts` (Modificado)

```typescript
import { LinuxCommandTypeStr } from "./types-linux";
import { loadPersonalityTraits } from "./personality-loader";

export const linuxAdminPrompt = async (task: string) => {
  // Carregar traits de personalidade
  const traits = await loadPersonalityTraits();
  
  let personalityContext = "";
  if (traits.length > 0) {
    // Top 5 traits mais importantes
    const topTraits = traits.slice(0, 5);
    personalityContext = `\n\nPERSONALIDADE DO ADMINISTRADOR:\n${topTraits
      .map(t => {
        const weight = t.intensity >= 0.8 ? "FORTEMENTE" :
                      t.intensity >= 0.6 ? "moderadamente" :
                      "levemente";
        return `- ${weight} ${t.trait_name}: ${t.value}`;
      })
      .join("\n")}\n`;
  }

  return `Task: ${task}
${personalityContext}
Você é um administrador de sistemas Linux experiente. Analise a tarefa solicitada e gere comandos Linux apropriados para executá-la.

IMPORTANTE:
1. Sempre considere a segurança - use comandos não-destrutivos quando possível
2. Inclua verificações de segurança antes de comandos perigosos
3. Forneça comandos de rollback quando aplicável
4. Use caminhos absolutos quando necessário
5. Considere o contexto do sistema (Ubuntu/Debian baseado)
${traits.length > 0 ? "6. Ajuste suas decisões baseado nos traços de personalidade acima\n" : ""}
Siga esta especificação de tipos e retorne APENAS um array JSON válido:

\`\`\`typescript
${LinuxCommandTypeStr}
\`\`\`
...`;
};
```

### Arquivo 3: `src/llm-cache.ts` (Novo)

```typescript
import { logger } from "./logger";
import { getConfigValue } from "./config";

interface CacheEntry {
  response: string;
  timestamp: number;
  model: string;
}

class LLMCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private ttlMs: number;
  private enabled: boolean;
  
  constructor() {
    this.maxEntries = parseInt(getConfigValue("CACHE_MAX_ENTRIES") || "200");
    const ttlMinutes = parseInt(getConfigValue("CACHE_TTL_MINUTES") || "10");
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.enabled = getConfigValue("CACHE_ENABLED") !== "false";
    
    logger.info(`LLM Cache initialized (enabled: ${this.enabled}, max: ${this.maxEntries}, ttl: ${ttlMinutes}m)`);
  }
  
  private generateKey(prompt: string, model: string): string {
    // Simple hash (pode usar crypto.createHash para produção)
    return `${model}:${Buffer.from(prompt).toString('base64').substring(0, 64)}`;
  }
  
  get(prompt: string, model: string): string | null {
    if (!this.enabled) return null;
    
    const key = this.generateKey(prompt, model);
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug("Cache miss");
      return null;
    }
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      logger.debug("Cache expired");
      return null;
    }
    
    logger.info("Cache hit! ✓");
    return entry.response;
  }
  
  set(prompt: string, model: string, response: string): void {
    if (!this.enabled) return;
    
    // Enforce max size (LRU simple: remove oldest)
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    const key = this.generateKey(prompt, model);
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      model
    });
    
    logger.debug(`Cached response (size: ${this.cache.size}/${this.maxEntries})`);
  }
  
  clear(): void {
    this.cache.clear();
    logger.info("Cache cleared");
  }
  
  stats() {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      enabled: this.enabled,
      ttlMinutes: this.ttlMs / 60000
    };
  }
}

export const llmCache = new LLMCache();
```

---

## ✅ Checklist de Validação

Após implementação, verificar:

- [ ] `fazai vector validate` cria `fazai_personality`
- [ ] Traits podem ser adicionados manualmente ao Qdrant
- [ ] `src/personality-loader.ts` carrega traits corretamente
- [ ] Prompts incluem contexto de personalidade
- [ ] `intensity` modula o comportamento do agente
- [ ] Python 3.9+ detectado pelo instalador
- [ ] Virtualenv `.venv` criado em `~/.fazai/`
- [ ] Dependencies Python instaladas sem erro
- [ ] GPTCache funciona (teste manual)
- [ ] Documentação atualizada com novos recursos

---

## 📚 Documentação Adicional Necessária

1. **Guia de Personality Traits**
   - Como definir traits
   - Como ajustar intensity
   - Exemplos práticos

2. **Python Bridge API Reference**
   - Endpoints disponíveis
   - Formato de request/response
   - Autenticação (se houver)

3. **Troubleshooting**
   - Python virtualenv issues
   - GPTCache não funciona
   - Personality não carrega

---

**Próximos Passos Recomendados:**
1. Revisar este documento com a equipe
2. Priorizar Fase 1 (personality integration)
3. Implementar MVP em 1-2 dias
4. Testar em ambiente de desenvolvimento
5. Documentar mudanças
6. Deploy gradual em produção

**Contato:** Roger Luft (VeilWalker)  
**Repositório:** https://github.com/rogerluft/fazai-ng
