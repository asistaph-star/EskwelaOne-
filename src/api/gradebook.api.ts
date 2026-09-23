import { apiClient } from './client';

export interface GradebookColumn {
  id: string;
  gradebook_id: string;
  type: string; // 'WW', 'PT', 'QA'
  label: string;
  max_score: number;
  order_index: number;
}

export interface GradeEntry {
  id: string;
  column_id: string;
  student_enrollment_id: string;
  score: number;
  is_superseded: boolean;
  superseded_by_id: string | null;
  historical_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Gradebook {
  id: string;
  teacher_assignment_id: string;
  term_id: string;
  status: string; // 'Draft', 'Submitted', 'Published'
  version: number;
  term: {
    id: string;
    key: string;
    label: string;
  };
  columns?: GradebookColumn[];
  entries?: GradeEntry[];
}

export interface CreateGradeEntryPayload {
  column_id: string;
  student_enrollment_id: string;
  score: number;
}

export interface CorrectGradePayload {
  grade_entry_id: string;
  replacement_score: number;
  correction_reason: string;
}

export interface UpdateGradebookStatusPayload {
  status: string;
  expected_version: number;
}

export const gradebookApi = {
  getGradebook: (id: string) => apiClient.get<Gradebook>(`/gradebooks/${id}`),
  createEntry: (payload: CreateGradeEntryPayload) => apiClient.post<GradeEntry>('/gradebooks/entries', payload),
  correctEntry: (payload: CorrectGradePayload) => apiClient.post<GradeEntry>('/gradebooks/entries/correct', payload),
  updateStatus: (id: string, payload: UpdateGradebookStatusPayload) => apiClient.patch<Gradebook>(`/gradebooks/${id}/status`, payload),
};
