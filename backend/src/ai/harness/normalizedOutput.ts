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
  structuredData: NormalizedStructuredData;
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

  const structuredData: NormalizedStructuredData = {
    type,
    raw: data,
    provenance: {
      sourceDomains: [type],
      asOf: new Date().toISOString(),
    },
  };

  return {
    structuredData,
    provenance: structuredData.provenance,
    navigationActions: navAction ? [navAction] : undefined,
  };
}
