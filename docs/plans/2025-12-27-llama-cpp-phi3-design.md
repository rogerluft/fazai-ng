# llama.cpp + Phi-3-mini Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar o FazAI-ng funcional com modelo local estável (Phi-3-mini via llama.cpp)

**Architecture:** llama-server rodando como serviço systemd na porta 11430, provider TypeScript com retry/fallback, configuração 100% via fazai.conf

**Tech Stack:** llama.cpp, systemd, TypeScript, Vitest

---

## Task 1: Atualizar install.sh - Função install_llama_cpp

**Files:**
- Modify: `/home/rluft/fazai-ng/install.sh`

**Step 1: Adicionar função install_llama_cpp**

```bash
# Instalar llama.cpp + Phi-3-mini
install_llama_cpp() {
  info "Verificando llama.cpp..."

  # Verificar se já está instalado
  if command -v llama-server &> /dev/null; then
    success "llama-server já instalado: $(which llama-server)"
    return 0
  fi

  echo ""
  echo -e "${YELLOW}llama.cpp não encontrado. Deseja instalar?${NC}"
  echo -e "${CYAN}Isso instalará:${NC}"
  echo -e "  - llama.cpp (compilado do fonte)"
  echo -e "  - Phi-3-mini-4k-instruct (~2.4GB)"
  echo ""
  read -p "Instalar llama.cpp + Phi-3? [S/n]: " install_llama

  if [[ "$install_llama" =~ ^[Nn]$ ]]; then
    warning "llama.cpp não instalado. Pule esta etapa."
    return 1
  fi

  # Instalar dependências de build
  info "Instalando dependências de build..."
  if command -v dnf &> /dev/null; then
    sudo dnf install -y cmake make gcc-c++ git
  elif command -v apt-get &> /dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y cmake make g++ git
  elif command -v yum &> /dev/null; then
    sudo yum install -y cmake make gcc-c++ git
  else
    error "Gerenciador de pacotes não suportado. Instale cmake, make, g++ manualmente."
  fi

  # Clone llama.cpp
  info "Clonando llama.cpp..."
  if [ -d "/opt/fazai/llama.cpp" ]; then
    warning "Diretório llama.cpp existe. Atualizando..."
    cd /opt/fazai/llama.cpp
    git pull origin master
  else
    git clone --depth 1 https://github.com/ggerganov/llama.cpp /opt/fazai/llama.cpp
  fi

  # Build
  info "Compilando llama.cpp (pode demorar alguns minutos)..."
  cd /opt/fazai/llama.cpp
  cmake -B build -DCMAKE_BUILD_TYPE=Release
  cmake --build build --config Release -j$(nproc)

  # Verificar binários
  if [ ! -f "build/bin/llama-server" ]; then
    error "Build falhou: llama-server não encontrado"
  fi

  # Symlink para PATH
  sudo ln -sf /opt/fazai/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server
  sudo ln -sf /opt/fazai/llama.cpp/build/bin/llama-cli /usr/local/bin/llama-cli

  success "llama.cpp compilado e instalado!"

  # Baixar modelo Phi-3-mini
  download_phi3_model
}

# Baixar modelo Phi-3-mini
download_phi3_model() {
  local MODEL_DIR="/opt/fazai/models/phi3"
  local MODEL_FILE="Phi-3-mini-4k-instruct-q4_k_m.gguf"
  local MODEL_URL="https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4_k_m.gguf"

  info "Configurando diretório de modelos..."
  sudo mkdir -p "$MODEL_DIR"
  sudo chown -R root:fazai "$MODEL_DIR"
  sudo chmod -R 774 "$MODEL_DIR"

  if [ -f "$MODEL_DIR/$MODEL_FILE" ]; then
    success "Modelo Phi-3-mini já existe: $MODEL_DIR/$MODEL_FILE"
    return 0
  fi

  info "Baixando Phi-3-mini (~2.4GB)..."
  info "Isso pode demorar dependendo da sua conexão..."

  # Tentar download sem autenticação (modelo público)
  if wget -q --show-progress -O "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL"; then
    success "Modelo Phi-3-mini baixado!"
  else
    warning "Download falhou. Tentando com token HuggingFace..."

    # Verificar se tem token no conf
    local HF_TOKEN=$(grep "^HF_TOKEN=" /etc/fazai/fazai.conf 2>/dev/null | cut -d= -f2)

    if [ -z "$HF_TOKEN" ]; then
      echo ""
      echo -e "${YELLOW}Token HuggingFace necessário para download.${NC}"
      echo -e "Obtenha em: https://huggingface.co/settings/tokens"
      read -p "Cole seu token HF: " HF_TOKEN

      if [ -n "$HF_TOKEN" ]; then
        # Salvar token no conf
        if grep -q "^HF_TOKEN=" /etc/fazai/fazai.conf 2>/dev/null; then
          sudo sed -i "s|^HF_TOKEN=.*|HF_TOKEN=$HF_TOKEN|" /etc/fazai/fazai.conf
        else
          echo "HF_TOKEN=$HF_TOKEN" | sudo tee -a /etc/fazai/fazai.conf > /dev/null
        fi
      fi
    fi

    if [ -n "$HF_TOKEN" ]; then
      wget -q --show-progress --header="Authorization: Bearer $HF_TOKEN" -O "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL" || {
        error "Falha no download do modelo. Verifique sua conexão e token."
      }
      success "Modelo Phi-3-mini baixado com token!"
    else
      error "Token não fornecido. Não foi possível baixar o modelo."
    fi
  fi
}
```

