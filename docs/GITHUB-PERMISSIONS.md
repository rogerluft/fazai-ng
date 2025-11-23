# 🔐 Guia de Permissões GitHub - FazAI

Este documento fornece soluções rápidas para problemas de permissão no GitHub.

## ❌ Erro: "Permission to rogerluft/fazai-ng.git denied"

### Cenário

Você está tentando fazer push e recebe:

```bash
[rluft@walker fazai-ng]$ git push origin master
remote: Permission to rogerluft/fazai-ng.git denied to RLuf.
fatal: unable to access 'https://github.com/rogerluft/fazai-ng/': The requested URL returned error: 403
```

### 🎯 Solução Rápida (Para Membros da Equipe)

#### Passo 1: O Proprietário do Repositório Deve Conceder Acesso

**Para rogerluft (proprietário do repositório):**

1. Acesse: https://github.com/rogerluft/fazai-ng/settings/access
2. Clique em **"Add people"** ou **"Invite a collaborator"**
3. Digite o nome de usuário: `RLuf`
4. Selecione o nível de permissão:
   - **Read**: Apenas leitura (clone, pull)
   - **Triage**: Read + gerenciar issues
   - **Write**: Read + push em branches, criar PRs ✅ **Recomendado**
   - **Maintain**: Write + gerenciar issues, PRs e algumas configurações
   - **Admin**: Acesso total ao repositório
5. Clique em **"Add RLuf to this repository"**

#### Passo 2: O Colaborador Deve Aceitar o Convite

**Para RLuf (colaborador):**

1. Verifique seu email cadastrado no GitHub para encontrar o convite
2. **OU** acesse diretamente: https://github.com/rogerluft/fazai-ng
3. Você verá um banner no topo: **"You have been invited to collaborate"**
4. Clique em **"View invitation"** e depois **"Accept invitation"**
5. Pronto! Agora você pode fazer push

#### Passo 3: Teste o Acesso

```bash
# Verifique sua autenticação
git config --global user.name
git config --global user.email

# Teste o push
git push origin master
```

### 🔄 Solução Alternativa (Fork + PR)

Se você **não é membro da equipe** ou prefere não ter acesso direto:

#### 1. Faça Fork do Repositório

```bash
# No GitHub, clique em "Fork" em https://github.com/rogerluft/fazai-ng
# Isso cria uma cópia em sua conta
```

#### 2. Clone Seu Fork

```bash
# Substitua SEU-USUARIO pelo seu username do GitHub
git clone https://github.com/SEU-USUARIO/fazai-ng.git
cd fazai-ng
```

#### 3. Configure o Upstream

```bash
# Adicione o repositório original como upstream
git remote add upstream https://github.com/rogerluft/fazai-ng.git

# Verifique os remotes
git remote -v
# origin    https://github.com/SEU-USUARIO/fazai-ng.git (fetch)
# origin    https://github.com/SEU-USUARIO/fazai-ng.git (push)
# upstream  https://github.com/rogerluft/fazai-ng.git (fetch)
# upstream  https://github.com/rogerluft/fazai-ng.git (push)
```

#### 4. Trabalhe Normalmente

```bash
# Crie uma branch
git checkout -b feature/minha-contribuicao

# Faça suas alterações
# ... edite arquivos ...

# Commit
git add .
git commit -m "Add: minha contribuição"

# Push para SEU fork (não o original)
git push origin feature/minha-contribuicao
```

#### 5. Abra um Pull Request

1. Acesse seu fork no GitHub: `https://github.com/SEU-USUARIO/fazai-ng`
2. Clique no botão **"Compare & pull request"**
3. Certifique-se de que está comparando:
   - Base repository: `rogerluft/fazai-ng` base: `master`
   - Head repository: `SEU-USUARIO/fazai-ng` compare: `feature/minha-contribuicao`
4. Preencha o título e descrição do PR
5. Clique em **"Create pull request"**

### 🔑 Usar SSH em vez de HTTPS

SSH é mais conveniente pois não requer senha a cada push.

