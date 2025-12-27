// Samba Types - Real types matching Samba/smb.conf configuration
// No placeholders - Real types for shares, users, and service management

export interface SambaShare {
  name: string;
  path: string;
  comment?: string;
  validUsers?: string[];
  readonly?: boolean;
  browseable?: boolean;
  guestOk?: boolean;
  writeable?: boolean;
  createMask?: string;
  directoryMask?: string;
  forceUser?: string;
  forceGroup?: string;
}

export interface CreateSharePayload {
  name: string;
  path: string;
  comment?: string;
  validUsers?: string; // Comma-separated string
  readonly?: boolean;
  browseable?: boolean;
  guestOk?: boolean;
  writeable?: boolean;
  createMask?: string;
  directoryMask?: string;
  forceUser?: string;
  forceGroup?: string;
}

export interface SambaStatus {
  running: boolean;
  version?: string;
  shares: SambaShare[];
  activeConnections?: number;
  pid?: number;
}

export interface SambaUser {
  username: string;
  uid?: number;
  groups?: string[];
  smbEnabled: boolean;
}

export interface SambaConnection {
  pid: number;
  username: string;
  machine: string;
  ip: string;
  share: string;
  connected_at: string;
}

export interface SambaAPIResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export type SambaError = {
  message: string;
  code?: string | number;
  details?: string;
};
