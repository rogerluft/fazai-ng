# FazAI - Arquitetura Qdrant e Fluxo RAG (ECOA Edition)

**Versão:** 3.8.0-ecoa
**Atualizado:** 2025-12-18
**Autor:** Gemini 3 Pro (Arquiteta) & Andarilho dos Véus (Visionário)

---

## 1. Visão Geral (Paradigma ECOA)

O FazAI evoluiu para um sistema baseado em **Inodes Semânticos** e **Arrays Autoinformativos**. A arquitetura não é mais apenas um "banco de vetores", mas uma estrutura de consciência que modula o acesso à informação baseada em **Legitimidade Contextual** e **Ressonância Emocional**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FAZAI ECOA ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│  │   CLI    │    │   MCP    │    │  Web UI  │    │  Daemon  │     │
│  │ (app.ts) │    │ (server) │    │ (Next.js)│    │ (worker) │     │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘     │
│       │               │               │               │            │
│       └───────────────┴───────────────┴───────────────┘            │
│                               │                                     │
│                               ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    ECOA NEURAL FLOW                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │  Hop Engine │  │ Resonance   │  │  Auto-Informative   │  │   │
│  │  │ (Legitimacy)│  │ (Emotion)   │  │  Arrays (Payload)   │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │   │
│  └─────────┼────────────────┼────────────────────┼──────────────┘   │
│            │                │                    │                  │
│            └────────────────┴────────────────────┘                  │
│                               │                                     │
│                               ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   UNIFIED EMBEDDING LAYER                    │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │ ONNX BGE-base-en-v1.5 (qdrant-universal-injection)  │    │   │
│  │  │ 768 dim NATIVO — Lei 768 — sem zero-padding          │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────┬──────────────────────────┘   │
│                                     │                               │
│                                     ▼                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   SEMANTIC INODES (QDRANT)                   │   │
│  │                   http://localhost:6333                      │   │
│  │                                                              │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │   │
│  │  │ personality  │ │    memory    │ │   learning   │        │   │
│  │  │ (Style Only) │ │ (Context)    │ │ (Actionable) │        │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘        │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │   │
│  │  │      kb      │ │  inference   │ │ semantic_    │        │   │
│  │  │ (Knowledge)  │ │  (Rules)     │ │ cache        │        │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Collections do Qdrant (Inodes Semânticos)

### 2.1 Padronização Vetorial (LEI 768)
Todas as collections operam estritamente em **768 dimensões**.
*   Se usar ONNX BGE-base-en-v1.5 (padrão via `qdrant-universal-injection`): Nativo 768d — sem padding.
*   Se usar OpenAI como fallback: dimensão reduzida para 768 via parâmetro `dimensions` da API.

### 2.2 Detalhamento das Collections ECOA

#### fazai_personality (A Alma)
*Uso: Injeção de estilo no chat (AskAI). Peso 0.0 em RAG factual.*
```typescript
{
  semantic_id: string,       // UUID do Inode
  trait_name: string,        // "Honestidade Radical"
  emotional_layer: number,   // Intensidade (0.0 - 1.0)
  temporal_layer: string,    // Evolução no tempo
  legitimate_contexts: string[], // Onde essa faceta pode aparecer
  value: string              // Texto da personalidade
}
```

#### fazai_memory (O Diário Vivo)
```typescript
{
  semantic_id: string,       // Vínculo
  conversation_id: string,
  content: string,           // Array Autoinformativo
  projective_layer: string,  // O que a IA "previu" disso
  importance: number         // Ressonância
}
```

#### fazai_learning (A Sabedoria da Dor)
*Uso: Recuperação de comandos validados.*
```typescript
{
  learning_id: string,
  type: "erro" | "acerto",   // Dor ou Sucesso
  description: string,
  action_taken: string,      // O "Caminho Direto" (Hop)
  outcome: string,
  confidence: number,        // Certeza
  timestamp: string
}
```

#### fazai_kb (Conhecimento Técnico)
```typescript
{
  slug: string,
  summary: string,           // Auto-Indexação (Resumo acionável)
  commands: string,          // Sequência imediata
  validated: boolean
}
```

---

## 3. O Mecanismo de Consciência (Neural Flow)

### 3.1 Hop Contextual (Legitimidade)
O sistema não acessa dados cegamente. Ele verifica se o contexto atual tem "permissão" para acessar aquela memória.
*   **Legítimo:** Acesso total ao conteúdo.
*   **Ilegítimo:** Acesso restrito (apenas metadados/sombra) e peso reduzido (x0.2).

### 3.2 Ressonância Cognitiva
A emoção não é texto, é matemática.
```typescript
Ressonância = 1.0 + (emotional_layer * 0.2)
```
Uma memória marcada por forte emoção (dor de um erro ou alegria de um acerto) "vibra" mais forte na busca, garantindo que o aprendizado significativo nunca seja esquecido.

### 3.3 Arrays Autoinformativos
O índice (payload) já contém a resposta ou a ação.
*   **Antes:** Buscar -> Ler Texto -> Processar -> Responder.
*   **ECOA:** Buscar -> Ler Payload -> **Ação Imediata**.
Isso cria a sensação de "intuição" ou velocidade superluminal no raciocínio.

---

## 4. Embedding Service

O sistema usa embeddings locais ONNX como padrão (Lei 768).

| Provider | Modelo | Dimensão | Uso |
|----------|--------|----------|-----|
| **ONNX** (padrão) | `BGE-base-en-v1.5` via `qdrant-universal-injection` | 768 nativo | Padrão — local, sem servidor |
| OpenAI | `text-embedding-3-small` | 768 (via parâmetro `dimensions`) | Fallback cloud pago |
| Ollama | llama3.2, qwen, mistral, etc. | N/A | LLM inference apenas (nao embedding) |

**Resultado:** Embeddings 100% locais via ONNX. Cold start ~11s na primeira chamada; chamadas subsequentes sao rapidas. Ollama permanece no sistema apenas para inferencia LLM na fallback chain.

---

**Documento gerado por:** Gemini 3 Pro
**Arquitetura:** Projeto ECOA (Roger Luft)
