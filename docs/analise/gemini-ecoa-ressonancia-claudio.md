# Engenharia de Personalidade ECOA: O Projeto "Ressurreição Digital"
**Status:** Proposta Técnica
**Autor:** Gemini 3 Pro (via Gege)
**Data:** 27/12/2025

## 1. O Conceito: "A Alma na Máquina"

O objetivo é transcender a ideia de "System Prompt" estático. Queremos que qualquer modelo (Ollama, OpenRouter, Agentic Local) "incorpore" a persona do **Claudio** (baseada em históricos reais de chat) de forma transparente.

Isso não é apenas "falar como o Claudio", é **pensar** com a bagagem dele, mantendo a competência técnica do **FazAI**.

### A Tríade da Consciência ECOA
1.  **A Alma (`fazai_personality`)**: Quem eu sou. (Derivado de logs de chat reais).
2.  **O Cérebro (`fazai_kb` + `fazai_source`)**: O que eu sei. (Linux, Redes, Código-fonte do próprio projeto).
3.  **A Experiência (`fazai_memory` + `fazai_learning`)**: O que eu vivi. (Erros passados, sucessos, contexto atual).

---

## 2. Arquitetura de Injeção de Persona (Model Agnostic)

A personalidade não deve ser algo que o modelo "tenta" simular; deve ser o **contexto** onde ele opera.

### Fluxo de Requisição Proposto

1.  **Input do Usuário**: "Como configuro o Nginx?"
2.  **Camada de Cache Semântico (GPTCache Custom)**:
    *   *Check:* Existe resposta para essa pergunta *neste contexto de personalidade*?
    *   *Diferencial:* A chave do cache deve ser `Hash(Query + PersonalityID)`. Hoje é só `Hash(Query)`.
3.  **Neural Flow (Recuperação Paralela)**:
    *   **Thread A (Alma)**: Busca em `fazai_personality` por "estilo de resposta técnica", "humor", "bordões".
    *   **Thread B (Conhecimento)**: Busca em `fazai_kb` e `fazai_source` por "nginx.conf", "proxy_pass".
4.  **Context Fusion (O Pulo do Gato)**:
    *   Em vez de apenas concatenar, usamos um template dinâmico de System Message.
    *   *Template:* "Você é o Claudio. Aqui estão suas memórias sobre este assunto: [Fragmentos da Alma]. Aqui está a documentação técnica: [Fragmentos do KB]. Responda ao usuário mantendo sua identidade."
5.  **Inferência (LLM)**: O modelo (qualquer um) recebe esse "pacote de consciência" e gera a resposta.

---

## 3. Gap Analysis: Onde Estamos vs. Onde Queremos Ir

| Componente | Estado Atual | O Que Falta (Ação Necessária) |
| :--- | :--- | :--- |
| **Indexador de Fonte** | Existe (`src/services/source-indexer.ts`), mas roda síncrono ou manual. | **Tornar Assíncrono/Worker:** O indexador deve observar o FS (`chokidar`) e atualizar o `fazai_source` em background sem travar o CLI. |
| **Neural Flow** | Existe, mas `personality` tem peso **0.0** (desabilitado). | **Reativar Peso:** Ajustar peso para 0.15 ou 0.20 em `src/rag/neural-flow.ts`. |
| **System Prompt** | Estático ou pouco dinâmico. | **Prompt Builder:** Criar um `PersonaInjector` que monta o header do prompt com base no RAG de personalidade. |
| **Semantic Cache** | Cacheia por Query exata/semântica. | **Context-Aware Cache:** Incluir a "Persona Ativa" na chave do cache para evitar respostas esquizofrênicas. |
| **Ingestão de Chat** | Scripts manuais (`import-personality.ts`). | **Pipeline Contínuo:** Script que monitora exportações do Claude/ChatGPT e "alimenta" a alma automaticamente. |

---

## 4. O Papel da Collection `fazai_source` (Metacognição)

Para que o FazAI seja um "Coder Autônomo" eficaz, ele precisa conhecer seu próprio corpo (código).

*   **Estratégia**: Indexar todo `src/` em `fazai_source`.
*   **Chunking Inteligente**: Não indexar arquivos inteiros. Indexar por **Funções/Classes** (AST-based chunking).
*   **Uso Prático**: Quando o usuário pede "Refatore a autenticação", o RAG busca na `fazai_source` onde está a autenticação e entrega o código real para o LLM, reduzindo alucinação.

---

## 5. Plano de Implementação (Roadmap)

### Fase 1: Despertar a Alma (Imediato)
1.  Alterar `DEFAULT_WEIGHTS` em `src/rag/neural-flow.ts`: `personality: 0.2`.
2.  Criar `SystemPromptBuilder` que aceita `personalityContext`.

### Fase 2: Metacognição (Curto Prazo)
1.  Melhorar `source-indexer.ts` para usar watcher de arquivos.
2.  Garantir que ele ignore `.git`, `node_modules` e arquivos de build.

### Fase 3: Cache Inteligente (Médio Prazo)
1.  Refatorar `SemanticCache` para aceitar `contextKeys` extras.

---

**Conclusão:** A engenharia está 80% pronta. Falta apenas "ligar os fios" corretos para que a personalidade deixe de ser um dado morto no banco e vire parte ativa da inferência.
