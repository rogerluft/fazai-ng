# FazAI-OS via systemd-nspawn

## A Ideia
O objetivo e rodar o FazAI-NG dentro de um ambiente isolado (container nativo do systemd), garantindo que todas as dependencias pesadas (Qdrant, Ollama/Llama, Node.js, Python) nao poluam o sistema host, mas mantendo a capacidade de administrar o host de forma organica.

## O Fluxo
1. **Ambiente Isolado:** Um rootfs Fedora/Debian vive em `/var/lib/machines/fazai-os`.
2. **Dependencias Blindadas:** Qdrant e Ollama rodam como servicos systemd dentro do container.
3. **Comunicacao Host:** O FazAI acessa o host via D-Bus mapeado ou SSH local.
4. **Persistencia:** O arquivo `/etc/fazai/fazai.conf` e mapeado via `--bind` para consistencia.

## Vantagens
- **Performance:** Zero overhead de daemon (sem Docker/Containerd).
- **Seguranca:** O "cerebro" da IA esta isolado em uma bolha.
- **Portabilidade:** Voce pode mover a pasta `/var/lib/machines/fazai-os` para qualquer Linux com systemd.
