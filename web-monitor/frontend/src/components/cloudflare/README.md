# Cloudflare Components

Componentes React para gerenciamento Cloudflare no FazAI Web Monitor.

## Componentes Disponíveis

### ZonesTable
Lista todas as zonas Cloudflare com seleção interativa.

**Props:**
```typescript
interface ZonesTableProps {
  zones: CloudflareZone[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  loading: boolean;
}
```

**Usage:**
```tsx
<ZonesTable
  zones={zones}
  selectedZoneId={selectedZoneId}
  onSelectZone={(id) => setSelectedZoneId(id)}
  loading={loading}
/>
```

**Features:**
- Status badge (active = green, pending = yellow, etc.)
- Highlight da zona selecionada
- Click na linha para selecionar
- Display de name servers (primeiros 2 + counter)

---

### DNSRecordsTable
Gerencia DNS records com CRUD completo.

**Props:**
```typescript
interface DNSRecordsTableProps {
  records: DNSRecord[];
  onCreateRecord: (payload: CreateDNSRecordPayload) => Promise<boolean>;
  onDeleteRecord: (recordId: string) => Promise<boolean>;
  loading: boolean;
}
```

**Usage:**
```tsx
<DNSRecordsTable
  records={dnsRecords}
  onCreateRecord={async (payload) => {
    const success = await createDNSRecord(zoneId, payload);
    return success;
  }}
  onDeleteRecord={async (id) => {
    const success = await deleteDNSRecord(zoneId, id);
    return success;
  }}
  loading={loading}
/>
```

**Features:**
- Botão "Add Record" abre formulário inline
- Proxy icon (☁️ laranja = proxied, cinza = DNS only)
- Delete com confirmação inline
- TTL formatado (Auto ou segundos)
- Lock icon para records locked

---

### DNSRecordForm
Formulário para criar novos DNS records.

**Props:**
```typescript
interface DNSRecordFormProps {
  onSubmit: (payload: CreateDNSRecordPayload) => Promise<boolean>;
  onCancel: () => void;
  loading: boolean;
}
```

**Usage:**
```tsx
<DNSRecordForm
  onSubmit={async (payload) => {
    const success = await api.createDNS(payload);
    return success;
  }}
  onCancel={() => setShowForm(false)}
  loading={loading}
/>
```

**Features:**
- Select para tipo (A, AAAA, CNAME, MX, TXT, etc.)
- Validação de campos obrigatórios
- Campo priority condicional (MX records)
- Toggle proxy (A, AAAA, CNAME apenas)
- TTL predefinidos
- Placeholders contextuais

**Validations:**
- Name required
- Content required
- MX priority 0-65535

---

### FirewallRulesTable
View read-only de regras de firewall.

**Props:**
```typescript
interface FirewallRulesTableProps {
  rules: FirewallRule[];
  loading: boolean;
}
```

**Usage:**
```tsx
<FirewallRulesTable
  rules={firewallRules}
  loading={loading}
/>
```

**Features:**
- Badge colorido para action:
  - block = red
  - allow/bypass = green
  - challenge = yellow
  - log = blue
- Expression em monospace
- Status paused/active
- Priority display

---

### SSLConfigPanel
Configuração de modo SSL/TLS.

**Props:**
```typescript
interface SSLConfigPanelProps {
  settings: SSLSettings | null;
  onUpdate: (payload: UpdateSSLPayload) => Promise<boolean>;
  loading: boolean;
}
```

**Usage:**
```tsx
<SSLConfigPanel
  settings={sslSettings}
  onUpdate={async (payload) => {
    const success = await updateSSL(zoneId, payload);
    return success;
  }}
  loading={loading}
/>
```

**Features:**
- Radio buttons para modos:
  - Off (red border)
  - Flexible (yellow)
  - Full (blue)
  - Full Strict (green)
- Descrição detalhada de cada modo
- Botões Save/Reset aparecem só com mudanças
- Respeita editable flag
- Mostra modo atual

---

### CacheManager
Purge de cache (all ou specific files).

**Props:**
```typescript
interface CacheManagerProps {
  onPurge: (payload: CachePurgePayload) => Promise<boolean>;
  loading: boolean;
}
```

**Usage:**
```tsx
<CacheManager
  onPurge={async (payload) => {
    const success = await purgeCache(zoneId, payload);
    return success;
  }}
  loading={loading}
/>
```

**Features:**
- Toggle entre "Purge All" e "Purge Files"
- Modal de confirmação para purge all
- Textarea para URLs (uma por linha)
- Validação máximo 30 URLs
- Success feedback
- Warning sobre propagação

---

### AnalyticsDashboard
Dashboard de métricas Cloudflare.

**Props:**
```typescript
interface AnalyticsDashboardProps {
  analytics: Analytics | null;
  loading: boolean;
}
```

