import React, { createContext, useContext, useState } from "react";
import { SCHOOL_EVENTS, TEACHER_PERSONAL_EVENTS, CalendarEvent } from "./data/calendarData";

// --- Types --
export type GradeStatus = "Draft" | "Submitted" | "Published" | "Returned";
export type ExcuseStatus = "Pending Review" | "Approved" | "Rejected";
export type Message = { id: string; senderId: string; senderName: string; receiverId?: string; receiverName?: string; text?: string; content?: string; timestamp: string; isAI?: boolean; read?: boolean; };
export type Announcement = { id: string; author: string; title: string; body: string; audience: string; timestamp: string };
export type ExcuseLetter = { id: string; studentName: string; section: string; dates: string; filename: string; submittedDate: string; status: ExcuseStatus; reason?: string };
export type GateAttendance = { studentName: string; time: string };
export type ClinicReferral = { id: string; studentName: string; teacherName: string; reason: string; timestamp: string; status: "Pending" | "Acknowledged" };
export type BehaviorLog = { id: string; studentName: string; section: string; type: string; date: string; status: string; note: string };
export type AppointmentStatus = "Pending" | "Confirmed" | "Declined" | "Completed";
export type AppointmentDirection = "parent-to-teacher" | "teacher-to-parent";
export type Appointment = {
  id: string;
  studentName: string;
  parentEmail: string;
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
  studentName: string;
  section: string;
  documentType: string;
  purpose: string;
  status: DocRequestStatus;
  currentStage: number; // 1=Submitted, 2=Teacher Approved, 3=Principal Approved, 4=Ready for Pickup
  submittedDate: string;
  teacherName: string;
  teacherApprovedDate?: string;
  teacherRemarks?: string;
  principalApprovedDate?: string;
  principalRemarks?: string;
  readyDate?: string; // estimated pickup date
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
  // Grades
  gradesStatus: Record<string, GradeStatus>; // key: "section-quarter", e.g., "Gr10-Rizal-Q1"
  setGradeStatus: (key: string, status: GradeStatus) => void;
  
  // Excuse Letters
  excuseLetters: ExcuseLetter[];
  updateExcuseLetter: (id: string, status: ExcuseStatus, reason?: string) => void;
  addExcuseLetter: (letter: ExcuseLetter) => void;

  // Announcements
  announcements: Announcement[];
  addAnnouncement: (a: Announcement) => void;

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
  clinicReferrals: ClinicReferral[];
  addClinicReferral: (ref: ClinicReferral) => void;
  resolveClinicReferral: (id: string) => void;

  behaviorLogs: BehaviorLog[];
  addBehaviorLog: (log: BehaviorLog) => void;
  updateBehaviorLog: (id: string, updates: Partial<BehaviorLog>) => void;

  // Appointments
  parentEmail: string;
  setParentEmail: (email: string) => void;
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
};

// --- Seed Data --
const SEED_GRADES_STATUS: Record<string, GradeStatus> = {
  "Gr10-Rizal-Q1": "Published",
  "Gr10-Rizal-Q2": "Submitted", // Sitting in Principal's queue
  "Gr10-Rizal-Q3": "Draft",
};

const SEED_EXCUSE_LETTERS: ExcuseLetter[] = [
  { id: "exc-1", studentName: "Juan Dela Cruz", section: "Grade 10 - Rizal", dates: "July 12, 2026", filename: "Medical_Cert_DelaCruz.pdf", submittedDate: "July 13, 2026", status: "Approved" },
  { id: "exc-2", studentName: "Juan Dela Cruz", section: "Grade 10 - Rizal", dates: "July 20, 2026", filename: "Letter_Parents.pdf", submittedDate: "July 21, 2026", status: "Pending Review" }, // Sitting in Teacher's queue
];

const SEED_ANNOUNCEMENTS: Announcement[] = [
  { id: "ann-1", author: "Dr. Roberto Santos (Principal)", title: "Quarter 1 Grading Period Deadline", body: "Please be reminded that all Q1 grades must be submitted for review by the end of this week. Thank you.", audience: "Teachers", timestamp: "Today, 8:00 AM" },
  { id: "ann-2", author: "Dr. Roberto Santos (Principal)", title: "Suspension of Afternoon Classes", body: "Due to heavy rainfall and flooding warnings, all afternoon classes are suspended today. Please stay safe.", audience: "All", timestamp: "Yesterday, 11:30 AM" },
];

