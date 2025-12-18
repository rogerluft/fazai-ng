'use client';

import { useState, FormEvent } from 'react';
import type { ListEntry, AddListEntryPayload } from '@/types/spamexperts.types';

interface ListManagerProps {
  listType: 'whitelist' | 'blacklist';
  entries: ListEntry[];
  onAdd: (payload: AddListEntryPayload) => Promise<boolean>;
  onRemove: (entry: string) => Promise<boolean>;
  loading: boolean;
}

function ListManager({ listType, entries, onAdd, onRemove, loading }: ListManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [entry, setEntry] = useState('');
  const [entryType, setEntryType] = useState<'email' | 'domain' | 'ip'>('email');
  const [comment, setComment] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');

  const validateEntry = (value: string, type: 'email' | 'domain' | 'ip'): boolean => {
    if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    }
    if (type === 'domain') {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
      return domainRegex.test(value);
    }
    if (type === 'ip') {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      return ipRegex.test(value);
    }
    return false;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!entry.trim()) {
      setValidationError('Entry is required');
      return;
    }

    if (!validateEntry(entry.trim(), entryType)) {
      setValidationError(`Invalid ${entryType} format`);
      return;
    }

    const payload: AddListEntryPayload = {
      entry: entry.trim(),
      entry_type: entryType,
      comment: comment.trim() || undefined,
    };

    const success = await onAdd(payload);
    if (success) {
      setEntry('');
      setComment('');
      setShowAddForm(false);
    }
  };

  const handleRemove = async (entryValue: string) => {
    const success = await onRemove(entryValue);
    if (success) {
      setDeleteConfirm(null);
    }
  };

  const getEntryTypeIcon = (type: ListEntry['entry_type']) => {
    switch (type) {
      case 'email':
        return '[E]';
      case 'domain':
        return '[D]';
      case 'ip':
        return '[IP]';
      default:
        return '[?]';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const title = listType === 'whitelist' ? 'Whitelist' : 'Blacklist';
  const icon = listType === 'whitelist' ? '[+]' : '[-]';
  const addButtonColor = listType === 'whitelist' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

  if (showAddForm) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">
          {icon} Add to {title}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg text-sm">
              {validationError}
            </div>
          )}

          <div>
            <label htmlFor="entryType" className="block text-sm font-medium text-gray-300 mb-2">
              Entry Type
            </label>
            <select
              id="entryType"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as 'email' | 'domain' | 'ip')}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="email">Email Address</option>
              <option value="domain">Domain</option>
              <option value="ip">IP Address</option>
            </select>
          </div>

          <div>
            <label htmlFor="entry" className="block text-sm font-medium text-gray-300 mb-2">
              {entryType === 'email' && 'Email Address'}
              {entryType === 'domain' && 'Domain'}
              {entryType === 'ip' && 'IP Address'}
            </label>
            <input
              type="text"
              id="entry"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder={
                entryType === 'email'
                  ? 'user@example.com'
                  : entryType === 'domain'
                  ? 'example.com'
                  : '192.168.1.1'
              }
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-300 mb-2">
              Comment (Optional)
            </label>
            <input
              type="text"
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Reason for adding this entry"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 ${addButtonColor} text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? 'Adding...' : `Add to ${title}`}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              disabled={loading}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (loading && entries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading {title.toLowerCase()}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">
          {icon} {title}
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className={`${addButtonColor} text-white font-medium py-2 px-4 rounded-lg transition-colors`}
        >
          Add Entry
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">No entries in {title.toLowerCase()}</p>
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
                    Entry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Comment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Added By
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {entries.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xl font-mono" title={item.entry_type}>
                        {getEntryTypeIcon(item.entry_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white max-w-xs truncate">{item.entry}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-400 max-w-xs truncate">
                        {item.comment || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-400">{formatDate(item.created_at)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-400">{item.created_by}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {deleteConfirm === item.entry ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleRemove(item.entry)}
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
                          onClick={() => setDeleteConfirm(item.entry)}
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

export default ListManager;
