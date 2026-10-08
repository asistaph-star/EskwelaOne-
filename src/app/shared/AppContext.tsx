import React, { createContext, useContext, useState, useEffect } from "react";
export type StoredDocument = { id: string; [key: string]: any };
import { SCHOOL_EVENTS, TEACHER_PERSONAL_EVENTS, CalendarEvent } from "./data/calendarData";
import { TeacherRankingRecord, TermKey, TermData } from "./types";
import { apiClient } from "../../api/client";
import { toast } from "sonner";

// --- Types --
export type User = { id: string; name: string; role: string; section?: string; photoDocId?: string; parentEmail?: string; smsAlerts?: boolean; emailAlerts?: boolean; };
export type GradeStatus = "Draft" | "Submitted" | "Published" | "Returned";

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
export type AppNotification = { id: string; recipientId: string; title: string; body: string; timestamp: string; isRead: boolean; iconType: "alert" | "megaphone" | "calendar" | "document" };
export type GateAttendance = { id: string; studentId: string; date: string; timeIn: string; timeOut: string; status: string; studentName?: string; time?: string; };
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

  // Generic Documents (Profile Photos, etc)
  getGenericDocument: (documentId: string) => Promise<StoredDocument | undefined>;
  saveGenericDocument: (doc: StoredDocument) => Promise<StoredDocument>;

  // Teacher Leaves
  students: User[];
  teachers: User[];
  addTeacher: (t: Omit<User, 'id'>) => Promise<void>;
  addStudent: (s: Omit<User, 'id'>) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;

  // Announcements
  announcements: Announcement[];
  addAnnouncement: (a: Announcement) => void;

  // Assignments

  // Notifications
  notifications: AppNotification[];
  addNotification: (n: AppNotification | string, type?: "success"|"error"|"info") => void;
  markNotificationsRead: (recipientId: string) => void;
  markSingleNotificationRead: (id: string) => void;

  // Events

  // Messages
  messages: Message[];
  addMessage: (msg: Message) => void;

  // Cross-checks
  gateAttendance: GateAttendance[];
  invalidScans: any[];
  addInvalidScan: (barcode: string, time?: string) => void;
  refreshGateAttendance: () => Promise<void>;
  addGateAttendance: (log: GateAttendance) => void;
  updateGateAttendance: (id: string, updates: Partial<GateAttendance>) => void;

  // Nurse Visit Records (persisted)

  // Student Records (Guidance)
  studentRecords: StudentRecord[];

  // Document Requests
  documentRequests: DocumentRequest[];
  addDocumentRequest: (req: DocumentRequest) => void;
  updateDocumentRequest: (id: string, updates: Partial<DocumentRequest>) => void;
  // System Accounts (IT Admin)
  systemAccounts: SystemAccount[];
  deleteAccount: (id: string) => void;
  resetPassword: (id: string) => void;
  
  // Teacher Ranking
  // Enrollments
};

// --- Seed Data --

