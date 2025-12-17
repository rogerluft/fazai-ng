import type { SystemStatus } from '../../types/opnsense.types';

interface SystemStatusPanelProps {
  status: SystemStatus | null;
  loading: boolean;
}

function SystemStatusPanel({ status, loading }: SystemStatusPanelProps) {
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join(' ') : '< 1m';
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 70) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  if (loading && !status) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading system status...</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
        <p className="text-gray-400">System status unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-white">System Status</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">Uptime</h4>
            <span className="text-2xl">⏱️</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {status.uptime_text || formatUptime(status.uptime)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {status.uptime.toLocaleString()} seconds
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">CPU Usage</h4>
            <span className="text-2xl">💻</span>
          </div>
          <div className="text-2xl font-bold text-white mb-2">
            {status.cpu_usage.toFixed(1)}%
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getUsageColor(status.cpu_usage)}`}
              style={{ width: `${Math.min(status.cpu_usage, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">Memory Usage</h4>
            <span className="text-2xl">🧠</span>
          </div>
          <div className="text-2xl font-bold text-white mb-2">
            {status.memory_usage.toFixed(1)}%
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getUsageColor(status.memory_usage)}`}
              style={{ width: `${Math.min(status.memory_usage, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">Disk Usage</h4>
            <span className="text-2xl">💾</span>
          </div>
          <div className="text-2xl font-bold text-white mb-2">
            {status.disk_usage.toFixed(1)}%
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getUsageColor(status.disk_usage)}`}
              style={{ width: `${Math.min(status.disk_usage, 100)}%` }}
            ></div>
          </div>
        </div>

        {status.temperature !== undefined && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-400">Temperature</h4>
              <span className="text-2xl">🌡️</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {status.temperature.toFixed(1)}°C
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {(status.temperature * 9/5 + 32).toFixed(1)}°F
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">Load Average</h4>
            <span className="text-2xl">📊</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">1 min:</span>
              <span className="text-white font-medium">{status.load_average.one.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">5 min:</span>
              <span className="text-white font-medium">{status.load_average.five.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">15 min:</span>
              <span className="text-white font-medium">{status.load_average.fifteen.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {status.kernel_pf_states !== undefined && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-400">Firewall States</h4>
              <span className="text-2xl">🔥</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {status.kernel_pf_states.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Active connections
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SystemStatusPanel;
