import { ExecutiveSummaryResponse } from '../../../api/executiveSummary.api';

export type PhilippineDayPart = 'morning' | 'afternoon' | 'evening';

/**
 * Returns the current daypart in Asia/Manila (UTC+8):
 * - 5:00 AM – 11:59 AM: 'morning'
 * - 12:00 PM – 5:59 PM: 'afternoon'
 * - 6:00 PM – 4:59 AM: 'evening'
 */
export function getPhilippineDayPart(date: Date = new Date()): PhilippineDayPart {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  const hour = parseInt(formatter.format(date), 10);

  if (hour >= 5 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 18) {
    return 'afternoon';
  } else {
    return 'evening';
  }
}

/**
 * Formats a personalized, time-aware greeting for the authenticated Principal:
 * - "Good morning, Principal Maria"
 * - "Good afternoon, Principal Maria"
 * - "Good evening, Principal Maria"
 * Fallback when name is unavailable:
 * - "Good morning, Principal" / "Good afternoon, Principal" / "Good evening, Principal"
 */
export function formatPrincipalGreeting(
  dayPart: PhilippineDayPart,
  user?: { name?: string; firstName?: string } | null
): string {
  const greetingWord =
    dayPart === 'morning'
      ? 'Good morning'
      : dayPart === 'afternoon'
      ? 'Good afternoon'
      : 'Good evening';

  // Extract clean first name
  let firstName = user?.firstName?.trim() || '';
  if (!firstName && user?.name) {
    const parts = user.name.trim().split(/\s+/);
    if (parts[0]?.toLowerCase() === 'principal' && parts[1]) {
      firstName = parts[1];
    } else {
      firstName = parts[0] || '';
    }
  }

  if (!firstName || firstName.toLowerCase() === 'principal') {
    return `${greetingWord}, Principal`;
  }

  return `${greetingWord}, Principal ${firstName}`;
}

export interface FormattedBriefingSections {
  operations: string[];
  attention: {
    items: string[];
    hasItems: boolean;
    behaviorCases: number;
    pendingLeaves: number;
    inventoryIssues: number;
  };
  academics: string;
  property: string | null;
  upcomingEvents: string | null;
}

/**
 * Parses and formats verified fact sheet metrics into structured executive sections.
 * Strictly adheres to verified semantics:
 * - onCampusNow vs cumulative checkedInToday vs checkedInNow
 * - promotion pass rate without lowest grade level claim
 * - term lowest average only when >= 2 grade levels
 * - physical inventory units under Model B
 */