const SEED_DOCUMENT_REQUESTS: DocumentRequest[] = [
  { id: "doc-1", studentId: "s1", studentName: "Juan Miguel Santos", section: "Grade 10 - Pilot", documentType: "Certificate of Good Moral", purpose: "Required for college application at University of the Philippines.", status: "Principal Approved", currentStage: 3, submittedDate: "July 10, 2026", teacherName: "Ana R. Soriano", teacherApprovedDate: "July 11, 2026", teacherRemarks: "Student has exemplary conduct. Recommended for approval.", principalApprovedDate: "July 14, 2026", principalRemarks: "Approved. Document will be ready by July 18.", readyDate: "July 18, 2026" },
  { id: "doc-2", studentId: "s2", studentName: "Juan Miguel Santos", section: "Grade 10 - Pilot", documentType: "Form 137 (Permanent Record)", purpose: "Transfer credentials for senior high school enrollment.", status: "Teacher Approved", currentStage: 2, submittedDate: "July 18, 2026", teacherName: "Ana R. Soriano", teacherApprovedDate: "July 19, 2026", teacherRemarks: "Records verified. Forwarding to principal for final approval." },
  { id: "doc-3", studentId: "s3", studentName: "Trisha Ann Cruz", section: "Grade 10 - Pilot", documentType: "Certificate of Enrollment", purpose: "Needed for scholarship application.", status: "Submitted", currentStage: 1, submittedDate: "July 20, 2026", teacherName: "Ana R. Soriano" },
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
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [gateAttendance, setGateAttendance] = useState<GateAttendance[]>([]);
  const [invalidScans, setInvalidScans] = useState<any[]>([]);

  const addInvalidScan = (barcode: string, time?: string) => setInvalidScans(prev => [{ barcode, time }, ...prev]);
  const refreshGateAttendance = async () => {
    try {
      const res = await apiClient.get("/attendance/gate");
      setGateAttendance(res as any);
    } catch (e) {}
  };
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([]);

  const [studentRecords, setStudentRecords] = useState<any[]>([]);
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
          dbDocReq, dbRank, dbNotifs, dbGateAtt,
          dbUsers, dbAnnouncements
        ] = await Promise.all([
          apiClient.get('/student-services/doc-requests').catch(() => []),
          Promise.resolve([]), // teacherRankings
          apiClient.get('/admin/notifications').catch(() => []),
          apiClient.get('/attendance/gate').catch(() => []),
          apiClient.get('/users').catch(() => []),
          apiClient.get('/admin/announcements').catch(() => [])
        ]);
        setDocumentRequests(dbDocReq as any);
        setNotifications(dbNotifs as any);
        setGateAttendance(dbGateAtt as any);
        
        // Filter users
        const users = (dbUsers as any[]).map((u: any) => ({ ...u, name: `${u.first_name} ${u.last_name}` }));
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

  const addNotification = async (n: AppNotification | string, type?: "success"|"error"|"info") => {
    let notif: AppNotification;
    if (typeof n === 'string') {
      notif = {
        id: `local-${Date.now()}`,
        recipientId: currentUser?.id || "",
        title: type === 'error' ? 'Error' : 'Notification',
        body: n as string,
        iconType: type === 'error' ? 'alert' : 'megaphone',
        isRead: false,
        timestamp: new Date().toISOString()
      };
    } else {
      notif = n;
    }
    setNotifications(prev => [notif, ...prev]);
    try {
      await apiClient.post("/admin/notifications", notif);
    } catch (e) {
      console.warn("Failed to sync notification to DB");
    }
  };


    const markSingleNotificationRead = async (id: string) => {
    const n = notifications.find(n => n.id === id);
    if (!n || n.isRead) return;
    await apiClient.patch("/admin/notifications/" + id, { ...n, isRead: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markNotificationsRead = async (recipientId: string) => {
    const unread = notifications.filter(n => n.recipientId === recipientId && !n.isRead);
    for (const n of unread) {
      await apiClient.patch("/admin/notifications/" + n.id, { ...n, isRead: true });
    }
    setNotifications(prev => prev.map(n => n.recipientId === recipientId ? { ...n, isRead: true } : n));
  };

  const getExcuseDocument = async (documentId: string): Promise<StoredDocument | undefined> => {
    if (!documentId) return undefined;
    return apiClient.get<any>('/documents/' + documentId).catch(() => undefined);
  };

  const saveExcuseDocument = async (doc: StoredDocument): Promise<StoredDocument> => {
    return apiClient.post('/documents', doc);
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
      await apiClient.patch("/users/" + currentUser.id, updates);
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
    const saved = await apiClient.post("/users", s);
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

  const addAnnouncement = async (a: Announcement) => {
    const saved = await apiClient.post("/admin/announcements", a);
    setAnnouncements(prev => [saved as any, ...prev]);
  };

  const addGateAttendance = async (log: GateAttendance) => {
    setGateAttendance(prev => [log, ...prev]);
    await apiClient.post("/attendance/gate", log);
  };

  const updateGateAttendance = async (id: string, updates: Partial<GateAttendance>) => {
    setGateAttendance(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    await apiClient.patch("/attendance/gate/" + id, updates);
  };

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const addDocumentRequest = async (req: DocumentRequest) => {
    const saved = await apiClient.post("/student-services/doc-requests", req);
    setDocumentRequests(prev => [saved as any, ...prev]);
  };

  const updateDocumentRequest = async (id: string, updates: Partial<DocumentRequest>) => {
    await apiClient.patch("/documents/requests/" + id, updates);
    setDocumentRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };;;

  if (!isLoaded) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100vw", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", background: "#f8fafc", color: "#64748b" }}>
        Loading Secure Environment...
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      students, teachers, addTeacher, addStudent, updateUser,
      isAuthChecking, setIsAuthChecking,
      currentUser, setCurrentUser, updateCurrentUser,
      
      getGenericDocument, saveGenericDocument,
      announcements, addAnnouncement,
      
      
      notifications, addNotification, markNotificationsRead, markSingleNotificationRead,
      
      messages, addMessage,
      gateAttendance, addGateAttendance, updateGateAttendance, invalidScans, addInvalidScan, refreshGateAttendance,
      
      

      
      documentRequests, addDocumentRequest, updateDocumentRequest,
      studentRecords, 
      systemAccounts, deleteAccount, resetPassword,
        
      
      
      
      
      
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
