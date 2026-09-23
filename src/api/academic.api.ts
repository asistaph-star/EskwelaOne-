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
  label: string;
  start_date: string;
  end_date: string;
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

export const academicApi = {
  getYears: () => apiClient.get<AcademicYear[]>('/academic/years'),
  getTerms: (yearId: string) => apiClient.get<Term[]>(`/academic/years/${yearId}/terms`),
  getSubjects: () => apiClient.get<Subject[]>('/academic/subjects'),
  getSections: (yearId: string) => apiClient.get<Section[]>(`/academic/years/${yearId}/sections`),
  getMyAssignments: (yearId: string) => apiClient.get<TeacherAssignment[]>(`/academic/years/${yearId}/assignments/me`),
  getSectionRoster: (sectionId: string) => apiClient.get<StudentEnrollment[]>(`/academic/sections/${sectionId}/roster`),
  
  // Teacher Excuse Letter endpoints
  getMyExcuseLetters: async () => {
    const response = await apiClient.get<any[]>(`/attendance/excuses/teacher/me`);
    return response;
  },
  updateExcuseStatus: async (id: string, status: string, teacherNote?: string) => {
    const response = await apiClient.patch(`/attendance/excuses/${id}/status`, { status, teacherNote });
    return response;
  }
};
