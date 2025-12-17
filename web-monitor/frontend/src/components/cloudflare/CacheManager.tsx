import { useState } from 'react';
import type { CachePurgePayload } from '../../types/cloudflare.types';

interface CacheManagerProps {
  onPurge: (payload: CachePurgePayload) => Promise<boolean>;
  loading: boolean;
}

function CacheManager({ onPurge, loading }: CacheManagerProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [purgeType, setPurgeType] = useState<'all' | 'files'>('all');
  const [urls, setUrls] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePurgeAll = async () => {
    const result = await onPurge({ purge_everything: true });
    if (result) {
      setSuccess(true);
      setShowConfirm(false);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handlePurgeFiles = async () => {
    const filesList = urls
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (filesList.length === 0) {
      return;
    }

    const result = await onPurge({ files: filesList });
    if (result) {
      setSuccess(true);
      setUrls('');
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  if (showConfirm) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-red-500">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="text-4xl">⚠️</div>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white mb-2">Confirm Cache Purge</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to purge all cached files? This action cannot be undone and
              may temporarily increase load on your origin server.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handlePurgeAll}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Purging...' : 'Yes, Purge All'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">Cache Management</h3>
        <p className="text-sm text-gray-400">
          Purge cached content from Cloudflare's edge network
        </p>
      </div>

      {success && (
        <div className="bg-green-900 border border-green-600 text-green-200 px-4 py-3 rounded-lg">
          Cache purged successfully
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
        <div className="flex gap-4">
          <button
            onClick={() => setPurgeType('all')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              purgeType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Purge All
          </button>
          <button
            onClick={() => setPurgeType('files')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              purgeType === 'files'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Purge Specific Files
          </button>
        </div>

        {purgeType === 'all' ? (
          <div className="space-y-4 pt-2">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🗑️</div>
                <div>
                  <h4 className="font-medium text-white mb-1">Purge Everything</h4>
                  <p className="text-sm text-gray-400">
                    Remove all files from Cloudflare's cache. Your website will continue to be
                    available, but requests will go directly to your origin until the cache
                    rebuilds.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Purge All Cache
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div>
              <label htmlFor="urls" className="block text-sm font-medium text-gray-300 mb-2">
                URLs to Purge (one per line)
              </label>
              <textarea
                id="urls"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder="https://example.com/style.css&#10;https://example.com/script.js&#10;https://example.com/image.png"
                rows={6}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                disabled={loading}
              />
              <p className="mt-2 text-xs text-gray-500">
                Enter full URLs including https://. Maximum 30 URLs per request.
              </p>
            </div>
            <button
              onClick={handlePurgeFiles}
              disabled={loading || urls.trim().length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Purging...' : 'Purge Files'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-blue-900 border border-blue-600 text-blue-200 px-4 py-3 rounded-lg text-sm">
        <strong>Note:</strong> Cache purge may take up to 30 seconds to propagate across all edge
        locations.
      </div>
    </div>
  );
}

export default CacheManager;
