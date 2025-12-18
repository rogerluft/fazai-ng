'use client';

import { useState, useEffect } from 'react';
import type { SSLSettings, UpdateSSLPayload } from '@/types/cloudflare.types';

interface SSLConfigPanelProps {
  settings: SSLSettings | null;
  onUpdate: (payload: UpdateSSLPayload) => Promise<boolean>;
  loading: boolean;
}

const SSL_MODES = [
  {
    value: 'off' as const,
    label: 'Off (Not Recommended)',
    description: 'No encryption between Cloudflare and your origin server.',
    color: 'border-red-500',
  },
  {
    value: 'flexible' as const,
    label: 'Flexible',
    description: 'Encrypts traffic between visitors and Cloudflare, but not between Cloudflare and your origin.',
    color: 'border-yellow-500',
  },
  {
    value: 'full' as const,
    label: 'Full',
    description: 'Encrypts end-to-end, using a self-signed certificate on the origin.',
    color: 'border-blue-500',
  },
  {
    value: 'strict' as const,
    label: 'Full (Strict)',
    description: 'Encrypts end-to-end, but requires a valid certificate on the origin.',
    color: 'border-green-500',
  },
];

function SSLConfigPanel({ settings, onUpdate, loading }: SSLConfigPanelProps) {
  const [selectedMode, setSelectedMode] = useState<SSLSettings['value']>('off');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setSelectedMode(settings.value);
      setHasChanges(false);
    }
  }, [settings]);

  const handleModeChange = (mode: SSLSettings['value']) => {
    setSelectedMode(mode);
    setHasChanges(mode !== settings?.value);
  };

  const handleSave = async () => {
    const success = await onUpdate({ value: selectedMode });
    if (success) {
      setHasChanges(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setSelectedMode(settings.value);
      setHasChanges(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-400">Loading SSL settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
        <p className="text-gray-400">SSL settings not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">SSL/TLS Encryption</h3>
          <p className="text-sm text-gray-400 mt-1">
            Choose how Cloudflare encrypts connections to your origin server
          </p>
        </div>
        {!settings.editable && (
          <span className="text-sm text-yellow-400">Read-only</span>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
        {SSL_MODES.map((mode) => (
          <div
            key={mode.value}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedMode === mode.value
                ? `${mode.color} bg-gray-700`
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onClick={() => settings.editable && handleModeChange(mode.value)}
          >
            <div className="flex items-start">
              <input
                type="radio"
                name="ssl-mode"
                value={mode.value}
                checked={selectedMode === mode.value}
                onChange={() => settings.editable && handleModeChange(mode.value)}
                disabled={!settings.editable}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600"
              />
              <div className="ml-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{mode.label}</span>
                  {selectedMode === mode.value && settings.value === mode.value && (
                    <span className="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1">{mode.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {settings.editable && hasChanges && (
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleReset}
            disabled={loading}
            className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {settings.modified_on && (
        <p className="text-xs text-gray-500 text-center">
          Last modified: {new Date(settings.modified_on).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default SSLConfigPanel;
