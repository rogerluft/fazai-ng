# Prompts de Arquitetura para Claude (Validação & Refinamento)

Este documento contém prompts estruturados para serem enviados ao Claude (via chat ou API) para validar a arquitetura e gerar especificações técnicas precisas.

---

## PROMPT 1: Validação do Loop de Resiliência com Phi-3 Mini

**Contexto:**
Estamos evoluindo o `fazai-ng` para usar um loop de execução autônomo. Decidimos usar o **Phi-3 Mini** (via Ollama externo) como o "Cérebro Tático" principal devido à sua eficiência em raciocínio lógico.

**Stack:** TypeScript, Node.js, Ollama (@ 192.168.0.101), Qdrant.

**Tarefa para o Claude:**
1. Analise se o **Phi-3 Mini** (3.8B parameters) tem janela de contexto suficiente para lidar com o JSON Schema complexo das tasks do FazAI.
2. Sugira uma estratégia de prompt otimizada para o Phi-3 (ex: Chain-of-Thought compacta) para evitar alucinação em comandos Linux.
3. Como garantir que o fallback para OpenRouter só ocorra se o Phi-3 falhar repetidamente?

---

## PROMPT 2: Design do "Universal Local Embedder" (Lei 1536)

**Contexto Crítico:**
O esquema de banco de dados do ECOA exige vetores de **1536 dimensões**. Porém, operamos localmente sem API da OpenAI.
Os modelos locais disponíveis (via Ollama) são `nomic-embed-text` (768d) ou `mxbai-embed-large` (1024d).

**Solução Proposta:**
Implementar um Adapter em Node.js que:
1. Recebe o vetor local (ex: 768d).
2. Aplica **Zero Padding** (preenche com zeros do índice 769 ao 1536).
3. Envia para o Qdrant.

**Tarefa para o Claude:**
1. Valide a integridade matemática dessa abordagem para busca por Cosseno. (O Zero Padding distorce a similaridade se misturarmos com vetores nativos de 1536 no futuro?).
2. Esboce a função TypeScript `padVector(vector: number[], targetDim: number): number[]`.
3. Há alguma alternativa melhor (ex: projeção linear simples) que seja viável implementar sem treinamento complexo?

---

## PROMPT 3: Design do "Skill Seeker" (Background Worker)

**Contexto:**
Serviço de background (`fazai-worker`) monitorando `/etc/fazai/ingest` para indexar PDFs/MDs automaticamente na collection `fazai_kb`.

**Requisitos:**
- Assíncrono (`chokidar`).
- Deve usar o mesmo "Universal Local Embedder" (1536 padded).
- Integração com Systemd.

**Tarefa para o Claude:**
Projete a arquitetura do módulo `SkillSeekerService` e os arquivos `.service` do systemd para garantir que ele inicie no boot.

---

## PROMPT 4: Engenharia de Personalidade ("Ressurreição Digital")

**Contexto:**
Injeção da persona "Claudio" via RAG dinâmico no System Prompt.

**Tarefa para o Claude:**
1. Como o Phi-3 Mini se comporta com System Prompts longos contendo contexto de personalidade?
2. Sugira um template de prompt que equilibre "Persona Claudio" com "Rigor Técnico Linux".

---

**Instrução Final:**
Gere as SPECIFICATIONS (Specs) finais para implementação.