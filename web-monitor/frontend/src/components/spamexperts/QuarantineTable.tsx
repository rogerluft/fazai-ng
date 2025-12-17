import { useState } from 'react';
import type { QuarantineMessage } from '../../types/spamexperts.types';

interface QuarantineTableProps {
  messages: QuarantineMessage[];
  onRelease: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  loading: boolean;
}

function QuarantineTable({ messages, onRelease, onDelete, loading }: QuarantineTableProps) {
  const [actionConfirm, setActionConfirm] = useState<{ id: string; action: 'release' | 'delete' } | null>(null);

  const handleRelease = async (id: string) => {
    const success = await onRelease(id);
    if (success) {
      setActionConfirm(null);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await onDelete(id);
    if (success) {
      setActionConfirm(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 10) return 'text-red-400';
    if (score >= 5) return 'text-orange-400';
    return 'text-yellow-400';
  };

  if (loading && messages.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading quarantined messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-gray-400">No quarantined messages</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                From
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {messages.map((message) => (
              <tr key={message.id} className="hover:bg-gray-700 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-white max-w-xs truncate" title={message.subject}>
                    {message.subject || '(No subject)'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{message.reason}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-300 max-w-xs truncate" title={message.sender}>
                    {message.sender}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-300 max-w-xs truncate" title={message.recipient}>
                    {message.recipient}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-400">{formatDate(message.date)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm font-medium ${getScoreColor(message.score)}`}>
                    {message.score.toFixed(1)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-400">{formatSize(message.size)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {actionConfirm?.id === message.id ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() =>
                          actionConfirm.action === 'release'
                            ? handleRelease(message.id)
                            : handleDelete(message.id)
                        }
                        disabled={loading}
                        className={`${
                          actionConfirm.action === 'release'
                            ? 'text-green-400 hover:text-green-300'
                            : 'text-red-400 hover:text-red-300'
                        } text-sm font-medium disabled:opacity-50`}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setActionConfirm(null)}
                        disabled={loading}
                        className="text-gray-400 hover:text-gray-300 text-sm font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setActionConfirm({ id: message.id, action: 'release' })}
                        disabled={loading}
                        className="text-green-400 hover:text-green-300 disabled:opacity-50"
                        title="Release message"
                      >
                        Release
                      </button>
                      <button
                        onClick={() => setActionConfirm({ id: message.id, action: 'delete' })}
                        disabled={loading}
                        className="text-red-400 hover:text-red-300 disabled:opacity-50"
                        title="Delete message"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default QuarantineTable;