**Usage:**
```tsx
<AnalyticsDashboard
  analytics={analytics}
  loading={loading}
/>
```

**Features:**
- 5 cards principais:
  - Total Requests (com cached)
  - Bandwidth (formatado)
  - Threats Blocked
  - Page Views (com uniques)
  - Cache Hit Ratio
- Formatação inteligente:
  - Números: 1.5K, 2.3M, 1.1B
  - Bytes: 1.2 GB, 500 MB
- Progress bars para distribuição
- Icons coloridos

---

## Hook Principal

### useCloudflare

Custom hook que centraliza todas as operações.

**Return:**
```typescript
interface UseCloudflareReturn {
  // State
  zones: CloudflareZone[];
  dnsRecords: DNSRecord[];
  firewallRules: FirewallRule[];
  sslSettings: SSLSettings | null;
  analytics: Analytics | null;
  loading: boolean;
  error: CloudflareError | null;

  // Methods
  fetchZones: () => Promise<void>;
  fetchDNSRecords: (zoneId: string) => Promise<void>;
  createDNSRecord: (zoneId: string, payload: CreateDNSRecordPayload) => Promise<boolean>;
  deleteDNSRecord: (zoneId: string, recordId: string) => Promise<boolean>;
  fetchFirewallRules: (zoneId: string) => Promise<void>;
  fetchSSLSettings: (zoneId: string) => Promise<void>;
  updateSSLSettings: (zoneId: string, payload: UpdateSSLPayload) => Promise<boolean>;
  purgeCache: (zoneId: string, payload: CachePurgePayload) => Promise<boolean>;
  fetchAnalytics: (zoneId: string) => Promise<void>;
  clearError: () => void;
}
```

**Usage:**
```tsx
function MyComponent() {
  const {
    zones,
    loading,
    error,
    fetchZones,
    createDNSRecord,
  } = useCloudflare();

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // Use state and methods
}
```

**Features:**
- Auto-refresh após mutations
- Error handling automático
- Loading states
- Auth configurado (Basic)
- Response parsing

---

## Example: Página Completa

```tsx
import { useState, useEffect } from 'react';
import { useCloudflare } from '../hooks/useCloudflare';
import ZonesTable from '../components/cloudflare/ZonesTable';
import DNSRecordsTable from '../components/cloudflare/DNSRecordsTable';

function CloudflarePage() {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const {
    zones,
    dnsRecords,
    loading,
    error,
    fetchZones,
    fetchDNSRecords,
    createDNSRecord,
    deleteDNSRecord,
    clearError,
  } = useCloudflare();

  // Fetch zones on mount
  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // Fetch DNS records when zone selected
  useEffect(() => {
    if (selectedZoneId) {
      fetchDNSRecords(selectedZoneId);
    }
  }, [selectedZoneId, fetchDNSRecords]);

  return (
    <div>
      {error && (
        <div className="error-banner">
          {error.message}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      <ZonesTable
        zones={zones}
        selectedZoneId={selectedZoneId}
        onSelectZone={setSelectedZoneId}
        loading={loading}
      />

      {selectedZoneId && (
        <DNSRecordsTable
          records={dnsRecords}
          onCreateRecord={(payload) => createDNSRecord(selectedZoneId, payload)}
          onDeleteRecord={(id) => deleteDNSRecord(selectedZoneId, id)}
          loading={loading}
        />
      )}
    </div>
  );
}
```

---

## Types

Todas as interfaces estão em `/src/types/cloudflare.types.ts`:

- `CloudflareZone`
- `DNSRecord`
- `CreateDNSRecordPayload`
- `FirewallRule`
- `SSLSettings`
- `UpdateSSLPayload`
- `CachePurgePayload`
- `Analytics`
- `CloudflareAPIResponse<T>`
- `CloudflareError`

---

## Styling

Todos os componentes usam **Tailwind CSS** com paleta consistente:

- Background: `bg-gray-900` (página), `bg-gray-800` (cards)
- Text: `text-white`, `text-gray-400`
- Borders: `border-gray-700`
- Primary: `bg-blue-600 hover:bg-blue-700`
- Destructive: `bg-red-600 hover:bg-red-700`
- Success: `bg-green-900 border-green-600`
- Warning: `bg-yellow-900 border-yellow-600`

---

## Acessibilidade

- ✅ Labels em todos os inputs
- ✅ Disabled states
- ✅ Focus rings
- ✅ Keyboard navigation
- ✅ ARIA implícito (HTML semântico)

---

## Performance

- ✅ useCallback para evitar re-renders
- ✅ Conditional rendering
- ✅ Lazy fetching
- ✅ No prop drilling (hooks)

---

**Autor:** Claude Code
**Data:** 2025-12-17
