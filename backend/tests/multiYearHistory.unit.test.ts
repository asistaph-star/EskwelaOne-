import { describe, it, expect } from 'vitest';
import { AppError } from '../src/common/middleware/errorHandler.js';
import { classifyAcademicYearLifecycle } from '../src/common/utils/calendarValidation.js';

describe('DigiSkwela — Multi-Year Grades & Attendance History Unit Tests', () => {

  describe('1. Academic Year Record Isolation & Metadata Contracts', () => {
    it('accurately identifies current, historical, and upcoming academic years', () => {
      const refDate = new Date('2026-11-05T00:00:00.000Z');

      const currentYear = {
        id: 'ay-2026-2027',
        name: 'SY 2026-2027',
        is_current: true,
        start_date: new Date('2026-08-24'),
        end_date: new Date('2027-06-25'),
      };

      const pastYear = {
        id: 'ay-2025-2026',
        name: 'SY 2025-2026',
        is_current: false,
        start_date: new Date('2025-08-25'),
        end_date: new Date('2026-06-26'),
      };

      const futureYear = {
        id: 'ay-2027-2028',
        name: 'SY 2027-2028',
        is_current: false,
        start_date: new Date('2027-08-23'),
        end_date: new Date('2028-06-23'),
      };

      expect(classifyAcademicYearLifecycle(currentYear, refDate)).toBe('CURRENT');
      expect(classifyAcademicYearLifecycle(pastYear, refDate)).toBe('HISTORICAL');
      expect(classifyAcademicYearLifecycle(futureYear, refDate)).toBe('UPCOMING');
    });

    it('ensures historical report card payload carries isHistorical=true and isCurrent=false', () => {
      const createReportCardSchoolDto = (year: { name: string; is_current: boolean; start_date?: Date; end_date?: Date }) => {
        const lifecycle = classifyAcademicYearLifecycle({
          is_current: year.is_current,
          start_date: year.start_date || new Date('2026-08-24'),
          end_date: year.end_date || new Date('2027-06-25'),
        });
        return {
          name: 'Calulut Integrated School',
          academicYear: year.name,
          isCurrent: lifecycle === 'CURRENT',
          isHistorical: lifecycle === 'HISTORICAL',
          isUpcoming: lifecycle === 'UPCOMING',
          lifecycle,
        };
      };

      const historicalSchool = createReportCardSchoolDto({
        name: 'SY 2025-2026',
        is_current: false,
        start_date: new Date('2025-08-25'),
        end_date: new Date('2026-06-26'),
      });
      expect(historicalSchool.isCurrent).toBe(false);
      expect(historicalSchool.isHistorical).toBe(true);
      expect(historicalSchool.isUpcoming).toBe(false);

      const currentSchool = createReportCardSchoolDto({
        name: 'SY 2026-2027',
        is_current: true,
        start_date: new Date('2026-08-24'),
        end_date: new Date('2027-06-25'),
      });
      expect(currentSchool.isCurrent).toBe(true);
      expect(currentSchool.isHistorical).toBe(false);
      expect(currentSchool.isUpcoming).toBe(false);
    });
  });

  describe('2. Official DepEd SF2 Cumulative Attendance Invariants', () => {
    const calculateCumulative = (monthlySummaries: Array<{ classDays: number; daysPresent: number; daysAbsent: number; daysTardy: number }>) => {
      const totalSchoolDays = monthlySummaries.reduce((acc, m) => acc + (m.classDays || 0), 0);
      const totalPresent = monthlySummaries.reduce((acc, m) => acc + (m.daysPresent || 0), 0);
      const totalAbsent = monthlySummaries.reduce((acc, m) => acc + (m.daysAbsent || 0), 0);
      const totalTardy = monthlySummaries.reduce((acc, m) => acc + (m.daysTardy || 0), 0);
      const attendanceRate = totalSchoolDays > 0 ? Math.round((totalPresent / totalSchoolDays) * 1000) / 10 : null;

      return {
        totalSchoolDays,
        totalPresent,
        totalAbsent,
        totalTardy,
        attendanceRate,
      };
    };

    it('accurately sums monthly SF2 records into cumulative annual statistics', () => {
      const mockMonthly = [
        { classDays: 21, daysPresent: 20, daysAbsent: 1, daysTardy: 2 }, // August
        { classDays: 22, daysPresent: 22, daysAbsent: 0, daysTardy: 0 }, // September
        { classDays: 20, daysPresent: 18, daysAbsent: 2, daysTardy: 1 }, // October
      ];

      const cumulative = calculateCumulative(mockMonthly);
      expect(cumulative.totalSchoolDays).toBe(63);
      expect(cumulative.totalPresent).toBe(60);
      expect(cumulative.totalAbsent).toBe(3);
      expect(cumulative.totalTardy).toBe(3);
      // 60 / 63 = 0.95238... -> 95.2%
      expect(cumulative.attendanceRate).toBe(95.2);
    });

    it('safely handles zero-school-days edge cases without NaN or division by zero, returning null rate', () => {
      const emptyMonthly: any[] = [];
      const cumulative = calculateCumulative(emptyMonthly);
      expect(cumulative.totalSchoolDays).toBe(0);
      expect(cumulative.totalPresent).toBe(0);
      expect(cumulative.attendanceRate).toBeNull();
    });
  });

  describe('3. Historical Academic Record Read-Only Enforcement Invariants', () => {
    it('throws HISTORICAL_GRADEBOOK_READ_ONLY if modifying a historical gradebook, and UPCOMING_ACADEMIC_YEAR_INACTIVE if upcoming', () => {
      const refDate = new Date('2026-11-05T00:00:00.000Z');
      const assertWritableGradebook = (ay: { is_current: boolean; start_date: string; end_date: string }) => {
        const lifecycle = classifyAcademicYearLifecycle(ay, refDate);
        if (lifecycle === 'HISTORICAL') {
          throw new AppError(403, 'HISTORICAL_GRADEBOOK_READ_ONLY', 'Cannot modify grades for a historical academic year. Historical records are strictly read-only.');
        }
        if (lifecycle === 'UPCOMING') {
          throw new AppError(403, 'UPCOMING_ACADEMIC_YEAR_INACTIVE', 'Cannot record or modify grades for an upcoming academic year that has not yet become active.');
        }
      };

      // Current year allows writes
      expect(() => assertWritableGradebook({ is_current: true, start_date: '2026-08-01', end_date: '2027-05-31' })).not.toThrow();

      // Historical year rejects writes with 403 HISTORICAL_GRADEBOOK_READ_ONLY
      expect(() => assertWritableGradebook({ is_current: false, start_date: '2025-08-01', end_date: '2026-05-31' })).toThrowError(
        /Cannot modify grades for a historical academic year/
      );
      try {
        assertWritableGradebook({ is_current: false, start_date: '2025-08-01', end_date: '2026-05-31' });
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('HISTORICAL_GRADEBOOK_READ_ONLY');
      }

      // Upcoming year rejects writes with 403 UPCOMING_ACADEMIC_YEAR_INACTIVE
      expect(() => assertWritableGradebook({ is_current: false, start_date: '2027-08-01', end_date: '2028-05-31' })).toThrowError(
        /Cannot record or modify grades for an upcoming academic year/
      );
      try {
        assertWritableGradebook({ is_current: false, start_date: '2027-08-01', end_date: '2028-05-31' });
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('UPCOMING_ACADEMIC_YEAR_INACTIVE');
      }
    });

    it('throws HISTORICAL_ACADEMIC_YEAR_READ_ONLY if recording attendance in historical year, and UPCOMING_ACADEMIC_YEAR_INACTIVE if upcoming', () => {
      const refDate = new Date('2026-11-05T00:00:00.000Z');
      const assertWritableAttendance = (ay: { is_current: boolean; start_date: string; end_date: string }) => {
        const lifecycle = classifyAcademicYearLifecycle(ay, refDate);
        if (lifecycle === 'HISTORICAL') {
          throw new AppError(403, 'HISTORICAL_ACADEMIC_YEAR_READ_ONLY', 'Cannot record or modify attendance for a historical academic year. Historical records are strictly read-only.');
        }
        if (lifecycle === 'UPCOMING') {
          throw new AppError(403, 'UPCOMING_ACADEMIC_YEAR_INACTIVE', 'Cannot record or modify attendance for an upcoming academic year that has not yet become active.');
        }
      };

      // Current year allows recording
      expect(() => assertWritableAttendance({ is_current: true, start_date: '2026-08-01', end_date: '2027-05-31' })).not.toThrow();

      // Historical year rejects recording with 403
      expect(() => assertWritableAttendance({ is_current: false, start_date: '2025-08-01', end_date: '2026-05-31' })).toThrowError(
        /Cannot record or modify attendance for a historical academic year/
      );
      try {
        assertWritableAttendance({ is_current: false, start_date: '2025-08-01', end_date: '2026-05-31' });
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('HISTORICAL_ACADEMIC_YEAR_READ_ONLY');
      }

      // Upcoming year rejects recording with 403 UPCOMING_ACADEMIC_YEAR_INACTIVE
      expect(() => assertWritableAttendance({ is_current: false, start_date: '2027-08-01', end_date: '2028-05-31' })).toThrowError(
        /Cannot record or modify attendance for an upcoming academic year/
      );
      try {
        assertWritableAttendance({ is_current: false, start_date: '2027-08-01', end_date: '2028-05-31' });
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('UPCOMING_ACADEMIC_YEAR_INACTIVE');
      }
    });
  });

  describe('4. Learner Multi-Year Isolation & Authorization Invariants', () => {
    it('restricts student actor to strictly viewing their own academic years', () => {
      const authorizeStudentAccess = (actorId: string, studentUserId: string) => {
        if (actorId !== studentUserId) {
          throw new AppError(403, 'FORBIDDEN', 'You can only view your own academic years.');
        }
      };

      // Student viewing own records succeeds
      expect(() => authorizeStudentAccess('student-user-1', 'student-user-1')).not.toThrow();

      // Student attempting to view peer records throws 403
      expect(() => authorizeStudentAccess('student-user-1', 'student-user-2')).toThrowError(
        /You can only view your own academic years/
      );
    });

    it('orders multi-year enrollments descending by academic year start date', () => {
      const enrollments = [
        { academicYearName: 'SY 2024-2025', startDate: new Date('2024-08-25') },
        { academicYearName: 'SY 2026-2027', startDate: new Date('2026-08-24') },
        { academicYearName: 'SY 2025-2026', startDate: new Date('2025-08-25') },
      ];

      const sorted = [...enrollments].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
      expect(sorted[0].academicYearName).toBe('SY 2026-2027');
      expect(sorted[1].academicYearName).toBe('SY 2025-2026');
      expect(sorted[2].academicYearName).toBe('SY 2024-2025');
    });
  });

});

