# 🔄 Workflow de Sincronização FazAI

## Arquitetura de Diretórios

```
┌─────────────────────────────────────────────────────────────┐
│                    AMBIENTE DE DESENVOLVIMENTO              │
│  📂 ~/fazai-ng/                                             │
│    ├── src/              (código TypeScript)                │
│    ├── dist/             (build local)                      │
│    ├── web/              (Next.js)                          │
│    ├── tsup.config.js    (configuração de build)           │
│    └── package.json      (dependências)                     │
└─────────────────────────────────────────────────────────────┘
                            ↓ npm run build
                            ↓ sudo cp dist/* /opt/fazai/dist/
┌─────────────────────────────────────────────────────────────┐
│                    INSTALAÇÃO GLOBAL                        │
│  📂 /opt/fazai/                                             │
│    ├── bin/fazai         (launcher script)                  │
│    ├── dist/app.cjs      (bundle executável)                │
│    ├── node_modules/     (dependências runtime)             │
│    ├── web/.next/        (build Next.js)                    │
│    └── package.json                                         │
│                                                             │
│  🔗 /usr/local/bin/fazai → /opt/fazai/bin/fazai            │
└─────────────────────────────────────────────────────────────┘
                            ↓ fazai (em qualquer terminal)
┌─────────────────────────────────────────────────────────────┐
│                    CONFIGURAÇÃO DO USUÁRIO                  │
│  📂 /etc/fazai/fazai.conf         (root/sistema)            │
│  📂 ~/.config/fazai/fazai.conf    (usuário local)           │
│                                                             │
│  Precedência: ~/.config/fazai → /etc/fazai → defaults      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Comandos de Sincronização

### 1️⃣ Sincronização do Desenvolvimento para Produção

O método canônico para sincronizar as alterações do seu diretório de desenvolvimento (`~/fazai-ng`) para a instalação global (`/opt/fazai`) é usando o comando `fazai sync`.

Este comando deve ser executado com `sudo` para ter permissão de escrita em `/opt/fazai`. O `-E` é importante para preservar as variáveis de ambiente, como `FAZAI_REPO`.

```bash
# No diretório do repo ou em qualquer lugar
sudo -E fazai sync
```

O comando irá automaticamente:
- Puxar as últimas alterações do seu repositório Git.
- Instalar quaisquer dependências novas ou atualizadas.
- Recompilar o projeto (`npm run build`).
- Sincronizar os arquivos necessários para `/opt/fazai` usando `rsync`.
- Reiniciar serviços relacionados, se necessário.


### 2️⃣ Sincronização Automática com `fazai sync`

O comando `fazai sync` é a maneira oficial de manter a instalação em `/opt/fazai` atualizada. Ele combina o `git pull` e o processo de build e cópia. Consulte a seção anterior para o uso correto.

---

## 📋 Checklist de Modificações

### Se você alterou código TypeScript (`src/`):
- [ ] Execute `sudo -E fazai sync` para reconstruir e sincronizar.
- [ ] Testar: `fazai ask "teste"`

### Se você alterou o launcher (`bin/fazai`):
- [ ] Execute `sudo -E fazai sync` para sincronizar o novo launcher.
- [ ] Testar: `fazai --help`

### Se você alterou a web (`web/`):
- [ ] Execute `sudo -E fazai sync`, que irá reconstruir e sincronizar a pasta `web/`.
- [ ] O `sync` tentará reiniciar o serviço `fazai-web` automaticamente.

### Se você alterou dependências (`package.json`):
- [ ] Execute `sudo -E fazai sync`. O comando irá rodar `npm install` no seu repo e copiar o `node_modules` atualizado.

### Se você alterou configuração (`fazai.conf.example`):
- [ ] Atualizar `/etc/fazai/fazai.conf` manualmente.
- [ ] Documentar no CHANGELOG.md

---

## 🔍 Verificação de Integridade

### Checar se CLI está usando a versão correta:
```bash
fazai --version
which fazai           # deve mostrar /usr/local/bin/fazai
readlink -f $(which fazai)  # deve mostrar /opt/fazai/bin/fazai
```

### Checar se o build está atualizado:
```bash
ls -lh /opt/fazai/dist/app.cjs
stat /opt/fazai/dist/app.cjs | grep Modify
```

### Checar se web está rodando:
```bash
sudo systemctl status fazai-web@$USER
curl http://localhost:3636
```

### Checar se Ollama está acessível:
```bash
curl http://192.168.0.101:11434/api/tags
```

---

## 🚨 Troubleshooting

### Problema: `fazai` não encontra comando
```bash
# Verificar symlink
ls -l /usr/local/bin/fazai

