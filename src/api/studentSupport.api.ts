import { apiClient } from './client';

export interface StudentSupportAttendanceWindow {
  startDate: string;
  endDate: string;
  timezone: string;
  isDefaultWindow: boolean;
}

export interface StudentSupportRulesMetadata {
  passingGradeThreshold: number;
  attendanceWindow: StudentSupportAttendanceWindow;
  rules: {
    belowPassingTerms: string;
    recordedAbsences: string;
    missingScoresCount: string;
  };
  disclaimer: string;
}

export interface TeacherStudentSupportIndicator {
  studentId: string;
  studentDisplayName: string;
  sectionId: string;
  sectionName: string;
  gradeLevel: number;
  subjectId: string;
  subjectName: string;
  belowPassingTerms: Array<{
    term: string;
    grade: number;
  }>;
  recordedAbsences: {
    absences: number;
    tardies: number;
    excused: number;
  };
  missingScoresCount: number;
  hasIndicator: boolean;
}

export interface TeacherStudentSupportResponse {
  metadata: StudentSupportRulesMetadata;
  filters: {
    sectionId?: string;
    subjectId?: string;
    term?: string;
  };
  students: TeacherStudentSupportIndicator[];
  totalStudentsWithIndicators: number;
}

export interface PrincipalSectionAggregate {
  gradeLevel: number;
  sectionId: string;
  sectionName: string;
  studentsBelowPassingCount: number;
  studentsWithThreeOrMoreAbsencesCount: number;
}

export interface PrincipalStudentSupportResponse {
  metadata: StudentSupportRulesMetadata;
  filters: {
    gradeLevel?: number;
    sectionId?: string;
    term?: string;
  };
  aggregates: PrincipalSectionAggregate[];
  totals: {
    totalSectionsEvaluated: number;
    studentsBelowPassingCount: number;
    studentsWithThreeOrMoreAbsencesCount: number;
  };
}

export const studentSupportApi = {
  getTeacherIndicators: (params?: { sectionId?: string; subjectId?: string; term?: string }) => {
    const q = new URLSearchParams();
    if (params?.sectionId) q.append('sectionId', params.sectionId);
    if (params?.subjectId) q.append('subjectId', params.subjectId);
    if (params?.term && params.term !== 'all') q.append('term', params.term);
    const queryString = q.toString();
    return apiClient.get<TeacherStudentSupportResponse>(
      `/student-support/teacher/indicators${queryString ? `?${queryString}` : ''}`
    );
  },
  getPrincipalAggregate: (params?: { gradeLevel?: number; sectionId?: string; term?: string }) => {
    const q = new URLSearchParams();
    if (params?.gradeLevel) q.append('gradeLevel', String(params.gradeLevel));
    if (params?.sectionId) q.append('sectionId', params.sectionId);
    if (params?.term && params.term !== 'all') q.append('term', params.term);
    const queryString = q.toString();
    return apiClient.get<PrincipalStudentSupportResponse>(
      `/student-support/principal/aggregate${queryString ? `?${queryString}` : ''}`
    );
  },
};
