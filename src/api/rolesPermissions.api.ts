import { apiClient } from './client';

export type AccessLevel = 'ALLOWED' | 'DENIED' | 'CONDITIONAL';

export interface RoleAccessEntry {
  access: AccessLevel;
  condition?: string;
}

export interface CapabilityItem {
  id: string;
  name: string;
  description: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'EXPORT' | 'MANAGE' | 'SPECIAL';
  requiredPermission?: string;
  roleAccess: Record<string, RoleAccessEntry>;
}

export interface ModuleGroup {
  id: string;
  name: string;
  description: string;
  capabilities: CapabilityItem[];
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  isAdministrative: boolean;
}

export interface RolesPermissionsData {
  meta: {
    generatedAt: string;
    viewerRole: 'ITAdmin' | 'Admin';
    totalRoles: number;
    totalModules: number;
    totalCapabilities: number;
  };
  roles: RoleDefinition[];
  modules: ModuleGroup[];
}

export const rolesPermissionsApi = {
  getMatrix: async (): Promise<RolesPermissionsData> => {
    return apiClient.get<RolesPermissionsData>('/admin/roles-permissions');
  },
};