# Recriar symlink
sudo ln -sf /opt/fazai/bin/fazai /usr/local/bin/fazai

# Adicionar ao PATH (se necessário)
export PATH="/usr/local/bin:$PATH"
```

### Problema: Mudanças não aparecem após rebuild
```bash
# Verificar se copiou o arquivo certo
sudo cp -f dist/app.cjs /opt/fazai/dist/app.cjs

# Verificar timestamp
ls -l ~/fazai-ng/dist/app.cjs /opt/fazai/dist/app.cjs
```

### Problema: Erro de módulo não encontrado
```bash
# Reinstalar dependências em produção
cd /opt/fazai
sudo npm install --production --no-save
```

### Problema: Web não inicia (CHDIR error)
```bash
# Verificar se diretório existe
ls -ld /opt/fazai/web/.next

# Rebuildar web
cd /opt/fazai/web
sudo npm run build

# Recarregar serviço
sudo systemctl daemon-reload
sudo systemctl restart fazai-web@$USER
```

---

## 📦 Estrutura de Releases

### Desenvolvimento Contínuo (Branch: master)
- Commits diretos no repo `~/fazai-ng`
- Build manual + sync para `/opt/fazai`

### Releases Estáveis (Tags: v3.1.0, v3.2.0, etc.)
- Criar tag no Git
- Fazer push do release
- Instalar via `install.sh` oficial

---

## 🔐 Permissões

| Diretório | Owner | Permissões | Motivo |
|-----------|-------|------------|--------|
| `/opt/fazai` | root:root | 755 | Instalação global protegida |
| `/opt/fazai/bin/fazai` | root:root | 755 | Executável global |
| `/opt/fazai/dist/` | root:root | 755 | Runtime read-only |
| `/etc/fazai/` | root:root | 755 | Configuração sistema |
| `~/.config/fazai/` | user:user | 700 | Configuração privada usuário |

---

## 🎯 Boas Práticas

1. **Sempre rebuilde antes de copiar**: `npm run build`
2. **Use sudo apenas para copiar para /opt**: `sudo cp dist/* /opt/fazai/dist/`
3. **Teste localmente primeiro**: `node dist/app.cjs ask "teste"`
4. **Commit após sync bem-sucedido**: `git add . && git commit -m "feat: nova funcionalidade"`
5. **Documente no CHANGELOG.md**: Especialmente breaking changes

---

## 📝 Exemplo Completo de Workflow

```bash
# 1. Fazer alterações no código
cd ~/fazai-ng
vim src/linux-admin.ts

# 2. Rebuildar
npm run build

# 3. Testar localmente (opcional)
node dist/app.cjs ask "teste de nova feature"

# 4. Sincronizar para produção
sudo cp -f dist/app.cjs /opt/fazai/dist/

# 5. Testar em produção
fazai ask "teste de nova feature"

# 6. Commitar
git add src/linux-admin.ts dist/app.cjs
git commit -m "feat: adiciona suporte a novo provedor"
git push origin master

# 7. Atualizar CHANGELOG
echo "- Adiciona suporte a novo provedor" >> CHANGELOG.md
git add CHANGELOG.md
git commit -m "docs: atualiza changelog"
git push
```

---

**Última atualização**: 2025-11-16  
**Versão FazAI**: 3.1.0-beta
