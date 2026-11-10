import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseScheduleDays,
  daysOverlap,
  timeIntervalsOverlap,
  validateScheduleConflict,
  updateTeacherAssignment,
} from '../src/academic/academic.service.js';
import prisma from '../src/config/database.js';
import * as auditService from '../src/audit/audit.service.js';

describe('Teaching Assignment: Schedule Conflict & Audit Completeness Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. parseScheduleDays', () => {
    it('parses comma-separated single-letter days', () => {
      expect(parseScheduleDays('M,W,F')).toEqual(['M', 'W', 'F']);
      expect(parseScheduleDays('T,TH')).toEqual(['T', 'TH']);
    });

    it('parses full or abbreviated English day names', () => {
      expect(parseScheduleDays('Mon, Wed, Fri')).toEqual(['M', 'W', 'F']);
      expect(parseScheduleDays('Tuesday, Thursday')).toEqual(['T', 'TH']);
      expect(parseScheduleDays('Saturday, Sunday')).toEqual(['SAT', 'SUN']);
    });

    it('parses combined compact day abbreviations like MTWThF', () => {
      expect(parseScheduleDays('MTWThF')).toEqual(['M', 'T', 'W', 'TH', 'F']);
      expect(parseScheduleDays('MWF')).toEqual(['M', 'W', 'F']);
    });

    it('handles whitespace, lowercase, and empty strings safely', () => {
      expect(parseScheduleDays('  m, w , f  ')).toEqual(['M', 'W', 'F']);
      expect(parseScheduleDays('')).toEqual([]);
      expect(parseScheduleDays(null)).toEqual([]);
      expect(parseScheduleDays(undefined)).toEqual([]);
    });
  });

  describe('2. daysOverlap', () => {
    it('returns true when at least one day overlaps', () => {
      expect(daysOverlap('M,W,F', 'M,TH')).toBe(true);
      expect(daysOverlap('MTWThF', 'W')).toBe(true);
      expect(daysOverlap('Mon, Wed, Fri', 'Wednesday')).toBe(true);
    });

    it('returns false when days are completely disjoint', () => {
      expect(daysOverlap('M,W,F', 'T,TH')).toBe(false);
      expect(daysOverlap('Saturday', 'M,W,F')).toBe(false);
    });

    it('returns false when either parameter is null or empty', () => {
      expect(daysOverlap(null, 'M,W,F')).toBe(false);
      expect(daysOverlap('M,W,F', '')).toBe(false);
    });
  });

  describe('3. timeIntervalsOverlap', () => {
    it('detects partial overlap between time intervals', () => {
      expect(timeIntervalsOverlap('08:00', '09:30', '09:00', '10:00')).toBe(true);
      expect(timeIntervalsOverlap('09:00', '10:00', '08:00', '09:30')).toBe(true);
    });

    it('detects identical time intervals', () => {
      expect(timeIntervalsOverlap('08:00', '09:00', '08:00', '09:00')).toBe(true);
    });

    it('detects nested interval containment', () => {
      expect(timeIntervalsOverlap('08:00', '12:00', '09:00', '10:00')).toBe(true);
      expect(timeIntervalsOverlap('09:00', '10:00', '08:00', '12:00')).toBe(true);
    });

    it('allows adjacent non-overlapping class periods (end equals start)', () => {
      expect(timeIntervalsOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false);
      expect(timeIntervalsOverlap('10:00', '11:00', '09:00', '10:00')).toBe(false);
    });

    it('allows separated non-overlapping intervals', () => {
      expect(timeIntervalsOverlap('08:00', '09:00', '10:00', '11:00')).toBe(false);
    });
  });

  describe('4. validateScheduleConflict', () => {
    const mockExistingTeacherAssignment = {
      id: 'existing-assign-1',
      academic_year_id: 'ay-2026',
      teacher_id: 'teacher-1',
      section_id: 'section-1',
      subject_id: 'subj-math10',
      days: 'M,W,F',
      start_time: '08:00',
      end_time: '09:00',
      room: 'Room 101',
      subject: { name: 'Mathematics 10' },
      section: { name: 'Rizal' },
      teacher: { user: { first_name: 'Maria', last_name: 'Clara' } },
    };

    const mockExistingSectionAssignment = {
      id: 'existing-assign-2',
      academic_year_id: 'ay-2026',
      teacher_id: 'teacher-2',
      section_id: 'section-1',
      subject_id: 'subj-sci10',
      days: 'M,W,F',
      start_time: '09:00',
      end_time: '10:00',
      room: 'Room 101',
      subject: { name: 'Science 10' },
      section: { name: 'Rizal' },
      teacher: { user: { first_name: 'Jose', last_name: 'Rizal' } },
    };

    it('rejects assignment when teacher is already scheduled at overlapping day and time', async () => {
      vi.spyOn(prisma.teacherSubjectAssignment, 'findMany').mockResolvedValue([mockExistingTeacherAssignment] as any);

      await expect(
        validateScheduleConflict({
          academicYearId: 'ay-2026',
          teacherId: 'teacher-1',
          sectionId: 'section-2', // Different section, same teacher
          days: 'M,W,F',
          startTime: '08:30', // Overlaps with 08:00-09:00
          endTime: '09:30',
        })
      ).rejects.toThrow(/Schedule conflict: Maria Clara is already assigned to Mathematics 10 in Section Rizal on M,W,F at 08:00-09:00/);
    });

    it('rejects assignment when section already has another subject at overlapping day and time', async () => {
      vi.spyOn(prisma.teacherSubjectAssignment, 'findMany').mockResolvedValue([mockExistingSectionAssignment] as any);

      await expect(
        validateScheduleConflict({
          academicYearId: 'ay-2026',
          teacherId: 'teacher-3', // Different teacher, same section
          sectionId: 'section-1',
          days: 'M,W,F',
          startTime: '09:15', // Overlaps with 09:00-10:00
          endTime: '10:15',
        })
      ).rejects.toThrow(/Schedule conflict: Section Rizal already has Science 10 scheduled on M,W,F at 09:00-10:00/);
    });

    it('allows assignment when days do not overlap', async () => {
      vi.spyOn(prisma.teacherSubjectAssignment, 'findMany').mockResolvedValue([mockExistingTeacherAssignment] as any);

      await expect(
        validateScheduleConflict({
          academicYearId: 'ay-2026',
          teacherId: 'teacher-1',
          sectionId: 'section-2',
          days: 'T,TH', // Disjoint days
          startTime: '08:00',
          endTime: '09:00',
        })
      ).resolves.toBeUndefined();
    });

    it('allows assignment when times are adjacent (back-to-back classes)', async () => {
      vi.spyOn(prisma.teacherSubjectAssignment, 'findMany').mockResolvedValue([mockExistingTeacherAssignment] as any);

      await expect(
        validateScheduleConflict({
          academicYearId: 'ay-2026',
          teacherId: 'teacher-1',
          sectionId: 'section-2',
          days: 'M,W,F',
          startTime: '09:00', // Starts exactly when previous ends
          endTime: '10:00',
        })
      ).resolves.toBeUndefined();
    });

    it('allows updating an existing assignment without triggering self-conflict', async () => {
      vi.spyOn(prisma.teacherSubjectAssignment, 'findMany').mockResolvedValue([] as any);

      await expect(
        validateScheduleConflict({
          academicYearId: 'ay-2026',
          teacherId: 'teacher-1',
          sectionId: 'section-1',
          days: 'M,W,F',
          startTime: '08:00',
          endTime: '09:00',
          excludeAssignmentId: 'existing-assign-1', // Excludes self
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('5. Teaching Assignment Update Audit Completeness', () => {
    it('captures previousState and newState when updating an assignment', async () => {
      const existingAssignment = {
        id: 'assign-test-1',
        academic_year_id: 'ay-2026',
        teacher_id: 'teacher-1',
        section_id: 'sec-1',
        subject_id: 'sub-1',
        days: 'M,W,F',
        start_time: '08:00',
        end_time: '09:00',
        room: 'Room 101',
      };

      const updatedAssignment = {
        ...existingAssignment,
        days: 'T,TH',
        start_time: '10:00',
        end_time: '11:30',
        room: 'Room 202',
      };

      vi.spyOn(prisma.teacherSubjectAssignment, 'findUnique').mockResolvedValue(existingAssignment as any);
      vi.spyOn(prisma.teacherSubjectAssignment, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.teacherSubjectAssignment, 'update').mockResolvedValue(updatedAssignment as any);

      const auditSpy = vi.spyOn(auditService, 'createAuditLog').mockResolvedValue(undefined as any);

      const result = await updateTeacherAssignment(
        'assign-test-1',
        {
          days: 'T,TH',
          startTime: '10:00',
          endTime: '11:30',
          room: 'Room 202',
        },
        'user-principal-1',
        'corr-123'
      );

      expect(result).toBeDefined();
      expect(auditSpy).toHaveBeenCalledTimes(1);

      const auditCall = auditSpy.mock.calls[0][0];
      expect(auditCall.action).toBe('TEACHER_ASSIGNMENT_UPDATED');
      expect(auditCall.resourceType).toBe('teacher_subject_assignment');
      expect(auditCall.resourceId).toBe('assign-test-1');
      expect(auditCall.actorUserId).toBe('user-principal-1');
      expect(auditCall.correlationId).toBe('corr-123');

      // Verify bidirectional state completeness
      expect(auditCall.previousState).toEqual({
        days: 'M,W,F',
        startTime: '08:00',
        endTime: '09:00',
        room: 'Room 101',
      });

      expect(auditCall.newState).toEqual({
        days: 'T,TH',
        startTime: '10:00',
        endTime: '11:30',
        room: 'Room 202',
      });
    });
  });
});
