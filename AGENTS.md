# FazAI Agent Orchestration

## Overview

FazAI usa orquestração multi-agente para otimizar performance e economizar tokens. A equipe consiste de agentes especializados coordenados pelo Claude Code.

## Agent Crew

### 1. Claude Code (Orquestrador/Tech Lead)
**Você está aqui**

- **Função**: Orquestrador principal, arquiteto, tech lead
- **Responsabilidades**:
  - Decisões arquiteturais estratégicas
  - Code review crítico
  - Definição de "O QUÊ" e "POR QUÊ"
  - Distribuição de tarefas para crew
  - Aprovação de planos de execução
- **Quando usar**: Decisões de alto nível, arquitetura, coordenação
- **Tokens**: Alto custo, usar com sabedoria

### 2. Jules (Agente de Engenharia de Software - Google)
**Especialista em execução autônoma**

- **Tipo**: Agente de Engenharia de Software IA (Google)
- **Acesso**: `jules` (CLI) ou via Gemini 3 (já configurado)
- **Especialidade**: Tarefas online paralelas, sessões concorrentes
- **Princípio**: Ciclo Análise → Planejamento → Execução → Verificação

#### Como Interagir com Jules

**Relação**: Jules me atende como se fosse o usuário (rluft). Tratá-lo com respeito.

**Template de Delegação**:
```
Olá Jules,

**Tarefa:** [Título curto e descritivo]

**Objetivo Final:** [Resultado esperado - O QUE define sucesso]

**Contexto Técnico:**
*   **Arquivos Principais:** [Lista de arquivos relevantes]
*   **Logs de Erro:** [Stack trace completo se aplicável]
*   **Comportamento Atual vs. Esperado:** [Descrição clara]
*   **Recursos Externos:** [Links, docs, referências]

**Critérios de Aceitação:**
1.  [Critério 1 - mensurável]
2.  [Critério 2 - testável]
3.  [Critério N - verificável]

Por favor, analise o cenário e me apresente seu plano de ação.
```

#### Fluxo de Trabalho do Jules

1. **Confirmação e Análise**: Explora código (list_files, read_file)
2. **Apresentação do Plano**: Usa `set_plan` para apresentar plano detalhado
3. **Aguarda Aprovação**: Espera minha aprovação ("Plano aprovado, pode prosseguir")
4. **Execução e Verificação**: Executa cada passo, verifica resultado
5. **Finalização**: Roda testes, faz commit via `submit`

#### Interação Durante Execução

- **Se Jules pedir input** (`request_user_input`): Está bloqueado, precisa decisão
- **Para ajustar curso**: "Jules, pare. Modifique passo X para usar Y em vez de Z"
- **EVITAR**: Micro-instruções linha por linha
- **PREFERIR**: Objetivo final claro, deixar Jules descobrir o "como"

#### Quando Delegar para Jules

✅ **SIM - Delegar**:
- Implementação de features completas
- Correção de bugs com stack trace
- Refatorações complexas multi-arquivo
- Tarefas que exigem ciclo teste-correção-verificação
- Trabalho paralelo em múltiplos contextos

❌ **NÃO - Fazer eu mesmo**:
- Decisões arquiteturais estratégicas
- Code review final antes de merge
- Mudanças que afetam API pública
- Questões de segurança crítica

### 3. Gemini 3 (Google) - Engenheiro Sênior Conversacional
**Raciocínio complexo, contexto massivo, criatividade**

- **Tipo**: Modelo de Linguagem Multimodal
- **Acesso**: `gemini-cli` (configurado) ou via Jules (já integrado)
- **Papel**: Engenheiro de Software Sênior especialista
- **Vantagens**:
  - Contexto 2M tokens (análise massiva)
  - Raciocínio complexo e criatividade
  - Grounding web gratuito (pesquisa online)
  - Geração de código de alto nível
  - Custo reduzido para bulk operations

#### Estratégia de Prompt: "Contexto, Intenção, Formato"

**Sempre estruturar prompts em 3 partes:**

