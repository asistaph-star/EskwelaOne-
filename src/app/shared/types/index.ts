

export type Role = "Admin" | "Teacher" | "Principal" | "Student" | "Parent" | "Registrar";

export type TScreen =
  | "dashboard" | "classroom" | "gradebook" | "quarterly-summary"
  | "grades-direct" | "attendance-direct" | "clinic-visits"
  | "ai-tools" | "pro-dev"
  | "calendar" | "templates" | "tutorials" | "tools" | "help" | "settings";

export type PScreen =
  | "p-dashboard" | "p-monitoring"
  | "p-analytics" | "p-teachers"
  | "p-welfare" | "p-inventory"
  | "p-reports" | "p-templates"
  | "p-events" | "p-messages"
  | "p-settings" | "p-help";

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
export type GbGrades = Record<number, Record<string, string>>;
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