const SEED_MESSAGES: Message[] = [
  { id: "msg-1", senderId: "s-juan", senderName: "Juan Dela Cruz", receiverId: "t-ana", receiverName: "Ana R. Soriano", content: "Good morning Ma'am Ana, I would like to ask about the deadline for our Q1 Project?", text: "Good morning Ma'am Ana, I would like to ask about the deadline for our Q1 Project?", timestamp: "Yesterday, 9:00 AM", read: true },
  { id: "msg-2", senderId: "t-ana", senderName: "Ana R. Soriano", receiverId: "s-juan", receiverName: "Juan Dela Cruz", content: "Hi Juan, the deadline is extended until next Wednesday. Make sure to complete the rubric.", text: "Hi Juan, the deadline is extended until next Wednesday. Make sure to complete the rubric.", timestamp: "Yesterday, 10:15 AM", read: true },
  { id: "msg-3", senderId: "s-juan", senderName: "Juan Dela Cruz", receiverId: "t-ana", receiverName: "Ana R. Soriano", content: "Thank you so much Ma'am! I'll submit it on Monday.", text: "Thank you so much Ma'am! I'll submit it on Monday.", timestamp: "Yesterday, 10:20 AM", read: true },
  { id: "msg-4", senderId: "p-roberto", senderName: "Dr. Roberto Santos", receiverId: "t-ana", receiverName: "Ana R. Soriano", content: "Hi Ana, please review the Q1 grades for Grade 10 - Rizal. I've sent back a few for recalibration.", text: "Hi Ana, please review the Q1 grades for Grade 10 - Rizal. I've sent back a few for recalibration.", timestamp: "Today, 8:15 AM", read: true },
  { id: "msg-5", senderId: "t-ana", senderName: "Ana R. Soriano", receiverId: "p-roberto", receiverName: "Dr. Roberto Santos", content: "Noted, Dr. Santos. I'm reviewing them now and will resubmit by noon.", text: "Noted, Dr. Santos. I'm reviewing them now and will resubmit by noon.", timestamp: "Today, 8:40 AM", read: true },
];

const SEED_GATE_ATTENDANCE: GateAttendance[] = [
  { studentName: "Juan Dela Cruz", time: "7:14 AM" } // Scanned in
];

const SEED_CLINIC_REFERRALS: ClinicReferral[] = [
  { id: "ref-1", studentName: "Trisha Ann Cruz", teacherName: "Ana R. Soriano", reason: "Severe headache and fever symptoms", timestamp: "Today, 9:45 AM", status: "Pending" }
];

const SEED_BEHAVIOR_LOGS: BehaviorLog[] = [
  { id: "log-1", studentName: "Juan Dela Cruz", section: "Grade 10 - Rizal", type: "Misconduct", date: "Today", status: "Under investigation", note: "Using mobile phone during lecture despite multiple warnings." },
  { id: "log-2", studentName: "Juan Dela Cruz", section: "Grade 10 - Rizal", type: "Disruption", date: "Yesterday", status: "Parent notified", note: "Consistently disruptive during group activities." }
];

