import type { VPNTunnel } from '../../types/opnsense.types';

interface VPNTunnelsTableProps {
  tunnels: VPNTunnel[];
  onConnect: (ikeid: string) => Promise<boolean>;
  onDisconnect: (ikeid: string) => Promise<boolean>;
  loading: boolean;
}

function VPNTunnelsTable({ tunnels, onConnect, onDisconnect, loading }: VPNTunnelsTableProps) {
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-900 text-green-200';
      case 'disconnected':
        return 'bg-gray-700 text-gray-300';
      case 'connecting':
        return 'bg-yellow-900 text-yellow-200';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  if (loading && tunnels.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading VPN tunnels...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">VPN Tunnels</h3>
      </div>

      {tunnels.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">No VPN tunnels configured</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Remote Gateway
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Local Subnet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Remote Subnet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {tunnels.map((tunnel) => (
                  <tr key={tunnel.ikeid} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{tunnel.name}</div>
                      {tunnel.description && (
                        <div className="text-xs text-gray-400">{tunnel.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{tunnel.remote_gateway}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{tunnel.local_subnet}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">{tunnel.remote_subnet}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(tunnel.status)}`}>
                        {tunnel.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      {tunnel.status === 'connected' ? (
                        <button
                          onClick={() => onDisconnect(tunnel.ikeid)}
                          disabled={loading}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => onConnect(tunnel.ikeid)}
                          disabled={loading || tunnel.status === 'connecting'}
                          className="text-green-400 hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {tunnel.status === 'connecting' ? 'Connecting...' : 'Connect'}
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

export default VPNTunnelsTable;
