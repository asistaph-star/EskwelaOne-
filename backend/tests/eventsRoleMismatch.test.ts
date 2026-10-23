import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { dispatchTool } from '../src/ai/tools/toolDispatcher.js';
import { toolRegistry } from '../src/ai/tools/toolRegistry.js';
import { roleCapabilityRegistry } from '../src/ai/harness/roleCapabilityRegistry.js';

describe('DIGISKWELA — EVENTS TOOL ROLE & AUDIENCE SCOPING (A4)', () => {
  let teacherUserId: string;
  let studentUserId: string;
  let principalUserId: string;
  let eventAllId: string;
  let eventTeacherId: string;
  let eventStudentId: string;

  beforeAll(async () => {
    // 1. Create test users with their canonical roles
    teacherUserId = generateId();
    await prisma.user.create({
      data: {
        id: teacherUserId,
        email: `teacher_event_test_${Date.now()}@sindalan.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Teacher',
        last_name: 'Tester',
        status: 'active',
      },
    });

    studentUserId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId,
        email: `student_event_test_${Date.now()}@sindalan.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Student',
        last_name: 'Tester',
        status: 'active',
      },
    });

    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        email: `prin_event_test_${Date.now()}@sindalan.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'Tester',
        status: 'active',
      },
    });

    const teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (teacherRole) {
      await prisma.userRole.create({ data: { user_id: teacherUserId, role_id: teacherRole.id } });
    }

    const studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (studentRole) {
      await prisma.userRole.create({ data: { user_id: studentUserId, role_id: studentRole.id } });
    }

    const principalRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (principalRole) {
      await prisma.userRole.create({ data: { user_id: principalUserId, role_id: principalRole.id } });
    }

    // 2. Create sample events for testing audience scoping
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    eventAllId = generateId();
    await prisma.event.create({
      data: {
        id: eventAllId,
        title: 'General School Assembly',
        date: nextWeek,
        type: 'Assembly',
        audience: 'all',
        created_by_id: principalUserId,
      },
    });

    eventTeacherId = generateId();
    await prisma.event.create({
      data: {
        id: eventTeacherId,
        title: 'Faculty INSET Training',
        date: nextWeek,
        type: 'Meeting',
        audience: 'teachers',
        created_by_id: principalUserId,
      },
    });

    eventStudentId = generateId();
    await prisma.event.create({
      data: {
        id: eventStudentId,
        title: 'Student Council Election',
        date: nextWeek,
        type: 'StudentEvent',
        audience: 'students',
        created_by_id: principalUserId,
      },
    });
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: { id: { in: [eventAllId, eventTeacherId, eventStudentId] } },
    });
    await prisma.userRole.deleteMany({
      where: { user_id: { in: [teacherUserId, studentUserId, principalUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [teacherUserId, studentUserId, principalUserId] } },
    });
  });

  it('TC-EVT-01: Tool definition and roleCapabilityRegistry agree on Teacher eligibility', () => {
    const tool = toolRegistry.getTool('getUpcomingEvents');
    expect(tool).toBeDefined();
    expect(tool?.allowedRoles).toContain('Teacher');
    expect(tool?.allowedRoles).toContain('Principal');

    const capabilities = roleCapabilityRegistry.getCapabilitiesForUser(['Teacher'], ['user:read']);
    const eventCap = capabilities.find(c => c.toolName === 'getUpcomingEvents');
    expect(eventCap).toBeDefined();
    expect(eventCap?.allowedRoles).toContain('Teacher');
  });

  it('TC-EVT-02: Teacher calls getUpcomingEvents with no audience argument (all included, teachers included, students excluded)', async () => {
    const teacherUser = {
      id: teacherUserId,
      email: 'teacher@sindalan.edu.ph',
      firstName: 'Teacher',
      lastName: 'Tester',
      status: 'active',
      roles: ['Teacher'],
      permissions: ['user:read', 'academic:read'],
    };

    // Case 1: Empty args object (no audience argument passed)
    const resultNoArgs = await dispatchTool('getUpcomingEvents', {}, { user: teacherUser });
    expect(resultNoArgs.success).toBe(true);

    const eventList = resultNoArgs.data.events;
    expect(Array.isArray(eventList)).toBe(true);
    expect(eventList.length).toBeGreaterThanOrEqual(2);

    // Explicitly prove: 'all' included, 'teachers' included, 'students' excluded
    const audiences = eventList.map((e: any) => e.targetAudience);
    expect(audiences).toContain('all');
    expect(audiences).toContain('teachers');
    expect(audiences).not.toContain('students');
    expect(audiences.every((a: string) => a === 'all' || a === 'teachers')).toBe(true);

    // Case 2: Explicitly undefined audience argument
    const resultUndefined = await dispatchTool('getUpcomingEvents', { audience: undefined }, { user: teacherUser });
    expect(resultUndefined.success).toBe(true);
    const undefAudiences = resultUndefined.data.events.map((e: any) => e.targetAudience);
    expect(undefAudiences).toContain('all');
    expect(undefAudiences).toContain('teachers');
    expect(undefAudiences).not.toContain('students');
  });

  it('TC-EVT-03: Teacher explicitly requesting audience students is rejected with 403', async () => {
    const teacherUser = {
      id: teacherUserId,
      email: 'teacher@sindalan.edu.ph',
      firstName: 'Teacher',
      lastName: 'Tester',
      status: 'active',
      roles: ['Teacher'],
      permissions: ['user:read', 'academic:read'],
    };

    await expect(
      dispatchTool('getUpcomingEvents', { audience: 'students' }, { user: teacherUser })
    ).rejects.toThrow('Teachers may only access events with audience "all" or "teachers"');
  });

  it('TC-EVT-04: Student role is rejected with 403 FORBIDDEN', async () => {
    const studentUser = {
      id: studentUserId,
      email: 'student@sindalan.edu.ph',
      firstName: 'Student',
      lastName: 'Tester',
      status: 'active',
      roles: ['Student'],
      permissions: ['academic:read', 'document:read'],
    };

    await expect(
      dispatchTool('getUpcomingEvents', {}, { user: studentUser })
    ).rejects.toThrow(/not authorized to execute 'getUpcomingEvents'/);
  });

  it('TC-EVT-05: Principal can access all events including student audience', async () => {
    const principalUser = {
      id: principalUserId,
      email: 'principal@sindalan.edu.ph',
      firstName: 'Principal',
      lastName: 'Tester',
      status: 'active',
      roles: ['Principal'],
      permissions: ['user:read', 'academic:read'],
    };

    const result = await dispatchTool('getUpcomingEvents', { audience: 'students' }, { user: principalUser });
    expect(result.success).toBe(true);
    expect(result.data.events.some((e: any) => e.targetAudience === 'students')).toBe(true);
  });
});

