'use client';

import { useState } from 'react';
import type { CreateNATRulePayload } from '@/types/opnsense.types';

interface NATFormProps {
  onSubmit: (payload: CreateNATRulePayload) => Promise<boolean>;
  onCancel: () => void;
  loading: boolean;
}

const INTERFACES = ['wan', 'lan', 'opt1', 'opt2'];
const PROTOCOLS = ['tcp', 'udp', 'tcp/udp'] as const;

function NATForm({ onSubmit, onCancel, loading }: NATFormProps) {
  const [formData, setFormData] = useState<CreateNATRulePayload>({
    interface: 'wan',
    protocol: 'tcp',
    external_port: '',
    internal_ip: '',
    internal_port: '',
    description: '',
    enabled: '1',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.interface) {
      newErrors.interface = 'Interface is required';
    }

    if (!formData.external_port.trim()) {
      newErrors.external_port = 'External port is required';
    } else if (!/^\d+(-\d+)?$/.test(formData.external_port)) {
      newErrors.external_port = 'Invalid port format (use 80 or 80-443)';
    }

    if (!formData.internal_ip.trim()) {
      newErrors.internal_ip = 'Internal IP is required';
    } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(formData.internal_ip)) {
      newErrors.internal_ip = 'Invalid IP address format';
    }

    if (!formData.internal_port.trim()) {
      newErrors.internal_port = 'Internal port is required';
    } else if (!/^\d+(-\d+)?$/.test(formData.internal_port)) {
      newErrors.internal_port = 'Invalid port format (use 80 or 80-443)';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit(formData);
  };

  const handleChange = (field: keyof CreateNATRulePayload, value: string) => {
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="interface" className="block text-sm font-medium text-gray-300 mb-1">
            Interface *
          </label>
          <select
            id="interface"
            value={formData.interface}
            onChange={(e) => handleChange('interface', e.target.value)}
            className={`w-full bg-gray-700 border ${
              errors.interface ? 'border-red-500' : 'border-gray-600'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            disabled={loading}
          >
            {INTERFACES.map((iface) => (
              <option key={iface} value={iface}>
                {iface.toUpperCase()}
              </option>
            ))}
          </select>
          {errors.interface && <p className="mt-1 text-sm text-red-400">{errors.interface}</p>}
        </div>

        <div>
          <label htmlFor="protocol" className="block text-sm font-medium text-gray-300 mb-1">
            Protocol *
          </label>
          <select
            id="protocol"
            value={formData.protocol}
            onChange={(e) => handleChange('protocol', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            {PROTOCOLS.map((proto) => (
              <option key={proto} value={proto}>
                {proto.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="external_port" className="block text-sm font-medium text-gray-300 mb-1">
            External Port *
          </label>
          <input
            id="external_port"
            type="text"
            value={formData.external_port}
            onChange={(e) => handleChange('external_port', e.target.value)}
            className={`w-full bg-gray-700 border ${
              errors.external_port ? 'border-red-500' : 'border-gray-600'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="80 or 80-443"
            disabled={loading}
          />
          {errors.external_port && <p className="mt-1 text-sm text-red-400">{errors.external_port}</p>}
        </div>

        <div>
          <label htmlFor="internal_ip" className="block text-sm font-medium text-gray-300 mb-1">
            Internal IP *
          </label>
          <input
            id="internal_ip"
            type="text"
            value={formData.internal_ip}
            onChange={(e) => handleChange('internal_ip', e.target.value)}
            className={`w-full bg-gray-700 border ${
              errors.internal_ip ? 'border-red-500' : 'border-gray-600'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="192.168.1.100"
            disabled={loading}
          />
          {errors.internal_ip && <p className="mt-1 text-sm text-red-400">{errors.internal_ip}</p>}
        </div>

        <div>
          <label htmlFor="internal_port" className="block text-sm font-medium text-gray-300 mb-1">
            Internal Port *
          </label>
          <input
            id="internal_port"
            type="text"
            value={formData.internal_port}
            onChange={(e) => handleChange('internal_port', e.target.value)}
            className={`w-full bg-gray-700 border ${
              errors.internal_port ? 'border-red-500' : 'border-gray-600'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="8080 or 8080-8443"
            disabled={loading}
          />
          {errors.internal_port && <p className="mt-1 text-sm text-red-400">{errors.internal_port}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
          Description *
        </label>
        <input
          id="description"
          type="text"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          className={`w-full bg-gray-700 border ${
            errors.description ? 'border-red-500' : 'border-gray-600'
          } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
          placeholder="Web server port forward"
          disabled={loading}
        />
        {errors.description && <p className="mt-1 text-sm text-red-400">{errors.description}</p>}
      </div>

      <div className="flex items-center">
        <input
          id="enabled"
          type="checkbox"
          checked={formData.enabled === '1'}
          onChange={(e) => handleChange('enabled', e.target.checked ? '1' : '0')}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
          disabled={loading}
        />
        <label htmlFor="enabled" className="ml-2 block text-sm text-gray-300">
          Enabled
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Adding...' : 'Add Port Forward'}
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

export default NATForm;