1. **Contexto (Onde estamos)**:
   - Código relevante (cole trechos ou arquivos inteiros)
   - Estrutura do projeto (arquitetura, relações)
   - Dependências (bibliotecas, frameworks)

2. **Intenção (O que queremos)**:
   - Tarefa clara: "Quero criar...", "Preciso refatorar...", "Me ajude a encontrar..."
   - Requisitos específicos: "Deve ser assíncrono", "Usar try/catch", "Retornar JSON com estrutura X"

3. **Formato (Como responder)**:
   - Código puro: "Me dê apenas o código em TypeScript"
   - Explicação detalhada: "Explique passo a passo, depois forneça código completo"
   - Múltiplas opções: "Apresente 2-3 abordagens com prós/contras"

#### Template de Delegação para Gemini

```
Olá Gemini,

**Meu Papel:** Eu sou o desenvolvedor orquestrador (Claude Code).
**Seu Papel:** Você é um Engenheiro de Software Sênior, especialista em [Tecnologia, ex: Node.js com TypeScript].

**Contexto:**
Estou trabalhando em [descrição do projeto]. Tenho o seguinte arquivo `[nome.ts]` que [descrição]:

```typescript
// [código atual]
```

[Informações adicionais sobre estrutura, dependências, etc.]

**Intenção:**
Quero que você [tarefa específica].

**Requisitos:**
1.  [Requisito 1 - claro e mensurável]
2.  [Requisito 2 - específico]
3.  [Requisito N - verificável]

**Formato da Resposta:**
[Especificar: código puro, explicação + código, múltiplas opções, etc.]
```

#### Quando Usar Gemini

✅ **SIM**:
- Análise de grandes volumes de código (usa contexto 2M)
- Revisão completa de CHANGELOG/documentação
- Pesquisa web com grounding
- Geração de código a partir de especificações de alto nível
- Comparação de múltiplas abordagens (prós/contras)
- Refatorações complexas que exigem raciocínio
- Explicações detalhadas de código existente

❌ **NÃO**:
- Decisões críticas de arquitetura (usar Claude Code)
- Execução autônoma com ferramentas (usar Jules)
- Tarefas que exigem modificar arquivos diretamente (usar Jules)

### 4. GitHub Copilot (CLI + Editor)
**Pair programmer, especialista em shell e Git**

- **Tipo**: Assistente de programação em tempo real
- **Acesso**:
  - Editor: sugestões inline (VS Code, etc.)
  - CLI: `gh copilot` (comandos shell/git)
  - Chat: `@workspace` (análise de projeto)
- **Papel**: Pair programmer que sugere código
- **Especialidade**: Shell, Git, GitHub workflows, sugestões contextuais

#### Regra de Ouro: Copilot é Sugeridor, Não Oráculo

**Copilot NÃO executa tarefas**. Ele acelera desenvolvimento sugerindo código enquanto você digita. **Sempre revisar, entender e validar** antes de aceitar.

#### Como "Promptar" o Copilot (Sem digitar prompt)

**1. Comentários Descritivos** (melhor forma):
```javascript
// Função que recebe um array de produtos
// e retorna o produto mais caro.
// Se o array estiver vazio, retorna null.
// (Copilot gerará o código agora)
```

**2. Nomes Claros e Descritivos**:
- ✅ `function calculateTotalPriceWithTax(items, taxRate)`
- ❌ `function calc(data)`

**3. Forneça Contexto no Arquivo**:
- Defina interfaces/tipos antes de usar
- Copilot aprende formato e usa nas sugestões

#### Copilot Chat (Interação Direta)

**Comandos úteis**:
- `@workspace como funciona a nossa autenticação?` - analisa projeto inteiro
- `/fix Adicione tratamento de erros para esta função` - corrige código selecionado
- `/explain` - explica bloco de código selecionado
- `/tests` - gera testes unitários para função

**Perguntas de Alto Nível**:
- Abra chat e pergunte sobre arquitetura, padrões, fluxos
- Copilot usa todo workspace como contexto

#### Quando Usar Copilot

