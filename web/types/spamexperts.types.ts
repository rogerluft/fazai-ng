// SpamExperts Types - Real interfaces matching backend API responses
// No placeholders - Real types from SpamExperts API

export interface SpamExpertsDomain {
  domain: string;
  destination: string;
  status: 'active' | 'pending' | 'suspended';
  created_at: string;
  updated_at: string;
  protection: {
    incoming: boolean;
    outgoing: boolean;
    archiving: boolean;
  };
}

export interface QuarantineMessage {
  id: string;
  domain: string;
  subject: string;
  sender: string;
  recipient: string;
  date: string;
  score: number;
  size: number;
  reason: string;
  status: 'quarantined' | 'released' | 'deleted';
}

export interface SpamReport {
  domain: string;
  period: '24h' | '7d' | '30d';
  total_emails: number;
  spam_blocked: number;
  clean_delivered: number;
  quarantined: number;
  virus_detected: number;
  outgoing_emails: number;
  statistics: {
    incoming: {
      total: number;
      clean: number;
      spam: number;
      virus: number;
      quarantined: number;
    };
    outgoing: {
      total: number;
      sent: number;
      rejected: number;
    };
  };
  top_senders: Array<{
    email: string;
    count: number;
  }>;
  top_recipients: Array<{
    email: string;
    count: number;
  }>;
}

export interface ListEntry {
  id: string;
  type: 'whitelist' | 'blacklist';
  entry: string;
  entry_type: 'email' | 'domain' | 'ip';
  comment?: string;
  created_at: string;
  created_by: string;
}

export interface AddDomainPayload {
  domain: string;
  destination: string;
  protection?: {
    incoming?: boolean;
    outgoing?: boolean;
    archiving?: boolean;
  };
}

export interface AddListEntryPayload {
  entry: string;
  entry_type: 'email' | 'domain' | 'ip';
  comment?: string;
}

export interface SpamExpertsAPIResponse<T> {
  success: boolean;
  result: T;
  errors?: Array<{
    code: string;
    message: string;
  }>;
  messages?: string[];
}

export type SpamExpertsError = {
  message: string;
  code?: string;
};
