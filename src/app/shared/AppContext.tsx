import React, { createContext, useContext, useState, useEffect } from "react";
export type StoredDocument = { id: string; [key: string]: any };
import { SCHOOL_EVENTS, TEACHER_PERSONAL_EVENTS, CalendarEvent } from "./data/calendarData";
import { TeacherRankingRecord, TermKey, TermData } from "./types";
import { apiClient } from "../../api/client";
import { toast } from "sonner";

// --- Types --
export type User = { id: string; name: string; role: string; section?: string; photoDocId?: string; parentEmail?: string; smsAlerts?: boolean; emailAlerts?: boolean; };
export type GradeStatus = "Draft" | "Submitted" | "Published" | "Returned";
export type ExcuseStatus = "Pending Review" | "Approved" | "Rejected";
export type ExcuseLetter = {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  section: string;
  dates: string;
  reason: string;
  // Document reference — empty string means no document attached
  documentId: string;
  documentName: string;
  documentType: string;
  documentSize: number;
  // Timestamps
  submittedDate: string;
  // Review
  status: ExcuseStatus;
  teacherNote?: string;
  reviewedAt?: string;
};

/** Represents the currently logged-in user identity */
export interface CurrentUser {
  id: string;
  name: string;
  role: string;
  section?: string;
  photoDocId?: string;
  parentEmail?: string;
  smsAlerts?: boolean;
  emailAlerts?: boolean;
  permissions?: string[];
  rawRoles?: string[];
  studentProfile?: any;
}
export type Message = { id: string; senderId: string; senderName: string; receiverId?: string; receiverName?: string; text?: string; content?: string; timestamp: string; isAI?: boolean; read?: boolean; };
export type Announcement = { id: string; author: string; title: string; body: string; audience: string; timestamp: string };
export type Assignment = { id: string; section?: string; subject: string; title: string; dueDate: string; type: string; gradebookColumnId?: string; };
export type AssignmentSubmission = { id: string; assignmentId: string; studentId: string; genericDocId?: string; status: "Submitted" | "Graded" | "Returned"; grade?: number; feedback?: string; submittedAt: string; };
export type AppNotification = { id: string; recipientId: string; title: string; body: string; timestamp: string; isRead: boolean; iconType: "alert" | "megaphone" | "calendar" | "document" };
export type TeacherLeave = { id: string; type: string; startDate: string; endDate: string; days: number; reason: string; status: "Pending" | "Approved" | "Rejected"; submittedOn: string; approverNote?: string };
export type GateAttendance = { id: string; studentId: string; date: string; timeIn: string; timeOut: string; status: string; studentName?: string; time?: string; };
export type ClinicReferral = { id: string; studentName: string; teacherName: string; reason: string; timestamp: string; status: "Pending" | "Acknowledged" };
export type BehaviorLog = { id: string; studentName: string; section: string; type: string; date: string; status: string; note: string };
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
export type AppointmentStatus = "Pending" | "Confirmed" | "Declined" | "Completed";
export type AppointmentDirection = "parent-to-teacher" | "teacher-to-parent";
export type Appointment = {
  id: string;
  studentId: string;
  studentName: string;
  parentEmail: string;
  teacherId: string;
  teacherName: string;
  date: string;
  time: string;
  purpose: string;
  status: AppointmentStatus;
  direction: AppointmentDirection;
  createdAt: string;
};
export type CounselingLogType = "Counseling Session" | "Disciplinary Incident" | "Academic Review" | "Attendance Check-in" | "Parent Conference";
export type CounselingLog = {
  id: string;
  studentId: string;
  date: string;
  type: CounselingLogType;
  summary: string;
  actionTaken: string;
  counselor: string;
};
export type StudentRecordStatus = "Active monitoring" | "Case resolved" | "Needs follow-up" | "New case";
export type StudentRecord = {
  id: string;
  fullName: string;
  lrn: string;
  grade: string;
  section: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  primaryConcerns: string[];
  effectiveStrategies: string[];
  currentStatus: StudentRecordStatus;
  aiSummary: string;
};
export type DocRequestStatus = "Submitted" | "Teacher Approved" | "Teacher Rejected" | "Principal Approved" | "Principal Rejected" | "Ready for Pickup" | "Completed";
export type DocumentRequest = {
  id: string;
  studentId: string;
  studentName: string;
  section: string;
  documentType: string;
  purpose: string;
  status: DocRequestStatus;
  currentStage: number; // 1=Submitted, 2=Teacher Approved, 3=Principal Approved, 4=Ready for Pickup
  submittedDate: string;
  teacherId?: string;
  teacherName?: string;
  responsibleRole?: "TEACHER" | "REGISTRAR" | "RECORDS_CUSTODIAN" | "GUIDANCE";
  responsibleOffice?: string;
  requiredInformation?: Record<string, string>;
  requiresPrincipalApproval?: boolean;
  teacherApprovedDate?: string;
  teacherRemarks?: string;
  principalApprovedDate?: string;
  principalRemarks?: string;
  readyDate?: string; // estimated pickup date
  attachedDocumentId?: string; // ID of the document stored in IndexedDB (Principal's attachment)
  studentAttachmentId?: string; // ID of the document stored in IndexedDB (Student's requirement upload)
  studentAttachmentName?: string; // Filename of the student's upload
};

