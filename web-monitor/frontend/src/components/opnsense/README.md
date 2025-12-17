# OPNsense Components

Componentes React para gerenciamento OPNsense.

## Componentes Disponíveis

### 1. FirewallRulesTable
Tabela de regras de firewall com CRUD completo.

```tsx
import FirewallRulesTable from '@/components/opnsense/FirewallRulesTable';
import { useOPNsense } from '@/hooks/useOPNsense';

function MyPage() {
  const {
    firewallRules,
    addFirewallRule,
    deleteFirewallRule,
    applyFirewallChanges,
    loading,
  } = useOPNsense();

  return (
    <FirewallRulesTable
      rules={firewallRules}
      onAddRule={addFirewallRule}
      onDeleteRule={deleteFirewallRule}
      onApplyChanges={applyFirewallChanges}
      loading={loading}
    />
  );
}
```

### 2. NATTable
Tabela de port forwarding (NAT).

```tsx
import NATTable from '@/components/opnsense/NATTable';
import { useOPNsense } from '@/hooks/useOPNsense';

function MyPage() {
  const {
    natRules,
    addNATRule,
    deleteNATRule,
    applyNATChanges,
    loading,
  } = useOPNsense();

  return (
    <NATTable
      rules={natRules}
      onAddRule={addNATRule}
      onDeleteRule={deleteNATRule}
      onApplyChanges={applyNATChanges}
      loading={loading}
    />
  );
}
```

### 3. VPNTunnelsTable
Tabela de túneis VPN IPSec.

```tsx
import VPNTunnelsTable from '@/components/opnsense/VPNTunnelsTable';
import { useOPNsense } from '@/hooks/useOPNsense';

function MyPage() {
  const {
    vpnTunnels,
    connectVPN,
    disconnectVPN,
    loading,
  } = useOPNsense();

  return (
    <VPNTunnelsTable
      tunnels={vpnTunnels}
      onConnect={connectVPN}
      onDisconnect={disconnectVPN}
      loading={loading}
    />
  );
}
```

### 4. InterfacesTable
Tabela de interfaces de rede (read-only).

```tsx
import InterfacesTable from '@/components/opnsense/InterfacesTable';
import { useOPNsense } from '@/hooks/useOPNsense';

function MyPage() {
  const { interfaces, loading } = useOPNsense();

  return <InterfacesTable interfaces={interfaces} loading={loading} />;
}
```

### 5. DHCPLeasesTable
Tabela de leases DHCP (read-only).

```tsx
import DHCPLeasesTable from '@/components/opnsense/DHCPLeasesTable';
import { useOPNsense } from '@/hooks/useOPNsense';

function MyPage() {
  const { dhcpLeases, loading } = useOPNsense();

  return <DHCPLeasesTable leases={dhcpLeases} loading={loading} />;
}
```

### 6. SystemStatusPanel
Painel de status do sistema com cards.

```tsx
import SystemStatusPanel from '@/components/opnsense/SystemStatusPanel';
import { useOPNsense } from '@/hooks/useOPNsense';

function MyPage() {
  const { systemStatus, loading } = useOPNsense();

  return <SystemStatusPanel status={systemStatus} loading={loading} />;
}
```

## Formulários

### FirewallRuleForm
Formulário para adicionar regra de firewall.

```tsx
import FirewallRuleForm from '@/components/opnsense/FirewallRuleForm';
import type { CreateFirewallRulePayload } from '@/types/opnsense.types';

function MyComponent() {
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (payload: CreateFirewallRulePayload) => {
    const success = await addFirewallRule(payload);
    if (success) setShowForm(false);
    return success;
  };

  return showForm ? (
    <FirewallRuleForm
      onSubmit={handleSubmit}
      onCancel={() => setShowForm(false)}
      loading={loading}
    />
  ) : (
    <button onClick={() => setShowForm(true)}>Add Rule</button>
  );
}
```

### NATForm
Formulário para adicionar port forward.

