import React, { createContext, useContext, useState } from "react";

// --- Types ---
export type GradeStatus = "Draft" | "Submitted" | "Published" | "Returned";
export type ExcuseStatus = "Pending Review" | "Approved" | "Rejected";
export type Message = { id: string; senderId: string; senderName: string; receiverId?: string; receiverName?: string; text?: string; content?: string; timestamp: string; isAI?: boolean; read?: boolean; };
export type Announcement = { id: string; author: string; title: string; body: string; audience: string; timestamp: string };
export type ExcuseLetter = { id: string; studentName: string; section: string; dates: string; filename: string; submittedDate: string; status: ExcuseStatus; reason?: string };
export type GateAttendance = { studentName: string; time: string };
export type ClinicReferral = { id: string; studentName: string; teacherName: string; reason: string; timestamp: string; status: "Pending" | "Acknowledged" };
export type BehaviorLog = { id: string; studentName: string; section: string; type: string; date: string; status: string; note: string };

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
};

// --- Seed Data ---
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


const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [gradesStatus, setGradesStatus] = useState<Record<string, GradeStatus>>(SEED_GRADES_STATUS);
  const [excuseLetters, setExcuseLetters] = useState<ExcuseLetter[]>(SEED_EXCUSE_LETTERS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(SEED_ANNOUNCEMENTS);
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES);
  const [gateAttendance, setGateAttendance] = useState<GateAttendance[]>(SEED_GATE_ATTENDANCE);
  const [clinicReferrals, setClinicReferrals] = useState<ClinicReferral[]>(SEED_CLINIC_REFERRALS);
  const [behaviorLogs, setBehaviorLogs] = useState<BehaviorLog[]>(SEED_BEHAVIOR_LOGS);

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

  return (
    <AppContext.Provider value={{
      gradesStatus, setGradeStatus,
      excuseLetters, updateExcuseLetter, addExcuseLetter,
      announcements, addAnnouncement,
      messages, addMessage,
      gateAttendance,
      clinicReferrals, addClinicReferral, resolveClinicReferral,
      behaviorLogs, addBehaviorLog
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
