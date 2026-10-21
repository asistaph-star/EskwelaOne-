import { z } from 'zod';
import { DigiSkwelaTool } from './toolTypes.js';
import { AIToolDeclaration } from '../provider/aiProvider.interface.js';
import { buildSchoolFactSheet } from '../../admin/executive-summary/factSheet.service.js';
import { FacultyAttendanceService } from '../../modules/faculty-attendance/facultyAttendance.service.js';
import prisma from '../../config/database.js';

const facultyAttendanceService = new FacultyAttendanceService();

class ToolRegistry {
  private tools: Map<string, DigiSkwelaTool> = new Map();

  register(tool: DigiSkwelaTool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): DigiSkwelaTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): DigiSkwelaTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns tool declarations filtered strictly by the user's authenticated roles and permissions.
   * Client-supplied roles are NEVER trusted.
   */
  getDeclarationsForUser(userRoles: string[], userPermissions: string[]): AIToolDeclaration[] {
    const authorizedDeclarations: AIToolDeclaration[] = [];

    for (const tool of this.tools.values()) {
      const hasRole = tool.allowedRoles.some(r => userRoles.includes(r));
      const hasPermissions = tool.requiredPermissions.every(p => userPermissions.includes(p));

      if (hasRole && hasPermissions) {
        authorizedDeclarations.push(tool.declaration);
      }
    }

    return authorizedDeclarations;
  }
}

export const toolRegistry = new ToolRegistry();

// ─── INITIAL MINIMAL ARCHITECTURAL VALIDATION TOOLS ─────────────────
// Registered to validate role filtering, strict Zod schemas, and domain service dispatch.
// Full set of 8 Principal production tools will be finalized in Phase C.

// 1. Fact Sheet Architecture Contract
toolRegistry.register({
  id: 'PRIN-AI-01',
  name: 'getSchoolOperationalFactSheet',
  description: 'Retrieves the authoritative daily executive operational fact sheet for Calulut Integrated School.',
  allowedRoles: ['Principal'],
  requiredPermissions: ['academic:read', 'attendance:read'],
  inputSchema: z.object({}).strict(),
  declaration: {
    id: 'PRIN-AI-01',
    name: 'getSchoolOperationalFactSheet',
    description: 'Retrieves the authoritative daily executive operational fact sheet.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    }
  },
  async execute(_args, _context) {
    return await buildSchoolFactSheet();
  }
});

// 2. Faculty Attendance Architecture Contract
toolRegistry.register({
  id: 'PRIN-AI-02',
  name: 'getFacultyAttendanceAudit',
  description: 'Audits today faculty check-ins correlated with approved leaves. Returns neutral, factual presence status.',
  allowedRoles: ['Principal'],
  requiredPermissions: ['faculty_attendance:read', 'leave:approve'],
  inputSchema: z.object({
    queryDate: z.string().optional()
  }).strict(),
  declaration: {
    id: 'PRIN-AI-02',
    name: 'getFacultyAttendanceAudit',
    description: 'Audits faculty attendance check-ins and approved leaves.',
    parameters: {
      type: 'object',
      properties: {
        queryDate: {
          type: 'string',
          description: 'Optional ISO date string (defaults to today in Asia/Manila)'
        }
      },
      required: [],
      additionalProperties: false
    }
  },
  async execute(_args, _context) {
    // Reuses FacultyAttendanceService domain logic
    const summary = await facultyAttendanceService.getSummary();
    const teachers = await prisma.teacher.findMany({
      where: { user: { status: 'active' } },
      include: { user: { select: { first_name: true, last_name: true } } },
      take: 50
    });

    return {
      asOfToday: summary.date,
      totalActiveTeachers: summary.totalActiveFaculty,
      checkedInCount: summary.checkedInCount,
      timeOutPendingCount: summary.timeOutPendingCount,
      completedCount: summary.completedCount,
      facultySample: teachers.map(t => ({
        teacherId: t.id,
        name: `${t.user.first_name} ${t.user.last_name}`,
        department: t.department
      }))
    };
  }
});
