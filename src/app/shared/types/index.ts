export type Role = "Admin" | "ITAdmin" | "Teacher" | "Student" | "Parent" | "Registrar" | "Nurse" | "Guidance" | "GateOperator";

export type TScreen =
  | "dashboard" | "classroom" | "gradebook" | "quarterly-summary" | "term-summary" | "t-ranking" | "announcements"
  | "grades-direct" | "attendance-direct" | "clinic-visits"
  | "ai-tools" | "pro-dev" | "appointments" | "doc-requests"
  | "calendar" | "templates" | "leave-requests" | "tutorials" | "tools" | "help" | "settings" | "behavior" | "scanner" | "student-create";

export type PScreen =
  | "p-dashboard" | "p-monitoring"
  | "p-analytics" | "p-teachers"
  | "p-inventory" | "p-doc-requests"
  | "p-events" | "p-faculty-attendance"
  | "p-settings" | "p-help" | "p-behavior" | "p-leaves" | "p-scanner" | "p-announcements";

export type GScreen =
  | "g-dashboard" | "g-behavior" | "g-counseling" | "g-records" | "g-settings" | "g-help";

export type RScreen =
  | "r-dashboard" | "r-enrollment" | "r-records" | "r-doc-requests" | "r-deficiency" | "r-search" | "r-settings" | "r-help";

export interface RCStudent {
  surname: string;
  first: string;
  lrn: string;
  grade: number;
  section: string;
  adviser: string;
  gender: string;
}

export interface TeacherCriteriaScore {
  criteriaName: string;
  score: number;
  maxScore: number;
}

export interface TeacherRankingRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  currentPosition: string;
  targetPosition: string;
  evaluationPeriod: string;
  status: "Pending" | "Under Review" | "Completed";
  criteriaScores: TeacherCriteriaScore[];
  totalScore: number;
  evaluators: string[];
  remarks: string;
  docsAttached?: number;
  createdAt?: string;
  supportingDocuments?: string[];
}

export type AttSub = "daily" | "qr" | "manual" | "late" | "sf2" | "excuses";
export type AStatus = "P" | "A" | "L" | "E";

export interface GradeCardInfo {
  name: string;
  section: string;
  grade: number;
}

export type GbItem = { id: string; label: string; max: number };
export type ExamItem = { id: string; label: string; max: number; weight: number };
export type CustomWeights = { ww: number; pt: number; qa: number };
export type GbGrades = Record<string | number, Record<string, string>>;
export type TermKey = "T1" | "T2" | "T3" | "T4";
export interface TermData {
  version?: number;
  wwItems: GbItem[];
  ptItems: GbItem[];
  examItems?: ExamItem[];
  customWeights?: CustomWeights;
  st1Max?: number;
  st2Max?: number;
  teMax?: number;
  qaMax?: number;
  grades: GbGrades;
  deletedColumnIds?: string[];
  computed?: Record<string, {
    initialGrade: number | null;
    termGrade: number | null;
    descriptor: string | null;
    isComplete: boolean;
    wwResult: any;
    ptResult: any;
    exResult: any;
  }>;
}

export type CurriculumType = "new" | "old";
export interface GradeRecord {
  q1: number;
  q2: number;
  q3: number;
  q4?: number;
  curriculum: CurriculumType;
}
export interface SubjectHistory {
  name: string;
  gr7?: GradeRecord;
  gr8?: GradeRecord;
  gr9?: GradeRecord;
  gr10?: GradeRecord;
}
export type GradeLevel = "gr7" | "gr8" | "gr9" | "gr10";

export interface InventoryUpdate {
  id: string;
  date?: string;
  created_at?: string;
  user?: string | { id: string; first_name: string; last_name: string };
  action: string;
  details: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  supplier: string;
  purchaseDate: string;
  condition: string;
  location: string;
  status: "Good" | "Repair" | "Borrowed" | "Lost" | "Damaged" | "Retired" | "Disposed";
  updates: InventoryUpdate[];
}

export interface VitalSigns {
  temperature?: string;
  bloodPressure?: string;
  heartRate?: string;
}

export interface ClinicVisit {
  id: string;
  studentId: string;
  date: string;
  time: string;
  symptoms: string;
  diagnoses: string;
  medications: string;
  treatments: string;
  vitalSigns: VitalSigns;
  notes: string;
}

export interface ClinicStudent {
  id: string;
  name: string;
  grade: string;
  section: string;
  bloodType: string;
  allergies: string;
  emergencyContact: string;
  medicalConditions: string;
}

export type EnrollmentStatus = "Pending Review" | "Missing Documents" | "Enrolled" | "Rejected";
export type Applicant = {
  id: string;
  name: string;
  gradeLevel: string;
  type: "New Student" | "Transferee" | "Returning";
  dateApplied: string;
  status: EnrollmentStatus;
  documents: { birthCert: boolean; form138: boolean; goodMoral: boolean; medical: boolean; };
};

export type Assignment = { id: string; section?: string; subject: string; title: string; dueDate: string; type: string; gradebookColumnId?: string; };
export type AssignmentSubmission = { id: string; assignmentId: string; studentId: string; genericDocId?: string; status: "Submitted" | "Graded" | "Returned"; grade?: number; feedback?: string; submittedAt: string; };

export * from './documentRequests';
