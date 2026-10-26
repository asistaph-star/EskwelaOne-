import { apiClient } from './client';

export interface BackupRegistryEntry {
  backupId: string;
  timestamp: string;
  overallStatus: 'SUCCESS' | 'FAILED';
  databaseSize: number;
  storageSize: number;
  totalSize: number;
  verified: boolean;
  backupPath: string;
  durationMs: number;
}

export interface BackupStatusOverview {
  lastBackupTime: string | null;
  lastBackupResult: 'SUCCESS' | 'FAILED' | 'NONE';
  backupType: string;
  nextScheduledBackup: string | null;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'NO_BACKUPS';
  totalBackupsCount: number;
  lastRestoreTestDate: string | null;
  operationalMessage: string;
  recentBackups: BackupRegistryEntry[];
}

export const backupApi = {
  getBackupStatus: async (): Promise<BackupStatusOverview> => {
    return apiClient.get<BackupStatusOverview>('/admin/backup-status');
  },
};
