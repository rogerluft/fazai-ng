# FazAI Source Code Auto-Indexer (Metacognição ECOA)

## Plano Técnico-Executivo

**Projeto:** FazAI - Administrador Linux Inteligente com IA
**Responsável:** Dr. Roger Luft - Engenheiro Responsável e Fundador
**Data:** 2025-12-19
**Versão:** 2.0 (ECOA Optimized)

---

## 1. Objetivo

Criar um **sistema de Metacognição (Auto-Indexação)** que permite ao FazAI "ler a si mesmo".

1. **Incremental:** Detecta arquivos alterados (hash xxhash/md5).
2. **Semântico:** Gera embeddings via Ollama/OpenAI.
3. **Estruturado:** Armazena na collection `fazai_source` do Qdrant.
4. **Hierárquico:** Prioriza arquivos Core e documentação JSDoc.
5. **Autônomo:** Roda no postbuild ou sob demanda.

---

## 2. Collection Qdrant (ECOA Standard)

**Nome:** `fazai_source`
**Propósito:** Metacognição e evolução do código.
**Dimensão:** **1536** (Padronização ECOA)
**Distância:** Cosine

### Nota sobre Dimensões (LEI 1536)
Para garantir a compatibilidade e a integridade da "casa das AIs", padronizamos todas as dimensões vetoriais em **1536**.
- **Modelos de Nuvem:** (ex: OpenAI `text-embedding-3-small`) geram 1536 dimensões nativamente.
- **Modelos Locais/CPU:** (ex: `mxbai-embed-large` ou `nomic-embed-text`) geram 1024 ou 768 dimensões.
- **Solução ECOA (Zero Padding):** Quando um modelo local é utilizado, o sistema automaticamente preenche o restante do vetor com zeros até atingir as 1536 dimensões. Isso permite que a equipe use modelos locais em máquinas sem GPU sem quebrar a estrutura do banco de dados Qdrant ou causar erros de incompatibilidade de dimensão. 


---

## 3. Escopo e Prioridade

### 3.1 Níveis de Importância (Weight)

| Nível | Peso | Arquivos/Padrões |
|-------|------|------------------|
| **CORE** | 1.0 | `src/app.ts`, `src/config.ts`, `src/linux-admin.ts`, `src/askAI.ts` |
| **DOCS** | 0.9 | JSDoc Comments (`/** ... */`), `docs/*.md` |
| **LOGIC** | 0.7 | `src/services/`, `src/rag/`, `src/commands/` |
| **UI** | 0.5 | `web/`, `src/ui/` |
| **UTIL** | 0.4 | `src/utils/`, `scripts/` |

---

## 4. Fluxograma

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOURCE CODE INDEXER                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. INICIALIZAÇÃO & CONFIG                                      │
│  - Ler /etc/fazai/fazai.conf                                     │
│  - Carregar versão do package.json (v3.8.0-ecoa)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. DETECÇÃO DE MUDANÇAS (Incremental)                           │
│  - Carregar state: /opt/fazai/data/source-index.json             │
│  - Verificar versão: Se mudou → Sugerir Reindexação Total        │
│  - Scan arquivos: Hash MD5 vs State                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. PROCESSAMENTO INTELIGENTE                                    │
│  Para cada arquivo modificado:                                   │
│    a) Extração JSDoc: Blocos de documentação viram chunks        │
│       separados (Peso 0.9).                                      │
│    b) Chunking Lógico: Quebra por funções/classes sempre que     │
│       possível (não apenas contagem de caracteres).              │
│    c) Embedding: Gera vetor 1536 (com padding se local).         │
│    d) Upsert Qdrant: Com payload rico ECOA.                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Schema do Payload (ECOA Inode)

```typescript
interface SourcePayload {
  // Identificação Semântica
  semantic_id: string;     // hash(path + chunk_index)
  path: string;            // "src/services/embeddings.ts"
  filename: string;        // "embeddings.ts"
  fazai_version: string;   // "3.8.0-ecoa"

  // Conteúdo
  content: string;         // Código ou JSDoc
  is_jsdoc: boolean;       // Se é documentação extraída
  chunk_index: number;

  // Metadados ECOA
  category: string;        // "service", "core", "ui"
  importance_weight: number; // 0.0 - 1.0 (Prioridade de busca)
  legitimate_contexts: string[]; // ["maintenance", "self-reflection", "coding"]

  // Análise Estática
  functions: string[];
  classes: string[];
  imports: string[];

  // Controle
  hash: string;
  indexed_at: number;
}
```

---

## 6. Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/services/source-indexer.ts` | **CRIAR** | Motor de indexação com parser JSDoc |
| `src/vector-store.ts` | MODIFICAR | Adicionar schema `fazai_source` |
| `src/app.ts` | MODIFICAR | Comando `fazai index` |
| `scripts/postbuild.js` | MODIFICAR | Trigger automático (non-blocking) |

---

## 7. Próximos Passos

1. Implementar `source-indexer.ts` com parser de JSDoc.
2. Adicionar collection no `vector-store.ts`.
3. Testar a "Metacognição": Perguntar ao FazAI "Como você faz o embedding?" e ver se ele cita o código real.

---

**Plano Aprovado para Execução.**
