'use client';

import { useState, useEffect } from 'react';
import { useOPNsense } from '@/lib/hooks/useOPNsense';
import FirewallRulesTable from './FirewallRulesTable';
import NATTable from './NATTable';
import VPNTunnelsTable from './VPNTunnelsTable';
import InterfacesTable from './InterfacesTable';
import DHCPLeasesTable from './DHCPLeasesTable';
import SystemStatusPanel from './SystemStatusPanel';

type Tab = 'firewall' | 'nat' | 'vpn' | 'interfaces' | 'dhcp' | 'status';

function OPNsensePage() {
  const [activeTab, setActiveTab] = useState<Tab>('status');

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
  }, [fetchSystemStatus]);

  useEffect(() => {
    if (activeTab === 'firewall') {
      fetchFirewallRules();
    }
  }, [activeTab, fetchFirewallRules]);

  useEffect(() => {
    if (activeTab === 'nat') {
      fetchNATRules();
    }
  }, [activeTab, fetchNATRules]);

  useEffect(() => {
    if (activeTab === 'vpn') {
      fetchVPNTunnels();
    }
  }, [activeTab, fetchVPNTunnels]);

  useEffect(() => {
    if (activeTab === 'interfaces') {
      fetchInterfaces();
    }
  }, [activeTab, fetchInterfaces]);

  useEffect(() => {
    if (activeTab === 'dhcp') {
      fetchDHCPLeases();
    }
  }, [activeTab, fetchDHCPLeases]);

  useEffect(() => {
    if (activeTab === 'status') {
      fetchSystemStatus();
    }
  }, [activeTab, fetchSystemStatus]);

  const tabs = [
    { id: 'status' as Tab, label: 'System Status', icon: '[SYS]' },
    { id: 'firewall' as Tab, label: 'Firewall', icon: '[FW]' },
    { id: 'nat' as Tab, label: 'NAT', icon: '[NAT]' },
    { id: 'vpn' as Tab, label: 'VPN', icon: '[VPN]' },
    { id: 'interfaces' as Tab, label: 'Interfaces', icon: '[IF]' },
    { id: 'dhcp' as Tab, label: 'DHCP', icon: '[DHCP]' },
  ];

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">[OPN]</span>
              <div>
                <h1 className="text-3xl font-bold">OPNsense Management</h1>
                <p className="text-gray-400 text-sm">Firewall, NAT, VPN, Network & DHCP</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg flex items-start gap-3">
              <span className="text-xl">[X]</span>
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
          {activeTab === 'status' && (
            <SystemStatusPanel status={systemStatus} loading={loading} />
          )}

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
            <InterfacesTable interfaces={interfaces} loading={loading} />
          )}

          {activeTab === 'dhcp' && (
            <DHCPLeasesTable leases={dhcpLeases} loading={loading} />
          )}
        </main>
      </div>
    </div>
  );
}

export default OPNsensePage;