const SEED_APPOINTMENTS: Appointment[] = [
  { id: "appt-1", studentName: "Juan Miguel Santos", parentEmail: "maria.santos@email.com", teacherName: "Ana R. Soriano", date: "July 25, 2026", time: "10:00 AM", purpose: "Discuss quarterly academic performance and study habits improvement plan.", status: "Confirmed", direction: "parent-to-teacher", createdAt: "July 18, 2026" },
  { id: "appt-2", studentName: "Juan Miguel Santos", parentEmail: "maria.santos@email.com", teacherName: "Carlo D. Reyes", date: "July 28, 2026", time: "2:00 PM", purpose: "Discuss Mathematics tutoring recommendations and supplementary materials.", status: "Pending", direction: "teacher-to-parent", createdAt: "July 20, 2026" },
];

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [gradesStatus, setGradesStatus] = useState<Record<string, GradeStatus>>(SEED_GRADES_STATUS);
  const [excuseLetters, setExcuseLetters] = useState<ExcuseLetter[]>(SEED_EXCUSE_LETTERS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(SEED_ANNOUNCEMENTS);
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES);
  const [gateAttendance, setGateAttendance] = useState<GateAttendance[]>(SEED_GATE_ATTENDANCE);
  const [clinicReferrals, setClinicReferrals] = useState<ClinicReferral[]>(SEED_CLINIC_REFERRALS);
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLog[]>(SEED_BEHAVIOR_LOGS);
  const [events, setEvents] = useState<CalendarEvent[]>([...SCHOOL_EVENTS, ...TEACHER_PERSONAL_EVENTS]);
  const [parentEmail, setParentEmail] = useState<string>("maria.santos@email.com");
  const [appointments, setAppointments] = useState<Appointment[]>(SEED_APPOINTMENTS);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>(SEED_DOCUMENT_REQUESTS);
  const [systemAccounts, setSystemAccounts] = useState<SystemAccount[]>(SEED_SYSTEM_ACCOUNTS);

  const deleteAccount = (id: string) => {
    setSystemAccounts(prev => prev.filter(a => a.id !== id));
  };

  const resetPassword = (id: string) => {
    // In a real app, this would make an API call to reset the password.
    // Here we might just unlock the account if it was locked.
    setSystemAccounts(prev => prev.map(a => 
      a.id === id ? { ...a, status: "Active" } : a
    ));
  };
  const [studentRecords] = useState<StudentRecord[]>(SEED_STUDENT_RECORDS);
  const [counselingLogs, setCounselingLogs] = useState<CounselingLog[]>(SEED_COUNSELING_LOGS);

  const setGradeStatus = (key: string, status: GradeStatus) => {
    setGradesStatus(prev => ({ ...prev, [key]: status }));
  };

  const updateExcuseLetter = (id: string, status: ExcuseStatus, reason?: string) => {
    setExcuseLetters(prev => prev.map(l => l.id === id ? { ...l, status, reason } : l));
  };
  
  const addExcuseLetter = (letter: ExcuseLetter) => {
    setExcuseLetters(prev => [letter, ...prev]);
  };

  const addAnnouncement = (a: Announcement) => {
    setAnnouncements(prev => [a, ...prev]);
  };

  const addEvent = (e: CalendarEvent) => {
    setEvents(prev => [...prev, e]);
  };

  const editEvent = (id: string, data: Partial<CalendarEvent>) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const addClinicReferral = (ref: ClinicReferral) => {
    setClinicReferrals(prev => [ref, ...prev]);
  };

  const resolveClinicReferral = (id: string) => {
    setClinicReferrals(prev => prev.map(r => r.id === id ? { ...r, status: "Acknowledged" } : r));
  };

  const addBehaviorLog = (log: BehaviorLog) => {
    setBehaviorLogs(prev => [log, ...prev]);
  };

  const updateBehaviorLog = (id: string, updates: Partial<BehaviorLog>) => {
    setBehaviorLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const addAppointment = (appt: Appointment) => {
    setAppointments(prev => [appt, ...prev]);
  };

  const updateAppointment = (id: string, status: AppointmentStatus) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const addDocumentRequest = (req: DocumentRequest) => {
    setDocumentRequests(prev => [req, ...prev]);
  };

  const updateDocumentRequest = (id: string, updates: Partial<DocumentRequest>) => {
    setDocumentRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const addCounselingLog = (log: CounselingLog) => {
    setCounselingLogs(prev => [log, ...prev]);
  };

  return (
    <AppContext.Provider value={{
      gradesStatus, setGradeStatus,
      excuseLetters, updateExcuseLetter, addExcuseLetter,
      announcements, addAnnouncement,
      events, addEvent, editEvent, deleteEvent,
      messages, addMessage,
      gateAttendance,
      clinicReferrals, addClinicReferral, resolveClinicReferral,
      behaviorLogs, addBehaviorLog, updateBehaviorLog,
      parentEmail, setParentEmail,
      appointments, addAppointment, updateAppointment,
      documentRequests, addDocumentRequest, updateDocumentRequest,
      studentRecords, counselingLogs, addCounselingLog,
      systemAccounts, deleteAccount, resetPassword
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
