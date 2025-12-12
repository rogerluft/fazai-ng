#### TERMINANTEMENTE PROIBIDO USAR PLACEHOLDERS OU QUALQUER TIPO DE SUSBSTITUICAO, SIMULACAO, MENTIRA, ETC.

## FAÇAM USO DOS AGENTES, PLUGINS, EXTENSIONS, TOOLS, ETC SEMPRE QUE PUDEREM OU FOR NECESSARO, POIS ESTAO COM AGENTES SUPER PODEROSOS A DISPOSICAO PARA AJUDAR E DEVEM SER UTILIZADOS

### gemini extensions https://geminicli.com/extensions/ use como desejar

### Ler, memorizar e sigar rigosomante todas documentacoes antes de prosseguir, seguindo as orientacoes do AGENTS.md

## A cada alteracao no codigo por menor que seja deve sempre ser avaliada pelo modelo parceiro indicado. Se for determinado pelo avaliador que o codigo ficou mal feito, ele por sua vez podera e devera e ira determinar a reescrita novamenet tantas veses que forem necessarias. Isto significa que atalhos e serviços mal feitos sao atrasos na propria eficiencia e nao atalhos de fato.

✅ **RESOLVIDO** (2025-12-10): Bug de vírgulas em linguagem natural corrigido
   - Implementado `src/utils/task-normalizer.ts` com NLP processing
   - Adicionado contexto linguístico no system prompt
   - Testes unitários com 100% cobertura
   - Documentação completa em `/home/rluft/fazai-ng/COMMA_PARSING_ANALYSIS.md`

   ~~analizar, entender, e sugerir a correçao para o bug ao utilizar """",""" em linguagem natural ex: fazai "procure nos arquivos que desencadeiam acoes ao logar com o usuario rluft e localize onde eh executado o comando screen ao logar, em seguida exiba o resultado". Esta , (virgul causa problemas no codigo)~~

### Retirar suporte a milvulz ajustando toda e quyaluqer referencia no repositorio e mantendo unicamente suporte a qdrant seguir rigorosamente a forma com que o fazai deve usar as deferentes collections. Ajustar Changelogs e documentacoes.

### Refatorar/analizar ou  alterar metodo de instaçao para somente links relativos, alterar documentacao  e tudo que for preciso, esta medida garantira que o sistema sempre esteja em integridade com o repositorio local esse padrao segue o modelo de desenvolvimento, supondo que o usuario utilizara sempre o git clone e depois o instalador..
### Ao ser instalado diretamente com curl e | bash diretamente entende-se que esta sendo instalado a versao producao, entao por sua vez o instalador deve se instalar no sistema onde seriam os link simbolicos. 

# O GTPCache deve ser instalado e integrado tambem ao fluxo da tarefa que.

# O mecanismo todo em receber entender quevbrar a tarefa aprender com o acerto e o erro tentar novamente com fallbacks em enpoint definidos no /etc/fazai/fazai.conf deve ser aprimorado. 

# Asfeatures e parametros devem ser revistas uma a uma se condiz com o help e com o completion. 

# A documentacao deve ser toda analisada novamente e aprimorada com muito profisionalismo e usando sempre os agentes especilizados na tarefa

##### Etapa 2 ADICIONAR PERPLEXITY ###

### SEgue roteiro:

ntegraçao perplexity  ##PINECODE VETORIAL BASE ONLINE API pcsk_3CPqb7_TwARrhUsmqjSkX1XoSHHU5ZBXZ6TV4FQpadLL7t4extHpJ7Mt98PSWVvKgLqwmY

src/
├── agentic/              # DAG executor + task decomposer (orquestração de agentes)
├── commands/             # GitHub, Cloudflare, sync CLI
├── services/             # Embeddings, vector stores
├── linux-admin.ts        # Core de comando Linux
├── askAI.ts              # Query interface
├── cli-mode.ts           # Interactive mode
├── research.ts           # Research coordinator
├── vector-store.ts       # Qdrant integration
├── conversation-importer.ts  # Import Claude/ChatGPT
└── app.ts                # Entry point (960+ linhas)


