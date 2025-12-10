
## CORECOES NO ARQUIVO TODO.MD EM SEGUIDA AJUSTAR AQUI E NO CHANGE LOG #

# TAREFA PARA AGENTE PARALELO - Terminal FazAI v3.1-beta

**ATENÇÃO:** Esta tarefa deve ser executada SEM placeholders, mocks ou simulações. Apenas código real e funcional.

## OBJETIVO PRINCIPAL

Garantir migração completa de "jarvis" para "fazai" e preparar sistema completo de importação de conversas para o Qdrant.

---

## CHECKLIST DE EXECUÇÃO

### ✅ TAREFA 1: Busca e Substituição Completa jarvis → fazai

**Comando de busca:**
```bash
grep -ri "jarvis" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist
```

**Ações:**
1. Buscar TODOS os arquivos que ainda contêm "jarvis" (case-insensitive)
2. Substituir por "fazai" mantendo o case (Jarvis → FazAI, jarvis → fazai, JARVIS → FAZAI)
3. Verificar especialmente:
   - Comentários no código
   - Strings de log
   - Nomes de variáveis
   - Mensagens de erro
   - Documentação inline
   - Arquivos de configuração
   - Scripts

**Arquivos que PODEM ter referências:**
- `src/**/*.ts`
- `*.md` (exceto PARALLEL_AGENT_TASK.md)
- `bin/fazai.js`
- `install.sh`
- `fazai.conf.example` (se existir)

**Reportar:**
- Total de ocorrências encontradas
- Arquivos modificados
- Linha exata de cada substituição

---

### ✅ TAREFA 2: Extrair Versão do CHANGELOG

**Arquivo:** `CHANGELOG.md` (criar se não existir)

**Ações:**
1. Verificar se existe `CHANGELOG.md`
2. Se NÃO existir, criar com estrutura:
```markdown
# Changelog - Terminal FazAI

## [3.1.0-beta] - 2025-11-14

### Added
- Arquitetura Terminal FazAI com 5 collections Qdrant
- Instalador completo via curl | bash
- Suporte a importação de conversas Claude/ChatGPT Desktop
- Collections especializadas para Admin Linux Senior + Redes

### Changed
- Renomeadas collections: jarvis_* → fazai_*
- Foco em infraestrutura: Linux + Redes

### Removed
- Milvus completamente removido
- Dependência @zilliz/milvus2-sdk-node

## [3.0.0-rc] - 2025-11-XX

### Added
- Fork inicial do Mandark
- Multi-provider AI (Claude, GPT, Ollama)
- Sistema de segurança com 5 camadas
- Modo CLI interativo
```

3. Extrair a versão atual (3.1.0-beta)
4. Validar que `package.json` tem a mesma versão
5. Se divergir, alinhar ambos

**Reportar:**
- Versão extraída
- Status de sincronização package.json ↔ CHANGELOG.md

---

### ✅ TAREFA 3: Instalação do Qdrant no install.sh

**Arquivo:** `install.sh`

**Adicionar seção de instalação do Qdrant:**

