# FazAI UI Components

Biblioteca de componentes visuais para o modo CLI interativo do FazAI.

## Estrutura

```
src/ui/
├── table.ts        # Componente de tabela formatada
├── spinner.ts      # Spinner de loading
├── prompt.ts       # Prompts interativos
├── banner.ts       # Banners e headers visuais
├── menu.ts         # Menus interativos
├── dashboard.ts    # Dashboard visual do sistema
└── index.ts        # Exportação centralizada
```

## Componentes

### 1. Table (`table.ts`)

Renderiza tabelas formatadas com bordas e cores.

```typescript
import { renderTable, TableColumn, statusColor } from "./ui/table";

const data = [
  { id: "1", name: "Server 1", status: "online" },
  { id: "2", name: "Server 2", status: "offline" },
];

const columns: TableColumn[] = [
  { header: "ID", key: "id", width: 5 },
  { header: "Name", key: "name", width: 20 },
  {
    header: "Status",
    key: "status",
    width: 10,
    color: statusColor, // Auto-colore baseado em valor
  },
];

renderTable(data, columns);
```

**Features:**
- Auto-width para colunas sem largura especificada
- Alinhamento (left, center, right)
- Colorização customizável por coluna
- 3 estilos de borda (single, double, rounded)
- Helpers de cor pré-definidos (`statusColor`, `statusColors`)

### 2. Spinner (`spinner.ts`)

Spinner de loading com estados success/fail/info/warn.

```typescript
import { Spinner } from "./ui/spinner";

const spinner = new Spinner();
spinner.start("Carregando dados...");

try {
  await fetchData();
  spinner.succeed("Dados carregados com sucesso!");
} catch (error) {
  spinner.fail("Erro ao carregar dados");
}
```

**Helper:**
```typescript
import { withSpinner } from "./ui/spinner";

const result = await withSpinner(
  "Processando...",
  async () => await processData(),
  "Processamento concluído",
  "Erro no processamento"
);
```

### 3. Prompt (`prompt.ts`)

Wrappers para prompts interativos do @inquirer/prompts.

```typescript
import { selectOption, confirmAction, inputText, inputSecret } from "./ui/prompt";

// Menu de seleção
const action = await selectOption("Escolha uma ação:", [
  { value: "create", name: "Criar novo", description: "Cria um novo recurso" },
  { value: "delete", name: "Deletar", description: "Remove recurso existente" },
]);

// Confirmação
const confirmed = await confirmAction("Deseja continuar?");

// Input de texto
const name = await inputText("Digite o nome:", "default-name");

// Input de senha
const apiKey = await inputSecret("Digite sua API key:");
```

### 4. Banner (`banner.ts`)

Banners, headers e mensagens visuais.

```typescript
import { showBanner, showHeader, showSuccess, showError } from "./ui/banner";

// Banner principal com gradiente
showBanner("FazAI CLI", "Administrador Linux Inteligente", {
  gradient: true,
  gradientColors: ["cyan", "blue"],
  borderStyle: "round",
});

// Header de seção
showHeader("🔥", "Firewall Manager", "Gerenciar regras de firewall");

// Mensagens em box
showSuccess("Operação concluída com sucesso!");
showError("Erro ao processar requisição");
```

**Logo ASCII:**
```typescript
import { showLogo } from "./ui/banner";

showLogo(); // Exibe logo FazAI em gradiente
```

### 5. Menu (`menu.ts`)

Menus interativos com ícones e descrições.

```typescript
import { showMenu, MenuItem } from "./ui/menu";

const items: MenuItem[] = [
  { label: "List Zones", value: "zones", icon: "🌐", description: "Listar todas as zonas" },
  { label: "DNS Records", value: "dns", icon: "📝", description: "Gerenciar registros DNS" },
  { label: "Workers", value: "workers", icon: "⚙️", description: "Gerenciar Workers" },
];

const choice = await showMenu("Cloudflare Management", items);

// Menu com opções automáticas
const choice2 = await showMenu("Menu", items, {
  includeBack: true,  // Adiciona "Voltar"
  includeExit: true,  // Adiciona "Sair" (padrão: true)
});
```

**Valores especiais:**
- `__exit__` - Usuário selecionou "Sair"
- `__back__` - Usuário selecionou "Voltar"

### 6. Dashboard (`dashboard.ts`)

Dashboard visual com estatísticas do sistema.

```typescript
import { showDashboard, DashboardData } from "./ui/dashboard";

const data: DashboardData = {
  system: {
    cpu: "42%",
    memory: "3.2GB / 8GB",
    disk: "120GB / 500GB",
    uptime: "15 days 6 hours",
  },
  recentCommands: [
    { timestamp: "10:30", command: "nginx restart", status: "success" },
    { timestamp: "10:25", command: "systemctl status", status: "success" },
  ],
  apiStatus: [
    { name: "Cloudflare", status: "online", responseTime: "120ms" },
    { name: "SpamExperts", status: "online", responseTime: "85ms" },
  ],
};

showDashboard(data);
```

**Dashboard minimalista:**
```typescript
import { showMiniDashboard } from "./ui/dashboard";

showMiniDashboard({
  cpu: "42%",
  memory: "3.2GB / 8GB",
  disk: "120GB / 500GB",
});
```

## Filosofia

### NO Placeholders
Todos os componentes são totalmente implementados, sem TODOs ou placeholders.

### Consistência
- Todos usam chalk para cores
- Todos retornam Promises quando assíncronos
- Todos têm tipagem TypeScript completa
- Todos seguem o mesmo padrão de nomenclatura

### Cores Padrão
- **Verde**: Sucesso, ativo, online
- **Vermelho**: Erro, inativo, offline
- **Amarelo**: Aviso, pendente, degradado
- **Azul/Cyan**: Informação, destaque
- **Cinza**: Desabilitado, secundário

### Responsividade
- Tabelas ajustam largura baseado no terminal width
- Boxes respeitam `process.stdout.columns`
- Texto longo é truncado automaticamente

## Uso nos Comandos de API

Veja exemplos completos em:
- `src/commands/api/cloudflare-ui.ts`
- `src/commands/api/spamexperts-ui.ts`
- `src/commands/api/opnsense-ui.ts`

## Dependências

- `chalk@4.1.2` - Cores no terminal
- `ora@5.4.1` - Spinners
- `@inquirer/prompts@^7.0.0` - Prompts interativos
- `boxen@^8.0.1` - Boxes formatados
- `gradient-string@^3.0.0` - Gradientes de texto
- `cli-table3@^0.6.5` - Tabelas (não usado diretamente, implementação custom)

## TypeScript

Todos os componentes têm:
- Interfaces exportadas
- JSDoc completo
- Strict mode habilitado
- Zero `any` types
