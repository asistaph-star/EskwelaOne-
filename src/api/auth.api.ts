import { apiClient } from './client.js';

export const authApi = {
  login: async (credentials: { schoolId: string; password: string }) => {
    return apiClient.post<{
      user: {
        id: string;
        schoolId: string;
        email?: string | null;
        firstName: string;
        lastName: string;
        roles: string[];
        permissions: string[];
        mustChangePassword?: boolean;
        studentProfile: any;
        teacherProfile: any;
        staffProfile?: any;
      };
    }>('/auth/login', credentials);
  },

  logout: async () => {
    return apiClient.post('/auth/logout', {});
  },

  getMe: async () => {
    return apiClient.get<any>('/auth/me');
  },

  changePassword: async (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    return apiClient.post<{ success: boolean; message?: string }>('/auth/change-password', data);
  },
};

