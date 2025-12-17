import { useState, FormEvent } from 'react';
import type { AddDomainPayload } from '../../types/spamexperts.types';

interface DomainFormProps {
  onSubmit: (payload: AddDomainPayload) => Promise<boolean>;
  onCancel: () => void;
  loading: boolean;
}

function DomainForm({ onSubmit, onCancel, loading }: DomainFormProps) {
  const [domain, setDomain] = useState('');
  const [destination, setDestination] = useState('');
  const [incoming, setIncoming] = useState(true);
  const [outgoing, setOutgoing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [validationError, setValidationError] = useState('');

  const validateDomain = (value: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    return domainRegex.test(value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!domain.trim()) {
      setValidationError('Domain is required');
      return;
    }

    if (!validateDomain(domain.trim())) {
      setValidationError('Invalid domain format');
      return;
    }

    if (!destination.trim()) {
      setValidationError('Destination mail server is required');
      return;
    }

    const payload: AddDomainPayload = {
      domain: domain.trim(),
      destination: destination.trim(),
      protection: {
        incoming,
        outgoing,
        archiving,
      },
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {validationError && (
        <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg text-sm">
          {validationError}
        </div>
      )}

      <div>
        <label htmlFor="domain" className="block text-sm font-medium text-gray-300 mb-2">
          Domain
        </label>
        <input
          type="text"
          id="domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
          required
        />
      </div>

      <div>
        <label htmlFor="destination" className="block text-sm font-medium text-gray-300 mb-2">
          Destination Mail Server
        </label>
        <input
          type="text"
          id="destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="mail.example.com"
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300 mb-2">Protection Options</label>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="incoming"
            checked={incoming}
            onChange={(e) => setIncoming(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            disabled={loading}
          />
          <label htmlFor="incoming" className="ml-2 text-sm text-gray-300">
            Incoming Protection
          </label>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="outgoing"
            checked={outgoing}
            onChange={(e) => setOutgoing(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            disabled={loading}
          />
          <label htmlFor="outgoing" className="ml-2 text-sm text-gray-300">
            Outgoing Protection
          </label>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="archiving"
            checked={archiving}
            onChange={(e) => setArchiving(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            disabled={loading}
          />
          <label htmlFor="archiving" className="ml-2 text-sm text-gray-300">
            Email Archiving
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding...' : 'Add Domain'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default DomainForm;