export function buildBriefingSections(data: ExecutiveSummaryResponse | null): FormattedBriefingSections {
  if (!data || !data.metrics) {
    return {
      operations: ['School operations are underway.'],
      attention: {
        items: ['No current administrative action items require your attention.'],
        hasItems: false,
        behaviorCases: 0,
        pendingLeaves: 0,
        inventoryIssues: 0,
      },
      academics: 'Academic performance data is currently compiling.',
      property: null,
      upcomingEvents: null,
    };
  }

  const { students, faculty, academics, welfare, operations, inventory } = data.metrics;

  // 1. School Operations Section
  const opLines: string[] = [];
  const onCampus = students?.onCampusNow;
  if (typeof onCampus === 'number') {
    opLines.push(`${onCampus} ${onCampus === 1 ? 'student is' : 'students are'} currently on campus.`);
  } else if (typeof students?.enrolled === 'number') {
    opLines.push(`${students.enrolled} enrolled students recorded for the academic year.`);
  } else {
    opLines.push('School operations are underway.');
  }

  const checkedToday = faculty?.checkedInToday;
  const checkedNow = faculty?.checkedInNow;
  const totalFaculty = faculty?.totalActive;
  if (typeof checkedToday === 'number' && typeof totalFaculty === 'number') {
    let facultyLine = `${checkedToday} of ${totalFaculty} faculty members checked in today`;
    if (typeof checkedNow === 'number' && checkedNow !== checkedToday) {
      facultyLine += ` (${checkedNow} currently on campus)`;
    }
    facultyLine += '.';
    opLines.push(facultyLine);
  }

  // 2. Needs Your Attention Section
  const attentionItems: string[] = [];
  const attentionCount = welfare?.studentsRequiringAttention ?? 0;
  const cases = welfare?.openBehaviorCases ?? 0;
  if (cases > 0) {
    attentionItems.push(
      `${attentionCount} ${attentionCount === 1 ? 'student has' : 'students have'} an unresolved behavioral concern across ${cases} open ${cases === 1 ? 'case' : 'cases'}.`
    );
  }

  const leaves = operations?.pendingLeaves ?? 0;
  if (leaves > 0) {
    attentionItems.push(
      `${leaves} faculty leave ${leaves === 1 ? 'request is' : 'requests are'} awaiting review.`
    );
  }

  const repair = inventory?.repairUnits ?? 0;
  const lostDamaged = inventory?.lostDamagedUnits ?? 0;
  const inventoryIssues = repair + lostDamaged;
  if (inventoryIssues > 0) {
    const parts: string[] = [];
    if (repair > 0) parts.push(`${repair} under repair`);
    if (lostDamaged > 0) parts.push(`${lostDamaged} lost or damaged`);
    attentionItems.push(
      `${inventoryIssues} property ${inventoryIssues === 1 ? 'unit requires' : 'units require'} attention (${parts.join(', ')}).`
    );
  }

  const hasItems = attentionItems.length > 0;
  if (!hasItems) {
    attentionItems.push('No current administrative action items require your attention.');
  }

  // 3. Academic Status Section
  let academicText: string;
  if (academics?.academicCompleteness === 'complete_annual' && typeof academics.annualPassRate === 'number') {
    // Option A: Annual promotion pass rate only
    academicText = `The current annual promotion pass rate is ${academics.annualPassRate}% across active sections.`;
  } else if (
    academics?.academicCompleteness === 'partial_terms' &&
    typeof academics.lowestTermAverageGradeLevel === 'number' &&
    (academics.assessedGradeLevelsCount ?? 0) >= 2
  ) {
    // Term grades pulse with >= 2 grade levels
    academicText = `Among currently submitted term grades across ${academics.assessedGradeLevelsCount} grade levels, Grade ${academics.lowestTermAverageGradeLevel} currently records the lowest average.`;
  } else {
    // Transparent unavailable statement (fewer than 2 grade levels or insufficient data)
    academicText = 'Annual academic performance is not yet available because complete T1–T4 grades have not been submitted.';
  }

  // 4. Property Section (Omitted if 0 issues per specification)
  let propertyText: string | null = null;
  if (repair > 0 || lostDamaged > 0) {
    const accountable = inventory?.currentAccountableUnits ?? 0;
    const parts: string[] = [];
    if (repair > 0) parts.push(`${repair} ${repair === 1 ? 'unit' : 'units'} under repair`);
    if (lostDamaged > 0) parts.push(`${lostDamaged} lost or damaged`);
    propertyText = `Property records show ${parts.join(' and ')} out of ${accountable} accountable units.`;
  }

  // 5. Upcoming Operations
  let upcomingEventsText: string | null = null;
  const eventCount = operations?.upcomingEventsCount ?? 0;
  if (eventCount > 0) {
    upcomingEventsText = `${eventCount} school ${eventCount === 1 ? 'event is' : 'events are'} scheduled on the calendar in the coming days.`;
  }

  return {
    operations: opLines,
    attention: {
      items: attentionItems,
      hasItems,
      behaviorCases: cases,
      pendingLeaves: leaves,
      inventoryIssues,
    },
    academics: academicText,
    property: propertyText,
    upcomingEvents: upcomingEventsText,
  };
}

export interface SynthesizedNarrative {
  paragraphs: string[];
  actions: {
    label: string;
    screen: 'p-behavior' | 'p-leaves' | 'p-inventory';
  }[];
}

/**
 * Builds a concise, executive-level synthesized narrative (2-4 paragraphs)
 * interpreting the school's operational, attention, and academic status,
 * paired with compact action triggers.
 */
