import { AIToolDeclaration } from '../provider/aiProvider.interface.js';
import { toolRegistry } from '../tools/toolRegistry.js';
import { OperationalDomainName } from '../orchestration/domainCatalog.js';
import { SOURCE_PERMISSIONS } from '../security/sourcePolicy.js';

export interface RoleCapability {
  id: string;
  domain: OperationalDomainName | string;
  toolName: string;
  allowedRoles: string[];
  requiredPermissions: string[];
  description: string;
  isSensitive?: boolean;
}

/**
 * RoleCapabilityRegistry — Server-side Role Capability Registry
 * 
 * Formal Invariants:
 * 1. Authenticated JWT determines user roles and permissions. Client/prompt claims are NEVER trusted.
 * 2. Models only receive authorized tool declarations filtered by role capabilities.
 * 3. Gate Operator has conversational AI permanently disabled.
 * 4. High-level domain tools only; generic DB/SQL/shell tools are strictly forbidden.
 */
export class RoleCapabilityRegistry {
  private capabilities: Map<string, RoleCapability> = new Map();

  constructor() {
    this.initDefaultCapabilities();
  }

  private initDefaultCapabilities(): void {
    // ─── Principal & School Admin Operational Capabilities ──────────────
    this.register({
      id: 'cap_principal_attendance',
      domain: 'faculty_attendance',
      toolName: 'getFacultyAttendanceAudit',
      allowedRoles: ['Principal', 'Admin', 'SuperAdmin'],
      requiredPermissions: [...SOURCE_PERMISSIONS.FACULTY_ATTENDANCE],
      description: 'Audit faculty check-in exceptions against gate logs and leave records.',
    });

    this.register({
      id: 'cap_principal_leaves',
      domain: 'leaves',
      toolName: 'getPendingLeaves',
      allowedRoles: ['Principal', 'Admin', 'SuperAdmin'],
      requiredPermissions: [...SOURCE_PERMISSIONS.LEAVE_MANAGEMENT],
      description: 'Review pending faculty leave applications and coordination status.',
    });

    this.register({
      id: 'cap_principal_behavior',
      domain: 'behavior',
      toolName: 'getAdministrativeBehaviorSummary',
      allowedRoles: ['Principal', 'Admin', 'SuperAdmin'],
      requiredPermissions: [...SOURCE_PERMISSIONS.BEHAVIOR],
      description: 'Review logged student behavioral records and administrative incident statuses.',
    });

    this.register({
      id: 'cap_principal_academics',
      domain: 'academics',
      toolName: 'getAcademicAnalytics',
      allowedRoles: ['Principal', 'Admin', 'SuperAdmin'],
      requiredPermissions: [...SOURCE_PERMISSIONS.ACADEMIC_ANALYTICS],
      description: 'Examine school-wide academic performance, quarterly completion, and promotion metrics.',
    });

    this.register({
      id: 'cap_principal_events',
      domain: 'events',
      toolName: 'getUpcomingEvents',
      allowedRoles: ['Principal', 'Admin', 'SuperAdmin', 'Teacher'],
      requiredPermissions: [...SOURCE_PERMISSIONS.EVENTS],
      description: 'Check upcoming school calendar events, holidays, and administrative schedules.',
    });

    this.register({
      id: 'cap_principal_fact_sheet',
      domain: 'overview',
      toolName: 'getSchoolOperationalFactSheet',
      allowedRoles: ['Principal', 'Admin', 'SuperAdmin'],
      requiredPermissions: [...SOURCE_PERMISSIONS.FACT_SHEET],
      description: 'Executive operational fact sheet of Calulut Integrated School.',
    });

    this.register({
      id: 'cap_principal_meeting_brief',
      domain: 'meeting_brief',
      toolName: 'generatePrincipalMeetingBrief',
      allowedRoles: ['Principal', 'Admin', 'SuperAdmin'],
      requiredPermissions: [...SOURCE_PERMISSIONS.FACT_SHEET],
      description: 'Executive meeting brief compiled from authoritative school records.',
    });

    this.register({
      id: 'cap_principal_weekly_report',
      domain: 'weekly_report',
      toolName: 'generateWeeklyOperationsReport',
      allowedRoles: ['Principal', 'Admin', 'SuperAdmin'],
      requiredPermissions: [...SOURCE_PERMISSIONS.FACT_SHEET],
      description: 'Weekly operations report for school leadership.',
    });
  }

  public register(cap: RoleCapability): void {
    this.capabilities.set(cap.toolName, cap);
  }

  public isConversationalAiAllowedForRoles(userRoles: string[]): boolean {
    // Gate Operator role is explicitly disabled for conversational AI
    const normalized = userRoles.map(r => r.toLowerCase());
    if (normalized.includes('gate') || normalized.includes('gate operator') || normalized.includes('gate_operator')) {
      return false;
    }
    return true;
  }

  public getCapabilitiesForUser(userRoles: string[], userPermissions: string[]): RoleCapability[] {
    if (!this.isConversationalAiAllowedForRoles(userRoles)) {
      return [];
    }

    const authorized: RoleCapability[] = [];
    for (const cap of this.capabilities.values()) {
      const hasRole = cap.allowedRoles.some(r => userRoles.some(ur => ur.toLowerCase() === r.toLowerCase()));
      const hasPerm = userPermissions.includes('*') || cap.requiredPermissions.every(p => userPermissions.includes(p));
      if (hasRole && hasPerm) {
        authorized.push(cap);
      }
    }
    return authorized;
  }

  public getDeclarationsForUser(userRoles: string[], userPermissions: string[]): AIToolDeclaration[] {
    const authorizedCaps = this.getCapabilitiesForUser(userRoles, userPermissions);
    const authorizedToolNames = new Set(authorizedCaps.map(c => c.toolName));
    return toolRegistry.getDeclarationsForUser(userRoles, userPermissions)
      .filter(d => authorizedToolNames.has(d.name));
  }

  public isToolAuthorizedForUser(toolName: string, userRoles: string[], userPermissions: string[]): boolean {
    if (!this.isConversationalAiAllowedForRoles(userRoles)) {
      return false;
    }

    const cap = this.capabilities.get(toolName);
    if (!cap) return false;
    const hasRole = cap.allowedRoles.some(r => userRoles.some(ur => ur.toLowerCase() === r.toLowerCase()));
    const hasPerm = userPermissions.includes('*') || cap.requiredPermissions.every(p => userPermissions.includes(p));
    return hasRole && hasPerm;
  }
}

export const roleCapabilityRegistry = new RoleCapabilityRegistry();
