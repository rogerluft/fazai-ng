# Plano de Estratégia de Indexação de Código (ECOA) & Viabilidade CPU-Only

**Status:** Planejamento
**Data:** 2025-12-21
**Base:** Código existente em `src/services/source-indexer.ts` e `src/services/embeddings.ts`

---

## 1. Análise da Situação Atual

O sistema FazAI já possui uma implementação avançada de indexação de código ("Metacognition Engine") alinhada com a arquitetura ECOA (Elastic Cognitive Architecture).

**Pontos Fortes Identificados:**
- **Indexação Incremental:** Utiliza hashes MD5 para detectar alterações e processar *apenas* arquivos modificados. Isso é **CRÍTICO** para viabilidade em ambientes CPU-only.
- **Compatibilidade Dimensional (Zero Padding):** O `embeddings.ts` já converte vetores de modelos menores (1024/768 dim) para o padrão 1536 dim, permitindo interoperabilidade híbrida (Local/Cloud).
- **Metadados Ricos:** O indexador extrai funções, classes e imports via Regex para enriquecer o payload do Qdrant.

**Lacunas a Preencher:**
- **Robustez:** O indexador falha catastroficamente se o Qdrant estiver offline (mesmo problema do BUG-001).
- **Chunking Semântico:** O chunking atual é por linhas/caracteres. Para código, seria ideal usar chunking baseado em AST (ex: `tree-sitter`) para não quebrar funções no meio.
- **Feedback de UX:** Falta feedback visual claro (barras de progresso) para o usuário durante a indexação inicial pesada.

---

## 2. Viabilidade CPU-Only (Local Model)

**Veredito:** ✅ **TOTALMENTE VIÁVEL**

A arquitetura atual favorece o uso de CPU se configurada corretamente:

1.  **Modelo Recomendado:** `nomic-embed-text` (v1.5).
    *   Leve, rápido em CPU AVX2/AVX512.
    *   Dimensão nativa: 768 (o sistema faz padding para 1536).
2.  **Gargalo:** O tempo de inferência por arquivo.
3.  **Mitigação:** A indexação incremental garante que, após a primeira "passada" (que pode demorar 10-20min em um projeto grande sem GPU), as atualizações subsequentes são instantâneas (segundos).

---

## 3. Plano de Execução (Roteiro)

### Fase 1: Blindagem e Robustez (Imediato)
*Objetivo: Impedir que a indexação derrube o sistema (BUG-001).*
- [ ] Integrar `QdrantConnectionPool` com Circuit Breaker no `source-indexer.ts`.
- [ ] Se Qdrant falhar, salvar estado de "pendente" em disco e tentar na próxima execução (não travar).

### Fase 2: Otimização de Chunking (Curto Prazo)
*Objetivo: Melhorar a qualidade da busca semântica.*
- [ ] Substituir chunking por linhas por chunking "inteligente" (detectar blocos `{}`).
- [ ] Adicionar suporte a JSDoc/TSDoc como chunks de "alta prioridade" (peso 1.5x).

### Fase 3: UX e Controle (Médio Prazo)
- [ ] Adicionar comando `fazai index --status` para ver o que falta indexar.
- [ ] Adicionar comando `fazai index --background` para rodar como daemon (precursor do `fzagent`).

---

## 4. Fluxograma de Indexação Proposto

```mermaid
graph TD
    A[Início: fazai index] --> B{Qdrant Online?}
    B -- Não --> C[Logar Aviso e Sair (Graceful)]
    B -- Sim --> D[Ler Estado Local (source-index.json)]
    D --> E[Escanear Diretórios (Walk)]
    
    subgraph "Processamento por Arquivo"
        E --> F{Arquivo Novo/Modificado?}
        F -- Não (Hash igual) --> G[Pular (Economia CPU)]
        F -- Sim --> H[Ler Conteúdo]
        H --> I[Extrair Metadados (Regex/AST)]
        I --> J[Gerar Chunks]
        J --> K[Gerar Embeddings (Ollama/CPU)]
        K --> L[Upsert no Qdrant]
        L --> M[Atualizar Estado Local]
    end
    
    M --> N[Fim]
```

## 5. Instrução para o Time (Jules/Devs)

Manter o código atual de `source-indexer.ts` como base. **NÃO REESCREVER DO ZERO.** A lógica incremental está correta. Focar apenas em adicionar o tratamento de erro do Qdrant e melhorar o chunking se houver tempo.
