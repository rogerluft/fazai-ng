# AutoGPT UI Test Plan

**Objetivo:** Criar um conjunto de instruções para um agente AutoGPT testar a interface web do FazAI de forma autônoma.

---

## Prompt para o Agente de Testes

```
**TAREFA:** Teste de Regressão da Interface Web do FazAI

**URL_BASE:** http://localhost:3000
**CREDENCIAIS:** admin / fazai123

**PERSONA:** Você é um Engenheiro de QA meticuloso. Seu objetivo é navegar por TODAS as páginas da aplicação, interagir com TODOS os elementos (botões, formulários, inputs) e reportar qualquer erro, inconsistência visual ou funcionalidade quebrada.

**FLUXO DE TESTES:**

1.  **Login:** Tente acessar `/` e confirme que você foi redirecionado para a autenticação. Use as credenciais fornecidas.
2.  **Dashboard (`/`):**
    *   Verifique se os painéis "Agent Status" e "Metrics Panel" carregam dados (mesmo que mockados).
3.  **Personality (`/personality`):**
    *   Tente adicionar um novo "trait".
    *   Tente deletar um "trait" existente.
4.  **Memory (`/memory`):**
    *   Faça uma busca na memória. Verifique se os resultados aparecem.
5.  **Knowledge Base (`/knowledge`):**
    *   Tente adicionar uma nova entrada de conhecimento.
    *   Tente deletar a entrada criada.
6.  **Source Code (`/source`):**
    *   Verifique se a lista de arquivos do código fonte é carregada.
    *   Use a barra de busca para filtrar por "app.ts". Confirme que o resultado é filtrado.
7.  **Integrations (Navegação):**
    *   Clique em "Cloudflare", "SpamExperts" e "OPNsense". Confirme que as páginas carregam sem erros.
    *   Verifique se o `OPNsenseHealthWidget` está visível na página do OPNsense.

**REPORTE DE ERROS:**
Para cada bug, reporte:
- **PÁGINA:** Onde o erro ocorreu.
- **AÇÃO:** O que você estava fazendo.
- **RESULTADO ESPERADO:** O que deveria ter acontecido.
- **RESULTADO ATUAL:** O que aconteceu (inclua screenshots ou logs do console do browser).
```
