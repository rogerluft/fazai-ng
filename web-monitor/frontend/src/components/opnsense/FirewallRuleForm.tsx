import { useState } from 'react';
import type { CreateFirewallRulePayload } from '../../types/opnsense.types';

interface FirewallRuleFormProps {
  onSubmit: (payload: CreateFirewallRulePayload) => Promise<boolean>;
  onCancel: () => void;
  loading: boolean;
}

const INTERFACES = ['wan', 'lan', 'opt1', 'opt2'];
const PROTOCOLS = ['tcp', 'udp', 'tcp/udp', 'icmp', 'any'] as const;
const ACTIONS = ['pass', 'block', 'reject'] as const;

function FirewallRuleForm({ onSubmit, onCancel, loading }: FirewallRuleFormProps) {
  const [formData, setFormData] = useState<CreateFirewallRulePayload>({
    action: 'pass',
    interface: 'lan',
    protocol: 'tcp',
    source_net: 'any',
    destination_net: 'any',
    description: '',
    enabled: '1',
    log: '0',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.interface) {
      newErrors.interface = 'Interface is required';
    }

    if (!formData.source_net.trim()) {
      newErrors.source_net = 'Source network is required';
    }

    if (!formData.destination_net.trim()) {
      newErrors.destination_net = 'Destination network is required';
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

  const handleChange = (field: keyof CreateFirewallRulePayload, value: string) => {
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
          <label htmlFor="action" className="block text-sm font-medium text-gray-300 mb-1">
            Action *
          </label>
          <select
            id="action"
            value={formData.action}
            onChange={(e) => handleChange('action', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

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
          <label htmlFor="source_net" className="block text-sm font-medium text-gray-300 mb-1">
            Source Network *
          </label>
          <input
            id="source_net"
            type="text"
            value={formData.source_net}
            onChange={(e) => handleChange('source_net', e.target.value)}
            className={`w-full bg-gray-700 border ${
              errors.source_net ? 'border-red-500' : 'border-gray-600'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="any or 192.168.1.0/24"
            disabled={loading}
          />
          {errors.source_net && <p className="mt-1 text-sm text-red-400">{errors.source_net}</p>}
        </div>

        <div>
          <label htmlFor="source_port" className="block text-sm font-medium text-gray-300 mb-1">
            Source Port
          </label>
          <input
            id="source_port"
            type="text"
            value={formData.source_port || ''}
            onChange={(e) => handleChange('source_port', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="any or 80"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="destination_net" className="block text-sm font-medium text-gray-300 mb-1">
            Destination Network *
          </label>
          <input
            id="destination_net"
            type="text"
            value={formData.destination_net}
            onChange={(e) => handleChange('destination_net', e.target.value)}
            className={`w-full bg-gray-700 border ${
              errors.destination_net ? 'border-red-500' : 'border-gray-600'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="any or 10.0.0.0/8"
            disabled={loading}
          />
          {errors.destination_net && <p className="mt-1 text-sm text-red-400">{errors.destination_net}</p>}
        </div>

        <div>
          <label htmlFor="destination_port" className="block text-sm font-medium text-gray-300 mb-1">
            Destination Port
          </label>
          <input
            id="destination_port"
            type="text"
            value={formData.destination_port || ''}
            onChange={(e) => handleChange('destination_port', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="any, 80, or 80-443"
            disabled={loading}
          />
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
          placeholder="Rule description"
          disabled={loading}
        />
        {errors.description && <p className="mt-1 text-sm text-red-400">{errors.description}</p>}
      </div>

      <div className="flex items-center gap-4">
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

        <div className="flex items-center">
          <input
            id="log"
            type="checkbox"
            checked={formData.log === '1'}
            onChange={(e) => handleChange('log', e.target.checked ? '1' : '0')}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
            disabled={loading}
          />
          <label htmlFor="log" className="ml-2 block text-sm text-gray-300">
            Log matches
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Adding...' : 'Add Rule'}
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

export default FirewallRuleForm;
