import { describe, it, expect } from 'vitest';
import { dispatchTool } from '../src/ai/tools/toolDispatcher.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';

describe('Teacher AI — Student-Level Class Performance Capability & Security', () => {
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
    ],
  };

  it('Authorized access: Teacher Maria Clara retrieves individual recorded T1 grades for assigned Rizal Math 10 class', async () => {
    const res = await dispatchTool('getMyClassPerformance', {
      sectionId: 'demo-sec-rizal10',
      subjectId: 'demo-subj-math10',
      term: 'T1',
    }, { user: teacherUser });

    expect(res.success).toBe(true);
    const data = res.data;

    expect(data.sectionName).toBe('Rizal');
    expect(data.subjectName).toBe('Mathematics 10');
    expect(data.term).toBe('T1');
    expect(Array.isArray(data.students)).toBe(true);
    expect(data.students.length).toBe(25);

    // Verify presence of known student Hannah Torres
    const hannah = data.students.find((s: any) => s.studentName === 'Hannah Torres');
    expect(hannah).toBeDefined();
    expect(hannah.recordedTermGrade).toBe(96.2);

    // Verify grades.students is also populated
    expect(data.grades.students).toEqual(data.students);
  });

  it('Unauthorized class: Teacher cannot request student-level grades for an assignment they do not own', async () => {
    await expect(
      dispatchTool('getMyClassPerformance', {
        sectionId: 'unassigned-section-999',
        subjectId: 'demo-subj-math10',
      }, { user: teacherUser })
    ).rejects.toThrow(/not authorized/);
  });

  it('Privacy: Returned tool payload contains no LRN, email, contacts, guardian data, clinic data, guidance data', async () => {
    const res = await dispatchTool('getMyClassPerformance', {
      sectionId: 'demo-sec-rizal10',
      subjectId: 'demo-subj-math10',
      term: 'T1',
    }, { user: teacherUser });

    expect(res.success).toBe(true);
    const str = JSON.stringify(res.data).toLowerCase();

    // Sensitive field keys/values
    expect(str).not.toContain('"lrn"');
    expect(str).not.toContain('@');
    expect(str).not.toContain('phone');
    expect(str).not.toContain('guardian');
    expect(str).not.toContain('clinic');
    expect(str).not.toContain('guidance');
    expect(str).not.toContain('medical');
    expect(str).not.toContain('password');

    // Each student item contains only allowed fields: studentId, studentName, recordedTermGrade
    for (const s of res.data.students) {
      expect(Object.keys(s).sort()).toEqual(['recordedTermGrade', 'studentId', 'studentName']);
    }
  });

  it('Active enrollment: Only active enrolled students are included', async () => {
    const res = await dispatchTool('getMyClassPerformance', {
      sectionId: 'demo-sec-rizal10',
      subjectId: 'demo-subj-math10',
      term: 'T1',
    }, { user: teacherUser });

    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        section_id: 'demo-sec-rizal10',
        status: { in: ['Enrolled', 'enrolled', 'Active', 'active'] },
      },
    });

    expect(res.data.students.length).toBe(activeEnrollments.length);
  });

  it('Missing term grade: Students without a recorded term grade are represented honestly as null and not fabricated', async () => {
    // T2 has no recorded grades in the demo dataset
    const res = await dispatchTool('getMyClassPerformance', {
      sectionId: 'demo-sec-rizal10',
      subjectId: 'demo-subj-math10',
      term: 'T2',
    }, { user: teacherUser });

    expect(res.success).toBe(true);
    expect(res.data.students.length).toBe(25);
    for (const s of res.data.students) {
      expect(s.recordedTermGrade).toBeNull();
    }
  });

  it('Zero: A legitimate recorded grade value of zero is preserved and not interpreted as missing/null', async () => {
    // Create a temporary isolated grade with 0 for testing zero semantics, then clean up immediately
    const firstStudent = await prisma.enrollment.findFirst({
      where: { section_id: 'demo-sec-rizal10' },
    });
    expect(firstStudent).toBeDefined();

    const existingGrade = await prisma.grade.findFirst({
      where: { subject_id: 'demo-subj-math10', term: 'T1' as any },
    });
    expect(existingGrade).toBeDefined();

    // Test term 'T4' with grade 0
    const zeroGrade = await prisma.grade.create({
      data: {
        id: generateId(),
        academic_year_id: existingGrade!.academic_year_id,
        student_id: firstStudent!.student_id,
        subject_id: 'demo-subj-math10',
        term: 'T4' as any,
        written_work: 0,
        performance_task: 0,
        term_assessment: 0,
        term_grade: 0,
      },
    });

    try {
      const res = await dispatchTool('getMyClassPerformance', {
        sectionId: 'demo-sec-rizal10',
        subjectId: 'demo-subj-math10',
        term: 'T4',
      }, { user: teacherUser });

      expect(res.success).toBe(true);
      const studentWithZero = res.data.students.find((s: any) => s.studentId === firstStudent!.student_id);
      expect(studentWithZero).toBeDefined();
      expect(studentWithZero.recordedTermGrade).toBe(0);
      expect(studentWithZero.recordedTermGrade).not.toBeNull();
    } finally {
      await prisma.grade.delete({ where: { id: zeroGrade.id } });
    }
  });

  it('Flexible query: Resolves assignment when section/subject name is used or omitted for single assigned teacher', async () => {
    const resName = await dispatchTool('getMyClassPerformance', {
      sectionId: 'Rizal',
      subjectId: 'Mathematics 10',
      term: 'T1',
    }, { user: teacherUser });
    expect(resName.success).toBe(true);
    expect(resName.data.students.length).toBe(25);



    const resOmitted = await dispatchTool('getMyClassPerformance', {
      term: 'T1',
    }, { user: teacherUser });
    expect(resOmitted.success).toBe(true);
    expect(resOmitted.data.students.length).toBe(25);
  });
});