```tsx
import NATForm from '@/components/opnsense/NATForm';
import type { CreateNATRulePayload } from '@/types/opnsense.types';

function MyComponent() {
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (payload: CreateNATRulePayload) => {
    const success = await addNATRule(payload);
    if (success) setShowForm(false);
    return success;
  };

  return showForm ? (
    <NATForm
      onSubmit={handleSubmit}
      onCancel={() => setShowForm(false)}
      loading={loading}
    />
  ) : (
    <button onClick={() => setShowForm(true)}>Add Port Forward</button>
  );
}
```

## Hook useOPNsense

```tsx
import { useOPNsense } from '@/hooks/useOPNsense';

function MyComponent() {
  const {
    // State
    firewallRules,
    natRules,
    vpnTunnels,
    interfaces,
    dhcpLeases,
    systemStatus,
    loading,
    error,

    // Firewall
    fetchFirewallRules,
    addFirewallRule,
    deleteFirewallRule,
    applyFirewallChanges,

    // NAT
    fetchNATRules,
    addNATRule,
    deleteNATRule,
    applyNATChanges,

    // VPN
    fetchVPNTunnels,
    connectVPN,
    disconnectVPN,

    // Network
    fetchInterfaces,
    fetchDHCPLeases,
    fetchSystemStatus,

    // Error
    clearError,
  } = useOPNsense();

  // Use as needed...
}
```

## Exemplo Completo: Página Custom

```tsx
import { useState, useEffect } from 'react';
import { useOPNsense } from '@/hooks/useOPNsense';
import FirewallRulesTable from '@/components/opnsense/FirewallRulesTable';
import SystemStatusPanel from '@/components/opnsense/SystemStatusPanel';

function CustomOPNsensePage() {
  const {
    firewallRules,
    systemStatus,
    loading,
    error,
    fetchFirewallRules,
    fetchSystemStatus,
    addFirewallRule,
    deleteFirewallRule,
    applyFirewallChanges,
    clearError,
  } = useOPNsense();

  // Fetch initial data
  useEffect(() => {
    fetchFirewallRules();
    fetchSystemStatus();

    // Auto-refresh system status every 30s
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchFirewallRules, fetchSystemStatus]);

  return (
    <div className="bg-gray-900 min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">OPNsense Dashboard</h1>

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-6">
            <strong>Error:</strong> {error.message}
            <button onClick={clearError} className="ml-4 underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-6">
          <SystemStatusPanel status={systemStatus} loading={loading} />

          <FirewallRulesTable
            rules={firewallRules}
            onAddRule={addFirewallRule}
            onDeleteRule={deleteFirewallRule}
            onApplyChanges={applyFirewallChanges}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

export default CustomOPNsensePage;
```

## Tipos TypeScript

Todos os tipos estão em `/src/types/opnsense.types.ts`:

```tsx
import type {
  FirewallRule,
  CreateFirewallRulePayload,
  NATRule,
  CreateNATRulePayload,
  VPNTunnel,
  NetworkInterface,
  DHCPLease,
  SystemStatus,
  OPNsenseAPIResponse,
  OPNsenseError,
} from '@/types/opnsense.types';
```

## Estilização

Todos os componentes usam Tailwind CSS. Para customizar cores:

```tsx
// Substituir cores de badge
const getActionBadgeColor = (action: string) => {
  switch (action) {
    case 'pass':
      return 'bg-green-900 text-green-200';  // Customizar aqui
    case 'block':
      return 'bg-red-900 text-red-200';      // Customizar aqui
    default:
      return 'bg-gray-900 text-gray-200';
  }
};
```

## Performance

- Todos os callbacks são memoizados com `useCallback`
- Dados carregados apenas quando necessário
- Auto-refresh limitado (30s para system status)
- Cleanup de intervalos em useEffect

## Acessibilidade

- Todos inputs têm labels associados
- Estados disabled têm `opacity-50`
- Focus states com `ring-2`
- Cores com contraste WCAG AA
- Semantic HTML (`<table>`, `<label>`, etc)
