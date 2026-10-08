export type DocRequestStatus = "Submitted" | "Teacher Approved" | "Teacher Rejected" | "Principal Approved" | "Principal Rejected" | "Ready for Pickup" | "Completed";

export type DocumentRequest = {
  id: string;
  studentId: string;
  studentName?: string;
  grade?: string;
  section?: string;
  documentType: string;
  purpose: string;
  status: DocRequestStatus;
  currentStage: number;
  submittedDate: string;
  teacherId?: string;
  teacherName?: string;
  teacherRemarks?: string;
  teacherApprovedDate?: string;
  principalRemarks?: string;
  principalApprovedDate?: string;
  readyDate?: string;
  attachedDocumentId?: string;
  studentAttachmentName?: string;
  requiresPrincipalApproval?: boolean;
};
