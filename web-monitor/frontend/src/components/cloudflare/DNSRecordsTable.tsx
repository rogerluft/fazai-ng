import { useState } from 'react';
import type { DNSRecord, CreateDNSRecordPayload } from '../../types/cloudflare.types';
import DNSRecordForm from './DNSRecordForm';

interface DNSRecordsTableProps {
  records: DNSRecord[];
  onCreateRecord: (payload: CreateDNSRecordPayload) => Promise<boolean>;
  onDeleteRecord: (recordId: string) => Promise<boolean>;
  loading: boolean;
}

function DNSRecordsTable({ records, onCreateRecord, onDeleteRecord, loading }: DNSRecordsTableProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (recordId: string) => {
    const success = await onDeleteRecord(recordId);
    if (success) {
      setDeleteConfirm(null);
    }
  };

  if (showCreateForm) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Add DNS Record</h3>
        <DNSRecordForm
          onSubmit={onCreateRecord}
          onCancel={() => setShowCreateForm(false)}
          loading={loading}
        />
      </div>
    );
  }

  if (loading && records.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading DNS records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">DNS Records</h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Add Record
        </button>
      </div>

      {records.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">No DNS records found</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Content
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Proxy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    TTL
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-900 text-blue-200">
                        {record.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white max-w-xs truncate">
                        {record.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300 max-w-xs truncate">
                        {record.content}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.proxiable ? (
                        record.proxied ? (
                          <span className="text-orange-400" title="Proxied through Cloudflare">
                            ☁️
                          </span>
                        ) : (
                          <span className="text-gray-500" title="DNS only">
                            ☁️
                          </span>
                        )
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-400">
                        {record.ttl === 1 ? 'Auto' : `${record.ttl}s`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {deleteConfirm === record.id ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleDelete(record.id)}
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
                          onClick={() => setDeleteConfirm(record.id)}
                          disabled={loading || record.locked}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={record.locked ? 'This record is locked' : 'Delete record'}
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

export default DNSRecordsTable;