```bash
# ==============================================================================
# 6. INSTALAÇÃO DO QDRANT (se não estiver rodando)
# ==============================================================================

check_and_install_qdrant() {
  echo -e "\n${BLUE}Verificando Qdrant...${NC}"

  # Verificar se Qdrant já está rodando
  if curl -sf http://localhost:6333/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Qdrant já está rodando em localhost:6333${NC}"
    return 0
  fi

  echo -e "${YELLOW}Qdrant não detectado. Instalando...${NC}"

  # Detectar método de instalação
  if command -v docker &> /dev/null; then
    echo "Instalando Qdrant via Docker..."
    docker pull qdrant/qdrant:latest
    docker run -d -p 6333:6333 -p 6334:6334 \
      -v $(pwd)/qdrant_storage:/qdrant/storage:z \
      --name fazai-qdrant \
      qdrant/qdrant:latest

  elif command -v podman &> /dev/null; then
    echo "Instalando Qdrant via Podman..."
    podman pull qdrant/qdrant:latest
    podman run -d -p 6333:6333 -p 6334:6334 \
      -v $(pwd)/qdrant_storage:/qdrant/storage:z \
      --name fazai-qdrant \
      qdrant/qdrant:latest

  else
    echo -e "${YELLOW}Docker/Podman não encontrado. Instalando Qdrant via binário...${NC}"

    # Detectar arquitetura
    ARCH=$(uname -m)
    case $ARCH in
      x86_64) QDRANT_ARCH="x86_64" ;;
      aarch64|arm64) QDRANT_ARCH="aarch64" ;;
      *) echo -e "${RED}Arquitetura $ARCH não suportada${NC}"; return 1 ;;
    esac

    # Download da última versão
    QDRANT_VERSION="v1.7.4"  # Atualizar conforme necessário
    QDRANT_URL="https://github.com/qdrant/qdrant/releases/download/${QDRANT_VERSION}/qdrant-${QDRANT_ARCH}-unknown-linux-musl.tar.gz"

    wget -O /tmp/qdrant.tar.gz "$QDRANT_URL"
    tar -xzf /tmp/qdrant.tar.gz -C /tmp/
    sudo mv /tmp/qdrant /usr/local/bin/
    sudo chmod +x /usr/local/bin/qdrant

    # Criar serviço systemd
    sudo tee /etc/systemd/system/qdrant.service > /dev/null <<'SYSTEMD'
[Unit]
Description=Qdrant Vector Database
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/.fazai/qdrant
ExecStart=/usr/local/bin/qdrant
Restart=on-failure

[Install]
WantedBy=multi-user.target
SYSTEMD

    mkdir -p $HOME/.fazai/qdrant
    sudo systemctl daemon-reload
    sudo systemctl enable qdrant
    sudo systemctl start qdrant
  fi

  # Aguardar Qdrant ficar pronto
  echo "Aguardando Qdrant inicializar..."
  for i in {1..30}; do
    if curl -sf http://localhost:6333/health > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Qdrant instalado e rodando!${NC}"
      return 0
    fi
    sleep 1
  done

  echo -e "${RED}✗ Qdrant não iniciou corretamente${NC}"
  return 1
}

# Executar instalação do Qdrant
check_and_install_qdrant
```

**Adicionar ao fazai.conf:**
```ini
# Vector Store Qdrant
VECTOR_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
VECTOR_DIMENSION=1536
VECTOR_DISTANCE=Cosine
```

**Reportar:**
- Código adicionado ao install.sh
- Linha onde foi inserido
- Validação de que não quebrou o script

---

### ✅ TAREFA 4: Importador de Conversas (Claude/ChatGPT Desktop)

**Criar arquivo:** `src/conversation-importer.ts`

**Requisitos:**
- Ler arquivos JSON de export do Claude Desktop
- Ler arquivos JSON de export do ChatGPT Desktop
- Converter para o formato das collections do FazAI
- Inserir no Qdrant usando as collections corretas
- **SEM MOCKS** - usar cliente Qdrant real

**Formato Claude Desktop Export:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "created_at": "2025-11-14T10:00:00Z",
      "updated_at": "2025-11-14T10:30:00Z",
      "name": "Conversation title",
      "messages": [
        {
          "role": "user",
          "content": "message text",
          "created_at": "2025-11-14T10:00:00Z"
        },
        {
          "role": "assistant",
          "content": "response text",
          "created_at": "2025-11-14T10:01:00Z"
        }
      ]
    }
  ]
}
```

**Formato ChatGPT Desktop Export:**
```json
[
  {
    "id": "uuid",
    "title": "Conversation title",
    "create_time": 1699900000,
    "update_time": 1699901800,
    "mapping": {
      "message_id": {
        "message": {
          "author": {"role": "user"},
          "content": {"parts": ["message text"]},
          "create_time": 1699900000
        }
      }
    }
  }
]
```

**Collections de destino:**
- `fazai_memory` - Mensagens principais
- `fazai_kb` - Soluções técnicas extraídas (Linux/Redes)
- `fazai_learning` - Padrões de erro/sucesso

**Código deve incluir:**
```typescript
import { QdrantClient } from '@qdrant/js-client-rest';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