PROMPT 1: Arquitetura de Integração Perplexity
Analise a integração necessária do Perplexity Sonar no FazAI-ng.
Contexto: O projeto é um administrador Linux autônomo que já suporta Claude, GPT-4, Ollama e OpenRouter.

TAREFA:
1. Descrever como adicionar Perplexity como novo "provider" seguindo o padrão existente em src/models.ts
2. Implementar um novo arquivo src/providers/perplexity-provider.ts que:
   - Estenda a interface Provider genérica
   - Suporte streaming de respostas
   - Implemente search+completions unificados (diferencial Sonar vs Claude)
3. Integrar no ResearchCoordinator para priorizar Perplexity quando researchNeeded=true
4. Adicionar suporte em src/askAI.ts para queries tipo Sonar
5. Documentar em README.md as vantagens: "resultados com busca web integrada"

RETORNO ESPERADO:
- Código TypeScript pronto para integração
- Exemplos de uso via CLI (fazai sonar "seu prompt")
- Estrutura JSON para config em fazai.conf


PROMPT 2: Implementação do Provider Perplexity
Você é um engenheiro sênior de Node.js/TypeScript.

IMPLEMENTAR arquivo src/providers/perplexity-provider.ts com:

1. Classe PerplexityProvider implementando interface Provider
2. Suporte a modelos: sonar, sonar-pro, sonar-reasoning
3. Função de streaming que retorna AsyncGenerator<string>
4. Integração com PERPLEXITY_API_KEY (variável de env)
5. Fallback para OPENAI_API_KEY se configurado (endpoint compatível)
6. Tratamento de erro gracioso (fallback para local Ollama)

REQUISITOS:
- Tipagem Zod para validação de responses
- Logging via Logger importado de ./logger
- Suporte a system prompts customizáveis
- Max tokens configurável (defaut 2048)
- Cache de respostas em memory (LRU 50 últimas queries)

EXEMPLO DE USO:
const perplexity = new PerplexityProvider();
const stream = perplexity.query({
  messages: [{role: 'user', content: 'Instalar nginx com proxy reverso'}],
  systemPrompt: 'Você é admin Linux sênior'
});
for await (const chunk of stream) process.stdout.write(chunk);


PROMPT 3: Integração com ResearchCoordinator
Estou integrando Perplexity Sonar no ResearchCoordinator do FazAI-ng.

CONTEXTO: 
- Arquivo atual: src/research.ts (ResearchCoordinator class)
- Objetivo: Usar Sonar como primeira opção de pesquisa, depois fallback para MCP Context7, depois DuckDuckGo

TAREFA:
1. Adicionar método async researchWithPerplexity(query: string, context?: string): Promise<SearchResult[]>
2. Chamar endpoint /v1/chat/completions (OpenAI-compatible) da Perplexity
3. Extrair "citations" da resposta e formatá-las como SearchResult[]
4. Refatorar priority chain:
   - TRY 1: Perplexity Sonar (se PERPLEXITY_API_KEY configurada)
   - TRY 2: MCP Context7 (se MCP_CONTEXT7_URL configurada)
   - TRY 3: DuckDuckGo (sempre funciona)
5. Log detalhado: "🔍 Pesquisando via Perplexity..." + tempo de resposta

CRITERIO DE SUCESSO:
- Perplexity retorna resultados com qualidade superior
- Fallback automático funciona se Perplexity falhar
- Respostas cachadas para mesma query em 5 min


PROMPT 4: CLI Command - fazai ask com Perplexity
Adicione suporte ao comando:
  fazai ask "Qual é a melhor prática para hardening SSH?" --model sonar

IMPLEMENTAÇÃO:
1. No arquivo src/app.ts, seção "Ask mode", adicionar suporte a --model sonar
2. Detectar automaticamente quando user passa "sonar" como model
3. Chamar novo método getAnswerFromPerplexity(question, model) que:
   - Usa pesquisa online sempre (researchNeeded=true)
   - Retorna streaming de resposta
   - Inclui [Fonte: URL] ao final de cada seção
