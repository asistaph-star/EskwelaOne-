import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import prisma from '../src/config/database.js';
import { toolRegistry } from '../src/ai/tools/toolRegistry.js';
import { roleCapabilityRegistry } from '../src/ai/harness/roleCapabilityRegistry.js';
import { dispatchTool } from '../src/ai/tools/toolDispatcher.js';

describe('DIGISKWELA — PHASE B0: DYNAMIC TEACHER TOOL-DISCOVERY GATE', () => {
  // ─── 1. Tool Registration & Role Exposure ────────────────────────────────
  it('B0-REG-01: getMyIncompleteGrades is registered with Teacher-only role & permissions', () => {
    const tool = toolRegistry.getTool('getMyIncompleteGrades');
    expect(tool).toBeDefined();
    expect(tool?.allowedRoles).toEqual(['Teacher']);
    expect(tool?.requiredPermissions).toContain('assignment:read_own');
    expect(tool?.requiredPermissions).toContain('grade:read');
    expect(tool?.id).toBe('TCH-AI-01');
  });

  it('B0-EXP-01: Teacher user receives getMyIncompleteGrades in declarations', () => {
    const teacherDeclarations = roleCapabilityRegistry.getDeclarationsForUser(
      ['Teacher'],
      ['assignment:read_own', 'grade:read', 'user:read', 'academic:read']
    );
    const names = teacherDeclarations.map(d => d.name);
    expect(names).toContain('getMyIncompleteGrades');
    expect(names).toContain('getUpcomingEvents'); // Shared A4 tool
    expect(names).not.toContain('getSchoolOperationalFactSheet');
    expect(names).not.toContain('getFacultyAttendanceAudit');
  });

  it('B0-EXP-02: Principal user does NOT receive getMyIncompleteGrades in declarations', () => {
    const principalDeclarations = roleCapabilityRegistry.getDeclarationsForUser(
      ['Principal'],
      ['user:read', 'academic:read', 'assignment:read_all', 'grade:read_all', 'faculty_attendance:read', 'attendance:read']
    );
    const names = principalDeclarations.map(d => d.name);
    expect(names).not.toContain('getMyIncompleteGrades');
    expect(names).toContain('getUpcomingEvents');
    expect(names).toContain('getSchoolOperationalFactSheet');
  });

  it('B0-EXP-03: Student user does NOT receive getMyIncompleteGrades and has zero tool declarations', () => {
    const studentDeclarations = roleCapabilityRegistry.getDeclarationsForUser(
      ['Student'],
      ['academic:read', 'document:request', 'document:read']
    );
    const names = studentDeclarations.map(d => d.name);
    expect(names).not.toContain('getMyIncompleteGrades');
    expect(studentDeclarations).toHaveLength(0);
  });

  // ─── 2. Scope Enforcement in Tool Execution ──────────────────────────────
  it('B0-SCP-01: Non-teacher role is rejected with 403 FORBIDDEN by tool dispatcher', async () => {
    const principalUser = {
      id: 'demo-principal-1',
      email: 'principal@demo.com',
      firstName: 'Principal',
      lastName: 'User',
      status: 'active',
      roles: ['Principal'],
      permissions: ['user:read', 'academic:read', 'grade:read_all'],
    };

    await expect(
      dispatchTool('getMyIncompleteGrades', {}, { user: principalUser, portal: 'Principal' })
    ).rejects.toThrow(/not authorized to execute 'getMyIncompleteGrades'/);
  });

  it('B0-SCP-02: Student role is rejected with 403 FORBIDDEN by tool dispatcher', async () => {
    const studentUser = {
      id: 'demo-student-1',
      email: 'student@demo.com',
      firstName: 'Student',
      lastName: 'User',
      status: 'active',
      roles: ['Student'],
      permissions: ['academic:read', 'document:read'],
    };

    await expect(
      dispatchTool('getMyIncompleteGrades', {}, { user: studentUser, portal: 'Student' })
    ).rejects.toThrow(/not authorized to execute 'getMyIncompleteGrades'/);
  });

  it('B0-SCP-03: Teacher requesting an unassigned section is rejected with 403 FORBIDDEN', async () => {
    const teacherUser = {
      id: 'demo-teacher-1',
      email: 'teacher@demo.com',
      firstName: 'Maria Clara',
      lastName: 'Santos',
      status: 'active',
      roles: ['Teacher'],
      permissions: ['assignment:read_own', 'grade:read', 'user:read'],
    };

    await expect(
      dispatchTool('getMyIncompleteGrades', { sectionId: 'unassigned-section-xyz' }, { user: teacherUser, portal: 'Teacher' })
    ).rejects.toThrow(/not assigned to the authenticated teacher/);
  });

  // ─── 3. Functional Execution against Demo Fixture ─────────────────────────
  it('B0-EXEC-01: getMyIncompleteGrades executes successfully on demo teacher assignments', async () => {
    const teacherUser = {
      id: 'demo-teacher-1',
      email: 'teacher@demo.com',
      firstName: 'Maria Clara',
      lastName: 'Santos',
      status: 'active',
      roles: ['Teacher'],
      permissions: ['assignment:read_own', 'grade:read', 'user:read'],
    };

    const result = await dispatchTool('getMyIncompleteGrades', { term: 'T1' }, { user: teacherUser, portal: 'Teacher' });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const data = result.data;
    expect(Array.isArray(data.classes)).toBe(true);
    expect(data.classes.length).toBeGreaterThanOrEqual(1);

    const rizalClass = data.classes.find((c: any) => c.sectionName === 'Rizal');
    expect(rizalClass).toBeDefined();
    expect(rizalClass.totalStudents).toBe(25); // 24 fixture students + 1 baseline demo student
    expect(rizalClass.totalColumns).toBe(2);
    expect(rizalClass.totalExpectedScores).toBe(50);

    // Score of 0 (Francis Garcia) must NOT be reported as missing!
    const francisMissing = rizalClass.missingScores.find((m: any) => m.studentName.includes('Francis'));
    expect(francisMissing).toBeUndefined();

    // Students with null scores must be reported with status "no score recorded"
    const missingNames = rizalClass.missingScores.map((m: any) => m.studentName);
    expect(missingNames).toContain('Mark Mercado'); // Missing PT1
    expect(missingNames).toContain('Wilfred Valdez'); // Missing WW1
    expect(missingNames).toContain('Zoren Domingo'); // Missing WW1 & PT1

    expect(rizalClass.missingScoresCount).toBe(6); // 4 from fixture + 2 from baseline demo student
    expect(rizalClass.recordedScoresCount).toBe(44);
    expect(rizalClass.completenessPercentage).toBe(88); // 44 / 50 = 88%
    expect(rizalClass.isGradingComplete).toBe(false);

    // Prohibited PII check: No LRN, no passwords, no emails in output
    const rawJson = JSON.stringify(data);
    expect(rawJson).not.toMatch(/\b1092837401\d{2}\b/); // No raw LRN
    expect(rawJson).not.toContain('guardian_phone');
    expect(rawJson).not.toContain('blood_type');
  });

  // ─── 4. Shared /api/ai/chat Teacher Path ──────────────────────────────────
  it('B0-CHAT-01: Real authenticated Teacher token reaches POST /api/ai/chat and executes getMyIncompleteGrades', async () => {
    // Generate valid JWT for the canonical demo teacher
    const token = jwt.sign(
      { userId: 'demo-teacher-1', roles: ['Teacher'] },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        portal: 'Teacher',
        messages: [
          { role: 'user', content: 'Which of my classes still have incomplete grading?' }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    expect(data.scopeDecision).toBe('ALLOWED');
    expect(data.toolsExecuted).toContain('getMyIncompleteGrades');
    expect(data.message.role).toBe('assistant');
    expect(data.message.content.length).toBeGreaterThan(0);

    // Audit log check: verify role = 'Teacher' was recorded
    const auditRecord = await prisma.aIAuditLog.findFirst({
      where: {
        user_id: 'demo-teacher-1',
      },
      orderBy: { created_at: 'desc' }
    });

    expect(auditRecord).toBeDefined();
    expect(auditRecord?.role).toBe('Teacher');
    expect(auditRecord?.portal).toBe('Teacher');
    expect(JSON.stringify(auditRecord?.tools_executed)).toContain('getMyIncompleteGrades');
  }, 60000);
});
