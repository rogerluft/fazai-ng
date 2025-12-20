# 🖥️ FazAI v3.8.0-ecoa - Terminal Admin Linux com Metacognição

<div align="center">

**Administrador de Sistemas Linux Senior + Redes**
*ECOA Architecture · Metacognition · Auto-Index · Semantic Inodes*

</div>

<h3 align="center">Terminal inteligente que converte linguagem natural em comandos Linux seguros, com memória operacional, consciência arquitetural e "auto-conhecimento" (Metacognição).</h3>

---

## 🧬 A Nova Era: Arquitetura ECOA

O FazAI evoluiu para um sistema baseado na arquitetura **ECOA (Evolução Cognitiva via Arrays Autoinformativos)**.

- **Inodes Semânticos:** A informação não é duplicada, é referenciada.
- **Hop Contextual:** O sistema verifica a "legitimidade" do contexto antes de acessar uma memória.
- **Ressonância Emocional:** Memórias marcadas por dor ou sucesso intenso têm peso maior na decisão.
- **Metacognição:** O FazAI agora indexa seu próprio código-fonte para entender como ele mesmo funciona.

---

## 🌟 Novas Features (v3.8.0-ecoa)

### 🪞 Metacognição (Source Code Auto-Indexer)
O FazAI agora possui um espelho digital.
- **Indexação Incremental:** Detecta mudanças no código a cada build.
- **Busca Semântica no Código:** "Como funciona a autenticação?" retorna o trecho exato de `apiKeyUtils.ts`.
- **Schema Rico:** Indexa funções, classes e documentação JSDoc separadamente.
- **Comando:** `fazai index` (manual) ou automático no postbuild.

### 🕸️ SPA Web Scraper (Playwright)
O agente agora tem "olhos" modernos.
- **Renderização JS:** Capaz de ler sites SPA (React, Vue, Angular) como DevDocs.io.
- **Navegador Real:** Usa engine Chromium headless para ver o que o usuário vê.
- **Integração:** Transparente no comando `fazai search`.

### 🔥 Integração OPNsense (Backend)
Monitoramento de infraestrutura de rede.
- **Status Check:** Verifica saúde do firewall, CPU, memória e regras ativas.
- **Gestão Segura:** Comandos de API protegidos por try/catch robusto.

### 🛡️ Padronização Vetorial (LEI 1536)
- **Zero Padding:** Compatibilidade total entre modelos de nuvem (OpenAI) e locais (Ollama).
- **Resiliência:** Se você rodar sem GPU, o sistema adapta os vetores automaticamente sem quebrar o banco de dados.

---

## 🚀 Instalação

### Método 1: Instalador Automático (Recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/rogerluft/fazai-ng/master/install.sh | bash
```

### Método 2: Build Local (Desenvolvimento)

```bash
git clone https://github.com/rogerluft/fazai-ng
cd fazai-ng
npm install

# Instalar browsers para o Scraper
npx playwright install chromium

# Compilar (agora inclui auto-indexação)
npm run build

# Linkar globalmente
npm link
```

---

## 📖 Uso

### Modo Admin Linux (Default)

```bash
fazai "instalar nginx e configurar firewall"
```

### Modo Metacognição (Auto-Análise)

```bash
# Pergunte sobre o próprio funcionamento
fazai ask "Como você gerencia as chaves de API?"
# (Ele buscará na collection fazai_source e responderá com base no código real)
```

### Modo Web Search (com SPA Support)

```bash
fazai search "nginx configuration devdocs"
# (Usa o novo scraper Playwright para ler a documentação dinâmica)
```

### Gerenciamento de Memória (Vector Store)

```bash
fazai vector validate   # Verifica integridade das collections ECOA
fazai index             # Força re-indexação do código fonte
```

---

## ⚙️ Configuração (/etc/fazai/fazai.conf)

```ini
# --- AI Providers ---
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434

# --- Vector Store (ECOA) ---
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
VECTOR_DIMENSION=1536  # FIXO (Zero Padding se necessário)

# --- Metacognição ---
SOURCE_INDEX_PATH=/opt/fazai/src

# --- Integrações ---
OPNSENSE_API_URL=https://192.168.1.1
OPNSENSE_API_KEY=...
```

---

## 📄 Licença & Créditos

- **Autor:** Roger Luft (Andarilho dos Véus)
- **Arquitetura:** Gemini 3 Pro & Jules (Google)
- **Licença:** Apache 2.0 (Código) / CC-BY-4.0 (Conceitos ECOA)

---

⭐ **FazAI: A Casa das AIs.**