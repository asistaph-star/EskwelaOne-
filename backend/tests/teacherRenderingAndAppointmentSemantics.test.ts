import { describe, it, expect } from 'vitest';
import { mapToolToNormalizedOutput } from '../src/ai/harness/normalizedOutput.js';
import { dispatchTool } from '../src/ai/tools/toolDispatcher.js';
import { TEACHER_SYSTEM_PROMPT } from '../src/ai/prompts/teacherSystemPrompt.js';
import fs from 'fs';
import path from 'path';

describe('DIGISKWELA — TEACHER RESPONSE RENDERING & APPOINTMENT SEMANTICS', () => {
  const teacherUser = {
    id: 'demo-teacher-1',
    email: 'teacher@demo.com',
    firstName: 'Maria',
    lastName: 'Clara',
    status: 'active',
    roles: ['Teacher'],
    permissions: [
      'user:read',
      'academic:read',
      'assignment:read_own',
      'grade:read',
      'grade:write',
      'attendance:read',
      'attendance:write',
      'behavior:read',
      'behavior:write'
    ],
  };

  // ─── A. RAW DTO & INTERNAL IDENTIFIERS SUPPRESSION ─────────────────────────
  it('TC-REND-01: mapToolToNormalizedOutput suppresses structuredData for Teacher tools to prevent raw JSON dumps', () => {
    const fakeB1Data = {
      teacherId: 'demo-teacher-1',
      assignmentId: 'demo-assign-1',
      sectionId: 'demo-sec-rizal10',
      subjectId: 'demo-subj-math10',
      studentId: 'fix-student-01',
      assignments: [{ sectionName: 'Rizal' }],
      appointmentsToday: [{ studentName: 'Angelo Santos' }],
      unreviewedExcuseLetters: [{ studentName: 'Angelo Santos' }],
    };

    const outB1 = mapToolToNormalizedOutput('getMyTeachingOperations', fakeB1Data);
    expect(outB1.structuredData).toBeUndefined();
    expect(outB1.provenance?.sourceDomains).toContain('getMyTeachingOperations');

    const outB2 = mapToolToNormalizedOutput('getMyIncompleteGrades', { classes: [] });
    expect(outB2.structuredData).toBeUndefined();

    const outB3 = mapToolToNormalizedOutput('getMyClassPerformance', { gradeAverage: 85 });
    expect(outB3.structuredData).toBeUndefined();
  });

  it('TC-REND-02: StructuredDataRenderer has zero pre/JSON.stringify fallback and returns null for generic data', () => {
    const rendererCode = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/principal/ai/components/StructuredDataRenderer.tsx'),
      'utf-8'
    );

    // Verify raw JSON fallback <pre> tag is completely removed
    expect(rendererCode).not.toContain('<pre');
    expect(rendererCode).not.toContain('JSON.stringify(raw');
    expect(rendererCode).toContain('return null;');
  });

  // ─── B. PRINCIPAL REGRESSION GUARD ─────────────────────────────────────────
  it('TC-REND-03: Principal tools continue to emit structuredData with dedicated card types', () => {
    const factSheetOut = mapToolToNormalizedOutput('getSchoolOperationalFactSheet', { schoolName: 'Sindalan NHS' });
    expect(factSheetOut.structuredData).toBeDefined();
    expect(factSheetOut.structuredData?.type).toBe('fact_sheet');

    const leavesOut = mapToolToNormalizedOutput('getPendingLeaves', { pendingLeaves: [] });
    expect(leavesOut.structuredData).toBeDefined();
    expect(leavesOut.structuredData?.type).toBe('leaves');

    const attendanceOut = mapToolToNormalizedOutput('getFacultyAttendanceAudit', { facultyMembers: [] });
    expect(attendanceOut.structuredData).toBeDefined();
    expect(attendanceOut.structuredData?.type).toBe('attendance');
  });

  // ─── C. B1 APPOINTMENT TIME SEMANTICS ──────────────────────────────────────
  it('TC-REND-04: B1 getMyTeachingOperations outputs appointment timeStatus and isPast without leaking PII', async () => {
    const res = await dispatchTool('getMyTeachingOperations', {}, { user: teacherUser });
    expect(res.success).toBe(true);

    const data = res.data;
    expect(data.currentTimeManila).toBeDefined();
    expect(Array.isArray(data.appointmentsToday)).toBe(true);

    if (data.appointmentsToday.length > 0) {
      const appt = data.appointmentsToday[0];
      expect(typeof appt.isPast).toBe('boolean');
      expect(['scheduled_earlier_today', 'upcoming_today']).toContain(appt.timeStatus);
      expect(appt.time).toBeDefined();
    }
  });

  // ─── D. TEACHER SYSTEM PROMPT GUIDANCE ─────────────────────────────────────
  it('TC-REND-05: TEACHER_SYSTEM_PROMPT contains appointment time semantics and presentation hygiene rules', () => {
    expect(TEACHER_SYSTEM_PROMPT).toContain('PARENT APPOINTMENT TIME SEMANTICS');
    expect(TEACHER_SYSTEM_PROMPT).toContain('PRESENTATION & OUTPUT HYGIENE');
    expect(TEACHER_SYSTEM_PROMPT).toContain('Never dump raw JSON');
    expect(TEACHER_SYSTEM_PROMPT).toContain('scheduled earlier today');
    expect(TEACHER_SYSTEM_PROMPT).toContain('DigiSkwela does not record appointment attendance');
  });
});