#### 1. Gere uma Chave SSH

```bash
# Gere uma nova chave SSH
ssh-keygen -t ed25519 -C "seu-email@example.com"

# Quando perguntado "Enter file in which to save the key", pressione Enter
# Defina uma senha (ou deixe em branco para não usar senha)
```

#### 2. Adicione a Chave ao SSH Agent

```bash
# Inicie o ssh-agent
eval "$(ssh-agent -s)"

# Adicione sua chave privada
ssh-add ~/.ssh/id_ed25519
```

#### 3. Adicione a Chave Pública ao GitHub

```bash
# Copie sua chave pública
cat ~/.ssh/id_ed25519.pub
# Copie todo o output (começa com "ssh-ed25519 ...")
```

Então:
1. Acesse: https://github.com/settings/keys
2. Clique em **"New SSH key"**
3. Título: Dê um nome descritivo (ex: "Laptop Fedora")
4. Key: Cole a chave pública que você copiou
5. Clique em **"Add SSH key"**

#### 4. Configure o Remote para Usar SSH

```bash
# Verifique o remote atual
git remote -v

# Altere para SSH
git remote set-url origin git@github.com:rogerluft/fazai-ng.git

# Ou se for seu fork:
git remote set-url origin git@github.com:SEU-USUARIO/fazai-ng.git

# Verifique a mudança
git remote -v
```

#### 5. Teste a Conexão SSH

```bash
# Teste a conexão
ssh -T git@github.com
# Deve retornar: "Hi RLuf! You've successfully authenticated..."

# Agora pode fazer push normalmente
git push origin master
```

## 🔍 Verificar Permissões Atuais

### Como Colaborador

```bash
# Verifique se você tem acesso
curl -H "Authorization: token SEU_GITHUB_TOKEN" \
  https://api.github.com/repos/rogerluft/fazai-ng/collaborators/RLuf

# Retorno 204 = tem acesso
# Retorno 404 = não tem acesso
```

### Como Proprietário

Para verificar quem tem acesso:
1. Acesse: https://github.com/rogerluft/fazai-ng/settings/access
2. Veja a lista de **"Collaborators"**
3. Verifique as permissões de cada colaborador

## 🐛 Outros Problemas Comuns

### "fatal: Authentication failed"

**Problema**: Suas credenciais estão incorretas ou expiradas.

**Solução**:
```bash
# Para HTTPS, use um Personal Access Token em vez de senha
# 1. Gere um token em: https://github.com/settings/tokens
# 2. Marque os escopos: repo, workflow
# 3. Use o token como senha ao fazer push

# Ou configure o credential helper
git config --global credential.helper cache
```

### "fatal: Could not read from remote repository"

**Problema**: Remote está configurado incorretamente ou sem permissão.

**Solução**:
```bash
# Verifique os remotes
git remote -v

# Reconfigure o remote
git remote set-url origin https://github.com/rogerluft/fazai-ng.git

# Ou use SSH
git remote set-url origin git@github.com:rogerluft/fazai-ng.git
```

### "error: failed to push some refs"

**Problema**: Seu branch está desatualizado.

**Solução**:
```bash
# Atualize seu branch local
git pull origin master --rebase

# Ou se estiver em outro branch
git pull origin NOME-DO-BRANCH --rebase

# Depois tente push novamente
git push origin NOME-DO-BRANCH
```

## 📞 Suporte

Se nenhuma dessas soluções funcionar:

1. **Verifique o status do GitHub**: https://www.githubstatus.com/
2. **Abra uma issue**: https://github.com/rogerluft/fazai-ng/issues
3. **Contate o proprietário do repositório**: @rogerluft no GitHub

## 📚 Documentação Adicional

- [Guia Completo de Contribuição](../CONTRIBUTING.md)
- [GitHub Docs - Managing Access](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-teams-and-people-with-access-to-your-repository)
- [GitHub Docs - Connecting with SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [GitHub Docs - Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

---

**Última atualização**: 2025-11-15
