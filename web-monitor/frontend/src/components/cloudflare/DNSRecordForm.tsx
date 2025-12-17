import { useState } from 'react';
import type { CreateDNSRecordPayload, DNSRecord } from '../../types/cloudflare.types';

interface DNSRecordFormProps {
  onSubmit: (payload: CreateDNSRecordPayload) => Promise<boolean>;
  onCancel: () => void;
  loading: boolean;
}

const DNS_TYPES: DNSRecord['type'][] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR'];

function DNSRecordForm({ onSubmit, onCancel, loading }: DNSRecordFormProps) {
  const [formData, setFormData] = useState<CreateDNSRecordPayload>({
    type: 'A',
    name: '',
    content: '',
    ttl: 1,
    proxied: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }

    if (formData.type === 'MX') {
      if (!formData.priority || formData.priority < 0 || formData.priority > 65535) {
        newErrors.priority = 'MX priority must be between 0 and 65535';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const success = await onSubmit(formData);
    if (success) {
      onCancel();
    }
  };

  const handleChange = (field: keyof CreateDNSRecordPayload, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-300 mb-1">
          Type *
        </label>
        <select
          id="type"
          value={formData.type}
          onChange={(e) => handleChange('type', e.target.value as DNSRecord['type'])}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          {DNS_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
          Name *
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={`w-full bg-gray-700 border ${
            errors.name ? 'border-red-500' : 'border-gray-600'
          } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
          placeholder="subdomain or @ for root"
          disabled={loading}
        />
        {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-1">
          Content *
        </label>
        <input
          id="content"
          type="text"
          value={formData.content}
          onChange={(e) => handleChange('content', e.target.value)}
          className={`w-full bg-gray-700 border ${
            errors.content ? 'border-red-500' : 'border-gray-600'
          } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
          placeholder={
            formData.type === 'A'
              ? '192.0.2.1'
              : formData.type === 'CNAME'
              ? 'example.com'
              : formData.type === 'TXT'
              ? 'v=spf1 include:example.com ~all'
              : 'Record content'
          }
          disabled={loading}
        />
        {errors.content && <p className="mt-1 text-sm text-red-400">{errors.content}</p>}
      </div>

      {formData.type === 'MX' && (
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-300 mb-1">
            Priority *
          </label>
          <input
            id="priority"
            type="number"
            value={formData.priority || 10}
            onChange={(e) => handleChange('priority', parseInt(e.target.value, 10))}
            className={`w-full bg-gray-700 border ${
              errors.priority ? 'border-red-500' : 'border-gray-600'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            min="0"
            max="65535"
            disabled={loading}
          />
          {errors.priority && <p className="mt-1 text-sm text-red-400">{errors.priority}</p>}
        </div>
      )}

      <div>
        <label htmlFor="ttl" className="block text-sm font-medium text-gray-300 mb-1">
          TTL
        </label>
        <select
          id="ttl"
          value={formData.ttl}
          onChange={(e) => handleChange('ttl', parseInt(e.target.value, 10))}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value={1}>Auto</option>
          <option value={120}>2 minutes</option>
          <option value={300}>5 minutes</option>
          <option value={600}>10 minutes</option>
          <option value={1800}>30 minutes</option>
          <option value={3600}>1 hour</option>
          <option value={7200}>2 hours</option>
          <option value={18000}>5 hours</option>
          <option value={43200}>12 hours</option>
          <option value={86400}>1 day</option>
        </select>
      </div>

      {(formData.type === 'A' || formData.type === 'AAAA' || formData.type === 'CNAME') && (
        <div className="flex items-center">
          <input
            id="proxied"
            type="checkbox"
            checked={formData.proxied}
            onChange={(e) => handleChange('proxied', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
            disabled={loading}
          />
          <label htmlFor="proxied" className="ml-2 block text-sm text-gray-300">
            Proxy through Cloudflare (Orange Cloud)
          </label>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Creating...' : 'Create Record'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default DNSRecordForm;
