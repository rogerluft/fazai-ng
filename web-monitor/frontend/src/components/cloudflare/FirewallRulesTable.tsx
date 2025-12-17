import type { FirewallRule } from '../../types/cloudflare.types';

interface FirewallRulesTableProps {
  rules: FirewallRule[];
  loading: boolean;
}

function FirewallRulesTable({ rules, loading }: FirewallRulesTableProps) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading firewall rules...</p>
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
        <p className="text-gray-400">No firewall rules found</p>
      </div>
    );
  }

  const getActionColor = (action: FirewallRule['action']) => {
    switch (action) {
      case 'block':
        return 'bg-red-900 text-red-200';
      case 'allow':
      case 'bypass':
        return 'bg-green-900 text-green-200';
      case 'challenge':
      case 'js_challenge':
      case 'managed_challenge':
        return 'bg-yellow-900 text-yellow-200';
      case 'log':
        return 'bg-blue-900 text-blue-200';
      default:
        return 'bg-gray-900 text-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Firewall Rules</h3>
        <div className="text-sm text-gray-400">Read-only view</div>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Expression
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-white max-w-xs">
                      {rule.description || 'Unnamed Rule'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-300 max-w-md">
                      <code className="bg-gray-900 px-2 py-1 rounded text-xs">
                        {rule.filter.expression}
                      </code>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getActionColor(
                        rule.action
                      )}`}
                    >
                      {rule.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                        rule.paused
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-green-900 text-green-200'
                      }`}
                    >
                      {rule.paused ? 'Paused' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-400">
                      {rule.priority !== null ? rule.priority : '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FirewallRulesTable;
