import { PScreen } from '../../shared/types';

export interface PrincipalAIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO date-time string
  traceId?: string;
  toolsExecuted?: string[];
  structuredData?: {
    type: 'fact_sheet' | 'attendance' | 'leaves' | 'events' | 'behavior' | 'academics' | 'meeting_brief' | 'weekly_report' | 'generic';
    raw: any;
    provenance?: {
      sourceDomains: string[];
      asOf?: string;
    };
  };
  errorState?: {
    code?: string;
    message: string;
    canRetry?: boolean;
  };
}

export interface QuickPrompt {
  id: string;
  category: string;
  label: string;
  prompt: string;
  iconName: 'calendar' | 'users' | 'file-text' | 'shield' | 'bar-chart' | 'briefcase' | 'activity' | 'clock';
  description: string;
}

export interface SafeNavAction {
  label: string;
  screen: PScreen;
  description?: string;
}
