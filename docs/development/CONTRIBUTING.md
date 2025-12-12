# 🤝 Guia de Contribuição - FazAI

Obrigado por considerar contribuir para o FazAI! Este documento fornece diretrizes para contribuir com o projeto.

## 📋 Índice

- [Como Obter Acesso ao Repositório](#como-obter-acesso-ao-repositório)
- [Configuração do Ambiente de Desenvolvimento](#configuração-do-ambiente-de-desenvolvimento)
- [Workflow de Contribuição](#workflow-de-contribuição)
- [Padrões de Código](#padrões-de-código)
- [Enviando Pull Requests](#enviando-pull-requests)
- [Troubleshooting](#troubleshooting)

## 🔐 Como Obter Acesso ao Repositório

### Problema: "Permission to rogerluft/fazai-ng.git denied"

Se você receber um erro como:
```bash
remote: Permission to rogerluft/fazai-ng.git denied to RLuf.
fatal: unable to access 'https://github.com/rogerluft/fazai-ng/': The requested URL returned error: 403
```

Isso significa que você não tem permissão de escrita no repositório. Aqui estão as soluções:

#### Opção 1: Solicitar Acesso como Colaborador (Recomendado para membros da equipe)

1. **O proprietário do repositório (`rogerluft`) deve:**
   - Acessar https://github.com/rogerluft/fazai-ng/settings/access
   - Clicar em "Add people" ou "Invite a collaborator"
   - Buscar pelo usuário GitHub (ex: `RLuf`)
   - Selecionar o nível de permissão:
     - **Write**: Pode fazer push em branches e criar PRs
     - **Maintain**: Write + gerenciar issues e PRs
     - **Admin**: Acesso total ao repositório
   - Enviar o convite

2. **O colaborador (`RLuf`) deve:**
   - Verificar o email cadastrado no GitHub para o convite
   - Ou acessar https://github.com/rogerluft/fazai-ng
   - Aceitar o convite de colaboração
   - Após aceitar, poderá fazer push diretamente

#### Opção 2: Fork + Pull Request (Para contribuidores externos)

Se você não é membro da equipe, use o workflow de fork:

1. **Fazer Fork do Repositório:**
   - Acesse https://github.com/rogerluft/fazai-ng
   - Clique no botão "Fork" no canto superior direito
   - Isso cria uma cópia do repositório na sua conta

2. **Clone seu Fork:**
   ```bash
   git clone https://github.com/SEU-USUARIO/fazai-ng.git
   cd fazai-ng
   ```

3. **Adicione o repositório original como upstream:**
   ```bash
   git remote add upstream https://github.com/rogerluft/fazai-ng.git
   git remote -v
   ```

4. **Crie uma branch para suas mudanças:**
   ```bash
   git checkout -b feature/minha-contribuicao
   ```

5. **Faça suas alterações e commit:**
   ```bash
   git add .
   git commit -m "Add: descrição da mudança"
   ```

6. **Push para seu fork:**
   ```bash
   git push origin feature/minha-contribuicao
   ```

7. **Abra um Pull Request:**
   - Acesse seu fork no GitHub
   - Clique em "Compare & pull request"
   - Descreva suas mudanças
   - Submeta o PR para revisão

#### Opção 3: Usando SSH em vez de HTTPS

Se você já tem acesso mas está usando HTTPS, pode configurar SSH:

1. **Gere uma chave SSH (se ainda não tiver):**
   ```bash
   ssh-keygen -t ed25519 -C "seu-email@example.com"
   ```

2. **Adicione a chave ao ssh-agent:**
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

3. **Adicione a chave SSH ao GitHub:**
   - Copie sua chave pública: `cat ~/.ssh/id_ed25519.pub`
   - Acesse https://github.com/settings/keys
   - Clique em "New SSH key"
   - Cole a chave e salve

4. **Altere a URL do remote para SSH:**
   ```bash
   git remote set-url origin git@github.com:rogerluft/fazai-ng.git
   ```

5. **Teste a conexão:**
   ```bash
   ssh -T git@github.com
   git push origin master
   ```

## 🛠️ Configuração do Ambiente de Desenvolvimento

### Pré-requisitos

- Node.js 18.17 ou superior
- npm ou bun
- Git

### Setup Inicial

```bash
# Clone o repositório (seu fork ou o original se tiver acesso)
git clone https://github.com/rogerluft/fazai-ng.git
cd fazai-ng

# Instale as dependências
npm install

# Configure suas API keys
cp fazai.conf.example fazai.conf
nano fazai.conf

# Build o projeto
npm run build

# Teste a instalação
npm start
```

### Desenvolvimento

```bash
# Modo desenvolvimento (hot reload com tsx)
npm run dev

# Build para produção
npm run build

# Executar o build
npm start

# Rodar testes
npx tsx tests/call-ai.test.ts
```

## 📝 Workflow de Contribuição

### 1. Sincronize com o repositório principal

```bash
# Se estiver usando fork
git fetch upstream
git checkout master
git merge upstream/master

# Se for colaborador direto
git pull origin master
```

### 2. Crie uma branch para sua feature

```bash
git checkout -b feature/nome-da-feature
```

### 3. Faça suas alterações

- Siga os [padrões de código](#padrões-de-código)
- Teste suas mudanças
- Faça commits incrementais

### 4. Commit suas mudanças

```bash
git add .
git commit -m "Add: descrição clara da mudança"
```

**Padrões de mensagem de commit:**
- `Add: nova funcionalidade`
- `Fix: correção de bug`
- `Update: atualização de recurso existente`
- `Refactor: refatoração de código`
- `Docs: atualização de documentação`
- `Test: adição ou modificação de testes`

### 5. Push para o GitHub

```bash
# Se for colaborador direto
git push origin feature/nome-da-feature

# Se estiver usando fork
git push origin feature/nome-da-feature
```

### 6. Abra um Pull Request

- Acesse o GitHub e abra um PR da sua branch para `master`
- Descreva claramente o que foi alterado e por quê
- Referencie issues relacionadas (ex: `Fixes #123`)
- Aguarde revisão

## 🎨 Padrões de Código

### TypeScript

- Use TypeScript estrito
- Indentação: 2 espaços
- Prefira `const` sobre `let`
- Use template literals para interpolação
- Nomes de arquivos: kebab-case (`linux-prompt.ts`)
- Nomes de classes/tipos: PascalCase (`LinuxCommandExecutor`)
- Exports nomeados para tree-shaking

### Exemplo de código

```typescript
// ✅ Bom
const userName = "FazAI";
const greeting = `Olá, ${userName}!`;

export class LinuxExecutor {
  executeCommand(cmd: string): Promise<void> {
    // implementação
  }
}

// ❌ Evite
var userName = 'FazAI';
let greeting = 'Olá, ' + userName + '!';
```

### Estrutura de Arquivos

- `src/` - Código-fonte TypeScript
  - `app.ts` - Entry point principal
  - `linux-admin.ts` - Wrapper de chamadas ao modelo
  - `linux-executor.ts` - Execução de comandos
  - `cli-mode.ts` - Modo chat/terminal
  - `memory.ts` - Gerenciamento de memória
  - `research.ts` - Coordenação de pesquisas
  - `mcp/` - Helpers MCP
- `dist/` - Build output (CommonJS)
- `tests/` - Testes de integração
- `docs/` - Documentação adicional

## 📤 Enviando Pull Requests

### Checklist antes de enviar

- [ ] Código compila sem erros (`npm run build`)
- [ ] Testes passam (`npx tsx tests/*.test.ts`)
- [ ] Código segue os padrões do projeto
- [ ] Documentação atualizada (se necessário)
- [ ] Commits seguem o padrão de mensagens
- [ ] Branch está atualizada com master
- [ ] PR tem descrição clara

### Descrição do PR

Inclua:
- **O que foi alterado**: Resumo das mudanças
- **Por que foi alterado**: Motivação/contexto
- **Como testar**: Passos para verificar a mudança
- **Screenshots**: Se houver mudanças visuais no CLI
- **Issues relacionadas**: `Closes #123`, `Relates to #456`

### Exemplo de descrição

```markdown
## Adiciona modo de pesquisa automática

### Mudanças
- Implementa ResearchCoordinator em `src/research.ts`
- Adiciona integração com MCP Context7
- Fallback para busca web via DuckDuckGo

### Motivação
Permite que o FazAI busque documentação automaticamente quando
o contexto não é suficiente para gerar comandos seguros.

### Como testar
1. Configure MCP_CONTEXT7_URL no fazai.conf
2. Execute `fazai --dry-run`
3. Peça uma tarefa complexa que requer pesquisa
4. Verifique que a pesquisa é acionada automaticamente

### Screenshots
```bash
🔍 Pesquisando: "como configurar nginx ssl"
✅ 5 resultados encontrados
```

Closes #42
```

## 🐛 Troubleshooting

### Erro: "Permission denied"
Veja [Como Obter Acesso ao Repositório](#como-obter-acesso-ao-repositório)

### Erro: "Build failed"
```bash
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### Erro: "API key não encontrada"
```bash
# Verifique se o arquivo existe
cat fazai.conf

# Copie o exemplo se necessário
cp fazai.conf.example fazai.conf
nano fazai.conf
```

### Conflitos de merge
```bash
# Atualize seu branch com master
git fetch origin
git rebase origin/master

# Resolva conflitos manualmente
# Após resolver cada arquivo:
git add <arquivo-resolvido>
git rebase --continue
```

## 📞 Obtendo Ajuda

- **Issues**: https://github.com/rogerluft/fazai-ng/issues
- **Discussions**: https://github.com/rogerluft/fazai-ng/discussions
- **Email**: Verifique o perfil do proprietário do repositório

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob:
- **Código**: Apache License 2.0
- **Documentação**: Creative Commons Attribution 4.0 International (CC BY 4.0)

---

**Obrigado por contribuir com o FazAI! 🚀**
