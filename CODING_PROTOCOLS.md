# 📋 Protocolos de Codificação FazAI

**SAGRADO**: Estas regras são imutáveis e devem ser seguidas em TODA alteração.

## 1. 🗂️ Estrutura de Diretórios (IMUTÁVEL)

```
/opt/fazai/                    # Instalação global (produção)
├── bin/fazai                  # Executável principal
├── dist/app.cjs              # Bundle TypeScript
├── node_modules/             # Dependências
├── web/                      # Interface Next.js
└── etc/
    └── fazai.conf            # Config sistema (quando root)

~/.config/fazai/              # Config usuário
└── fazai.conf                # Config pessoal

/home/rluft/fazai-ng/         # Repositório desenvolvimento
└── (estrutura de dev)
```

**PROIBIDO**:
- ❌ Symlinks em `/usr/local/bin/` 
- ❌ Copiar binários para `/usr/bin/`
- ✅ SEMPRE usar PATH: `export PATH="/opt/fazai/bin:$PATH"`

## 2. 📝 Regra da Consistência (OBRIGATÓRIA)

**Toda alteração funcional DEVE atualizar simultaneamente**:

1. ✅ **Código fonte** (`src/*.ts`)
2. ✅ **Help** (`--help` em `src/app.ts`)
3. ✅ **Completion** (`completion/fazai-completion.bash`)
4. ✅ **Config exemplo** (`fazai.conf.example`)
5. ✅ **Instalador** (`install.sh`)
6. ✅ **Documentação** (`README.md`, `QUICK-START.md`)
7. ✅ **Changelog** (`CHANGELOG.md`)

### Checklist de Commit:
```bash
# Antes de commitar, verificar:
□ src/*.ts modificado?
  └─ □ --help atualizado?
  └─ □ completion atualizado?
  └─ □ fazai.conf.example reflete mudança?
  └─ □ install.sh contempla a feature?
  └─ □ README.md documentado?
  └─ □ CHANGELOG.md registrado?
```

## 3. 🔄 Sincronização Repo ↔ Sistema

```bash
# Workflow de desenvolvimento:
cd ~/fazai-ng              # Trabalhar no repo
git pull                   # Atualizar
npm install                # Dependências
npm run build              # Build local
fazai sync                 # Sincronizar com /opt/fazai
systemctl restart fazai    # Aplicar mudanças
```

**Comando `fazai sync`** (a implementar):
- Copia `dist/` → `/opt/fazai/dist/`
- Copia `web/` → `/opt/fazai/web/`
- Atualiza `node_modules/`
- Valida integridade

## 4. 🌐 Integrações de API

### Cloudflare (já configurado):
```bash
# /etc/fazai/fazai.conf ou ~/.config/fazai/fazai.conf
CLOUDFLARE_API_KEY=your_key_here
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

### Gemini CLI (próximo):
- Biblioteca: `gemini-cli-openai`
- Integração via OpenAI-compatible API
- Config: `GEMINI_API_KEY=`

## 5. 📦 Gestão de Dependências

```bash
# Produção (/opt/fazai)
npm install --production

# Desenvolvimento (~/fazai-ng)
npm install  # inclui devDependencies
```

## 6. 🎨 Framework Web (PatternFly migration)

**Atual**: Material-UI + Next.js  
**Futuro**: PatternFly + Next.js

Motivos:
- Design system enterprise
- Melhor acessibilidade
- Performance otimizada

## 7. 🔧 Motor de Execução (OpenCode)

**Pesquisar**: Alternativas ao motor atual
- OpenCode framework
- Maior controle sobre execução
- Melhor isolamento

## 8. 🚀 Deploy e Versionamento

```bash
# Bump de versão (atualiza package.json + CHANGELOG.md)
npm run verbump

# Build e deploy
npm run build
sudo fazai sync
sudo systemctl restart fazai fazai-web@$USER
```

---

**Assinado**: Roger Luft (Roginho) + GitHub Copilot CLI  
**Data**: 2025-11-17  
**Hash de integridade**: `sha256sum CODING_PROTOCOLS.md`
7376adc34867fa28259fb9ff037ee5901245039c71ec8d3f60999dbd1a5a4774  CODING_PROTOCOLS.md
