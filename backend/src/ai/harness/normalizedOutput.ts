export interface NormalizedProvenance {
  sourceDomains: string[];
  asOf?: string;
}

export interface NormalizedNavigationAction {
  label: string;
  screen: string;
  description?: string;
}

export interface NormalizedStructuredData {
  type: 'fact_sheet' | 'attendance' | 'leaves' | 'events' | 'behavior' | 'academics' | 'meeting_brief' | 'weekly_report' | 'generic';
  raw: any;
  provenance?: NormalizedProvenance;
}

export function mapToolToNormalizedOutput(toolName: string, data: any): {
  structuredData?: NormalizedStructuredData;
  provenance?: NormalizedProvenance;
  navigationActions?: NormalizedNavigationAction[];
} {
  let type: NormalizedStructuredData['type'] = 'generic';
  let navAction: NormalizedNavigationAction | undefined = undefined;

  switch (toolName) {
    case 'getFacultyAttendanceAudit':
      type = 'attendance';
      navAction = {
        label: 'Open Gate Attendance Monitoring',
        screen: 'p-monitoring',
        description: 'Open Gate Attendance Monitoring tab',
      };
      break;
    case 'getSchoolOperationalFactSheet':
      type = 'fact_sheet';
      navAction = {
        label: 'Open Dashboard Overview',
        screen: 'p-dashboard',
        description: 'Open Dashboard Overview',
      };
      break;
    case 'getPendingLeaves':
      type = 'leaves';
      navAction = {
        label: 'Open Leave Management',
        screen: 'p-leaves',
        description: 'Open Leave Management tab',
      };
      break;
    case 'getUpcomingEvents':
      type = 'events';
      navAction = {
        label: 'Open School Events',
        screen: 'p-events',
        description: 'Open School Events tab',
      };
      break;
    case 'getAdministrativeBehaviorSummary':
      type = 'behavior';
      navAction = {
        label: 'View Behavioral Reports',
        screen: 'p-behavior',
        description: 'Open Behavioral Reports tab',
      };
      break;
    case 'getAcademicAnalytics':
      type = 'academics';
      navAction = {
        label: 'Open Academic Analytics',
        screen: 'p-analytics',
        description: 'Open Academic Analytics tab',
      };
      break;
    case 'generatePrincipalMeetingBrief':
      type = 'meeting_brief';
      navAction = {
        label: 'Open Dashboard Overview',
        screen: 'p-dashboard',
        description: 'Open Dashboard Overview',
      };
      break;
    case 'generateWeeklyOperationsReport':
      type = 'weekly_report';
      navAction = {
        label: 'Open Dashboard Overview',
        screen: 'p-dashboard',
        description: 'Open Dashboard Overview',
      };
      break;
    default:
      type = 'generic';
  }

  // Specialized source domains from tool result if available, otherwise type or toolName
  const explicitSourceDomains = Array.isArray(data?.provenance?.sourceDomains) && data.provenance.sourceDomains.length > 0
    ? data.provenance.sourceDomains
    : Array.isArray(data?.sourceDomains) && data.sourceDomains.length > 0
      ? data.sourceDomains
      : undefined;

  const resolvedSourceDomains = explicitSourceDomains || (type !== 'generic' ? [type] : [toolName]);
  const asOf = data?.provenance?.asOf || data?.asOf || new Date().toISOString();

  // Only emit structuredData when a dedicated, designed visual card component exists.
  // Tools without dedicated UI cards rely on natural-language narrative and markdown presentation.
  const structuredData: NormalizedStructuredData | undefined = type !== 'generic'
    ? {
      type,
      raw: data,
      provenance: {
        sourceDomains: resolvedSourceDomains,
        asOf,
      },
    }
    : undefined;

  return {
    structuredData,
    provenance: {
      sourceDomains: resolvedSourceDomains,
      asOf,
    },
    navigationActions: navAction ? [navAction] : undefined,
  };
}