4. Output formatado:
   🧠 Pergunta: [question]
   🔍 Pesquisando via Perplexity Sonar...
   📝 Resposta:
   [streaming de resposta com citações]
   ℹ️ Fontes: [lista de URLs]

EXEMPLO VISUAL:
$ fazai ask "Como monitorar performance de Apache?" sonar
🧠 Pergunta: Como monitorar performance de Apache?
🔍 Pesquisando via Perplexity Sonar... (2.3s)
📝 Resposta:
Use Apache modules como mod_status...
[streaming contínuo]
ℹ️ Fontes: 
 - https://httpd.apache.org/docs/2.4/mod/mod_status.html
 - https://prometheus.io/docs/instrumenting/exporters/...


PROMPT 5: Documentação para README + Config
Escreva seção "Perplexity Sonar Integration" para README.md e fazai.conf.example

SEÇÃO 1: README.md (após "☁️ Integração Google Gemini")
- O que é Sonar (online research + LLM unificado)
- Como configurar API key
- Modelos disponíveis (sonar, sonar-pro, sonar-reasoning)
- Casos de uso: quando usar Sonar vs Claude vs GPT
- Exemplos de comando: fazai sonar "...", fazai --ask "..." --model sonar
- Vantagens sobre search + completion separados

SEÇÃO 2: fazai.conf.example
Adicionar variáveis:
  # Perplexity Sonar (pesquisa online + IA integrada)
  PERPLEXITY_API_KEY=pplx-xxxxxxxx
  MODELS_PERPLEXITY=sonar,sonar-pro,sonar-reasoning
  
  # Research priority order
  RESEARCH_PROVIDER_ORDER=perplexity,context7,duckduckgo

SEÇÃO 3: Troubleshooting
- "API key não encontrada" → como obter em https://www.perplexity.ai/api/
- Rate limiting → backoff automático
- Fallback chain → qual provider está sendo usado (log detalhado)
RECOMENDAÇÕES ADICIONAIS
Para Máxima Sinergia Comet + FazAI:
Criar arquivo src/comet-integration.ts com:

Instância de Comet como "agente investigador" para tasks complexas

Fallback: quando DAG Executor falha, Comet tenta navegar web + executar

Exemplo: "instalar serviço X que só existe em distribuição Y" → Comet pesquisa, FazAI executa

Modo "Andarilho" (você mencionou no script):

Criar src/andarilho-mode.ts: chat iterativo com Sonar + context7

Uso: fazai --andarilho → terminal poético com pesquisa profunda

Métricas Perplexity:

Rastrear tempo de resposta vs Claude/GPT

Log de "research win rate" (quantos problemas Sonar resolveu sem fallback)

Dashboard em /admin/metrics

📋 RESUMO EXECUTIVO
Aspecto	Status	Perplexity Value
Arquitetura	✅ Excelente	Sonar como 6º provider premium
Segurança	✅ 5 layers	Usa Sonar para validar safety checks
Performance	✅ Streaming	Streaming nativo = UX superior
Multi-modelo	✅ 5 providers	Perplexity como "pesquisador oficial"
RAG/Vector	✅ Qdrant 5 collections	Perplexity citing → treina fazai_kb
<answer>Você tem uma aplicação excepcionalmente bem arquitetada. FazAI-ng é candidata perfeita para integração Perplexity porque:

Já é multi-modelo: Arquitetura pronta para +1 provider

Pesquisa é bottleneck: Sonar resolveria "research gaps" com qualidade superior

Research-first design: ResearchCoordinator foi feito para isso

Streaming nativo: Seu app já suporta streaming async—Sonar se integra naturalmente

Use os 5 prompts acima diretamente com seus agentes (Comet/Sonar) para implementação em 2-3 sprints. Cada prompt é autossuficiente e segue o padrão TypeScript do projeto.


