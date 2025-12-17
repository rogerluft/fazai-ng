import { useState } from 'react';
import type { SpamReport } from '../../types/spamexperts.types';

interface ReportsDashboardProps {
  report: SpamReport | null;
  onPeriodChange: (period: '24h' | '7d' | '30d') => void;
  loading: boolean;
}

function ReportsDashboard({ report, onPeriodChange, loading }: ReportsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d'>('24h');

  const handlePeriodChange = (period: '24h' | '7d' | '30d') => {
    setSelectedPeriod(period);
    onPeriodChange(period);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const calculatePercentage = (value: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  if (loading && !report) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
        <p className="text-gray-400">No report data available</p>
      </div>
    );
  }

  const periods = [
    { value: '24h' as const, label: 'Last 24 Hours' },
    { value: '7d' as const, label: 'Last 7 Days' },
    { value: '30d' as const, label: 'Last 30 Days' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Email Protection Report</h3>
        <div className="flex gap-2">
          {periods.map((period) => (
            <button
              key={period.value}
              onClick={() => handlePeriodChange(period.value)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">Total Emails</h4>
            <span className="text-2xl">📧</span>
          </div>
          <div className="text-3xl font-bold text-white">{formatNumber(report.total_emails)}</div>
          <div className="text-xs text-gray-500 mt-1">Processed</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">Spam Blocked</h4>
            <span className="text-2xl">🛡️</span>
          </div>
          <div className="text-3xl font-bold text-red-400">{formatNumber(report.spam_blocked)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {calculatePercentage(report.spam_blocked, report.total_emails)}% of total
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">Clean Delivered</h4>
            <span className="text-2xl">✅</span>
          </div>
          <div className="text-3xl font-bold text-green-400">{formatNumber(report.clean_delivered)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {calculatePercentage(report.clean_delivered, report.total_emails)}% of total
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-400">Quarantined</h4>
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400">{formatNumber(report.quarantined)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {calculatePercentage(report.quarantined, report.total_emails)}% of total
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-4">Incoming Email Statistics</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Received</span>
              <span className="text-white font-medium">{formatNumber(report.statistics.incoming.total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Clean</span>
              <span className="text-green-400 font-medium">{formatNumber(report.statistics.incoming.clean)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Spam</span>
              <span className="text-red-400 font-medium">{formatNumber(report.statistics.incoming.spam)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Virus</span>
              <span className="text-purple-400 font-medium">{formatNumber(report.statistics.incoming.virus)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Quarantined</span>
              <span className="text-yellow-400 font-medium">
                {formatNumber(report.statistics.incoming.quarantined)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-4">Outgoing Email Statistics</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Sent</span>
              <span className="text-white font-medium">{formatNumber(report.statistics.outgoing.total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Successfully Sent</span>
              <span className="text-green-400 font-medium">{formatNumber(report.statistics.outgoing.sent)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Rejected</span>
              <span className="text-red-400 font-medium">{formatNumber(report.statistics.outgoing.rejected)}</span>
            </div>
          </div>
        </div>
      </div>

      {(report.top_senders.length > 0 || report.top_recipients.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {report.top_senders.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h4 className="text-lg font-semibold text-white mb-4">Top Senders</h4>
              <div className="space-y-2">
                {report.top_senders.slice(0, 5).map((sender, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300 truncate max-w-xs">{sender.email}</span>
                    <span className="text-gray-400 ml-2">{sender.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.top_recipients.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h4 className="text-lg font-semibold text-white mb-4">Top Recipients</h4>
              <div className="space-y-2">
                {report.top_recipients.slice(0, 5).map((recipient, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300 truncate max-w-xs">{recipient.email}</span>
                    <span className="text-gray-400 ml-2">{recipient.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportsDashboard;
