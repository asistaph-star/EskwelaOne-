export type Role = "Admin" | "ITAdmin" | "Teacher" | "Student" | "Parent" | "Registrar" | "Nurse";

export type TScreen =
  | "dashboard" | "classroom" | "gradebook" | "quarterly-summary"
  | "grades-direct" | "attendance-direct"
  | "ai-tools" | "pro-dev"
  | "calendar" | "templates" | "leave-requests" | "tutorials" | "tools" | "help" | "settings" | "behavior";

export type PScreen =
  | "p-dashboard" | "p-monitoring"
  | "p-analytics" | "p-teachers"
  | "p-inventory"
  | "p-events" | "p-faculty-attendance"
  | "p-settings" | "p-help" | "p-behavior" | "p-leaves";

export interface RCStudent {
  surname: string;
  first: string;
  lrn: string;
  grade: number;
  section: string;
  adviser: string;
  gender: string;
}

export type AttSub = "daily" | "qr" | "manual" | "late" | "sf2";
export type AStatus = "P" | "A" | "L" | "E";

export interface GradeCardInfo {
  name: string;
  section: string;
  grade: number;
}

export type GbItem = { id: string; label: string; max: number };
export type GbGrades = Record<string | number, Record<string, string>>;
export type QKey = "Q1" | "Q2" | "Q3";
export interface QData {
  wwItems: GbItem[];
  ptItems: GbItem[];
  qaMax: number;
  grades: GbGrades;
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
  date: string;
  user: string;
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
  status: "Good" | "Repair" | "Borrowed" | "Lost" | "Damaged";
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
