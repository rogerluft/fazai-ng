'use client';

import type { Analytics } from '@/types/cloudflare.types';

interface AnalyticsDashboardProps {
  analytics: Analytics | null;
  loading: boolean;
}

function AnalyticsDashboard({ analytics, loading }: AnalyticsDashboardProps) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading analytics...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
        <p className="text-gray-400">No analytics data available</p>
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(1)}B`;
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1_099_511_627_776) {
      return `${(bytes / 1_099_511_627_776).toFixed(2)} TB`;
    }
    if (bytes >= 1_073_741_824) {
      return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
    }
    if (bytes >= 1_048_576) {
      return `${(bytes / 1_048_576).toFixed(2)} MB`;
    }
    if (bytes >= 1_024) {
      return `${(bytes / 1_024).toFixed(2)} KB`;
    }
    return `${bytes} B`;
  };

  const calculateCacheHitRatio = (): string => {
    const total = analytics.totals.requests.all;
    const cached = analytics.totals.requests.cached;
    if (total === 0) return '0%';
    return `${((cached / total) * 100).toFixed(1)}%`;
  };

  const stats = [
    {
      label: 'Total Requests',
      value: formatNumber(analytics.totals.requests.all),
      subtext: `${formatNumber(analytics.totals.requests.cached)} cached`,
      icon: '[REQ]',
      color: 'bg-blue-900 border-blue-600',
    },
    {
      label: 'Bandwidth',
      value: formatBytes(analytics.totals.bandwidth.all),
      subtext: `${formatBytes(analytics.totals.bandwidth.cached)} cached`,
      icon: '[BW]',
      color: 'bg-purple-900 border-purple-600',
    },
    {
      label: 'Threats Blocked',
      value: formatNumber(analytics.totals.threats.all),
      subtext: 'Security events',
      icon: '[SEC]',
      color: 'bg-red-900 border-red-600',
    },
    {
      label: 'Page Views',
      value: formatNumber(analytics.totals.pageviews.all),
      subtext: `${formatNumber(analytics.totals.uniques.all)} unique visitors`,
      icon: '[PV]',
      color: 'bg-green-900 border-green-600',
    },
    {
      label: 'Cache Hit Ratio',
      value: calculateCacheHitRatio(),
      subtext: 'Efficiency',
      icon: '[HIT]',
      color: 'bg-yellow-900 border-yellow-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">Analytics Dashboard</h3>
        <p className="text-sm text-gray-400">Last 24 hours overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`bg-gray-800 border-2 ${stat.color} rounded-lg p-6 hover:scale-105 transition-transform`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-gray-400 text-sm font-medium mb-1">{stat.label}</div>
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-gray-500 text-xs">{stat.subtext}</div>
              </div>
              <div className="text-4xl ml-4 font-mono">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {analytics.timeseries.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-4">Request Distribution</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-400">Cached</div>
              <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-green-500 h-full rounded-full transition-all"
                  style={{
                    width: `${
                      analytics.totals.requests.all > 0
                        ? (analytics.totals.requests.cached / analytics.totals.requests.all) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
              <div className="w-24 text-sm text-gray-300 text-right">
                {formatNumber(analytics.totals.requests.cached)}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-400">Uncached</div>
              <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{
                    width: `${
                      analytics.totals.requests.all > 0
                        ? (analytics.totals.requests.uncached / analytics.totals.requests.all) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
              <div className="w-24 text-sm text-gray-300 text-right">
                {formatNumber(analytics.totals.requests.uncached)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-900 border border-blue-600 text-blue-200 px-4 py-3 rounded-lg text-sm">
        <strong>Note:</strong> Analytics data is updated every 60 seconds and may have a delay of
        up to 5 minutes.
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
