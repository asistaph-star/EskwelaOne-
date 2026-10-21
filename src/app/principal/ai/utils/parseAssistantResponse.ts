import { PrincipalAIMessage } from '../types.js';

/**
 * Extracts structured data, tool type, and provenance from raw assistant output.
 * Gracefully handles MockAIProvider JSON grounding format as well as standard responses.
 */
export function parseAssistantResponse(
  content: string,
  toolsExecuted: string[] = []
): {
  displayText: string;
  structuredData?: PrincipalAIMessage['structuredData'];
} {
  if (!content) {
    return { displayText: '' };
  }

  let jsonCandidate: any = null;

  // Pattern 1: MockAIProvider deterministic output
  const mockPrefix = 'Verified DigiSkwela Data Grounding:\n';
  if (content.startsWith(mockPrefix)) {
    const rawJsonStr = content.slice(mockPrefix.length).trim();
    try {
      jsonCandidate = JSON.parse(rawJsonStr);
    } catch {
      // not valid JSON, leave as text
    }
  }

  // Pattern 2: Markdown code fence ```json ... ```
  if (!jsonCandidate && content.includes('```json')) {
    const match = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        jsonCandidate = JSON.parse(match[1]);
      } catch {
        // ignore
      }
    }
  }

  // Pattern 3: Raw JSON root
  if (!jsonCandidate && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
    try {
      jsonCandidate = JSON.parse(content.trim());
    } catch {
      // ignore
    }
  }

  if (jsonCandidate && typeof jsonCandidate === 'object') {
    let type: PrincipalAIMessage['structuredData']['type'] = 'generic';

    if (jsonCandidate.records && jsonCandidate.summary && 'totalActiveFaculty' in jsonCandidate.summary) {
      type = 'attendance';
    } else if (jsonCandidate.students && jsonCandidate.faculty && jsonCandidate.inventory) {
      type = 'fact_sheet';
    } else if (jsonCandidate.leaves && 'totalPending' in jsonCandidate) {
      type = 'leaves';
    } else if (jsonCandidate.events && 'totalEvents' in jsonCandidate) {
      type = 'events';
    } else if (jsonCandidate.cases && jsonCandidate.statusBreakdown) {
      type = 'behavior';
    } else if (jsonCandidate.academicYear && jsonCandidate.completenessStatus) {
      type = 'academics';
    } else if (jsonCandidate.briefTitle && jsonCandidate.operationalHighlights) {
      type = 'meeting_brief';
    } else if (jsonCandidate.reportPeriod && jsonCandidate.facultyAttendanceFacts) {
      type = 'weekly_report';
    }

    // Extract provenance
    let provenance: { sourceDomains: string[]; asOf?: string } | undefined = undefined;
    if (jsonCandidate.provenance && Array.isArray(jsonCandidate.provenance.sourceDomains)) {
      provenance = {
        sourceDomains: jsonCandidate.provenance.sourceDomains,
        asOf: jsonCandidate.provenance.asOf || jsonCandidate.provenance.generatedAt,
      };
    } else if (Array.isArray(jsonCandidate.sourceDomains)) {
      provenance = {
        sourceDomains: jsonCandidate.sourceDomains,
        asOf: jsonCandidate.asOf || jsonCandidate.generatedAt,
      };
    }

    return {
      displayText: 'Verified DigiSkwela Data Grounding',
      structuredData: {
        type,
        raw: jsonCandidate,
        provenance,
      },
    };
  }

  // Plain conversational text response (no structured tool grounding)
  return {
    displayText: content,
  };
}
