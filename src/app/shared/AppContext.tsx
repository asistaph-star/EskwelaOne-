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
  schoolId?: string;
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
  mustChangePassword?: boolean;
}
export type Message = { id: string; senderId: string; senderName: string; receiverId?: string; receiverName?: string; text?: string; content?: string; timestamp: string; isAI?: boolean; read?: boolean; };
export type Announcement = { id: string; author: string; title: string; body: string; audience: string; timestamp: string };
export type AppNotification = { id: string; recipientId: string; title: string; body: string; timestamp: string; isRead: boolean; iconType: "alert" | "megaphone" | "calendar" | "document" };
export type GateAttendance = { id: string; studentId: string; date: string; timeIn: string; timeOut: string; status: string; studentName?: string; time?: string; };

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

  // Document Requests
  // System Accounts (IT Admin)
  systemAccounts: SystemAccount[];
  deleteAccount: (id: string) => void;
  resetPassword: (id: string) => void;
  
  // Teacher Ranking
  // Enrollments
};

// --- Seed Data --





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
  const [systemAccounts, setSystemAccounts] = useState<any[]>([]);
  const deleteAccount = (id: string) => setSystemAccounts(prev => prev.filter(a => a.id !== id));
  const resetPassword = (id: string) => setSystemAccounts(prev => prev.map(a => a.id === id ? { ...a, status: "Active" } : a));

  useEffect(() => {
    async function initDB() {
      if (!currentUser) {
        setIsLoaded(true);
        return;
      }
      
      let perms: string[] = [];
      try {
          const meData = await apiClient.get<any>('/auth/me');
          perms = meData.permissions || [];
          setCurrentUser({
            id: meData.id,
            name: `${meData.firstName} ${meData.lastName}`,
            role: meData.roles?.[0] || '',
            permissions: meData.permissions || [],
            rawRoles: meData.roles,
            studentProfile: meData.studentProfile,
            mustChangePassword: !!meData.mustChangePassword,
          });
        } catch (err: any) {
          setCurrentUser(null);
          localStorage.removeItem('currentUser');
          return;
        }

      try {
        const [
           dbRank, dbNotifs, dbGateAtt,
          dbUsers, dbAnnouncements
        ] = await Promise.all([
          Promise.resolve([]), // teacherRankings
          apiClient.get('/admin/notifications').catch(() => []),
          perms.includes('attendance:read') ? apiClient.get('/attendance/gate').catch(() => []) : Promise.resolve([]),
          perms.includes('user:read') ? apiClient.get('/users').catch(() => []) : Promise.resolve([]),
          apiClient.get('/admin/announcements').catch(() => [])
        ]);
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

  if (!isLoaded) {
    return (
      <div key="loading-secure-env" style={{ display: "flex", height: "100vh", width: "100vw", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", background: "#f8fafc", color: "#64748b" }}>
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
