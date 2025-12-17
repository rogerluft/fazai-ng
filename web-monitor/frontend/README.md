# FazAI Web Monitor - Frontend

React 18 + TypeScript + Vite frontend para gerenciamento de integrações (Cloudflare, SpamExperts, OPNsense).

## Stack Tecnológica

- **React 18** - UI Library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Utility-first CSS
- **React Router** - Navigation

## Estrutura do Projeto

```
frontend/
├── src/
│   ├── components/          # Componentes React organizados por feature
│   │   ├── cloudflare/      # Componentes Cloudflare (DNS, Firewall, SSL)
│   │   ├── spamexperts/     # Componentes SpamExperts (Quarantine, Lists)
│   │   └── opnsense/        # Componentes OPNsense (Firewall, NAT, VPN)
│   ├── hooks/               # Custom React hooks
│   │   ├── useCloudflare.ts
│   │   ├── useSpamExperts.ts
│   │   └── useOPNsense.ts
│   ├── pages/               # Páginas principais
│   │   ├── CloudflarePage.tsx
│   │   ├── SpamExpertsPage.tsx
│   │   └── OPNsensePage.tsx
│   ├── types/               # TypeScript type definitions
│   │   ├── cloudflare.types.ts
│   │   ├── spamexperts.types.ts
│   │   └── opnsense.types.ts
│   ├── App.tsx              # Root component
│   └── main.tsx             # Entry point
├── public/                  # Static assets
├── dist/                    # Build output
└── index.html               # HTML template
```

## Scripts Disponíveis

```bash
# Desenvolvimento (hot reload)
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Lint
npm run lint

# Typecheck
npm run typecheck
```

## Páginas Implementadas

### 1. Cloudflare Management
**Rota:** `/cloudflare`
**Documentação:** [CLOUDFLARE_IMPLEMENTATION.md](./CLOUDFLARE_IMPLEMENTATION.md)

Features:
- Gerenciamento de Zones
- DNS Records (A, AAAA, CNAME, MX, TXT)
- Firewall Rules
- SSL/TLS Settings
- Cache Purge
- Analytics Dashboard

### 2. SpamExperts Management
**Rota:** `/spamexperts`

Features:
- Domain Management
- Quarantine Email Viewer
- Whitelist/Blacklist Management
- Reports Dashboard

### 3. OPNsense Management
**Rota:** `/opnsense`
**Documentação:** [OPNSENSE_IMPLEMENTATION.md](./OPNSENSE_IMPLEMENTATION.md)

Features:
- Firewall Rules (CRUD + Apply)
- NAT / Port Forwarding (CRUD + Apply)
- VPN Tunnels (Connect/Disconnect)
- Network Interfaces (View)
- DHCP Leases (View)
- System Status (CPU, Memory, Disk, Load Average)

## Desenvolvimento

### Instalar Dependências
```bash
npm install
```

### Iniciar Dev Server
```bash
npm run dev
# Acesse: http://localhost:5173
```

### Configuração Backend
O frontend se conecta ao backend em `http://localhost:3001`.

**Autenticação:** HTTP Basic Auth
- User: `admin`
- Password: `fazai123`

### Hot Module Replacement (HMR)
Vite suporta HMR para React. Edite qualquer arquivo `.tsx` e veja as mudanças instantaneamente.

## Build de Produção

```bash
# Build
npm run build

# Output: dist/
# - index.html
# - assets/index-[hash].js
# - assets/index-[hash].css
```

### Preview do Build
```bash
npm run preview
# Acesse: http://localhost:4173
```

## Arquitetura de Componentes

### Padrão de Organização
Cada integração segue o mesmo padrão:

```
integration/
├── [Feature]Table.tsx      # Tabela de listagem
├── [Feature]Form.tsx       # Formulário de criação/edição
├── [Feature]Panel.tsx      # Painel de informações
└── README.md               # Documentação dos componentes
```

