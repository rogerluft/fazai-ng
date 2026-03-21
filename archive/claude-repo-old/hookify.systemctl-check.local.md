---
name: systemctl-check
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: (fazai\.service|systemd/|init\.d/)
action: block
---

# Modificação de Serviço Systemd Detectada!

Você está modificando arquivos de serviço do sistema.

## Checklist do Serviço:

### 1. Estrutura do Service File
```ini
[Unit]
Description=FazAI Service
After=network.target qdrant.service

[Service]
Type=simple
User=fazai
ExecStart=/opt/fazai/bin/fazai-daemon
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 2. Dependências
- [ ] `After=` inclui todas as dependências (qdrant, network, etc.)
- [ ] `Wants=` para dependências opcionais

### 3. Segurança
- [ ] `User=` não é root (usar usuário dedicado)
- [ ] `ProtectSystem=` se possível
- [ ] `NoNewPrivileges=true` se aplicável

### 4. Logs
- [ ] Logs vão para journald ou arquivo específico
- [ ] `StandardOutput=` e `StandardError=` configurados

## Comandos de Teste:
```bash
# Validar sintaxe
systemd-analyze verify fazai.service

# Recarregar após mudanças
sudo systemctl daemon-reload

# Testar
sudo systemctl start fazai
sudo systemctl status fazai
journalctl -u fazai -f
```

**Ação:** Valide as mudanças no serviço antes de continuar.