export type SystemAccountRole = "Teacher" | "Student" | "Parent" | "Staff";
export type SystemAccountStatus = "Active" | "Locked" | "Pending";
export type SystemAccount = {
  id: string;
  name: string;
  username: string;
  role: SystemAccountRole;
  status: SystemAccountStatus;
  lastLogin?: string;
  departmentOrGrade?: string;
};

type AppContextType = {
  // Current User
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  updateCurrentUser: (updates: Partial<CurrentUser>) => Promise<void>;
  isAuthChecking: boolean;
  setIsAuthChecking: (val: boolean) => void;
  
  // Excuse Letters
  excuseLetters: ExcuseLetter[];
  updateExcuseLetter: (id: string, status: ExcuseStatus, teacherNote?: string) => void;
  addExcuseLetter: (letter: ExcuseLetter) => void;
  getExcuseDocument: (documentId: string) => Promise<StoredDocument | undefined>;
  saveExcuseDocument: (doc: StoredDocument) => Promise<StoredDocument>;
  deleteExcuseDocument: (id: string) => Promise<void>;

  // Generic Documents (Profile Photos, etc)
  getGenericDocument: (documentId: string) => Promise<StoredDocument | undefined>;
  saveGenericDocument: (doc: StoredDocument) => Promise<StoredDocument>;

  // Teacher Leaves
  students: User[];
  teachers: User[];
  addTeacher: (t: Omit<User, 'id'>) => Promise<void>;
  addStudent: (s: Omit<User, 'id'>) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  teacherLeaves: TeacherLeave[];
  addTeacherLeave: (leave: TeacherLeave) => void;
  updateTeacherLeave: (id: string, status: "Pending"|"Approved"|"Rejected", approverNote?: string) => void;

  // Announcements
  announcements: Announcement[];
  addAnnouncement: (a: Announcement) => void;

  // Assignments
  assignments: Assignment[];
  addAssignment: (a: Assignment) => Promise<void>;
  updateAssignment: (id: string, updates: Partial<Assignment>) => Promise<void>;
  assignmentSubmissions: AssignmentSubmission[];
  addAssignmentSubmission: (s: AssignmentSubmission) => Promise<void>;
  updateAssignmentSubmission: (id: string, updates: Partial<AssignmentSubmission>) => Promise<void>;

  // Notifications
  notifications: AppNotification[];
  addNotification: (n: AppNotification) => void;
  markNotificationsRead: (recipientId: string) => void;

  // Events
  events: CalendarEvent[];
  addEvent: (e: CalendarEvent) => void;
  editEvent: (id: string, e: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;

  // Messages
  messages: Message[];
  addMessage: (msg: Message) => void;

  // Cross-checks
  gateAttendance: GateAttendance[];
  addGateAttendance: (log: GateAttendance) => void;
  updateGateAttendance: (id: string, updates: Partial<GateAttendance>) => void;
  clinicReferrals: ClinicReferral[];
  addClinicReferral: (ref: ClinicReferral) => void;
  resolveClinicReferral: (id: string) => void;

  // Nurse Visit Records (persisted)
  clinicVisitRecords: any[];
  addClinicVisitRecord: (v: any) => Promise<void>;

  behaviorLogs: BehaviorLog[];
  addBehaviorLog: (log: BehaviorLog) => void;
  updateBehaviorLog: (id: string, updates: Partial<BehaviorLog>) => void;

  // Appointments
  appointments: Appointment[];
  addAppointment: (appt: Appointment) => void;
  updateAppointment: (id: string, status: AppointmentStatus) => void;

  // Student Records (Guidance)
  studentRecords: StudentRecord[];
  counselingLogs: CounselingLog[];
  addCounselingLog: (log: CounselingLog) => void;

  // Document Requests
  documentRequests: DocumentRequest[];
  addDocumentRequest: (req: DocumentRequest) => void;
  updateDocumentRequest: (id: string, updates: Partial<DocumentRequest>) => void;
  // System Accounts (IT Admin)
  systemAccounts: SystemAccount[];
  deleteAccount: (id: string) => void;
  resetPassword: (id: string) => void;
  
  // Teacher Ranking
  teacherRankings: TeacherRankingRecord[];
  addTeacherRanking: (record: TeacherRankingRecord) => void;
  updateTeacherRanking: (id: string, updates: Partial<TeacherRankingRecord>) => void;

  // Enrollments
  enrollmentApplications: Applicant[];
  enrollmentError: string | null;
  addEnrollmentApplication: (app: Applicant) => Promise<void>;
  updateEnrollmentApplication: (id: string, updates: Partial<Applicant>) => void;
};

// --- Seed Data --








const SEED_DOCUMENT_REQUESTS: DocumentRequest[] = [
  { id: "doc-1", studentName: "Juan Miguel Santos", section: "Grade 10 - Pilot", documentType: "Certificate of Good Moral", purpose: "Required for college application at University of the Philippines.", status: "Principal Approved", currentStage: 3, submittedDate: "July 10, 2026", teacherName: "Ana R. Soriano", teacherApprovedDate: "July 11, 2026", teacherRemarks: "Student has exemplary conduct. Recommended for approval.", principalApprovedDate: "July 14, 2026", principalRemarks: "Approved. Document will be ready by July 18.", readyDate: "July 18, 2026" },
  { id: "doc-2", studentName: "Juan Miguel Santos", section: "Grade 10 - Pilot", documentType: "Form 137 (Permanent Record)", purpose: "Transfer credentials for senior high school enrollment.", status: "Teacher Approved", currentStage: 2, submittedDate: "July 18, 2026", teacherName: "Ana R. Soriano", teacherApprovedDate: "July 19, 2026", teacherRemarks: "Records verified. Forwarding to principal for final approval." },
  { id: "doc-3", studentName: "Trisha Ann Cruz", section: "Grade 10 - Pilot", documentType: "Certificate of Enrollment", purpose: "Needed for scholarship application.", status: "Submitted", currentStage: 1, submittedDate: "July 20, 2026", teacherName: "Ana R. Soriano" },
];

const SEED_STUDENT_RECORDS: StudentRecord[] = [
  {
    id: "sr-1",
    fullName: "Juan Dela Cruz",
    lrn: "200014",
    grade: "Grade 10",
    section: "Rizal",
    parentName: "Mrs. Maria Dela Cruz",
    parentEmail: "maria.delacruz@email.com",
    parentPhone: "0917-834-5621",
    primaryConcerns: ["Classroom misconduct", "Disruptive behavior during group activities", "Mobile phone policy violations"],
    effectiveStrategies: ["Bi-weekly progress check-ins", "Parent-teacher conference", "Assigned peer mentor"],
    currentStatus: "Active monitoring",
    aiSummary: "Juan Dela Cruz has been documented across five guidance interactions since June 2026, primarily involving classroom misconduct and disruptive behavior. A pattern of recurring incidents during group activities has been identified, with escalation noted in early July. Following parental notification and the introduction of bi-weekly progress check-ins, observable improvement in classroom conduct has been reported by the advising teacher. The case remains under active monitoring with the next scheduled review on August 30, 2026."
  },
  {
    id: "sr-2",
    fullName: "Hannah Grace Espino",
    lrn: "200005",
    grade: "Grade 8",
    section: "Rizal",
    parentName: "Mr. Ricardo Espino",
    parentEmail: "ricardo.espino@email.com",
    parentPhone: "0926-451-7803",
    primaryConcerns: ["Academic underperformance", "Frequent unexcused absences", "Exam-related anxiety"],
    effectiveStrategies: ["Weekly academic counseling", "Coordinated study plan with adviser", "Referral to peer tutoring program"],
    currentStatus: "Needs follow-up",
    aiSummary: "Hannah Grace Espino has been the subject of four guidance office interactions since June 2026, primarily concerning declining academic performance and chronic absenteeism. Records indicate a pattern of unexcused absences correlating with quarterly examination periods, suggesting possible exam-related anxiety. A coordinated academic support plan involving weekly counseling, peer tutoring, and close collaboration with her class adviser was initiated in July 2026. While attendance has shown marginal improvement, the student's quarterly average remains below the passing threshold, and continued follow-up is strongly recommended."
  },
  {
    id: "sr-3",
    fullName: "Ramon Jr. Bondoc",
    lrn: "200002",
    grade: "Grade 8",
    section: "Rizal",
    parentName: "Mr. Ramon Sr. Bondoc",
    parentEmail: "ramon.bondoc@email.com",
    parentPhone: "0935-612-9487",
    primaryConcerns: ["Peer conflict", "Reported bullying behavior", "Emotional regulation difficulties"],
    effectiveStrategies: ["Individual counseling sessions", "Restorative justice circle", "Parent involvement and home-school agreement"],
    currentStatus: "Active monitoring",
    aiSummary: "Ramon Jr. Bondoc has been involved in six guidance-related interactions since May 2026, centered on peer conflict and reported bullying behavior targeting younger students. Documented incidents reveal a pattern of verbal aggression during unstructured periods such as recess and lunch. A restorative justice circle conducted in July 2026 with affected parties resulted in a formal agreement, and individual counseling sessions focused on emotional regulation were initiated. Parental engagement has been active, and while no new incidents have been reported in the past three weeks, the case remains under active monitoring."
  }
];

const SEED_COUNSELING_LOGS: CounselingLog[] = [
  { id: "cl-1", studentId: "sr-1", date: "2026-08-20", type: "Counseling Session", summary: "Bi-weekly progress check-in. Juan reported feeling more focused in class after being assigned a peer mentor. Teacher confirmed reduced disruptions in the past two weeks.", actionTaken: "Continued current intervention plan. Scheduled next check-in for September 3.", counselor: "Counselor Perez" },
  { id: "cl-2", studentId: "sr-1", date: "2026-08-06", type: "Counseling Session", summary: "Follow-up session after parent conference. Discussed behavioral expectations and strategies for self-regulation during group activities.", actionTaken: "Assigned peer mentor from Grade 10 Honor Society. Provided self-monitoring checklist.", counselor: "Counselor Perez" },
  { id: "cl-3", studentId: "sr-1", date: "2026-07-28", type: "Parent Conference", summary: "Conference with Mrs. Dela Cruz regarding recurring behavioral incidents. Parent expressed concern and willingness to collaborate on an intervention plan.", actionTaken: "Established home-school behavioral agreement. Parent will monitor homework completion and screen time.", counselor: "Counselor Perez" },
  { id: "cl-4", studentId: "sr-1", date: "2026-07-15", type: "Disciplinary Incident", summary: "Reported by adviser for consistently disrupting group activities in Filipino 10 class. Third documented incident in two weeks.", actionTaken: "Formal written warning issued. Parent notification sent via official letter. Scheduled parent conference.", counselor: "Counselor Perez" },
  { id: "cl-5", studentId: "sr-1", date: "2026-07-08", type: "Disciplinary Incident", summary: "Caught using mobile phone during lecture despite prior verbal warnings. Device was confiscated per school policy.", actionTaken: "Phone returned to parent after school. Student signed mobile phone policy acknowledgment form.", counselor: "Counselor Perez" },
  { id: "cl-6", studentId: "sr-1", date: "2026-06-24", type: "Academic Review", summary: "Initial guidance check-in for Q1. Student's grades are satisfactory but adviser flagged emerging behavioral concerns in class.", actionTaken: "Noted for monitoring. Advised student on classroom expectations and self-discipline.", counselor: "Counselor Perez" },

  { id: "cl-7", studentId: "sr-2", date: "2026-08-14", type: "Academic Review", summary: "Mid-quarter academic review. Hannah's current average is 68.5%, below the 75% passing threshold. She is at risk of failing Mathematics and Science.", actionTaken: "Coordinated with subject teachers for remedial worksheets. Enrolled in after-school peer tutoring (Tuesdays/Thursdays).", counselor: "Counselor Perez" },
  { id: "cl-8", studentId: "sr-2", date: "2026-07-30", type: "Counseling Session", summary: "Hannah disclosed feeling overwhelmed before exams and frequently avoids school on test days. She described symptoms consistent with test anxiety.", actionTaken: "Provided coping strategy handout. Recommended relaxation techniques. Referred to weekly counseling.", counselor: "Counselor Perez" },
  { id: "cl-9", studentId: "sr-2", date: "2026-07-10", type: "Attendance Check-in", summary: "Called in for attendance review. Hannah accumulated 5 unexcused absences in June, primarily on Mondays and Fridays.", actionTaken: "Parent contacted via phone. Attendance contract established with student and parent.", counselor: "Counselor Perez" },
  { id: "cl-10", studentId: "sr-2", date: "2026-06-20", type: "Academic Review", summary: "Quarterly baseline academic check. Hannah's Grade 7 records show declining performance starting Q3 of previous year. Current trajectory suggests continued risk.", actionTaken: "Flagged for academic support. Coordinated with class adviser for study plan.", counselor: "Counselor Perez" },

  { id: "cl-11", studentId: "sr-3", date: "2026-08-12", type: "Counseling Session", summary: "Bi-weekly individual counseling session. Ramon demonstrated improved awareness of his emotional triggers. No new incidents reported in the past three weeks.", actionTaken: "Positive reinforcement provided. Continued emotional regulation exercises. Next session scheduled August 26.", counselor: "Counselor Perez" },
  { id: "cl-12", studentId: "sr-3", date: "2026-07-29", type: "Counseling Session", summary: "Follow-up after restorative justice circle. Ramon expressed remorse and committed to the behavior agreement. Discussed healthy conflict resolution strategies.", actionTaken: "Began structured emotional regulation program (4 sessions). Provided journal for self-reflection.", counselor: "Counselor Perez" },
  { id: "cl-13", studentId: "sr-3", date: "2026-07-22", type: "Disciplinary Incident", summary: "Restorative justice circle conducted with Ramon, two affected Grade 7 students, and their class advisers. All parties shared their perspectives.", actionTaken: "Formal behavioral agreement signed by all parties. Ramon committed to zero verbal aggression policy. Follow-up in one week.", counselor: "Counselor Perez" },
  { id: "cl-14", studentId: "sr-3", date: "2026-07-08", type: "Disciplinary Incident", summary: "Second reported incident of verbal aggression toward Grade 7 students during lunch break. Witnesses confirmed intimidation behavior.", actionTaken: "Parent (Mr. Bondoc) called in for conference. Temporary lunch supervision assigned. Recommended individual counseling.", counselor: "Counselor Perez" },
  { id: "cl-15", studentId: "sr-3", date: "2026-06-18", type: "Disciplinary Incident", summary: "Reported by recess duty teacher for verbal bullying of a Grade 7 student. Incident involved name-calling and exclusion from a group activity.", actionTaken: "Verbal warning issued. Student counseled on anti-bullying policy. Incident documented.", counselor: "Counselor Perez" },
  { id: "cl-16", studentId: "sr-3", date: "2026-05-28", type: "Parent Conference", summary: "End-of-year parent conference for Grade 7. Mr. Bondoc raised concerns about Ramon's social difficulties and aggressive tendencies at home.", actionTaken: "Recommended continued monitoring into Grade 8. Noted for incoming guidance caseload.", counselor: "Counselor Reyes" }
];

const SEED_SYSTEM_ACCOUNTS: SystemAccount[] = [
  { id: "acc-1", name: "Ana R. Soriano", username: "ana.soriano@cis.edu.ph", role: "Teacher", status: "Active", lastLogin: "Today, 7:15 AM", departmentOrGrade: "Science" },
  { id: "acc-2", name: "Carlo D. Reyes", username: "carlo.reyes@cis.edu.ph", role: "Teacher", status: "Active", lastLogin: "Yesterday, 3:30 PM", departmentOrGrade: "Mathematics" },
  { id: "acc-3", name: "Maria Clara Santos", username: "maria.santos@cis.edu.ph", role: "Staff", status: "Locked", lastLogin: "July 15, 2026", departmentOrGrade: "Registrar" },
  { id: "acc-4", name: "Juan Dela Cruz", username: "juan.delacruz@cis.edu.ph", role: "Student", status: "Active", lastLogin: "Today, 8:00 AM", departmentOrGrade: "Grade 10" },
  { id: "acc-5", name: "Hannah Grace Espino", username: "hannah.espino@cis.edu.ph", role: "Student", status: "Pending", departmentOrGrade: "Grade 8" },
  { id: "acc-6", name: "Ramon Jr. Bondoc", username: "ramon.bondoc@cis.edu.ph", role: "Student", status: "Active", lastLogin: "2 days ago", departmentOrGrade: "Grade 8" },
];

export const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Reusable authorization helper.
 * Validates whether the current user is authorized to perform an action on a specific resource.
 * This must be used by all AppContext mutations to secure data layer writes.
 */
function assertAuthorized(currentUser: CurrentUser | null, targetId: string, resourceType: "profile" | "gradebook" | "assignment" | "announcement" | "document" | "class_roster") {
  if (!currentUser) throw new Error("Unauthorized: No active user session.");
  
  if (resourceType === "profile" && targetId !== currentUser.id) {
    if (currentUser.role !== "Admin" && currentUser.role !== "Principal") {
      throw new Error("Unauthorized: Cannot modify another user's profile.");
    }
  }

  if (resourceType === "announcement" && targetId === "All") {
    if (currentUser.role !== "Principal" && currentUser.role !== "Admin") {
      throw new Error("Unauthorized: Only Principals/Admins can publish school-wide announcements.");
    }
  }

  if (resourceType === "gradebook" || resourceType === "class_roster" || resourceType === "assignment") {
    if (currentUser.role !== "Teacher" && currentUser.role !== "Principal" && currentUser.role !== "Admin") {
      throw new Error(`Unauthorized: Cannot modify ${resourceType}.`);
    }
    // TODO: In a real backend, verify that targetId (classId/section) is explicitly assigned to currentUser.id via a teacher_classes bridge table.
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [excuseLetters, setExcuseLetters] = useState<ExcuseLetter[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [clinicVisitRecords, setClinicVisitRecords] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [gateAttendance, setGateAttendance] = useState<GateAttendance[]>([]);
  const [clinicReferrals, setClinicReferrals] = useState<ClinicReferral[]>([]);
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLog[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([]);
  const [teacherRankings, setTeacherRankings] = useState<TeacherRankingRecord[]>([]);
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeave[]>([]);
  const [enrollmentApplications, setEnrollmentApplications] = useState<Applicant[]>([]);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);

  const [studentRecords, setStudentRecords] = useState<any[]>([]);
  const [counselingLogs, setCounselingLogs] = useState<any[]>([]);
  const [systemAccounts, setSystemAccounts] = useState<any[]>([]);
  const deleteAccount = (id: string) => setSystemAccounts(prev => prev.filter(a => a.id !== id));
  const resetPassword = (id: string) => setSystemAccounts(prev => prev.map(a => a.id === id ? { ...a, status: "Active" } : a));

  useEffect(() => {
    async function initDB() {
      if (currentUser) {
        try {
          const meData = await apiClient.get<any>('/auth/me');
          setCurrentUser({
            id: meData.id,
            name: `${meData.firstName} ${meData.lastName}`,
            role: meData.roles[0],
            permissions: meData.permissions || [],
            rawRoles: meData.roles,
            studentProfile: meData.studentProfile
          });
        } catch (err: any) {
          setCurrentUser(null);
          localStorage.removeItem('currentUser');
          return;
        }
      }

      try {
        const [
          dbExcuses, dbEv, dbClinic, dbNurseVisits, dbBeh,
          dbAppt, dbDocReq, dbRank, dbEnrollments, dbNotifs, dbGateAtt,
          dbUsers, dbAnnouncements, dbLeaves
        ] = await Promise.all([
          apiClient.get('/attendance/excuses').catch(() => []),
          apiClient.get('/admin/events').catch(() => []),
          apiClient.get('/student-services/clinic').catch(() => []),
          Promise.resolve([]), // nurseVisits
          apiClient.get('/student-services/guidance').catch(() => []),
          apiClient.get('/student-services/appointments').catch(() => []),
          apiClient.get('/student-services/doc-requests').catch(() => []),
          Promise.resolve([]), // teacherRankings
          apiClient.get('/admin/enrollment-applications').catch((e) => {
            console.error("Failed to fetch enrollment applications", e);
            setEnrollmentError("Failed to fetch enrollment applications. Please check the backend connection.");
            return [];
          }),
          Promise.resolve([]), // notifications
          apiClient.get('/attendance/gate').catch(() => []),
          apiClient.get('/users').catch(() => []),
          apiClient.get('/admin/announcements').catch(() => []),
          apiClient.get('/admin/leaves').catch(() => [])
        ]);

        setExcuseLetters(dbExcuses as any);
        setEvents(dbEv as any);
        setClinicReferrals(dbClinic as any);
        setClinicVisitRecords(dbNurseVisits as any);
        setBehaviorLogs(dbBeh as any);
        setAppointments(dbAppt as any);
        setDocumentRequests(dbDocReq as any);
        console.log("DB LEAVES FETCHED:", dbLeaves);
        setTeacherRankings(dbRank as any);
        setTeacherLeaves(dbLeaves as any);
        setEnrollmentApplications(dbEnrollments as any);
        setNotifications(dbNotifs as any);
        setGateAttendance(dbGateAtt as any);
        
        // Filter users
        const users = dbUsers.map((u: any) => ({ ...u, name: `${u.first_name} ${u.last_name}` }));
        setStudents(users.filter(u => u.user_roles?.some((ur: any) => ur.role.name === 'Student')));
        setTeachers(users.filter(u => u.user_roles?.some((ur: any) => ur.role.name === 'Teacher')));
        setAnnouncements(dbAnnouncements as any);

        setIsLoaded(true);
      } catch (err: any) {
        console.error("Failed to fetch from backend API:", err);
      }
    }
    initDB();

    const handleConflict = () => {
      toast.error("Data was modified by another user. Refreshing...");
      initDB();
    };
    
    const handleUnauthorized = () => {
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
    };

    window.addEventListener("api_conflict", handleConflict as EventListener);
    window.addEventListener("api_unauthorized", handleUnauthorized as EventListener);
    return () => {
      window.removeEventListener("api_conflict", handleConflict as EventListener);
      window.removeEventListener("api_unauthorized", handleUnauthorized as EventListener);
    };
  }, [currentUser?.id]);

  // Sync currentUser to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  const addNotification = async (n: AppNotification) => {
    const saved = await apiClient.post("/admin/notifications", n);
    setNotifications(prev => [...prev, saved as any]);
  };

  const markNotificationsRead = async (recipientId: string) => {
    const unread = notifications.filter(n => n.recipientId === recipientId && !n.isRead);
    for (const n of unread) {
      await apiClient.patch("/admin/notifications/" + n.id, { ...n, isRead: true });
    }
    setNotifications(prev => prev.map(n => n.recipientId === recipientId ? { ...n, isRead: true } : n));
  };

  const updateExcuseLetter = async (id: string, status: ExcuseStatus, teacherNote?: string) => {
    const updates: Partial<ExcuseLetter> = { status, reviewedAt: new Date().toISOString() };
    if (teacherNote !== undefined) updates.teacherNote = teacherNote;
    await apiClient.patch("/admin/notifications/" + id, updates);
    setExcuseLetters(prev => prev.map(l => l.id === id ? { ...l, ...updates } as any as any : l));
  };
  
  const addExcuseLetter = async (letter: ExcuseLetter) => {
    const saved = await apiClient.post("/attendance/excuses", letter);
    setExcuseLetters(prev => [saved as any, ...prev]);
  };

  const getExcuseDocument = async (documentId: string): Promise<StoredDocument | undefined> => {
    if (!documentId) return undefined;
    return apiClient.get<any>('/documents/' + documentId).catch(() => undefined);
  };

  const saveExcuseDocument = async (doc: StoredDocument): Promise<StoredDocument> => {
    return apiClient.post('/documents', doc);
  };

  const deleteExcuseDocument = async (id: string): Promise<void> => {
    return apiClient.delete('/documents/' + id);
  };

  const getGenericDocument = async (documentId: string): Promise<StoredDocument | undefined> => {
    if (!documentId) return undefined;
    return apiClient.get<any>('/documents/' + documentId).catch(() => undefined);
  };

  const saveGenericDocument = async (doc: StoredDocument): Promise<StoredDocument> => {
    return apiClient.post('/documents', doc);
  };

  const updateCurrentUser = async (updates: Partial<CurrentUser>) => {
    if (!currentUser) return;
    assertAuthorized(currentUser, currentUser.id, "profile");
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
    // Persist to indexedDB if it's a known user
    try {
      await apiClient.patch("/admin/notifications/" + currentUser.id, updates);
    } catch (e) {
      console.warn("Failed to persist currentUser updates", e);
    }
  };

  const addTeacher = async (t: Omit<User, 'id'>) => {
    assertAuthorized(currentUser, "admin", "profile"); // basic check
    const saved = await apiClient.post("/users", t);
    setTeachers(prev => [...prev, saved as any]);
  };

  const addStudent = async (s: Omit<User, 'id'>) => {
    assertAuthorized(currentUser, s.section || "", "class_roster");
    const saved = await apiClient.post("/admin/notifications", s);
    setStudents(prev => [...prev, saved as any]);
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    // Basic check: if teacher, they can modify student records, else strictly profile
    if (currentUser?.role === 'Teacher') {
      assertAuthorized(currentUser, "", "class_roster"); // allowed via class_roster rule
    } else {
      assertAuthorized(currentUser, id, "profile");
    }
    const saved = await apiClient.patch("/users/" + id, updates);
    setStudents(prev => prev.map(u => u.id === id ? { ...u, ...updates } as any : u));
    setTeachers(prev => prev.map(u => u.id === id ? { ...u, ...updates } as any : u));
  };

  const addTeacherLeave = async (leave: TeacherLeave) => {
    const saved = await apiClient.post("/admin/leaves", leave);
    setTeacherLeaves(prev => [saved as any, ...prev]);
  };

  const updateTeacherLeave = async (id: string, status: "Pending"|"Approved"|"Rejected", approverNote?: string) => {
    await apiClient.patch("/admin/leaves/" + id, { status, approverNote });
    setTeacherLeaves(prev => prev.map(l => l.id === id ? { ...l, status, approverNote } : l));
  };

  const addAnnouncement = async (a: Announcement) => {
    const saved = await apiClient.post("/admin/announcements", a);
    setAnnouncements(prev => [saved as any, ...prev]);
  };

  const updateAssignment = async (id: string, updates: Partial<Assignment>) => {
    try {
      const assn = assignments.find(a => a.id === id);
      if (!assn) return;
      assertAuthorized(currentUser, assn.subject, "assignment");
      const updated = await apiClient.patch("/admin/notifications/" + id, { ...assn, ...updates });
      setAssignments(prev => prev.map(a => a.id === id ? updated as any : a));
    } catch(e) { console.error(e); }
  };

  const addAssignmentSubmission = async (s: AssignmentSubmission) => {
    // Only students submit, and they only submit for themselves
    if (currentUser?.role === "Student") {
      assertAuthorized(currentUser, s.studentId, "profile"); // ensure they are themselves
    }
    const saved = await apiClient.post("/admin/notifications", s);
    setAssignmentSubmissions(prev => [saved as any, ...prev]);
  };

  const updateAssignmentSubmission = async (id: string, updates: Partial<AssignmentSubmission>) => {
    try {
      const sub = assignmentSubmissions.find(s => s.id === id);
      if (!sub) return;
      
      // If teacher is grading, they must be authorized
      if (updates.grade !== undefined) {
        assertAuthorized(currentUser, "", "gradebook");
      }

      const updated = await apiClient.patch("/admin/notifications/" + id, { ...sub, ...updates });
      setAssignmentSubmissions(prev => prev.map(s => s.id === id ? updated as any : s));
    } catch(e) { console.error(e); }
  };

  const addAssignment = async (a: Assignment) => {
    assertAuthorized(currentUser, a.subject, "assignment"); // subject represents class context
    const saved = await apiClient.post("/admin/notifications", a);
    setAssignments(prev => [saved as any, ...prev]);
  };

  const addEvent = async (e: CalendarEvent) => {
    const saved = await apiClient.post("/admin/events", e);
    setEvents(prev => [...prev, saved as any]);
  };

  const addGateAttendance = async (log: GateAttendance) => {
    setGateAttendance(prev => [log, ...prev]);
    await apiClient.post("/admin/notifications", log);
  };

  const updateGateAttendance = async (id: string, updates: Partial<GateAttendance>) => {
    setGateAttendance(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    await apiClient.patch("/attendance/gate/" + id, updates);
  };

  const editEvent = async (id: string, data: Partial<CalendarEvent>) => {
    await apiClient.patch("/admin/events/" + id, data);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };

  const deleteEvent = async (id: string) => {
    await apiClient.delete("/mock/" + id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const addClinicReferral = async (ref: ClinicReferral) => {
    const saved = await apiClient.post("/student-services/clinic", ref);
    setClinicReferrals(prev => [saved as any, ...prev]);
  };

  const addClinicVisitRecord = async (v: any) => {
    const saved = await apiClient.post("/student-services/clinic", v);
    setClinicVisitRecords(prev => [saved as any, ...prev]);
  };

  const resolveClinicReferral = async (id: string) => {
    await apiClient.patch("/student-services/clinic/" + id, { status: "Acknowledged" });
    setClinicReferrals(prev => prev.map(r => r.id === id ? { ...r, status: "Acknowledged" } : r));
  };

  const addBehaviorLog = async (log: BehaviorLog) => {
    const saved = await apiClient.post("/student-services/guidance", log);
    setBehaviorLogs(prev => [saved as any, ...prev]);
  };

  const updateBehaviorLog = async (id: string, updates: Partial<BehaviorLog>) => {
    await apiClient.patch("/admin/notifications/" + id, updates);
    setBehaviorLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } as any as any : l));
  };

  const addAppointment = async (appt: Appointment) => {
    const saved = await apiClient.post("/student-services/appointments", appt);
    setAppointments(prev => [saved as any, ...prev]);
  };

  const updateAppointment = async (id: string, status: AppointmentStatus) => {
    await apiClient.patch("/student-services/appointments/" + id, { status });
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const addDocumentRequest = async (req: DocumentRequest) => {
    const saved = await apiClient.post("/student-services/doc-requests", req);
    setDocumentRequests(prev => [saved as any, ...prev]);
  };

  const updateDocumentRequest = async (id: string, updates: Partial<DocumentRequest>) => {
    await apiClient.patch("/documents/requests/" + id, updates);
    setDocumentRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };
  
  const addTeacherRanking = async (record: TeacherRankingRecord) => {
    const saved = await apiClient.post("/users/rankings", record);
    setTeacherRankings(prev => [saved as any, ...prev]);
  };

  const updateTeacherRanking = async (id: string, updates: Partial<TeacherRankingRecord>) => {
    await apiClient.patch("/admin/notifications/" + id, updates);
    setTeacherRankings(prev => prev.map(r => r.id === id ? { ...r, ...updates } as any : r));
  };

  const addEnrollmentApplication = async (app: Applicant) => {
    const saved = await apiClient.post("/admin/enrollment-applications", app);
    setEnrollmentApplications(prev => [saved as any, ...prev]);
  };

  const updateEnrollmentApplication = async (id: string, updates: Partial<Applicant>) => {
    await apiClient.patch("/admin/notifications/" + id, updates);
    setEnrollmentApplications(prev => prev.map(a => a.id === id ? { ...a, ...updates } as any : a));
  };

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100vw", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", background: "#f8fafc", color: "#64748b" }}>
        Loading Secure Environment...
      </div>
    );
  }

  const addCounselingLog = (log: CounselingLog) => {
    setCounselingLogs(prev => [log, ...prev]);
  };

  return (
    <AppContext.Provider value={{
      students, teachers, addTeacher, addStudent, updateUser,
      isAuthChecking, setIsAuthChecking,
      currentUser, setCurrentUser, updateCurrentUser,
      excuseLetters, updateExcuseLetter, addExcuseLetter,
      getExcuseDocument, saveExcuseDocument, deleteExcuseDocument,
      getGenericDocument, saveGenericDocument,
      announcements, addAnnouncement,
      assignments, addAssignment, updateAssignment,
      assignmentSubmissions, addAssignmentSubmission, updateAssignmentSubmission,
      notifications, addNotification, markNotificationsRead,
      events, addEvent, editEvent, deleteEvent,
      messages, addMessage,
      gateAttendance, addGateAttendance, updateGateAttendance,
      clinicReferrals, addClinicReferral, resolveClinicReferral,
      behaviorLogs, addBehaviorLog, updateBehaviorLog,

      appointments, addAppointment, updateAppointment,
      documentRequests, addDocumentRequest, updateDocumentRequest,
      studentRecords, counselingLogs, addCounselingLog,
      systemAccounts, deleteAccount, resetPassword,
      teacherRankings, addTeacherRanking, updateTeacherRanking,
      teacherLeaves, addTeacherLeave, updateTeacherLeave,
      clinicVisitRecords, addClinicVisitRecord,
      enrollmentApplications,
      enrollmentError,
      addEnrollmentApplication, updateEnrollmentApplication
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