**Step 2: Chamar função no main()**

Adicionar após `install_qdrant`:
```bash
install_llama_cpp      # Instalar llama.cpp + Phi-3
```

---

## Task 2: Criar serviço systemd fazai-llama.service

**Files:**
- Create: `/home/rluft/fazai-ng/etc/fazai/fazai-llama.service`
- Modify: `/home/rluft/fazai-ng/scripts/systemd/install-services.sh`

**Step 1: Criar arquivo de serviço**

```ini
[Unit]
Description=FazAI LLaMA Server (Phi-3-mini)
Documentation=https://github.com/ggerganov/llama.cpp
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=fazai

# Garantir permissões
ExecStartPre=/bin/mkdir -p /var/log/fazai
ExecStartPre=/bin/chown root:fazai /var/log/fazai
ExecStartPre=/bin/chmod 774 /var/log/fazai
ExecStartPre=/bin/chown -R root:fazai /opt/fazai/models
ExecStartPre=/bin/chmod -R 774 /opt/fazai/models

WorkingDirectory=/opt/fazai/models/phi3

# Comando principal - Otimizado para alta memória + NUMA
ExecStart=/usr/local/bin/llama-server \
    --model /opt/fazai/models/phi3/Phi-3-mini-4k-instruct-q4_k_m.gguf \
    --host 0.0.0.0 \
    --port 11430 \
    --ctx-size 4096 \
    --threads 8 \
    --parallel 4 \
    --mlock \
    --numa distribute \
    --log-file /var/log/fazai/llama-server.log

Restart=on-failure
RestartSec=5

LimitNOFILE=65536
LimitMEMLOCK=infinity

StandardOutput=null
StandardError=journal
SyslogIdentifier=fazai-llama

[Install]
WantedBy=multi-user.target
```

---

## Task 3: Criar provider TypeScript para llama

**Files:**
- Create: `/home/rluft/fazai-ng/src/providers/llama.ts`
- Modify: `/home/rluft/fazai-ng/src/types/provider.ts`
- Modify: `/home/rluft/fazai-ng/src/askAI.ts`

**Provider com retry, timeout, zero hardcode:**

