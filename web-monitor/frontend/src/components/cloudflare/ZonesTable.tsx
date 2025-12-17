import type { CloudflareZone } from '../../types/cloudflare.types';

interface ZonesTableProps {
  zones: CloudflareZone[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  loading: boolean;
}

function ZonesTable({ zones, selectedZoneId, onSelectZone, loading }: ZonesTableProps) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading zones...</p>
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
        <p className="text-gray-400">No zones found</p>
      </div>
    );
  }

  const getStatusColor = (status: CloudflareZone['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'initializing':
        return 'bg-blue-500';
      case 'moved':
      case 'deleted':
      case 'deactivated':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Name Servers
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {zones.map((zone) => (
              <tr
                key={zone.id}
                onClick={() => onSelectZone(zone.id)}
                className={`cursor-pointer hover:bg-gray-700 transition-colors ${
                  selectedZoneId === zone.id ? 'bg-gray-700' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-white">{zone.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getStatusColor(
                      zone.status
                    )}`}
                  >
                    {zone.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-300">{zone.plan.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-400">
                    {zone.name_servers.slice(0, 2).join(', ')}
                    {zone.name_servers.length > 2 && (
                      <span className="text-gray-500"> +{zone.name_servers.length - 2} more</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ZonesTable;
