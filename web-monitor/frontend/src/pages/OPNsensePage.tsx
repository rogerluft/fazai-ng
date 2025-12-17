import { useState, useEffect } from 'react';
import { useOPNsense } from '../hooks/useOPNsense';
import FirewallRulesTable from '../components/opnsense/FirewallRulesTable';
import NATTable from '../components/opnsense/NATTable';
import VPNTunnelsTable from '../components/opnsense/VPNTunnelsTable';
import InterfacesTable from '../components/opnsense/InterfacesTable';
import DHCPLeasesTable from '../components/opnsense/DHCPLeasesTable';
import SystemStatusPanel from '../components/opnsense/SystemStatusPanel';

type Tab = 'firewall' | 'nat' | 'vpn' | 'interfaces' | 'dhcp' | 'system';

function OPNsensePage() {
  const [activeTab, setActiveTab] = useState<Tab>('firewall');

  const {
    firewallRules,
    natRules,
    vpnTunnels,
    interfaces,
    dhcpLeases,
    systemStatus,
    loading,
    error,
    fetchFirewallRules,
    addFirewallRule,
    deleteFirewallRule,
    applyFirewallChanges,
    fetchNATRules,
    addNATRule,
    deleteNATRule,
    applyNATChanges,
    fetchVPNTunnels,
    connectVPN,
    disconnectVPN,
    fetchInterfaces,
    fetchDHCPLeases,
    fetchSystemStatus,
    clearError,
  } = useOPNsense();

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSystemStatus]);

  useEffect(() => {
    switch (activeTab) {
      case 'firewall':
        fetchFirewallRules();
        break;
      case 'nat':
        fetchNATRules();
        break;
      case 'vpn':
        fetchVPNTunnels();
        break;
      case 'interfaces':
        fetchInterfaces();
        break;
      case 'dhcp':
        fetchDHCPLeases();
        break;
      case 'system':
        fetchSystemStatus();
        break;
    }
  }, [activeTab, fetchFirewallRules, fetchNATRules, fetchVPNTunnels, fetchInterfaces, fetchDHCPLeases, fetchSystemStatus]);

  const tabs = [
    { id: 'firewall' as Tab, label: 'Firewall', icon: '🛡️' },
    { id: 'nat' as Tab, label: 'NAT', icon: '🔀' },
    { id: 'vpn' as Tab, label: 'VPN', icon: '🔒' },
    { id: 'interfaces' as Tab, label: 'Interfaces', icon: '🔌' },
    { id: 'dhcp' as Tab, label: 'DHCP', icon: '📡' },
    { id: 'system' as Tab, label: 'System', icon: '⚙️' },
  ];

  const getSystemStatusBadge = () => {
    if (!systemStatus) return null;

    const isHealthy =
      systemStatus.cpu_usage < 80 &&
      systemStatus.memory_usage < 80 &&
      systemStatus.disk_usage < 80;

    return (
      <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
        isHealthy ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
      }`}>
        {isHealthy ? '✓ System OK' : '⚠ High Usage'}
      </div>
    );
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🛡️</span>
              <div>
                <h1 className="text-3xl font-bold">OPNsense Management</h1>
                <p className="text-gray-400 text-sm">Firewall, NAT, VPN, Network & System</p>
              </div>
            </div>
            {getSystemStatusBadge()}
          </div>

          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg flex items-start gap-3">
              <span className="text-xl">❌</span>
              <div className="flex-1">
                <strong>Error:</strong> {error.message}
                {error.code && <span className="text-xs ml-2">(Code: {error.code})</span>}
              </div>
              <button
                onClick={clearError}
                className="text-red-300 hover:text-red-100 font-medium"
              >
                Dismiss
              </button>
            </div>
          )}
        </header>

        <nav className="mb-6">
          <div className="border-b border-gray-700 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <main>
          {activeTab === 'firewall' && (
            <FirewallRulesTable
              rules={firewallRules}
              onAddRule={addFirewallRule}
              onDeleteRule={deleteFirewallRule}
              onApplyChanges={applyFirewallChanges}
              loading={loading}
            />
          )}

          {activeTab === 'nat' && (
            <NATTable
              rules={natRules}
              onAddRule={addNATRule}
              onDeleteRule={deleteNATRule}
              onApplyChanges={applyNATChanges}
              loading={loading}
            />
          )}

          {activeTab === 'vpn' && (
            <VPNTunnelsTable
              tunnels={vpnTunnels}
              onConnect={connectVPN}
              onDisconnect={disconnectVPN}
              loading={loading}
            />
          )}

          {activeTab === 'interfaces' && (
            <InterfacesTable
              interfaces={interfaces}
              loading={loading}
            />
          )}

          {activeTab === 'dhcp' && (
            <DHCPLeasesTable
              leases={dhcpLeases}
              loading={loading}
            />
          )}

          {activeTab === 'system' && (
            <SystemStatusPanel
              status={systemStatus}
              loading={loading}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default OPNsensePage;
