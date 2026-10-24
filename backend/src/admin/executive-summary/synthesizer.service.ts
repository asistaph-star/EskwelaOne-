import { SchoolFactSheet, ExecutiveSummaryResponse } from './executiveSummary.types.js';

export class ExecutiveSummarySynthesizer {
  /**
   * Dispatches synthesis to Engine A (External LLM) if configured,
   * or Engine B (Deterministic Grounded Generator) by default.
   */
  async synthesize(factSheet: SchoolFactSheet): Promise<ExecutiveSummaryResponse> {
    const isLlmConfigured = !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);

    let summary: string;
    let generationMode: 'llm' | 'deterministic' = 'deterministic';

    if (isLlmConfigured) {
      try {
        summary = await this.synthesizeWithLLM(factSheet);
        generationMode = 'llm';
      } catch (err) {
        console.error('LLM synthesis failed, falling back to deterministic engine:', err);
        summary = this.synthesizeDeterministic(factSheet);
        generationMode = 'deterministic';
      }
    } else {
      summary = this.synthesizeDeterministic(factSheet);
      generationMode = 'deterministic';
    }

    const sourceDomains = [
      'Gate Attendance',
      'Faculty Attendance',
      'Academics',
      'Behavior & Welfare',
      'Operations & Leaves',
      'Property & Inventory'
    ];

