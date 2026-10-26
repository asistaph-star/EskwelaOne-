import { apiClient } from './client';

export interface SchoolSettingsData {
  id?: string;
  schoolName: string;
  schoolShortName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginBackgroundUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  address: string | null;
  contactEmail: string | null;
  contactNumber: string | null;
  loginWelcomeText: string | null;
  footerText: string | null;
  updatedAt?: string;
  updatedById?: string;
}

export const settingsApi = {
  getPublicSettings: async (): Promise<SchoolSettingsData> => {
    return apiClient.get<SchoolSettingsData>('/settings/school/public');
  },

  getSettings: async (): Promise<SchoolSettingsData> => {
    return apiClient.get<SchoolSettingsData>('/settings/school');
  },

  updateSettings: async (data: Partial<SchoolSettingsData>): Promise<SchoolSettingsData> => {
    return apiClient.patch<SchoolSettingsData>('/settings/school', data);
  },

  resetSettings: async (): Promise<SchoolSettingsData> => {
    return apiClient.post<SchoolSettingsData>('/settings/school/reset', {});
  },

  uploadAsset: async (file: File, assetType: 'logo' | 'favicon' | 'background'): Promise<{ url: string; assetType: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assetType', assetType);
    return apiClient.post<{ url: string; assetType: string }>('/settings/school/upload', formData);
  },
};