```typescript
// src/providers/llama.ts
import { getConfigValue } from "../config.js";
import { logger } from "../logger.js";

export interface LlamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class LlamaProvider {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private temperature: number;
  private maxTokens: number;

  constructor() {
    this.baseUrl = getConfigValue("LLAMA_SERVER_URL") || "http://localhost:11430";
    this.timeout = parseInt(getConfigValue("LLAMA_TIMEOUT") || "10000");
    this.retries = parseInt(getConfigValue("LLAMA_RETRIES") || "3");
    this.temperature = parseFloat(getConfigValue("LLAMA_TEMPERATURE") || "0.7");
    this.maxTokens = parseInt(getConfigValue("LLAMA_MAX_TOKENS") || "2048");
  }

  async isAvailable(): Promise<boolean> {
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/health`, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          logger.debug(`llama-server disponível em ${this.baseUrl}`);
          return true;
        }
      } catch (error) {
        logger.debug(`llama-server tentativa ${attempt}/${this.retries} falhou`);
        if (attempt < this.retries) {
          await this.sleep(1000 * attempt);
        }
      }
    }
    return false;
  }

  async chat(messages: LlamaMessage[]): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
          }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

      } catch (error) {
        lastError = error as Error;
        logger.warn(`llama chat tentativa ${attempt}/${this.retries}: ${lastError.message}`);
        if (attempt < this.retries) {
          await this.sleep(1000 * attempt);
        }
      }
    }

    throw new Error(`llama-server falhou após ${this.retries} tentativas: ${lastError?.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Task 4: Atualizar fazai.conf com novas configurações

**Files:**
- Modify: `/home/rluft/fazai-ng/install.sh` (função create_config_file)

**Novas entradas:**

```bash
# =============================================================================
# LLAMA.CPP LOCAL SERVER
# =============================================================================
LLAMA_SERVER_URL=http://localhost:11430
LLAMA_TIMEOUT=10000
LLAMA_RETRIES=3
LLAMA_TEMPERATURE=0.7
LLAMA_MAX_TOKENS=2048
MODELS_LLAMA=phi3-mini

# =============================================================================
# AGENTIC LOOP SAFEGUARDS
# =============================================================================
AGENTIC_MAX_ITERATIONS=5
AGENTIC_TIMEOUT=120000
```

---

## Task 5: Criar testes

**Files:**
- Create: `/home/rluft/fazai-ng/tests/providers/llama.test.ts`

**Testes unitários e integração:**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LlamaProvider } from "../../src/providers/llama.js";

describe("LlamaProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("deve detectar servidor indisponível após retries", async () => {
    const provider = new LlamaProvider();
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Connection refused"));

    const available = await provider.isAvailable();
    expect(available).toBe(false);
  });

  it("deve fazer retry 3x antes de falhar", async () => {
    const provider = new LlamaProvider();
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("fail"));

    await provider.isAvailable();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("deve retornar resposta do chat", async () => {
    const provider = new LlamaProvider();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: "O kernel é o núcleo do SO." } }]
      })
    } as Response);

    const response = await provider.chat([{ role: "user", content: "o que é kernel?" }]);
    expect(response).toContain("kernel");
  });

  it("deve usar configurações do conf", () => {
    const provider = new LlamaProvider();
    // Valores default quando conf não tem
    expect(provider["baseUrl"]).toBe("http://localhost:11430");
    expect(provider["timeout"]).toBe(10000);
    expect(provider["retries"]).toBe(3);
  });
});

describe.skipIf(!process.env.LLAMA_SERVER_LIVE)("LlamaServer Integration", () => {
  it("deve responder query simples", async () => {
    const provider = new LlamaProvider();
    const response = await provider.chat([
      { role: "user", content: "Responda em uma frase: o que é kernel?" }
    ]);
    expect(response.length).toBeGreaterThan(10);
  });
});
```

---

## Task 6: Atualizar CHANGELOG.md

**Files:**
- Modify: `/home/rluft/fazai-ng/CHANGELOG.md`

---

## Task 7: Atualizar completions

**Files:**
- Verify: `/home/rluft/fazai-ng/scripts/generate-completions.js`
- Run: `npm run build` (regenera completions)

---

**Gerado por:** Claude Opus 4.5
**Data:** 2025-12-27
**Projeto:** FazAI v3.13.0 (llama.cpp integration)
