import { useState, useEffect } from 'react';
import { useCloudflare } from '../hooks/useCloudflare';
import ZonesTable from '../components/cloudflare/ZonesTable';
import DNSRecordsTable from '../components/cloudflare/DNSRecordsTable';
import FirewallRulesTable from '../components/cloudflare/FirewallRulesTable';
import SSLConfigPanel from '../components/cloudflare/SSLConfigPanel';
import CacheManager from '../components/cloudflare/CacheManager';
import AnalyticsDashboard from '../components/cloudflare/AnalyticsDashboard';

type Tab = 'zones' | 'dns' | 'firewall' | 'ssl' | 'cache' | 'analytics';

function CloudflarePage() {
  const [activeTab, setActiveTab] = useState<Tab>('zones');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const {
    zones,
    dnsRecords,
    firewallRules,
    sslSettings,
    analytics,
    loading,
    error,
    fetchZones,
    fetchDNSRecords,
    createDNSRecord,
    deleteDNSRecord,
    fetchFirewallRules,
    fetchSSLSettings,
    updateSSLSettings,
    purgeCache,
    fetchAnalytics,
    clearError,
  } = useCloudflare();

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  useEffect(() => {
    if (selectedZoneId && activeTab === 'dns') {
      fetchDNSRecords(selectedZoneId);
    }
  }, [selectedZoneId, activeTab, fetchDNSRecords]);

  useEffect(() => {
    if (selectedZoneId && activeTab === 'firewall') {
      fetchFirewallRules(selectedZoneId);
    }
  }, [selectedZoneId, activeTab, fetchFirewallRules]);

  useEffect(() => {
    if (selectedZoneId && activeTab === 'ssl') {
      fetchSSLSettings(selectedZoneId);
    }
  }, [selectedZoneId, activeTab, fetchSSLSettings]);

  useEffect(() => {
    if (selectedZoneId && activeTab === 'analytics') {
      fetchAnalytics(selectedZoneId);
    }
  }, [selectedZoneId, activeTab, fetchAnalytics]);

  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    if (activeTab === 'zones') {
      setActiveTab('dns');
    }
  };

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  const tabs = [
    { id: 'zones' as Tab, label: 'Zones', icon: '🌐' },
    { id: 'dns' as Tab, label: 'DNS', icon: '📝', disabled: !selectedZoneId },
    { id: 'firewall' as Tab, label: 'Firewall', icon: '🛡️', disabled: !selectedZoneId },
    { id: 'ssl' as Tab, label: 'SSL/TLS', icon: '🔒', disabled: !selectedZoneId },
    { id: 'cache' as Tab, label: 'Cache', icon: '⚡', disabled: !selectedZoneId },
    { id: 'analytics' as Tab, label: 'Analytics', icon: '📊', disabled: !selectedZoneId },
  ];

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">☁️</span>
              <div>
                <h1 className="text-3xl font-bold">Cloudflare Management</h1>
                <p className="text-gray-400 text-sm">DNS, Firewall, SSL/TLS, Cache & Analytics</p>
              </div>
            </div>
            {selectedZone && (
              <div className="hidden md:block bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-400">Selected Zone</div>
                <div className="text-sm font-medium">{selectedZone.name}</div>
              </div>
            )}
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
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`px-4 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : tab.disabled
                      ? 'text-gray-600 cursor-not-allowed'
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
          {activeTab === 'zones' && (
            <ZonesTable
              zones={zones}
              selectedZoneId={selectedZoneId}
              onSelectZone={handleSelectZone}
              loading={loading}
            />
          )}

          {activeTab === 'dns' && selectedZoneId && (
            <DNSRecordsTable
              records={dnsRecords}
              onCreateRecord={(payload) => createDNSRecord(selectedZoneId, payload)}
              onDeleteRecord={(recordId) => deleteDNSRecord(selectedZoneId, recordId)}
              loading={loading}
            />
          )}

          {activeTab === 'firewall' && selectedZoneId && (
            <FirewallRulesTable rules={firewallRules} loading={loading} />
          )}

          {activeTab === 'ssl' && selectedZoneId && (
            <SSLConfigPanel
              settings={sslSettings}
              onUpdate={(payload) => updateSSLSettings(selectedZoneId, payload)}
              loading={loading}
            />
          )}

          {activeTab === 'cache' && selectedZoneId && (
            <CacheManager
              onPurge={(payload) => purgeCache(selectedZoneId, payload)}
              loading={loading}
            />
          )}

          {activeTab === 'analytics' && selectedZoneId && (
            <AnalyticsDashboard analytics={analytics} loading={loading} />
          )}
        </main>
      </div>
    </div>
  );
}

export default CloudflarePage;
