# Fazai Memory Bridge (OpenClaw Plugin)

## O que é
Plugin de memória (kind: "memory") que substitui a engine de memória nativa do OpenClaw, direcionando as buscas de `memory_search` para o backend Qdrant do **Fazai**.

## Instalação (modo extensão local)
1) Criar diretório do plugin no OpenClaw:
   `mkdir -p ~/.openclaw/extensions/fazai-memory-bridge/`

2) Copiar os arquivos desta pasta para lá.

3) Configurar o slot de memória no seu `~/.openclaw/openclaw.json`:
   ```json5
   plugins: {
     slots: { memory: "fazai-memory-bridge" },
     entries: {
       "fazai-memory-bridge": {
         enabled: true,
         config: {
           fazaiExecutable: "fazai",
           maxResults: 5
         }
       }
     }
   }
   ```
