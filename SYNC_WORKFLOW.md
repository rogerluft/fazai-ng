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

### 1️⃣ Desenvolvimento → Produção (Manual)

```bash
# No diretório do repo
cd ~/fazai-ng

# Rebuild + sync
npm run build
sudo cp -f dist/app.cjs /opt/fazai/dist/
sudo cp -f bin/fazai /opt/fazai/bin/

# Testar
fazai --version
```

### 2️⃣ Sincronização Automática (Futuro: `fazai sync`)

```bash
# Comando planejado (não implementado ainda)
fazai sync --from-repo ~/fazai-ng
```

### 3️⃣ Atualização via Git

```bash
# Dentro de /opt/fazai (instalação produção)
cd /opt/fazai
git pull origin master
npm install --production
npm run build
sudo systemctl restart fazai-web@$USER
```

---

## 📋 Checklist de Modificações

### Se você alterou código TypeScript (`src/`):
- [ ] `npm run build` no repo
- [ ] `sudo cp dist/app.cjs /opt/fazai/dist/`
- [ ] Testar: `fazai ask "teste"`

### Se você alterou o launcher (`bin/fazai`):
- [ ] `sudo cp bin/fazai /opt/fazai/bin/`
- [ ] Testar: `fazai --help`

### Se você alterou a web (`web/`):
- [ ] `cd web && npm run build`
- [ ] `sudo cp -r .next /opt/fazai/web/`
- [ ] `sudo systemctl restart fazai-web@$USER`

### Se você alterou dependências (`package.json`):
- [ ] `cd /opt/fazai && sudo npm install --production`

### Se você alterou configuração (`fazai.conf.example`):
- [ ] Atualizar `/etc/fazai/fazai.conf` manualmente
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
