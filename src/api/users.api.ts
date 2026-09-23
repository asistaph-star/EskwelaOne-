
import { apiClient } from './client';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  status: string;
  created_at: string;
  user_roles: {
    role: {
      id: string;
      name: string;
    };
  }[];
  student_profile?: {
    id: string;
    lrn: string;
    grade_level: number;
    gender: string;
    guardian_name: string;
    guardian_phone: string;
  };
}

export const usersApi = {
  getUsers: (filters?: { role?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.status) params.append('status', filters.status);
    return apiClient.get<UserProfile[]>(`/users?${params.toString()}`);
  },
  getUserById: (id: string) => apiClient.get<UserProfile>(`/users/${id}`),
};

