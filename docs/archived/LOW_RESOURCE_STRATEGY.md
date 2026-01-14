# FazAI Low-Resource Strategy (16GB RAM / No GPU)

**Objetivo:** Rodar inteligência real em hardware modesto (Laptop i5/i7, 16GB RAM, Gráficos Integrados).

---

## 1. O Desafio

Rodar modelos grandes (70B, 34B) é impossível sem GPU dedicada ou 64GB+ RAM.
Modelos pequenos (1B, 3B, 7B) cabem na RAM, mas sofrem em raciocínio complexo e seguimento de instruções (instruction following).

## 2. Estratégia de "Prompt Inteligente" (Cognitive Offloading)

Em vez de pedir para um modelo burro (1B) "pensar", nós damos a ele a resposta semi-pronta via RAG ou estruturamos o pensamento para ele.

### 2.1 Chain-of-Thought Guiado
Não peça: *"Instale nginx e configure proxy."*
Peça:
1. *"Liste comandos para instalar nginx."*
2. *"Liste comandos para criar config de proxy."*
3. *"Combine os dois."*

O FazAI (Orquestrador) quebra a tarefa complexa. O modelo local só executa passos simples.

### 2.2 Seleção de Modelos (Quantização é Vida)

Para 16GB RAM (reservando 8GB para OS + Apps + Qdrant):
Temos ~8GB livres para IA.

| Modelo | Tamanho (Q4_K_M) | RAM Req | IQ (Raciocínio) | Uso |
|--------|------------------|---------|-----------------|-----|
| **Qwen 2.5 7B** | ~4.5 GB | 6 GB | Alto | **Generalista (Default)** |
| **Llama 3.2 3B** | ~2.0 GB | 3.5 GB | Médio | Comandos Rápidos |
| **Gemma 2 2B** | ~1.5 GB | 2.5 GB | Médio | Classificação/Resumo |
| **Phi-3.5 Mini**| ~2.3 GB | 3.5 GB | Alto | Lógica |

**Recomendação:**
*   **Primary:** `qwen2.5:7b-instruct-q4_k_m` (O melhor balanceamento hoje).
*   **Fallback:** `llama3.2:3b`.

### 2.3 Descarregamento de Memória (Swap Inteligente)
O Ollama mantém o modelo na RAM por 5 min (default).
Se a máquina estiver apertada, podemos configurar `OLLAMA_KEEP_ALIVE=0` para descarregar imediatamente após o uso, liberando RAM para o Chrome/VSCode.

## 3. Aceleradores Sem GPU

*   **AVX-512 / AMX:** CPUs modernas têm instruções vetoriais. O `llama.cpp` (base do Ollama) usa isso muito bem.
*   **Zero Padding (Embeddings):** Nossa técnica implementada no ECOA permite usar modelos de embedding minúsculos (`nomic-embed-text`: 270MB) mantendo a estrutura do banco.

## 4. O "Truque" do RAG Estático

Se o modelo é "burro", aumentamos a inteligência do contexto.
Em vez de pedir "escreva um script de backup", nós buscamos um script perfeito no `fazai_kb` (Qdrant) e dizemos ao modelo:
*"Adapte este script (A) para o diretório (B)."*
Isso exige zero criatividade, apenas substituição de padrão. Até um modelo 1B consegue fazer isso.

**Conclusão:**
Com Qwen 2.5 7B (Q4) + RAG agressivo + Zero Padding nos Embeddings, o FazAI roda "liso" em 16GB de RAM, parecendo muito mais inteligente do que o hardware permitiria.
