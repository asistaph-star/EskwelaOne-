import { apiClient } from './client';

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface Term {
  id: string;
  academic_year_id: string;
  key: string;
  name?: string;
  label?: string;
  start_date: string;
  end_date: string;
  is_grades_visible_to_students?: boolean;
  isGradesVisible?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
}

export interface Section {
  id: string;
  academic_year_id: string;
  name: string;
  grade_level: number;
  adviser_teacher_id?: string | null;
  adviser_assigned_at?: string | null;
  adviser_name_snapshot?: string | null;
  academic_year?: AcademicYear;
  adviser_teacher?: {
    id: string;
    employee_id: string;
    department?: string | null;
    position?: string | null;
    user?: {
      id: string;
      school_id: string;
      first_name: string;
      last_name: string;
      middle_name?: string | null;
      email?: string | null;
    };
  } | null;
}

export interface TeacherAssignment {
  id: string;
  academic_year_id: string;
  teacher_id: string;
  subject_id: string;
  section_id: string;
  subject: Subject;
  section: Section;
  gradebooks?: any[];
}

export interface StudentEnrollment {
  id: string;
  student_id: string;
  section_id: string;
  status: string;
  student: {
    id: string;
    lrn: string;
    gender: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
    };
  };
}

export interface PromotionRosterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  gradeLevel?: number | string;
  sectionId?: string;
  outcome?: string;
  reviewStatus?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const academicApi = {
  getYears: () => apiClient.get<AcademicYear[]>('/academic/years'),
  getTerms: (yearId: string) => apiClient.get<Term[]>(`/academic/years/${yearId}/terms`),
  addTerm: (yearId: string, data: { key: string; name?: string; startDate?: string | null; endDate?: string | null; confirm?: boolean; confirmPublishedOverride?: boolean; confirmedAcademicYearId?: string }) =>
    apiClient.post<{ success: boolean; data: Term }>(`/academic/years/${yearId}/terms`, data),
  removeTerm: (yearId: string, termId: string) =>
    apiClient.delete<{ success: boolean; removedTerm: Term }>(`/academic/years/${yearId}/terms/${termId}`),
  updateTermVisibility: (termId: string, isVisible: boolean) =>
    apiClient.patch<{ success: boolean; data: any }>(`/academic/terms/${termId}/visibility`, { isVisible }),
  getSubjects: () => apiClient.get<Subject[]>('/academic/subjects'),
  getSections: (yearId: string) => apiClient.get<Section[]>(`/academic/years/${yearId}/sections`),
  getAllSections: (params?: { yearId?: string; gradeLevel?: number }) => {
    const q = new URLSearchParams();
    if (params?.yearId) q.append('yearId', params.yearId);
    if (params?.gradeLevel) q.append('gradeLevel', String(params.gradeLevel));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiClient.get<Section[]>(`/academic/sections${qs}`);
  },
  assignAdviser: (sectionId: string, teacherId: string) =>
    apiClient.patch<{ success: boolean; data: any }>(`/academic/sections/${sectionId}/adviser`, { teacherId }),
  getMyAssignments: (yearId: string) => apiClient.get<TeacherAssignment[]>(`/academic/years/${yearId}/assignments/me`),
  getSectionRoster: (sectionId: string) => apiClient.get<StudentEnrollment[]>(`/academic/sections/${sectionId}/roster`),
  getClosureReadiness: (yearId: string) => apiClient.get<any>(`/academic/years/${yearId}/closure-readiness`),
  closeSchoolYear: (yearId: string, data: { confirmClosure: boolean; confirmationCode: string; remarks?: string }) =>
    apiClient.post<{ success: boolean; message: string; data: any }>(`/academic/years/${yearId}/close`, data),

  // Teacher Excuse Letter endpoints
  getMyExcuseLetters: async () => {
    const response = await apiClient.get<any[]>(`/attendance/excuses/teacher/me`);
    return response;
  },
  updateExcuseStatus: async (id: string, status: string, teacherNote?: string) => {
    const response = await apiClient.patch(`/attendance/excuses/${id}/status`, { status, teacherNote });
    return response;
  },

  // Student Promotion & Academic Lifecycle (Phase 2C / 2C.2)
  getPromotionRoster: (yearId: string, paramsOrSectionId?: string | PromotionRosterParams) => {
    let qs = '';
    if (typeof paramsOrSectionId === 'string') {
      qs = `?sectionId=${encodeURIComponent(paramsOrSectionId)}`;
    } else if (paramsOrSectionId && typeof paramsOrSectionId === 'object') {
      const q = new URLSearchParams();
      if (paramsOrSectionId.page) q.append('page', String(paramsOrSectionId.page));
      if (paramsOrSectionId.pageSize !== undefined) q.append('pageSize', String(paramsOrSectionId.pageSize));
      if (paramsOrSectionId.search) q.append('search', paramsOrSectionId.search);
      if (paramsOrSectionId.gradeLevel && paramsOrSectionId.gradeLevel !== 'ALL') q.append('gradeLevel', String(paramsOrSectionId.gradeLevel));
      if (paramsOrSectionId.sectionId && paramsOrSectionId.sectionId !== 'ALL') q.append('sectionId', paramsOrSectionId.sectionId);
      if (paramsOrSectionId.outcome && paramsOrSectionId.outcome !== 'ALL') q.append('outcome', paramsOrSectionId.outcome);
      if (paramsOrSectionId.reviewStatus && paramsOrSectionId.reviewStatus !== 'ALL') q.append('reviewStatus', paramsOrSectionId.reviewStatus);
      if (paramsOrSectionId.sortBy) q.append('sortBy', paramsOrSectionId.sortBy);
      if (paramsOrSectionId.sortOrder) q.append('sortOrder', paramsOrSectionId.sortOrder);
      const str = q.toString();
      if (str) qs = `?${str}`;
    }
    return apiClient.get<any>(`/academic/years/${yearId}/promotion-roster${qs}`);
  },
  approvePromotion: (yearId: string, data: { studentId: string; decision: 'PROMOTED' | 'RETAINED' | 'COMPLETED'; remarks?: string }) =>
    apiClient.post<any>(`/academic/years/${yearId}/promotion/approve`, data),
  bulkApprovePromotion: (yearId: string, data: { actionType: 'PROMOTION' | 'COMPLETION'; studentIds?: string[]; selectAllMatching?: boolean; filterScope?: any; remarks?: string }) =>
    apiClient.post<any>(`/academic/years/${yearId}/promotion/bulk-approve`, data),
  enrollNextYear: (yearId: string, data: { studentId: string; targetAcademicYearId: string; targetSectionId: string; remarks?: string }) =>
    apiClient.post<any>(`/academic/years/${yearId}/promotion/enroll-next-year`, data),
  bulkEnrollNextYear: (yearId: string, data: { targetAcademicYearId: string; placements: Array<{ studentId: string; targetSectionId: string }>; remarks?: string }) =>
    apiClient.post<any>(`/academic/years/${yearId}/promotion/bulk-enroll-next-year`, data)
};