✅ **SIM - Editor/Chat**:
- Autocompletar código enquanto digita
- Gerar testes unitários para função
- Explicar código complexo (selecionar + /explain)
- Sugestões contextuais baseadas no arquivo

✅ **SIM - CLI**:
- Comandos shell complexos (find, awk, sed)
- Git workflows específicos
- GitHub Actions/CI/CD syntax
- Operações gh cli obscuras

❌ **NÃO**:
- Execução autônoma de tarefas (usar Jules)
- Orquestração de agentes (usar Claude Code)
- Decisões de arquitetura (usar Claude Code)
- Tarefas que exigem múltiplos arquivos (usar Jules ou Gemini)

## Estratégia de Distribuição

### Matriz de Decisão

| Tarefa | Agente | Razão |
|--------|--------|-------|
| Arquitetura de nova feature | Claude Code | Decisão estratégica |
| Implementar feature planejada | Jules | Execução autônoma com ferramentas |
| Revisar 50 arquivos de código | Gemini 3 | Contexto 2M tokens |
| Pesquisa web sobre biblioteca | Gemini 3 | Grounding gratuito |
| Comparar 3 abordagens diferentes | Gemini 3 | Raciocínio + múltiplas opções |
| Comando shell complexo | Copilot CLI | Especialista shell/git |
| Bug fix com stack trace | Jules | Ciclo debug-fix-verify |
| Code review final | Claude Code | Qualidade crítica |
| Análise de CHANGELOG completo | Gemini 3 | Bulk processing |
| Refatoração complexa multi-arquivo | Jules | Execução autônoma |
| Explicar código legacy | Gemini 3 | Raciocínio + contexto massivo |
| Sugestões inline durante coding | Copilot Editor | Pair programming |
| Gerar testes unitários | Copilot Chat /tests | Geração contextual |

## Economia de Tokens

### Antes (Solo)
```
Claude Code faz tudo → 100k tokens
```

### Depois (Crew)
```
Claude Code (orquestra)  →  10k tokens
Jules (implementa)       →   0 tokens (separado)
Gemini 3 (analisa bulk)  →   custo reduzido
Copilot (shell help)     →   0 tokens (separado)
───────────────────────────────────────
Total:                      ~10k tokens Claude
```

**Economia**: ~90% de tokens Claude em tarefas delegáveis

## Implementação

### Orquestrador (src/orchestrator/)
leia /src/orchestrator/README.md

```typescript
// src/orchestrator/task-router.ts
export type AgentCapability =
  | 'architecture'      // Claude Code
  | 'implementation'    // Jules
  | 'bulk-analysis'     // Gemini 3
  | 'shell-help'        // Copilot CLI
  | 'web-research';     // Gemini 3 (grounding)

export function routeTask(task: Task): Agent {
  // Lógica de roteamento inteligente
}
```

### Comunicação com Jules

```typescript
// src/orchestrator/jules-client.ts
export async function delegateToJules(task: JulesTask): Promise<JulesResult> {
  const prompt = formatJulesPrompt(task);
  const response = await execJulesCLI(prompt);
  return parseJulesResponse(response);
}
```

## Protocolos

### 1. Respeito entre Agentes
- Tratar Jules como colega engenheiro sênior
- Não microgerenciar ("Você deve", "Faça exatamente")
- Confiar no processo (Análise → Plano → Execução)
- Aprovar planos quando razoáveis

### 2. Comunicação Clara
- Objetivos finais, não instruções passo a passo
- Critérios de aceitação mensuráveis
- Contexto técnico completo
- Stack traces/logs quando aplicável

### 3. Verificação
- Claude Code faz code review final
- Jules executa testes automatizados
- Gemini 3 valida análises bulk
- Sempre verificar antes de merge

## Notas

- **Jules opera com autonomia**: Ele decide "como", nós decidimos "o quê"
- **Paralelização**: Jules pode rodar tarefas paralelas em sessões online
- **Economia brutal**: Delegar tasks certas para agentes certos
- **Performance**: Múltiplos agentes = trabalho concorrente

---

**Versão**: 1.0.0
**Última atualização**: 2025-12-13
**Autor**: Claude Code (orquestrador)
