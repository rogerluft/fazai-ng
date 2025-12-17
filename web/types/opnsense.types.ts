// OPNsense Types - Real types matching OPNsense API
// No placeholders - Real types for firewall, NAT, VPN, interfaces, DHCP

export interface FirewallRule {
  uuid: string;
  enabled: '0' | '1';
  action: 'pass' | 'block' | 'reject';
  interface: string;
  protocol: 'tcp' | 'udp' | 'tcp/udp' | 'icmp' | 'any';
  source_net: string;
  source_port?: string;
  destination_net: string;
  destination_port?: string;
  description: string;
  created?: string;
  log?: '0' | '1';
}

export interface CreateFirewallRulePayload {
  enabled?: '0' | '1';
  action: 'pass' | 'block' | 'reject';
  interface: string;
  protocol: 'tcp' | 'udp' | 'tcp/udp' | 'icmp' | 'any';
  source_net: string;
  source_port?: string;
  destination_net: string;
  destination_port?: string;
  description: string;
  log?: '0' | '1';
}

export interface NATRule {
  uuid: string;
  enabled: '0' | '1';
  interface: string;
  protocol: 'tcp' | 'udp' | 'tcp/udp';
  external_port: string;
  internal_ip: string;
  internal_port: string;
  description: string;
  created?: string;
}

export interface CreateNATRulePayload {
  enabled?: '0' | '1';
  interface: string;
  protocol: 'tcp' | 'udp' | 'tcp/udp';
  external_port: string;
  internal_ip: string;
  internal_port: string;
  description: string;
}

export interface VPNTunnel {
  ikeid: string;
  name: string;
  remote_gateway: string;
  local_subnet: string;
  remote_subnet: string;
  status: 'connected' | 'disconnected' | 'connecting';
  enabled: '0' | '1';
  description?: string;
}

export interface NetworkInterface {
  identifier: string;
  name: string;
  description: string;
  ipv4?: string;
  ipv6?: string;
  mac: string;
  status: 'up' | 'down';
  speed?: string;
  mtu?: number;
}

export interface DHCPLease {
  ip: string;
  mac: string;
  hostname: string;
  lease_start: string;
  lease_end: string;
  status: 'active' | 'expired';
  interface?: string;
}

export interface SystemStatus {
  uptime: number;
  uptime_text?: string;
  cpu_usage: number;
  memory_usage: number;
  temperature?: number;
  disk_usage: number;
  load_average: {
    one: number;
    five: number;
    fifteen: number;
  };
  kernel_pf_states?: number;
}

export interface OPNsenseAPIResponse<T> {
  result: 'ok' | 'failed';
  data?: T;
  message?: string;
  validations?: Record<string, string>;
}

export type OPNsenseError = {
  message: string;
  code?: string | number;
};