### Custom Hooks
Cada integração tem seu hook customizado em `/hooks/`:

```tsx
// hooks/useOPNsense.ts
export function useOPNsense() {
  const [data, setData] = useState(...);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    // Fetch logic with error handling
  }, []);

  return { data, loading, error, fetchData };
}
```

### TypeScript Types
Tipos estritamente definidos em `/types/`:

```tsx
// types/opnsense.types.ts
export interface FirewallRule {
  uuid: string;
  action: 'pass' | 'block' | 'reject';
  interface: string;
  protocol: 'tcp' | 'udp' | 'tcp/udp' | 'icmp' | 'any';
  // ... more fields
}
```

**Regras:**
- Nunca usar `any`
- Union types para valores finitos
- Interfaces para objetos
- Tipos alinhados com API backend

## Estilização

### Tailwind CSS
Todas as páginas usam Tailwind CSS com o mesmo tema:

**Cores:**
- Background: `bg-gray-900` (dark theme)
- Cards: `bg-gray-800`
- Inputs: `bg-gray-700`
- Text: `text-white`, `text-gray-400`
- Accent: `blue-500/600/700`
- Success: `green-500/900`
- Danger: `red-500/900`
- Warning: `yellow-500/900`

**Componentes Comuns:**
```tsx
// Button primary
<button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg">
  Click me
</button>

// Card
<div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
  Content
</div>

// Badge
<span className="bg-green-900 text-green-200 px-2.5 py-0.5 rounded text-xs font-medium">
  Active
</span>
```

### Responsividade
Mobile-first com breakpoints:
- `sm:` 640px
- `md:` 768px
- `lg:` 1024px

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid */}
</div>
```

## Performance

### Otimizações Implementadas
1. **useCallback** - Memoização de funções
2. **Lazy Loading** - Dados carregados apenas quando necessário
3. **Conditional Rendering** - Componentes renderizados apenas quando visíveis
4. **Auto-refresh Limitado** - Polling apenas quando necessário

### Bundle Size
- Total: ~626 kB (141 kB gzipped)
- Code splitting sugerido para chunks > 500kB

## Testes (TODO)

```bash
# Unit tests (Vitest)
npm run test

# Integration tests (React Testing Library)
npm run test:integration

# E2E tests (Playwright)
npm run test:e2e

# Coverage
npm run test:coverage
```

## Acessibilidade

- Semantic HTML (`<table>`, `<label>`, `<button>`)
- Labels em todos inputs
- Focus states visíveis
- Color contrast WCAG AA
- Disabled states claros
- Loading indicators com texto

## Troubleshooting

Ver [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) para problemas comuns.

### Problemas Comuns

**Build falha com erro TypeScript:**
```bash
npm run typecheck
# Verificar erros de tipo
```

**Backend não conecta:**
- Verificar se backend está rodando em `http://localhost:3001`
- Verificar credenciais (`admin:fazai123`)
- Verificar CORS

**Componente não renderiza:**
- Verificar console para erros
- Verificar se dados estão sendo carregados
- Verificar estado de loading/error

## Documentação Adicional

- [CLOUDFLARE_IMPLEMENTATION.md](./CLOUDFLARE_IMPLEMENTATION.md) - Detalhes da implementação Cloudflare
- [OPNSENSE_IMPLEMENTATION.md](./OPNSENSE_IMPLEMENTATION.md) - Detalhes da implementação OPNsense
- [src/components/opnsense/README.md](./src/components/opnsense/README.md) - Uso de componentes OPNsense

## Contribuindo

1. Seguir padrões de código existentes
2. TypeScript strict mode (sem `any`)
3. Tailwind CSS para estilos
4. Componentes funcionais com hooks
5. Documentar componentes complexos

## Versão

**Frontend:** v1.0.0
**React:** 18.x
**TypeScript:** 5.x
**Vite:** 5.x

---

**Última atualização:** 2025-12-17
