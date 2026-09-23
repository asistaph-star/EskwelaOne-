import { apiClient } from './client.js';

export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    return apiClient.post<{
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        roles: string[];
        permissions: string[];
        studentProfile: any;
        teacherProfile: any;
      };
    }>('/auth/login', credentials);
  },

  logout: async () => {
    return apiClient.post('/auth/logout', {});
  },

  getMe: async () => {
    return apiClient.get<any>('/auth/me');
  },
};
