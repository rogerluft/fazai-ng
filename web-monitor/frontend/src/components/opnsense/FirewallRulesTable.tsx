import { useState } from 'react';
import type { FirewallRule, CreateFirewallRulePayload } from '../../types/opnsense.types';
import FirewallRuleForm from './FirewallRuleForm';

interface FirewallRulesTableProps {
  rules: FirewallRule[];
  onAddRule: (payload: CreateFirewallRulePayload) => Promise<boolean>;
  onDeleteRule: (uuid: string) => Promise<boolean>;
  onApplyChanges: () => Promise<boolean>;
  loading: boolean;
}

function FirewallRulesTable({ rules, onAddRule, onDeleteRule, onApplyChanges, loading }: FirewallRulesTableProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(false);

  const handleDelete = async (uuid: string) => {
    const success = await onDeleteRule(uuid);
    if (success) {
      setDeleteConfirm(null);
      setPendingChanges(true);
    }
  };

  const handleApply = async () => {
    const success = await onApplyChanges();
    if (success) {
      setPendingChanges(false);
    }
  };

  const handleAddRule = async (payload: CreateFirewallRulePayload) => {
    const success = await onAddRule(payload);
    if (success) {
      setShowAddForm(false);
      setPendingChanges(true);
    }
    return success;
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'pass':
        return 'bg-green-900 text-green-200';
      case 'block':
        return 'bg-red-900 text-red-200';
      case 'reject':
        return 'bg-yellow-900 text-yellow-200';
      default:
        return 'bg-gray-900 text-gray-200';
    }
  };

  if (showAddForm) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Add Firewall Rule</h3>
        <FirewallRuleForm
          onSubmit={handleAddRule}
          onCancel={() => setShowAddForm(false)}
          loading={loading}
        />
      </div>
    );
  }

  if (loading && rules.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading firewall rules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h3 className="text-xl font-semibold text-white">Firewall Rules</h3>
        <div className="flex gap-3">
          {pendingChanges && (
            <button
              onClick={handleApply}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Apply Changes
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Add Rule
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">No firewall rules found</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Interface
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Protocol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Port
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {rules.map((rule) => (
                  <tr key={rule.uuid} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getActionBadgeColor(rule.action)}`}>
                        {rule.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{rule.interface}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{rule.protocol}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-300 max-w-xs truncate">
                        {rule.source_net}
                        {rule.source_port && `:${rule.source_port}`}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-300 max-w-xs truncate">
                        {rule.destination_net}
                        {rule.destination_port && `:${rule.destination_port}`}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-400">
                        {rule.destination_port || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-400 max-w-xs truncate">
                        {rule.description || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      {deleteConfirm === rule.uuid ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleDelete(rule.uuid)}
                            disabled={loading}
                            className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            disabled={loading}
                            className="text-gray-400 hover:text-gray-300 text-sm font-medium disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(rule.uuid)}
                          disabled={loading}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Delete
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

export default FirewallRulesTable;