    return {
      summary,
      asOf: factSheet.asOf,
      asOfFormatted: factSheet.asOfFormatted,
      generationMode,
      sourceDomains,
      metrics: {
        students: {
          enrolled: factSheet.students.enrolled,
          timeInNoTimeoutCount: factSheet.students.timeInNoTimeoutCount,
          onCampusNow: factSheet.students.onCampusNow
        },
        faculty: {
          checkedInToday: factSheet.faculty.checkedInToday,
          checkedInNow: factSheet.faculty.checkedInNow,
          totalActive: factSheet.faculty.totalActive
        },
        academics: {
          academicCompleteness: factSheet.academics.academicCompleteness,
          annualPassRate: factSheet.academics.annualPassRate,
          lowestTermAverageGradeLevel: factSheet.academics.lowestTermAverageGradeLevel,
          assessedGradeLevelsCount: factSheet.academics.assessedGradeLevelsCount
        },
        welfare: {
          studentsRequiringAttention: factSheet.welfare.studentsRequiringAttention,
          openBehaviorCases: factSheet.welfare.openBehaviorCases
        },
        operations: {
          pendingLeaves: factSheet.operations.pendingLeaves,
          upcomingEventsCount: factSheet.operations.upcomingEventsCount
        },
        inventory: {
          currentAccountableUnits: factSheet.inventory.currentAccountableUnits,
          repairUnits: factSheet.inventory.repairUnits,
          lostDamagedUnits: factSheet.inventory.lostDamagedUnits
        }
      }
    };
  }

  /**
   * Engine B: Deterministic Grounded Synthesizer
   * 
   * Strict Grounding Principles:
   * - Uses ONLY supplied facts from SchoolFactSheet.
   * - Contains NO invented values or external numbers.
   * - Omits unsupported claims (e.g. if annualPassRate is null, no annual pass rate claim is made).
   * - Never predicts, forecasts, or interprets medical/counseling data.
   * - Distinguishes between complete annual DepEd ratings vs partial submitted term grades.
   * - Generates 2 to 4 concise, executive-level sentences.
   */
  public synthesizeDeterministic(facts: SchoolFactSheet): string {
    const sentences: string[] = [];

    // 1. Campus & Faculty Operational Status
    const onCampus = facts.students.timeInNoTimeoutCount ?? facts.students.onCampusNow;
    const checkedIn = facts.faculty.checkedInToday;
    const totalFaculty = facts.faculty.totalActive;

    if (onCampus !== null && checkedIn !== null && totalFaculty !== null) {
      const studentPart = onCampus === 0
        ? 'no student gate time-in recorded today'
        : `${onCampus} ${onCampus === 1 ? 'student has' : 'students have'} a gate time-in recorded with no time-out today`;
      sentences.push(
        `School operations are underway with ${studentPart}, and ${checkedIn} of ${totalFaculty} faculty checked in today.`
      );
    } else if (onCampus !== null) {
      const studentPart = onCampus === 0
        ? 'no student gate time-in recorded today'
        : `${onCampus} ${onCampus === 1 ? 'student has' : 'students have'} a gate time-in recorded with no time-out today`;
      sentences.push(
        `School operations are underway with ${studentPart}.`
      );
    } else if (facts.students.enrolled !== null) {
      sentences.push(
        `School operations record ${facts.students.enrolled} enrolled students for the current academic year.`
      );
    } else {
      sentences.push(`School operations are currently active.`);
    }

    // 2. Academic Performance (Semantic grounding: matching fact semantics strictly to statements)
    // Option A: When annual data is complete, state the overall annual promotion pass rate only.
    // lowestTermAverageGradeLevel represents submitted term averages, NOT annual general averages,
    // so it must NEVER be conflated with annual performance or used to claim a "lowest general average".
    if (facts.academics.academicCompleteness === 'complete_annual' && facts.academics.annualPassRate !== null) {
      sentences.push(
        `Academic performance reflects an overall annual promotion pass rate of ${facts.academics.annualPassRate}%.`
      );
    } else if (facts.academics.academicCompleteness === 'partial_terms' && facts.academics.lowestTermAverageGradeLevel !== null) {
      // Precise term-only wording: among currently submitted term grades only
      sentences.push(
        `Among currently submitted term grades across ${facts.academics.assessedGradeLevelsCount} grade levels, Grade ${facts.academics.lowestTermAverageGradeLevel} currently records the lowest average.`
      );
    }

    // 3. Welfare & Administrative Action Items
    const attention = facts.welfare.studentsRequiringAttention;
    const cases = facts.welfare.openBehaviorCases;
    const leaves = facts.operations.pendingLeaves;

    let welfarePart: string;
    if (cases > 0) {
      welfarePart = `${attention} ${attention === 1 ? 'student currently requires' : 'students currently require'} administrative attention across ${cases} open behavior ${cases === 1 ? 'case' : 'cases'}`;
    } else {
      welfarePart = `No students currently require administrative attention`;
    }

    let leavePart: string;
    if (leaves > 0) {
      leavePart = `${leaves} faculty leave ${leaves === 1 ? 'request is' : 'requests are'} awaiting review`;
    } else {
      leavePart = `no pending leave requests are awaiting review`;
    }

    sentences.push(`${welfarePart}, and ${leavePart}.`);

    // 4. Property / Inventory / Upcoming Events
    const repair = facts.inventory.repairUnits;
    const lostDamaged = facts.inventory.lostDamagedUnits;
    const accountable = facts.inventory.currentAccountableUnits;

    if (repair > 0 || lostDamaged > 0) {
      sentences.push(
        `Property management logs ${repair} units under repair and ${lostDamaged} lost or damaged out of ${accountable} accountable units.`
      );
    } else if (accountable > 0) {
      sentences.push(
        `All ${accountable} accountable property units are in active service.`
      );
    } else if (facts.operations.upcomingEventsCount > 0) {
      const eventCount = facts.operations.upcomingEventsCount;
      sentences.push(
        `There ${eventCount === 1 ? 'is' : 'are'} ${eventCount} upcoming school ${eventCount === 1 ? 'event' : 'events'} on the institutional calendar.`
      );
    }

    return sentences.join(' ');
  }

  /**
   * Engine A: External LLM Synthesizer (Staging hook & Semantic Contract)
   * 
   * Strict LLM Contract Rules for Academic Semantics:
   * 1. annualPassRate:
   *    - Governed solely by complete DepEd T1-T4 ratings across all subjects.
   *    - May ONLY produce an annual promotion/pass statement (e.g. "Academic performance reflects an overall annual promotion pass rate of {annualPassRate}%.").
   *    - Must NEVER state or imply a lowest annual grade level, because no annual general average by grade level is provided.
   * 2. lowestTermAverageGradeLevel:
   *    - Derived solely from submitted term grade averages across grade levels.
   *    - Must strictly use "among currently submitted term grades..." phrasing.
   *    - Must NEVER be described as an "annual general average" or "lowest-performing grade overall".
   * 3. Null / Incomplete values:
   *    - If annualPassRate is null or completeness is 'partial_terms' / 'insufficient_data', OMIT all annual pass/promotion claims.
   *    - If lowestTermAverageGradeLevel is null (e.g. single grade level or no grades), OMIT all comparative grade-level performance claims.
   * 4. Zero Hallucination:
   *    - Temperature 0.0.
   *    - No speculative, predictive, clinical, or guidance claims.
   */
  private async synthesizeWithLLM(facts: SchoolFactSheet): Promise<string> {
    // In Milestone 2, if no LLM provider is explicitly enabled via environment,
    // this immediately defers to deterministic synthesis.
    throw new Error('LLM provider not configured or active in current environment.');
  }
}
