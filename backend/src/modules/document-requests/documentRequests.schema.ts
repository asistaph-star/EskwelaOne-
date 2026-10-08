import { z } from 'zod';

export const createStudentServicesDocRequestSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  section: z.string(),
  documentType: z.string(),
  purpose: z.string(),
  teacherId: z.string().optional(),
});

export const createDocumentsDocRequestSchema = z.object({
  studentId: z.string().min(1),
  documentType: z.string().min(1),
  purpose: z.string().min(1),
});

export const updateDocumentRequestSchema = z.object({
  status: z.string().optional(),
  currentStage: z.number().optional(),
  teacherApprovedDate: z.string().optional(),
  teacherRemarks: z.string().optional(),
  principalApprovedDate: z.string().optional(),
  principalRemarks: z.string().optional(),
  readyDate: z.string().optional(),
  attachedDocumentId: z.string().optional()
});