export function buildSynthesizedNarrative(data: ExecutiveSummaryResponse | null): SynthesizedNarrative {
  if (!data || !data.metrics) {
    return {
      paragraphs: [
        'School operations are underway.',
        'No current administrative action items require your attention.',
        'Annual academic performance is not yet available because complete T1–T4 grades have not been submitted.',
      ],
      actions: [],
    };
  }

  const sections = buildBriefingSections(data);
  const { welfare, operations, inventory, students, faculty } = data.metrics;
  const paragraphs: string[] = [];
  const actions: { label: string; screen: 'p-behavior' | 'p-leaves' | 'p-inventory' }[] = [];

  // Paragraph 1: School Operations Synthesis
  const onCampus = students?.onCampusNow;
  const checkedToday = faculty?.checkedInToday;
  const totalFaculty = faculty?.totalActive;

  if (onCampus === 0 && typeof checkedToday === 'number' && typeof totalFaculty === 'number' && checkedToday === totalFaculty) {
    paragraphs.push(
      'School operations are currently stable. All active faculty have checked in today, while no students are currently recorded on campus.'
    );
  } else if (typeof onCampus === 'number' && typeof checkedToday === 'number' && typeof totalFaculty === 'number') {
    let text = `School operations are underway with ${onCampus} ${onCampus === 1 ? 'student' : 'students'} currently recorded on campus, and ${checkedToday} of ${totalFaculty} active faculty checked in today`;
    if (typeof faculty?.checkedInNow === 'number' && faculty.checkedInNow !== checkedToday) {
      text += ` (${faculty.checkedInNow} currently on campus)`;
    }
    text += '.';
    paragraphs.push(text);
  } else {
    paragraphs.push(sections.operations.join(' '));
  }

  // Paragraph 2: Attention Items Synthesis
  const attentionParts: string[] = [];
  if ((welfare?.openBehaviorCases ?? 0) > 0) {
    const cases = welfare.openBehaviorCases;
    const studentsCount = welfare.studentsRequiringAttention ?? 1;
    attentionParts.push(
      `${studentsCount} ${studentsCount === 1 ? 'student has' : 'students have'} an unresolved behavioral concern across ${cases} open ${cases === 1 ? 'case' : 'cases'}`
    );
    actions.push({
      label: cases === 1 ? 'Review Behavior Case' : 'Review Behavior Cases',
      screen: 'p-behavior',
    });
  }

  if ((operations?.pendingLeaves ?? 0) > 0) {
    const leaves = operations.pendingLeaves;
    attentionParts.push(
      `${leaves} faculty leave ${leaves === 1 ? 'request is' : 'requests are'} awaiting review`
    );
    actions.push({
      label: leaves === 1 ? 'Review Leave Request' : 'Review Leave Requests',
      screen: 'p-leaves',
    });
  }

  const inventoryIssues = (inventory?.repairUnits ?? 0) + (inventory?.lostDamagedUnits ?? 0);
  if (inventoryIssues > 0) {
    const repair = inventory.repairUnits ?? 0;
    const lostDamaged = inventory.lostDamagedUnits ?? 0;
    const parts: string[] = [];
    if (repair > 0) parts.push(`${repair} under repair`);
    if (lostDamaged > 0) parts.push(`${lostDamaged} lost or damaged`);
    attentionParts.push(
      `${inventoryIssues} property ${inventoryIssues === 1 ? 'unit requires' : 'units require'} attention (${parts.join(', ')})`
    );
    actions.push({
      label: 'View Inventory',
      screen: 'p-inventory',
    });
  }

  if (attentionParts.length > 0) {
    const countWord =
      attentionParts.length === 1
        ? 'One item requires'
        : attentionParts.length === 2
        ? 'Two items require'
        : `${attentionParts.length} items require`;
    paragraphs.push(`${countWord} your attention: ${attentionParts.join(' and ')}.`);
  } else {
    paragraphs.push('No current administrative action items require your attention.');
  }

  // Paragraph 3: Academic Status Synthesis
  paragraphs.push(sections.academics);

  // Optional Paragraph 4: Upcoming Events (if calendar events scheduled)
  if (sections.upcomingEvents) {
    paragraphs.push(sections.upcomingEvents);
  }

  return {
    paragraphs,
    actions,
  };
}
