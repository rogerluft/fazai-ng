import { useState } from 'react';
import type { SpamExpertsDomain, AddDomainPayload } from '../../types/spamexperts.types';
import DomainForm from './DomainForm';

interface DomainsTableProps {
  domains: SpamExpertsDomain[];
  onAddDomain: (payload: AddDomainPayload) => Promise<boolean>;
  onRemoveDomain: (domain: string) => Promise<boolean>;
  onSelectDomain: (domain: string) => void;
  selectedDomain: string | null;
  loading: boolean;
}

function DomainsTable({
  domains,
  onAddDomain,
  onRemoveDomain,
  onSelectDomain,
  selectedDomain,
  loading,
}: DomainsTableProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (domain: string) => {
    const success = await onRemoveDomain(domain);
    if (success) {
      setDeleteConfirm(null);
    }
  };

  const handleAddDomain = async (payload: AddDomainPayload) => {
    const success = await onAddDomain(payload);
    if (success) {
      setShowAddForm(false);
    }
    return success;
  };

  const getStatusColor = (status: SpamExpertsDomain['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'suspended':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (showAddForm) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Add Domain</h3>
        <DomainForm
          onSubmit={handleAddDomain}
          onCancel={() => setShowAddForm(false)}
          loading={loading}
        />
      </div>
    );
  }

  if (loading && domains.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading domains...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Protected Domains</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Add Domain
        </button>
      </div>

      {domains.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">No domains configured</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Protection
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {domains.map((domain) => (
                  <tr
                    key={domain.domain}
                    onClick={() => onSelectDomain(domain.domain)}
                    className={`cursor-pointer hover:bg-gray-700 transition-colors ${
                      selectedDomain === domain.domain ? 'bg-gray-700' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{domain.domain}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{domain.destination}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(
                          domain.status
                        )}`}
                      >
                        {domain.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2 text-sm">
                        {domain.protection.incoming && (
                          <span className="text-green-400" title="Incoming protection">
                            ↓
                          </span>
                        )}
                        {domain.protection.outgoing && (
                          <span className="text-blue-400" title="Outgoing protection">
                            ↑
                          </span>
                        )}
                        {domain.protection.archiving && (
                          <span className="text-purple-400" title="Archiving enabled">
                            📁
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {deleteConfirm === domain.domain ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(domain.domain);
                            }}
                            disabled={loading}
                            className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(null);
                            }}
                            disabled={loading}
                            className="text-gray-400 hover:text-gray-300 text-sm font-medium disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(domain.domain);
                          }}
                          disabled={loading}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DomainsTable;
