/**
 * Shared Source-Domain Capability & Authorization Policy
 * 
 * Enforces the permanent architectural rule:
 * DIRECT TOOL POLICY === SHARED CAPABILITY AUTHORIZATION === COMPOSITE TOOL SOURCE ACCESS
 * 
 * Guarantees zero permission drift between direct AI tools and composite report services.
 * Under no circumstance may a composite service use looser boolean expressions (e.g., OR)
 * that would allow a less-privileged user to indirectly access an unauthorized domain.
 */

export const SOURCE_PERMISSIONS = {
  FACT_SHEET: ['academic:read', 'attendance:read'] as const,
  FACULTY_ATTENDANCE: ['faculty_attendance:read'] as const,
  LEAVE_MANAGEMENT: ['leave:approve'] as const,
  EVENTS: ['user:read'] as const,
  BEHAVIOR: ['behavior:read'] as const,
  ACADEMIC_ANALYTICS: ['grade:read_all', 'academic:read'] as const,
} as const;

export type SourceDomainKey = keyof typeof SOURCE_PERMISSIONS;

/**
 * Evaluates whether a set of user permissions satisfies all required permissions for a domain source.
 * Requires EVERY permission in the domain's required set. Looser OR substitutions are prohibited.
 */
export function canAccessSource(source: SourceDomainKey, userPermissions: string[] = []): boolean {
  const required = SOURCE_PERMISSIONS[source];
  return required.every(p => userPermissions.includes(p));
}
