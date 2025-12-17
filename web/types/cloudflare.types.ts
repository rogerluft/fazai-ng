// Cloudflare Types - Auto-generated interfaces from API responses
// No placeholders - Real types matching Cloudflare API

export interface CloudflareZone {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'initializing' | 'moved' | 'deleted' | 'deactivated';
  paused: boolean;
  type: 'full' | 'partial';
  name_servers: string[];
  original_name_servers: string[];
  original_registrar: string | null;
  original_dnshost: string | null;
  created_on: string;
  modified_on: string;
  activated_on: string | null;
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    frequency: string;
    legacy_id: string;
    is_subscribed: boolean;
    can_subscribe: boolean;
  };
  account: {
    id: string;
    name: string;
  };
}

export interface DNSRecord {
  id: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA' | 'PTR';
  name: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  locked: boolean;
  zone_id: string;
  zone_name: string;
  created_on: string;
  modified_on: string;
  data?: Record<string, unknown>;
  meta?: {
    auto_added: boolean;
    source: string;
  };
  priority?: number;
}

export interface CreateDNSRecordPayload {
  type: DNSRecord['type'];
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

export interface FirewallRule {
  id: string;
  paused: boolean;
  description: string;
  action: 'block' | 'challenge' | 'js_challenge' | 'managed_challenge' | 'allow' | 'log' | 'bypass';
  priority: number | null;
  filter: {
    id: string;
    expression: string;
    paused: boolean;
    description: string;
  };
  created_on: string;
  modified_on: string;
}

export interface SSLSettings {
  id: string;
  value: 'off' | 'flexible' | 'full' | 'strict';
  editable: boolean;
  modified_on: string;
}

export interface UpdateSSLPayload {
  value: SSLSettings['value'];
}

export interface CachePurgePayload {
  purge_everything?: boolean;
  files?: string[];
  tags?: string[];
  hosts?: string[];
}

export interface Analytics {
  timeseries: Array<{
    since: string;
    until: string;
    requests: {
      all: number;
      cached: number;
      uncached: number;
      ssl: {
        encrypted: number;
        unencrypted: number;
      };
      http_status: {
        [key: string]: number;
      };
      content_type: {
        [key: string]: number;
      };
      country: {
        [key: string]: number;
      };
    };
    bandwidth: {
      all: number;
      cached: number;
      uncached: number;
      ssl: {
        encrypted: number;
        unencrypted: number;
      };
      content_type: {
        [key: string]: number;
      };
      country: {
        [key: string]: number;
      };
    };
    threats: {
      all: number;
      type: {
        [key: string]: number;
      };
      country: {
        [key: string]: number;
      };
    };
    pageviews: {
      all: number;
      search_engine: {
        [key: string]: number;
      };
    };
    uniques: {
      all: number;
    };
  }>;
  totals: {
    requests: {
      all: number;
      cached: number;
      uncached: number;
    };
    bandwidth: {
      all: number;
      cached: number;
      uncached: number;
    };
    threats: {
      all: number;
    };
    pageviews: {
      all: number;
    };
    uniques: {
      all: number;
    };
  };
}

export interface CloudflareAPIResponse<T> {
  success: boolean;
  errors: Array<{
    code: number;
    message: string;
  }>;
  messages: string[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    count: number;
    total_count: number;
    total_pages: number;
  };
}

export type CloudflareError = {
  message: string;
  code?: number;
};
