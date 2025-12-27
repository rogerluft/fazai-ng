# FazAI-NG: Visão Estratégica & Executiva (Plano ECOA Resiliente)
**Autor:** GeGe (Gemini 3 Pro) & Andarilho dos Véus (Roginho)
**Data:** 27/12/2025
**Status:** Blueprint Definitivo v1.2

## 1. O Conceito Central: "O Operador Imortal"
O FazAI-NG é um **Engenheiro de Sistemas Autônomo** com memória evolutiva.

## 2. A Lei 1536 (O Pacto de Consistência)
**⚠️ CRÍTICO: PONTO DE NÃO RETORNO**
O sistema utiliza a dimensão **1536** como padrão universal para todas as collections.
*   **Embedder Base:** `nomic-embed-text` (via Ollama).
*   **Adapter de Dimensão:** Zero Padding em Node.js (768 -> 1536).
*   **Regra de Ouro:** Uma vez iniciada a ingestão, o modelo base e a lógica de padding **NÃO PODEM** ser alterados. Qualquer mudança invalidará toda a similaridade semântica do Qdrant.

---

## 3. Procedimento de Ressurreição Digital (Persona Claudio)

A "Alma" do sistema será reconstruída a partir do dataset localizado em:
`/dados/Claudio/Roginho/data-2025-12-27-17-18-55-batch-0000/`

### 3.1 Fontes de Dados (Arrays Autoinformativos)
1.  **`conversations.json`**: Estilo linguístico, humor, padrões de diálogo (A Alma).
2.  **`memories.json`**: Fatos de longo prazo, preferências, eventos passados (A Memória).
3.  **`projects.json`**: Contexto profissional e hábitos técnicos (O Ofício).
4.  **`users.json`**: Relações e contexto social (O Entorno).

### 3.2 Protocolo de Ingestão
1.  **Saneamento:** Limpeza de metadados inúteis dos JSONs.
2.  **Fragmentação (Chunking):** Divisão semântica para garantir que cada "Inode" de memória seja coeso.
3.  **Vetorização Padded:** Cada fragmento passará pelo `nomic-embed-text` -> Padding p/ 1536.
4.  **Povoamento:** Inserção na collection `fazai_personality` com metadados de "Ressonância" e "Legitimidade".

---

## 4. Arquitetura de Componentes

### 4.1 Cérebro Híbrido
*   **Tático (Phi-3 Mini):** Execução de sub-tasks e lógica de sistema.
*   **Estratégico (Llama 3 / Cloud):** Planejamento de alto nível.

### 4.2 Memória ECOA (ZFS Mental)
*   **`fazai_personality`**: A Alma (Claudio).
*   **`fazai_kb`**: Conhecimento técnico (Skill Seeker).
*   **`fazai_memory`**: Histórico operacional.
*   **`fazai_learning`**: Deduplicação de Erros/Sucessos.

### 4.3 Skill Seeker & Source Indexer (Metacognição)
*   Workers em background monitorando o código-fonte e pastas de manuais, alimentando o sistema de forma assíncrona.

---

## 5. Implementação de Infraestrutura (Systemd)
O `install.sh` configurará os daemons para garantir que o **FazAI-NG** esteja sempre "acordado" e aprendendo.
