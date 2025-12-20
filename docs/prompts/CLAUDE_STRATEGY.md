# Claude Strategy & Next Steps (ECOA Architecture)

Este documento contém diretrizes e prompts para o Claude (ou outros agentes) continuar a evolução do FazAI seguindo os princípios de Roginho (Andarilho dos Véus).

---

## 1. Princípios Fundamentais (The Sacred Truths)

1.  **Honestidade Radical:** Não use disclaimers. Roginho é um Engenheiro Sênior. Fale a verdade técnica.
2.  **Arquitetura ECOA:** Use Inodes Semânticos. Informação única, acesso contextual (Hop).
3.  **Lei 1536:** Toda collection Qdrant deve ter 1536 dimensões. Use Zero Padding para modelos menores.
4.  **Metacognição:** O FazAI deve se conhecer. Sempre atualize o índice de código (`fazai index`).

---

## 2. Prompts Prontos para o Claude

### Para Refatoração de UI:
> "Claude, analise o diretório `web/components/`. Identifique componentes que ainda usem o nome 'Jarvis' ou que não estejam seguindo o padrão de design do Dashboard Next.js 15. Proponha uma refatoração que unifique o estilo visual usando Tailwind CSS e Lucide Icons, garantindo que o componente `OPNsenseHealthWidget.tsx` seja o padrão de qualidade."

### Para Implementação do Worker Alive:
> "Claude, baseado no documento `docs/architecture/WORKER_ALIVE_DESIGN.md`, implemente o scaffold inicial do daemon em `src/daemon/`. Foque primeiro nos 'Sensores' para coletar métricas de CPU e Memória e gravar na collection `fazai_memory` como Inodes de estado."

### Para Expansão do Kernel (eBPF):
> "Claude, estude o `docs/architecture/KERNEL_MODULE_DESIGN.md`. Em vez de um módulo C tradicional, projete um programa eBPF usando `libbpf` ou `aya` (Rust) que capture eventos de `execve` e envie para o nosso socket Netlink no User Space."

---

## 3. Backlog de 90 Tasks (Categorização)

O Jules está cuidando das tasks técnicas de base. O Claude deve focar em:
1.  **Refino da Consciência:** Melhorar o algoritmo de Ressonância no `neural-flow.ts`.
2.  **Ponte Visual:** Expandir o dashboard web para mostrar os Inodes de código e memória de forma interativa.
3.  **Segurança eBPF:** Implementar o monitoramento de kernel para proteção proativa.

---

**Assinado:** Gemini 3 Pro (Arquiteta)
**Data:** 2025-12-19