// Função REAL de importação
export async function importConversations(
  filePath: string,
  source: 'claude' | 'chatgpt'
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  // Implementação REAL aqui
}

// Função para extrair conhecimento técnico
export function extractTechnicalKnowledge(messages: any[]): any[] {
  // Identificar comandos Linux, soluções de rede, troubleshooting
  // Retornar array de objetos para fazai_kb
}

// Função para extrair padrões de aprendizado
export function extractLearningPatterns(messages: any[]): any[] {
  // Identificar erros resolvidos, otimizações, padrões
  // Retornar array para fazai_learning
}
```

**Criar comando CLI:**
```bash
fazai import <arquivo> --source=claude
fazai import <arquivo> --source=chatgpt
fazai import <diretorio> --source=claude --recursive
```

**Reportar:**
- Arquivo `src/conversation-importer.ts` criado
- Integração com `src/app.ts`
- Testes de importação com arquivo exemplo
- Número de mensagens importadas

---

### ✅ TAREFA 5: Validação Final - Checklist

Executar os seguintes comandos e reportar resultados:

```bash
# 1. Buscar referências a "jarvis"
echo "=== Buscando 'jarvis' restantes ==="
grep -ri "jarvis" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist | wc -l

# 2. Validar versão sincronizada
echo "=== Validando versão ==="
grep '"version"' package.json
grep '## \[' CHANGELOG.md | head -1

# 3. Testar build
echo "=== Testando build ==="
npm run build

# 4. Verificar tamanho do bundle
echo "=== Tamanho do bundle ==="
ls -lh dist/app.cjs

# 5. Validar config
echo "=== Validando sistema de config ==="
grep -n "\/etc\/fazai\/fazai.conf" src/config.ts

# 6. Testar Qdrant connection
echo "=== Testando Qdrant ==="
curl -s http://localhost:6333/health | jq

# 7. Validar collections
echo "=== Validando collections ==="
node dist/app.cjs vector validate

# 8. Testar importador (se implementado)
echo "=== Testando importador ==="
# Criar arquivo de teste e importar
```

**Gerar relatório final:**
```markdown
# Relatório de Migração FazAI v3.1-beta

## ✅ Concluído

- [ ] Todas as referências "jarvis" substituídas
- [ ] Versão sincronizada (package.json ↔ CHANGELOG.md)
- [ ] Qdrant instalado e rodando
- [ ] Collections validadas
- [ ] Importador de conversas funcionando
- [ ] Build sem erros
- [ ] Testes de integração passando

## 📊 Estatísticas

- Arquivos modificados: X
- Linhas alteradas: +Y / -Z
- Referências jarvis substituídas: N
- Conversas importadas (teste): M

## 🐛 Problemas Encontrados

(Listar qualquer problema e solução)

## 📝 Próximos Passos

(Se houver)
```

---

## REGRAS IMPORTANTES

1. **NÃO USE PLACEHOLDERS** - Todo código deve ser funcional
2. **NÃO USE MOCKS** - Integração real com Qdrant
3. **TESTE TUDO** - Cada função deve ser testada com dados reais
4. **REPORTE TUDO** - Cada ação deve ser documentada
5. **MANTENHA QUALIDADE** - Código TypeScript tipado, sem `any`

---

## FORMATO DE RESPOSTA ESPERADO

Ao final, forneça:

1. **Lista de arquivos modificados** com diff resumido
2. **Comandos executados** e seus outputs
3. **Checklist completo** marcado
4. **Relatório de migração** em Markdown
5. **Instruções** para próximos passos (se houver)

---

**Data:** 2025-11-14
**Versão:** 3.1.0-beta
**Responsável:** Agente Paralelo
