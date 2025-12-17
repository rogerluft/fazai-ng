'use client';

import { useState, useEffect } from 'react';
import { useSpamExperts } from '@/lib/hooks/useSpamExperts';
import DomainsTable from './DomainsTable';
import QuarantineTable from './QuarantineTable';
import ReportsDashboard from './ReportsDashboard';
import ListManager from './ListManager';

type Tab = 'domains' | 'quarantine' | 'reports' | 'whitelist' | 'blacklist';

function SpamExpertsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('domains');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const {
    domains,
    quarantine,
    report,
    whitelist,
    blacklist,
    loading,
    error,
    fetchDomains,
    addDomain,
    removeDomain,
    fetchQuarantine,
    releaseMessage,
    deleteMessage,
    fetchReport,
    fetchList,
    addToList,
    removeFromList,
    clearError,
  } = useSpamExperts();

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    if (selectedDomain && activeTab === 'quarantine') {
      fetchQuarantine(selectedDomain);
    }
  }, [selectedDomain, activeTab, fetchQuarantine]);

  useEffect(() => {
    if (selectedDomain && activeTab === 'reports') {
      fetchReport(selectedDomain, '24h');
    }
  }, [selectedDomain, activeTab, fetchReport]);

  useEffect(() => {
    if (activeTab === 'whitelist') {
      fetchList('whitelist');
    }
  }, [activeTab, fetchList]);

  useEffect(() => {
    if (activeTab === 'blacklist') {
      fetchList('blacklist');
    }
  }, [activeTab, fetchList]);

  const handleSelectDomain = (domain: string) => {
    setSelectedDomain(domain);
    if (activeTab === 'domains') {
      setActiveTab('quarantine');
    }
  };

  const handlePeriodChange = (period: '24h' | '7d' | '30d') => {
    if (selectedDomain) {
      fetchReport(selectedDomain, period);
    }
  };

  const selectedDomainData = domains.find((d) => d.domain === selectedDomain);

  const tabs = [
    { id: 'domains' as Tab, label: 'Domains', icon: '[DOM]' },
    { id: 'quarantine' as Tab, label: 'Quarantine', icon: '[Q]', disabled: !selectedDomain },
    { id: 'reports' as Tab, label: 'Reports', icon: '[REP]', disabled: !selectedDomain },
    { id: 'whitelist' as Tab, label: 'Whitelist', icon: '[+]' },
    { id: 'blacklist' as Tab, label: 'Blacklist', icon: '[-]' },
  ];

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">[SE]</span>
              <div>
                <h1 className="text-3xl font-bold">SpamExperts Management</h1>
                <p className="text-gray-400 text-sm">Email Protection, Quarantine & Filtering</p>
              </div>
            </div>
            {selectedDomainData && (
              <div className="hidden md:block bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
                <div className="text-xs text-gray-400">Selected Domain</div>
                <div className="text-sm font-medium">{selectedDomainData.domain}</div>
              </div>
            )}
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
          {activeTab === 'domains' && (
            <DomainsTable
              domains={domains}
              onAddDomain={addDomain}
              onRemoveDomain={removeDomain}
              onSelectDomain={handleSelectDomain}
              selectedDomain={selectedDomain}
              loading={loading}
            />
          )}

          {activeTab === 'quarantine' && selectedDomain && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">
                Quarantine for {selectedDomain}
              </h3>
              <QuarantineTable
                messages={quarantine}
                onRelease={releaseMessage}
                onDelete={deleteMessage}
                loading={loading}
              />
            </div>
          )}

          {activeTab === 'reports' && selectedDomain && (
            <ReportsDashboard
              report={report}
              onPeriodChange={handlePeriodChange}
              loading={loading}
            />
          )}

          {activeTab === 'whitelist' && (
            <ListManager
              listType="whitelist"
              entries={whitelist}
              onAdd={(payload) => addToList('whitelist', payload)}
              onRemove={(entry) => removeFromList('whitelist', entry)}
              loading={loading}
            />
          )}

          {activeTab === 'blacklist' && (
            <ListManager
              listType="blacklist"
              entries={blacklist}
              onAdd={(payload) => addToList('blacklist', payload)}
              onRemove={(entry) => removeFromList('blacklist', entry)}
              loading={loading}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default SpamExpertsPage;
