---
name: install-sh-sync
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: (package\.json|fazai\.conf|src/app\.ts|completion/)
action: warn
---

# Verificar install.sh

Você modificou arquivos que podem afetar a instalação.

## Arquivos que Disparam Este Aviso:
- `package.json` - Dependências e versão
- `fazai.conf` - Configuração exemplo
- `src/app.ts` - CLI principal
- `completion/*` - Scripts de completion

## Verificações no install.sh:

### 1. Dependências do Sistema
```bash
# Novas dependências de sistema precisam ser adicionadas?
apt-get install -y <nova-dependencia>
```

### 2. Paths de Instalação
```bash
# Binário: /opt/fazai/
# Config: /etc/fazai/
# Completion: /etc/bash_completion.d/
```

### 3. Permissões
```bash
# Executáveis precisam de chmod +x?
chmod +x /opt/fazai/bin/fazai
```

### 4. Serviço Systemd
```bash
# Precisa atualizar o serviço?
systemctl daemon-reload
```

## Teste de Instalação:
```bash
# Em ambiente de teste:
sudo ./install.sh
fazai --version
fazai --help
```

**Nota:** Este é um aviso. Verifique se install.sh precisa de mudanças.
