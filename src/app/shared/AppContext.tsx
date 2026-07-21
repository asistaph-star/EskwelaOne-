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

  // Appointments
  parentEmail: string;
  setParentEmail: (email: string) => void;
  appointments: Appointment[];
  addAppointment: (appt: Appointment) => void;
  updateAppointment: (id: string, status: AppointmentStatus) => void;

  // Document Requests
  documentRequests: DocumentRequest[];
  addDocumentRequest: (req: DocumentRequest) => void;
  updateDocumentRequest: (id: string, updates: Partial<DocumentRequest>) => void;
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
const AppContext = createContext<AppContextType | undefined>(undefined);

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

  return (
    <AppContext.Provider value={{
      gradesStatus, setGradeStatus,
      excuseLetters, updateExcuseLetter, addExcuseLetter,
      announcements, addAnnouncement,
      events, addEvent, editEvent, deleteEvent,
      messages, addMessage,
      gateAttendance,
      clinicReferrals, addClinicReferral, resolveClinicReferral,
      behaviorLogs, addBehaviorLog,
      parentEmail, setParentEmail,
      appointments, addAppointment, updateAppointment,
      documentRequests, addDocumentRequest, updateDocumentRequest
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
