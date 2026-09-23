import React, { useState, useMemo, useRef, useEffect } from 'react';
import { studentApi } from '../../api/student.api';
import { usersApi } from '../../api/users.api';
import { academicApi } from '../../api/academic.api';
import { C } from '../shared/constants/tokens';
import { StudentReportCard } from './components/StudentReportCard';
import {
  getStudentSubjectGrades,
  getStudentFullAcademicHistory,
  getStudentGradeTrend,
  getStudentRecentQuizzes,
  getStudentRankAndStanding
} from '../shared/utils/gradesService';
import { generateReportCardPDF } from '../shared/utils/pdfGenerator';
import { NotificationDropdown } from '../shared/components/NotificationDropdown';
import { MobileDrawer } from '../shared/components/MobileDrawer';
import { Form138PDFDocument } from './components/Form138PDFDocument';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import {
  LogOut, BookOpen, Calendar, Award, BookMarked, Printer, Download,
  LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope
} from 'lucide-react';
import type { AppointmentStatus } from '../shared/AppContext';
import { Stamp } from '../shared/components/Stamp';
import { StatBox } from '../shared/components/StatBox';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { SCHOOL_EVENTS, CLASS_SCHEDULE, SUBJECT_COLORS, CalendarEvent } from '../shared/data/calendarData';
import { useAppContext } from '../shared/AppContext';
import { useHashRouter } from '../shared/utils/useHashRouter';
import { StoredDocument } from '../shared/AppContext';
import { DOCUMENT_REQUIREMENTS } from '../shared/constants/documentRequirements';

const STUDENT_NAV_GROUPS = [
  {
    title: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "calendar", label: "Calendar", icon: Calendar }
    ]
  },
  {
    title: "Services",
    items: [
      { id: "clinic", label: "Clinic & Health", icon: Stethoscope },
      { id: "doc-requests", label: "Request Documents", icon: FileText }
    ]
  },
  {
    title: "Academics",
    items: [
      { id: "academics", label: "Grades", icon: BookOpen },
      { id: "attendance", label: "Attendance", icon: Calendar },
      { id: "assignments", label: "Assignments", icon: ClipboardList },
      ]
  },
  {
    title: "Communication",
    items: [
      { id: "announcements", label: "Announcements", icon: Bell },
      { id: "appointments", label: "Book Appointment", icon: CalendarCheck },
      ]
  }
];

const STUDENT_TAB_METADATA: Record<string, { title: string; sub: string }> = {
  dashboard: { title: "Student Portal", sub: "Overview & Quick Actions" },
  academics: { title: "Grades & Performance", sub: "Scholastic History & Grades" },
  attendance: { title: "Gate Attendance", sub: "Daily Logs & excuse submissions" },
  assignments: { title: "My Assignments", sub: "Tasks & Submissions" },
  announcements: { title: "Announcements", sub: "School Bulletin Board" },
  calendar: { title: "Calendar & Schedule", sub: "Academic Events & Classes" },
  appointments: { title: "Book Appointment", sub: "Parent-Teacher Meeting Requests" },
  "doc-requests": { title: "Request Documents", sub: "School Certificates & Records" },
  settings: { title: "Account Settings", sub: "Profile & Security Configuration" }
};

type SScreen = "dashboard" | "academics" | "attendance" | "assignments" | "resources" | "behavior" | "clinic" | "settings" | "calendar" | "announcements" | "messages" | "appointments" | "doc-requests";

export function StudentPortal({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useHashRouter<SScreen>("student", "dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { events, assignments, assignmentSubmissions, addAssignmentSubmission } = useAppContext();

  function formatTimeDisplay(timeStr?: string) {
    if (!timeStr) return "";
    let [h, m] = timeStr.split(":");
    let hr = parseInt(h);
    let ampm = hr >= 12 ? " PM" : " AM";
    hr = hr % 12 || 12;
    return `${hr}${m !== "00" ? ":" + m : ""}${ampm}`;
  }

  const { currentUser, updateCurrentUser, getGenericDocument, saveGenericDocument, behaviorLogs, announcements, messages, addMessage, appointments, addAppointment, updateAppointment, addNotification, notifications } = useAppContext();
  const unreadCount = notifications.filter(n => n.recipientId === currentUser?.id && !n.isRead).length;

  const [apiHistory, setApiHistory] = useState<any[]>([]);
  const [apiGateAttendance, setApiGateAttendance] = useState<any[]>([]);
  const [apiClassAttendance, setApiClassAttendance] = useState<any[]>([]);
  const [apiClinicRecords, setApiClinicRecords] = useState<any[]>([]);
  const [apiGuidanceRecords, setApiGuidanceRecords] = useState<any[]>([]);
  const [apiAppointments, setApiAppointments] = useState<any[]>([]);
  const [apiExcuses, setApiExcuses] = useState<any[]>([]);
  const [apiDocRequests, setApiDocRequests] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  const fetchAppointments = async () => {
    if (currentUser?.id) {
      try {
        const data = await studentApi.getAppointments(currentUser.id);
        const formatted = data.map((a: any) => {
          const d = new Date(a.time);
          let hr = d.getUTCHours();
          const min = d.getUTCMinutes();
          const ampm = hr >= 12 ? 'PM' : 'AM';
          hr = hr % 12 || 12;
          const timeStr = `${hr}:${min.toString().padStart(2, '0')} ${ampm}`;
          return {
            ...a,
            teacherName: a.teacher?.user?.first_name ? `${a.teacher.user.first_name} ${a.teacher.user.last_name}` : "Teacher",
            date: new Date(a.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
            time: timeStr
          };
        });
        setApiAppointments(formatted);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const fetchExcuses = async () => {
    if (currentUser?.id) {
      try {
        const data = await studentApi.getExcuseLetters(currentUser.id);
        setApiExcuses(data);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const fetchDocRequests = async () => {
    if (currentUser?.id) {
      try {
        const data = await studentApi.getDocumentRequests(currentUser.id);
        setApiDocRequests(data);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    if (apiHistory && apiHistory.length > 0) {
      const activeEnrollment = apiHistory.find(h => h.status === 'Enrolled') || apiHistory[0];
      const uniqueTeachers = new Map();

      // 1. Add Subject Teachers from Enrollment History
      if (activeEnrollment?.section?.assignments) {
        activeEnrollment.section.assignments.forEach((tsa: any) => {
          if (tsa.teacher?.user) {
            uniqueTeachers.set(tsa.teacher.id, {
              id: tsa.teacher.id,
              name: `${tsa.teacher.user.first_name} ${tsa.teacher.user.last_name} (${tsa.subject?.name})`,
              email: tsa.teacher.user.email,
              subject: tsa.subject?.name,
              type: 'subject'
            });
          }
        });
      }

      // 2. Fetch and append other Staff members (Principal, Nurse, etc.)
      studentApi.getStaff().then(staffArray => {
        if (staffArray && Array.isArray(staffArray)) {
          staffArray.forEach((staff: any) => {
            if (!uniqueTeachers.has(staff.id)) {
              uniqueTeachers.set(staff.id, { ...staff, type: 'support' });
            }
          });
        }
        setTeachers(Array.from(uniqueTeachers.values()));
      }).catch(err => {
        console.error("Failed to fetch staff:", err);
        setTeachers(Array.from(uniqueTeachers.values()));
      });
    }
  }, [apiHistory]);

  useEffect(() => {
    if (currentUser?.id) {
      const studentId = currentUser.studentProfile?.id || (currentUser as any).student_profile?.id || currentUser.id;
      
      // Fetch dynamic academic year first
      academicApi.getYears().then(years => {
        if (years && Array.isArray(years)) {
          const currentYear = years.find((y: any) => y.is_current === true);
          if (currentYear) {
            studentApi.getEnrollmentHistory(currentUser.id, currentYear.id)
              .then(setApiHistory)
              .catch(console.error);
          } else {
            console.error("No current academic year found in database.");
          }
        }
      }).catch(console.error);

      studentApi.getGateAttendance(currentUser.id).then(setApiGateAttendance).catch(console.error);
      studentApi.getClassAttendance(currentUser.id).then(setApiClassAttendance).catch(console.error);
      studentApi.getClinicRecords(studentId).then(setApiClinicRecords).catch(console.error);
      studentApi.getGuidanceRecords(studentId).then(setApiGuidanceRecords).catch(console.error);
      fetchAppointments();
      fetchExcuses();
      fetchDocRequests();
    }
  }, [currentUser?.id]);

  const t1Status = "Submitted";
  const t2Status = "Draft";
  const t3Status = "Draft";

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date(2025, 5, 1));



  // Excuse Letter States
  const [excuseTeacher, setExcuseTeacher] = useState("");
  const [excuseStartDate, setExcuseStartDate] = useState("");
  const [excuseEndDate, setExcuseEndDate] = useState("");
  const [excuseText, setExcuseText] = useState("");
  const [excuseFile, setExcuseFile] = useState<File | null>(null);
  const [excuseError, setExcuseError] = useState("");
  const [isSubmittingExcuse, setIsSubmittingExcuse] = useState(false);
  const [notes, setNotes] = useState("");

  const [replyText, setReplyText] = useState("");
  const [activeConvId, setActiveConvId] = useState("t-ana");

  // Appointment booking state
  const [apptTeacher, setApptTeacher] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [apptPurpose, setApptPurpose] = useState("");
  const [apptParentEmail, setApptParentEmail] = useState("");
  const [showApptEmailPreview, setShowApptEmailPreview] = useState<string | null>(null);
  const [isSubmittingAppt, setIsSubmittingAppt] = useState(false);

  // Document Request state
  const { documentRequests, addDocumentRequest } = useAppContext();
  const [docType, setDocType] = useState("");
  const [docPurpose, setDocPurpose] = useState("");
  const [docTeacherId, setDocTeacherId] = useState("t-ana");
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [docSuccess, setDocSuccess] = useState(false);
  const [docError, setDocError] = useState("");
  const [docValidation, setDocValidation] = useState<{ type?: string; purpose?: string; file?: string; info?: Record<string, string> }>({});
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docRequiredInfo, setDocRequiredInfo] = useState<Record<string, string>>({});
  const [docRouting, setDocRouting] = useState<"TEACHER" | "REGISTRAR">("TEACHER");
  const [docFilter, setDocFilter] = useState<"all" | "Submitted" | "Teacher Approved" | "Completed">("all");
  const [expandedDocSteps, setExpandedDocSteps] = useState<Record<string, boolean>>({});

  const currentRequirement = docType ? DOCUMENT_REQUIREMENTS[docType] : null;

  // PDF Export state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfToast, setPdfToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  async function handleExportPDF() {
    setIsExportingPDF(true);
    setPdfToast(null);
    try {
      console.log("PDF DEBUG - currentStudent:", JSON.stringify(currentStudent));
      console.log("PDF DEBUG - realSubjectGrades:", JSON.stringify(realSubjectGrades));

      const blob = await pdf(
        <Form138PDFDocument 
          student={currentStudent} 
          subjects={realSubjectGrades} 
          attendance={{ daysOfSchool: 180, daysPresent: 176, daysAbsent: 4 }} 
        />
      ).toBlob();

      const filename = `Form138_${currentStudent.name.replace(/\s+/g, '_')}_SY2025-2026.pdf`;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setPdfToast({ message: "PDF Downloaded Successfully!", type: "success" });
          return;
        } catch (pickerErr) {
          // user cancelled the picker, or API failed - fall through to anchor method
          if ((pickerErr as any)?.name === 'AbortError') {
            setIsExportingPDF(false);
            return; // user cancelled, not an error
          }
        }
      }

      // Fallback for browsers/environments without File System Access API
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPdfToast({ message: "PDF Downloaded Successfully!", type: "success" });

    } catch (err) {
      console.error('PDF export failed:', err);
      setPdfToast({ message: "Failed to generate PDF. Please try again.", type: "error" });
    } finally {
      setIsExportingPDF(false);
      setTimeout(() => setPdfToast(null), 4000);
    }
  }

  // Temporary isolated test route hook removal for defense prep
  async function handleDownload(attachedDocumentId: string, docType: string) {
    try {
      const doc = await getGenericDocument(attachedDocumentId);
      if (!doc || !doc.blob) {
        setDocError("Document file is missing or corrupted.");
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error("Failed to download document:", err);
      setDocError("Failed to retrieve the document. Please try again.");
    }
  }

  async function handleDocumentRequest(e: React.FormEvent) {
    e.preventDefault();
    setDocError("");
    setDocSuccess(false);

    // Validate required fields
    const vErrors: { type?: string; purpose?: string; file?: string; info?: Record<string, string> } = { info: {} };
    if (!docType) vErrors.type = "Please select a document type.";
    if (!docPurpose.trim()) vErrors.purpose = "Please provide the purpose of this request.";
    
    // Requirement Validation
    if (currentRequirement?.attachmentRequired && !docFile) {
      vErrors.file = `Please attach the required ${currentRequirement.attachmentLabel?.toLowerCase() || 'document'} before submitting your ${docType} request.`;
    } else if (docFile && currentRequirement) {
      if (currentRequirement.acceptedFileTypes && !currentRequirement.acceptedFileTypes.includes(docFile.type)) {
         vErrors.file = `Unsupported file type. Accepted types: ${currentRequirement.acceptedFileTypes.join(', ')}`;
      }
      if (currentRequirement.maxFileSizeMB && docFile.size > currentRequirement.maxFileSizeMB * 1024 * 1024) {
         vErrors.file = `File size exceeds the maximum limit of ${currentRequirement.maxFileSizeMB}MB.`;
      }
    }

    // Dynamic info validation
    if (currentRequirement?.requiredFields?.length) {
      currentRequirement.requiredFields.forEach(field => {
        if (field !== "purpose" && !docRequiredInfo[field]?.trim()) {
          vErrors.info![field] = `Please provide ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}.`;
        }
      });
    }
    
    if (Object.keys(vErrors.info!).length === 0) delete vErrors.info;

    if (Object.keys(vErrors).length > 0) {
      setDocValidation(vErrors);
      return;
    }
    setDocValidation({});

    // Validate current user identity
    if (!currentUser?.id || !currentUser?.name) {
      setDocError("Student identity could not be determined. Please log in again.");
      return;
    }

    const isRegistrar = docRouting === "REGISTRAR";
    let selectedTeacher = undefined;
    if (!isRegistrar) {
      selectedTeacher = teachers.find(t => t.id === docTeacherId);
      if (!selectedTeacher) {
        setDocError("Please select a valid teacher.");
        return;
      }
    }

    setDocSubmitting(true);
    try {
      let studentAttachmentId = undefined;
      let studentAttachmentName = undefined;

      if (docFile) {
        const savedDoc = await saveGenericDocument({
          id: crypto.randomUUID(),
          name: docFile.name,
          mimeType: docFile.type,
          size: docFile.size,
          createdAt: new Date().toISOString(),
          blob: docFile
        });
        studentAttachmentId = savedDoc.id;
        studentAttachmentName = savedDoc.name;
      }

      await addDocumentRequest({
        id: "doc-" + Date.now(),
        studentId: currentUser.id,
        studentName: currentUser.name,
        section: currentUser.section || "",
        documentType: docType,
        purpose: docPurpose.trim(),
        status: "Submitted",
        currentStage: 1,
        submittedDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        teacherId: selectedTeacher?.id,
        teacherName: selectedTeacher?.name,
        responsibleRole: docRouting,
        responsibleOffice: currentRequirement?.responsibleOffice,
        requiresPrincipalApproval: currentRequirement?.requiresPrincipalApproval,
        requiredInformation: docRequiredInfo,
        studentAttachmentId,
        studentAttachmentName
      });

      // Notify the assigned teacher or registrar
      if (selectedTeacher) {
        await addNotification({
          id: "notif-doc-" + Date.now(),
          recipientId: selectedTeacher.id,
          title: "New Document Request",
          body: `${currentUser.name} submitted a request for ${docType}.`,
          timestamp: new Date().toISOString(),
          isRead: false,
          iconType: "document"
        });
      }

      setDocType("");
      setDocPurpose("");
      setDocFile(null);
      setDocRequiredInfo({});
      setDocSuccess(true);
      setTimeout(() => setDocSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to submit document request:", err);
      setDocError("Failed to submit request. Please try again.");
    } finally {
      setDocSubmitting(false);
    }
  }

  async function handleBookAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmittingAppt) return;
    
    const emailToUse = apptParentEmail || currentUser?.parentEmail || "";
    if (!emailToUse || !apptTeacher || !apptDate || !apptTime || !apptPurpose || !currentUser) return;

    const teacher = teachers.find(t => t.id === apptTeacher);
    if (!teacher) return;

    setIsSubmittingAppt(true);
    try {
      const dateObj = new Date(apptDate);
      const formattedDate = dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const [h, m] = apptTime.split(":");
      let hr = parseInt(h);
      const ampm = hr >= 12 ? "PM" : "AM";
      hr = hr % 12 || 12;
      const formattedTime = `${hr}:${m} ${ampm}`;

      if (!currentUser?.parentEmail && emailToUse) {
        await updateCurrentUser({ parentEmail: emailToUse });
      }

      await addAppointment({
        id: "appt-" + Date.now(),
        studentId: currentUser.id,
        studentName: currentUser.name,
        parentEmail: emailToUse,
        teacherId: teacher.id,
        teacherName: teacher.name,
        date: formattedDate,
        time: formattedTime,
        purpose: apptPurpose,
        status: "Pending",
        direction: "parent-to-teacher",
        createdAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      });

      addNotification({
        id: "notif-" + Date.now(),
        recipientId: teacher.id,
        title: "New Appointment Request",
        body: `${currentUser.name} requested an appointment on ${formattedDate} at ${formattedTime}.`,
        timestamp: "Just now",
        isRead: false,
        iconType: "calendar"
      });

      setApptTeacher("");
      setApptDate("");
      setApptTime("");
      setApptPurpose("");
      setApptParentEmail("");
    } catch (err) {
      console.error("Failed to book appointment:", err);
    } finally {
      setIsSubmittingAppt(false);
    }
  }

  function apptStatusColor(s: AppointmentStatus) {
    return s === "Confirmed" ? C.green : s === "Pending" ? "#f59e0b" : s === "Declined" ? C.red : C.blue;
  }
  function apptStatusBg(s: AppointmentStatus) {
    return s === "Confirmed" ? C.greenBg : s === "Pending" ? "#fef3c7" : s === "Declined" ? C.redBg : C.blueBg;
  }
  const [aiBuddyOpen, setAiBuddyOpen] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailInputValue, setEmailInputValue] = useState(currentUser?.parentEmail || "");

  useEffect(() => {
    if (currentUser?.parentEmail) setEmailInputValue(currentUser.parentEmail);
  }, [currentUser?.parentEmail]);

  const handleEmailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInputValue.trim();
    if (!trimmed) {
      setEmailError("Email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email.");
      return;
    }
    setEmailError("");
    setIsSavingEmail(true);
    try {
      await updateCurrentUser({ parentEmail: trimmed });
      setEmailSaveSuccess(true);
      setTimeout(() => setEmailSaveSuccess(false), 2000);
    } catch (err) {
      setEmailError("Failed to save email.");
    } finally {
      setIsSavingEmail(false);
    }
  };
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 6A: Load photo blob from IndexedDB
  useEffect(() => {
    let url: string | null = null;
    if (currentUser?.photoDocId) {
      getGenericDocument(currentUser.photoDocId).then(doc => {
        if (doc?.blob) {
          url = URL.createObjectURL(doc.blob);
          setPhotoUrl(url);
        }
      });
    } else {
      setPhotoUrl(null);
    }
    
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [currentUser?.photoDocId, getGenericDocument]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setPhotoUploadError("Please select a JPEG or PNG image.");
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoUploadError("Profile photo must be 5 MB or smaller.");
      return;
    }

    setPhotoUploadError("");
    setIsUploadingPhoto(true);

    try {
      const docId = `photo_${currentUser?.id || crypto.randomUUID()}_${Date.now()}`;
      const doc = {
        id: docId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
        blob: file
      };

      await saveGenericDocument(doc);
      await updateCurrentUser({ photoDocId: docId });
    } catch (err) {
      console.error(err);
      setPhotoUploadError("Failed to save profile photo.");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Phase B1.10-C Migration: Parse backend apiHistory into SubjectGrade format
  const parsedApiGrades = useMemo(() => {
    if (!apiHistory || apiHistory.length === 0) return [];
    
    // We expect apiHistory to contain an array of studentEnrollments for this year
    const enrollment = apiHistory[0];
    if (!enrollment || !enrollment.grade_entries) return [];

    // Map backend grade_entries to SubjectGrade format
    // In a real app, this would involve complex WW/PT/QA weighting or the backend would return term averages directly.
    // For now, we will return an empty array and rely on the mock fallback below if the backend isn't populated with term averages.
    // TODO: Create a backend endpoint that returns pre-calculated term averages for the student portal.
    return [];
  }, [apiHistory]);

  const studentId = currentUser?.id || "s-juan";
  
  // Use backend grades if they exist, otherwise fallback to mock gradebooks
  const realSubjectGrades = useMemo(() => {
    if (parsedApiGrades.length > 0) return parsedApiGrades;
    return getStudentSubjectGrades(studentId, {});
  }, [studentId, parsedApiGrades]);
  
  const realAcademicHistory = useMemo(() => getStudentFullAcademicHistory(studentId, {}), [studentId]);
  const realGradeTrendData = useMemo(() => getStudentGradeTrend(realAcademicHistory), [realAcademicHistory]);
  const realRecentQuizzes = useMemo(() => getStudentRecentQuizzes(studentId, {}), [studentId]);

  const currentStudent = useMemo(() => {
    const rawName = currentUser?.name || "Juan Miguel Santos";
    const nameParts = rawName.split(" ");
    const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
    const first = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
    const lrn = currentUser?.id === "s-juan" ? "100001" : currentUser?.id ? `1000${currentUser.id.replace(/\D/g, '').padEnd(2, '0').slice(0, 2)}` : "100001";
    const section = currentUser?.section ? currentUser.section.replace(/Grade \d+\s*-\s*/i, "").trim() : "Pilot";
    return {
      name: rawName,
      surname,
      first,
      lrn,
      grade: 10,
      section,
      adviser: "Ana R. Soriano",
      gender: "male"
    };
  }, [currentUser]);

  const currentGrade10Avg = useMemo(() => {
    if (realSubjectGrades.length === 0) return 0;
    const total = realSubjectGrades.reduce((sum, s) => sum + (s.term1 + s.term2 + s.term3) / 3, 0);
    return Math.round((total / realSubjectGrades.length) * 10) / 10;
  }, [realSubjectGrades]);

  const standingInfo = useMemo(() => getStudentRankAndStanding(currentGrade10Avg), [currentGrade10Avg]);

  // Excuse Letter Submit
  async function handleExcuseSubmit(e: React.FormEvent) {
    e.preventDefault();
    setExcuseError("");
    
    if (!excuseTeacher) {
      setExcuseError("Please select a teacher.");
      return;
    }
    if (!excuseStartDate || !excuseEndDate) {
      setExcuseError("Please provide start and end dates.");
      return;
    }
    if (!excuseText) {
      setExcuseError("Please provide an explanation.");
      return;
    }
    if (!currentUser) {
      setExcuseError("User session not found.");
      return;
    }

    setIsSubmittingExcuse(true);
    try {
      let documentId = undefined;
      
      if (excuseFile) {
        const uploadRes: any = await studentApi.uploadDocument(excuseFile);
        documentId = uploadRes.data?.id;
      }

      await studentApi.createExcuseLetter({
        teacherId: excuseTeacher,
        startDate: excuseStartDate,
        endDate: excuseEndDate,
        reason: excuseText,
        documentId
      });
      
      setExcuseTeacher("");
      setExcuseStartDate("");
      setExcuseEndDate("");
      setExcuseText("");
      setExcuseFile(null);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
      
      await fetchExcuses();
    } catch (err: any) {
      console.error(err);
      setExcuseError(err?.response?.data?.error || "Failed to submit excuse letter. Ensure the selected teacher is assigned to your section.");
    } finally {
      setIsSubmittingExcuse(false);
    }
  }

  const renderSidebarContent = () => (
    <>
      {/* Brand Header - matches teacher sidebar exactly */}
      <div style={{ padding: "22px 24px", borderBottom: `1px solid ${C.borderHeavy}`, display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
        <img src="/school_seal.png" alt="CIS Logo" style={{ width: 52, height: 52, objectFit: "contain", flexShrink: 0 }} onError={(e) => (e.currentTarget.style.display = 'none')} />
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", justifyContent: "center" }}>
          <div style={{ color: "#ffffff", fontSize: 19, fontWeight: 700, fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em", lineHeight: 1, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
            Calulut
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 3, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", lineHeight: 1 }}>
            Integrated School
          </div>
        </div>
      </div>

      {/* Navigation list with categories - matches teacher sidebar */}
      <div style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", position: "relative", zIndex: 1 }}>
        {STUDENT_NAV_GROUPS.map((group, groupIdx) => (
          <div key={groupIdx} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", padding: "8px 14px 4px", userSelect: "none" }}>
              {group.title}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const tabMap: Record<string, string> = {
                dashboard: "dashboard", calendar: "calendar", academics: "academics",
                attendance: "attendance", assignments: "assignments",
                announcements: "announcements", messages: "messages",
                appointments: "appointments", "doc-requests": "doc-requests", settings: "settings"
              };
              const mappedTab = tabMap[item.id] || item.id;
              const isActive = tab === mappedTab;

              return (
                <button
                  key={item.id}
                  onClick={() => { setTab(mappedTab as any); setIsMobileMenuOpen(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "9px 14px",
                    borderRadius: 4, background: isActive ? C.m700 : "transparent", border: "none",
                    color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s", boxSizing: "border-box"
                  }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={16} color={isActive ? '#fff' : 'rgba(255,255,255,0.65)'} />
                  <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Profile Popup - matches teacher sidebar exactly */}
      <div style={{ padding: 16, borderTop: `1px solid ${C.borderHeavy}`, position: "relative", zIndex: 1 }}>
        <div 
          onClick={() => setProfileOpen(!profileOpen)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", borderBottom: profileOpen ? `1px solid ${C.borderHeavy}` : "none", cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width: 32, height: 32, borderRadius: 16, background: C.m700, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>
            {currentUser?.name ? currentUser.name.split(" ").map(n => n[0]).join("").substring(0,2) : "S"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser?.name || "Student User"}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser?.section || "Grade 10 - Pilot Section"}</div>
          </div>
          <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>

        {profileOpen && (
          <div style={{ position: "absolute", bottom: "100%", left: 8, right: 8, marginBottom: 4, display: "flex", flexDirection: "column", gap: 4, padding: "6px", background: C.m800, borderRadius: 6, border: `1px solid ${C.borderHeavy}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.3)", zIndex: 10 }}>
            <button onClick={() => { setTab("settings"); setProfileOpen(false); setIsMobileMenuOpen(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <User size={13} />
              <span style={{ fontSize: 11 }}>My Profile</span>
            </button>
            <button onClick={onLogout}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <LogOut size={13} color="#f87171" />
              <span style={{ fontSize: 11, color: "#f87171" }}>Logout</span>
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: C.paper, fontFamily: "'Inter',sans-serif", display: "flex" }}>
      {/* ── Left Sidebar Navigation ── */}
      <div className="no-print hidden md:flex" style={{ width: 240, background: C.m900, borderRight: `1px solid ${C.borderHeavy}`, flexDirection: "column", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        {renderSidebarContent()}
      </div>

      <MobileDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.m900 }}>
          {renderSidebarContent()}
        </div>
      </MobileDrawer>

      {/* ── Main Content View Window ── */}
      <div className="watermark-bg" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        
        {/* Top Header Band */}
        <div className="no-print" style={{
          background: "#fff",
          borderBottom: `2px solid ${C.m700}`,
          padding: "0 16px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          position: "relative",
          zIndex: 10
        }}>
          {/* Hamburger + Dynamic Page Title/Subtitle */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button 
              className="md:hidden flex items-center justify-center bg-transparent border-none cursor-pointer p-1" 
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} color={C.m700} />
            </button>
            <div className="hidden md:block">
              <h1 style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>
                {STUDENT_TAB_METADATA[tab]?.title || "Student Portal"}
              </h1>
              <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>
                {STUDENT_TAB_METADATA[tab]?.sub || "OVERVIEW"}
              </div>
            </div>
          </div>
          
          {/* Right Area: Search, Theme sun, Notification Bell & Profile dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Search bar mockup */}
            <div style={{ display: "flex", alignItems: "center", position: "relative", width: 280 }}>
              <Search size={13} color={C.t3} style={{ position: "absolute", left: 10 }} />
              <input 
                type="text" 
                placeholder="Search..." 
                style={{
                  width: "100%",
                  padding: "6px 12px 6px 30px",
                  fontSize: 11,
                  color: C.t1,
                  background: C.m50,
                  border: "1.5px solid " + C.borderMed,
                  borderRadius: 20,
                  outline: "none",
                  transition: "all 0.15s"
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = C.m700;
                  e.currentTarget.style.background = "#fff";
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = C.borderMed;
                  e.currentTarget.style.background = C.m50;
                }}
              />
            </div>

            {/* Action buttons and Profile */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>

              {/* ID Card Button */}
              <button 
                onClick={() => setShowQRModal(true)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32 }}
                title="View Digital ID Card"
              >
                <QrCode size={18} color={C.t2} />
              </button>

              {/* Notification Bell */}
              <div style={{ position: "relative" }}>
                <button 
                  onClick={() => setNotifOpen(true)}
                  style={{
                    background: notifOpen ? C.m50 : "transparent",
                    border: "none",
                    borderRadius: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    position: "relative",
                    transition: "background 0.2s"
                  }}
                >
                  <Bell size={18} color={notifOpen ? C.m700 : C.t2} />
                  {unreadCount > 0 && (
                    <div style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      background: C.red,
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 700,
                      borderRadius: 10,
                      width: 14,
                      height: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1.5px solid #fff"
                    }}>{unreadCount}</div>
                  )}
                </button>
                <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
              </div>
            </div>
          </div>
        </div>

        {/* Inner Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:px-7 md:py-6 md:pb-[100px] relative z-10">
          
          {/* 1. STUDENT DASHBOARD (Dynamic) */}
          {tab === "dashboard" && (() => {
            const myGateScans = apiGateAttendance;
            const myAssignments = assignments.filter(a => a.section === currentUser?.section);
            const mySubmissions = assignmentSubmissions.filter(s => s.studentId === currentUser?.id);
            const myPendingAssignments = myAssignments.filter(a => !mySubmissions.some(s => s.assignmentId === a.id));

            return (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* KPI metrics strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: "Attendance Scans", val: myGateScans.length.toString(), sub: "Gate Scans Recorded", icon: CheckCircle, color: C.green, bg: "#f0fdf4" },
                  { label: "Assignments Due", val: myPendingAssignments.length.toString(), sub: "Incomplete Assignments", icon: ClipboardList, color: C.red, bg: "#fef2f2" },
                  { label: "Today's Classes", val: "Unavailable", sub: "Schedule not yet synced", icon: Clock, color: C.t3, bg: "#eff6ff" }
                ].map((kpi, idx) => {
                  const Icon = kpi.icon;
                  return (
                    <div key={idx} className="hover-zoom" style={{ 
                      background: "#fff", 
                      border: `1.5px solid ${C.borderMed}`, 
                      borderRadius: 8, 
                      padding: "12px 14px", 
                      boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 12, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={12} color={kpi.color} />
                        </div>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: C.t3 }}>{kpi.label}</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{kpi.val}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: kpi.color }}>{kpi.sub}</div>
                    </div>
                  );
                })}
              </div>

              {/* Main content layout with Left (2 columns) and Right (340px) structure */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_340px] gap-5">
                
                {/* Left Area: Contains Schedule, Assignments, and Announcements */}
                <div className="col-span-1 xl:col-span-2 flex flex-col gap-5">
                  
                  {/* Row 1: Schedule and Assignments side-by-side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* 1. Today's Schedule */}
                    <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Calendar size={16} color={C.m700} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Today's Schedule</span>
                        </div>
                        <button onClick={() => setTab("calendar")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View Calendar</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <Clock size={32} color={C.t3} style={{ opacity: 0.4 }} />
                        <span style={{ fontSize: 11.5, color: C.t3, textAlign: "center", marginTop: 8 }}>Detailed student schedules are not yet available.</span>
                      </div>
                      <button onClick={() => setTab("calendar")} style={{ 
                        alignSelf: "center",
                        padding: "7px 24px",
                        background: "#fff",
                        border: `1.5px solid rgba(139, 30, 30, 0.15)`,
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: C.m700,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        display: "block",
                        margin: "12px auto 0"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.m50; e.currentTarget.style.borderColor = C.m700; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "rgba(139, 30, 30, 0.15)"; }}
                      >
                        View Calendar Events
                      </button>
                    </div>

                    {/* 2. Upcoming Assignments */}
                    <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ClipboardList size={16} color={C.m700} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Upcoming Assignments</span>
                        </div>
                        <button onClick={() => setTab("assignments")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View All</button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                        {myPendingAssignments.slice(0, 4).map((ass) => (
                          <div key={ass.id} style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: 12, 
                            padding: 10, 
                            border: `1px solid ${C.borderMed}`, 
                            borderRadius: 6,
                            background: "#fff"
                          }}>
                            <div style={{ width: 32, height: 32, borderRadius: 4, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <ClipboardList size={14} color={C.m700} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ass.title}</div>
                              <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{ass.subject}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.t3 }}>Due {ass.dueDate}</div>
                            </div>
                          </div>
                        ))}
                        {myPendingAssignments.length === 0 && (
                          <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: C.t3 }}>No upcoming assignments.</div>
                        )}
                      </div>
                      <button onClick={() => setTab("assignments")} style={{ 
                        alignSelf: "center",
                        padding: "7px 24px",
                        background: "#fff",
                        border: `1.5px solid rgba(139, 30, 30, 0.15)`,
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: C.m700,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        display: "block",
                        margin: "12px auto 0"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.m50; e.currentTarget.style.borderColor = C.m700; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "rgba(139, 30, 30, 0.15)"; }}
                      >
                        View All Assignments
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Announcements */}
                  <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Megaphone size={16} color={C.m700} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Announcements</span>
                      </div>
                      <button onClick={() => setTab("announcements")} style={{ background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View All</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(() => {
                        const dashboardAnnouncements = announcements
                          .filter(a => a.audience === "All" || a.audience === "Students")
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 3);
                          
                        return (
                          <>
                            {dashboardAnnouncements.map((ann) => (
                              <div key={ann.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", border: `1px solid ${C.borderMed}`, borderRadius: 6, position: "relative" }}>
                                <div style={{ width: 28, height: 28, borderRadius: 14, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                  <Bell size={13} color={C.m700} />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{ann.title}</div>
                                  <p style={{ fontSize: 10.5, color: C.t2, margin: "4px 0", lineHeight: 1.4 }}>{ann.body}</p>
                                  <span style={{ fontSize: 9, color: C.t3 }}>{new Date(ann.created_at || new Date()).toLocaleDateString()} &middot; {ann.author?.first_name ? `${ann.author.first_name} ${ann.author.last_name}` : "Administration"}</span>
                                </div>
                              </div>
                            ))}
                            {dashboardAnnouncements.length === 0 && (
                              <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: C.t3 }}>No announcements at this time.</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Row 3: Pending Requests and Appointments */}
                  <div className="hover-zoom" style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={16} color={C.m700} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Pending Requests & Appointments</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {(() => {
                          const myAppts = apiAppointments.filter(a => a.status === "Pending" || a.status === "Confirmed");
                          const myDocs = apiDocRequests.filter(d => d.status !== "Completed" && !d.status.includes("Rejected"));
                          const myExcuses = apiExcuses.filter(e => e.status === "Pending Review");
                          
                          const hasAny = myAppts.length > 0 || myDocs.length > 0 || myExcuses.length > 0;
                          
                          return (
                            <>
                              {myAppts.map(appt => (
                                <div key={appt.id} className="hover-lift" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.m50, padding: "10px 14px", borderRadius: 8, cursor: "pointer", border: `1px solid ${C.borderLight}` }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderLight}` }}>
                                      <Calendar size={14} color={C.m700} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{appt.teacher_name}</div>
                                      <div style={{ fontSize: 10.5, color: C.t2 }}>{new Date(appt.date).toLocaleDateString()} at {appt.time}</div>
                                    </div>
                                  </div>
                                  <Stamp label={appt.status} color={appt.status === "Confirmed" ? C.green : "#f59e0b"} bg={appt.status === "Confirmed" ? C.greenBg : "#fef3c7"} />
                                </div>
                              ))}
                              {myDocs.map(doc => (
                                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: `1px solid ${C.borderMed}`, borderRadius: 6 }}>
                                  <FileText size={14} color={C.m700} />
                                  <div style={{ flex: 1, fontSize: 11.5, color: C.t1 }}>Request for <strong>{doc.documentType}</strong></div>
                                  <span style={{ fontSize: 9.5, padding: "2px 8px", background: "#eff6ff", color: C.blue, borderRadius: 10, fontWeight: 700 }}>{doc.status}</span>
                                </div>
                              ))}
                              {myExcuses.map(excuse => (
                                <div key={excuse.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: `1px solid ${C.borderMed}`, borderRadius: 6 }}>
                                  <AlertTriangle size={14} color={C.m700} />
                                  <div style={{ flex: 1, fontSize: 11.5, color: C.t1 }}>Excuse Letter (Absence on {excuse.dates})</div>
                                  <span style={{ fontSize: 9.5, padding: "2px 8px", background: "#fff7ed", color: "#f97316", borderRadius: 10, fontWeight: 700 }}>Pending</span>
                                </div>
                              ))}
                              
                              {!hasAny && (
                                <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: C.t3 }}>You have no pending requests or upcoming appointments.</div>
                              )}
                            </>
                          );
                        })()}
                    </div>
                  </div>

                </div>

                {/* Right Area: Stacked Column for Academic Calendar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
                  
                  {/* Academic Calendar Widget */}
                  <div className="hover-zoom" style={{ flex: 1, background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={16} color={C.m700} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Academic Calendar</span>
                      </div>
                      <button onClick={() => setTab("calendar")} style={{ background: "none", border: "none", color: C.m700, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: 0 }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>View Calendar</button>
                    </div>
                    <div style={{ borderBottom: `0.5px solid ${C.border}`, paddingBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>Upcoming Events</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(() => {
                        const now = new Date();
                        const upcomingEvents = events
                          .filter(e => (e.audience === "all" || e.audience === "students") && new Date(e.date) >= now)
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .slice(0, 3);
                          
                        return upcomingEvents.map((ev, idx) => {
                          const dateObj = new Date(ev.date);
                          const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                          const day = dateObj.getDate();
                          return (
                            <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ width: 36, height: 36, background: C.m50, border: `1px solid ${C.borderMed}`, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: 7, fontWeight: 800, color: C.m700 }}>{month}</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: C.m700, lineHeight: 1 }}>{day}</span>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>{ev.title}</div>
                                <div style={{ fontSize: 9, color: C.t3, marginTop: 2 }}>{ev.time ? ev.time + (ev.endTime ? " - " + ev.endTime : "") : "All Day"}</div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                      {events.filter(e => e.audience === "all" || e.audience === "students").length === 0 && (
                        <div style={{ fontSize: 11, color: C.t3, textAlign: "center", padding: "10px 0" }}>No upcoming events.</div>
                      )}
                    </div>
                    <button onClick={() => setTab("calendar")} style={{ 
                      alignSelf: "center",
                      padding: "7px 24px",
                      background: "#fff",
                      border: `1.5px solid rgba(139, 30, 30, 0.15)`,
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: C.m700,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "block",
                      margin: "auto auto 0"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.m50; e.currentTarget.style.borderColor = C.m700; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "rgba(139, 30, 30, 0.15)"; }}
                    >
                      View Full Calendar
                    </button>
                  </div>

                </div>

              </div>

            </div>
            );
          })()}

          {/* ANNOUNCEMENTS SCREEN */}
          {tab === "announcements" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>School Announcements</h1>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Stay updated with the latest news, notices, and events.</div>
                </div>
              </div>

              <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                {announcements.filter(a => a.audience === "All" || a.audience === "Students").map((ann) => (
                  <div key={ann.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", border: `1px solid ${C.borderMed}`, borderRadius: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Megaphone size={14} color={C.m700} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{ann.title}</div>
                        <span style={{ fontSize: 9.5, padding: "2px 8px", background: "#f0fdf4", color: C.green, borderRadius: 10, fontWeight: 700 }}>Announcement</span>
                      </div>
                      <p style={{ fontSize: 11.5, color: C.t2, margin: "6px 0", lineHeight: 1.5 }}>{ann.body}</p>
                      <span style={{ fontSize: 9.5, color: C.t3 }}>{new Date(ann.created_at || new Date()).toLocaleDateString()} &middot; {ann.author?.first_name ? `${ann.author.first_name} ${ann.author.last_name}` : "Administration"}</span>
                    </div>
                  </div>
                ))}
                {announcements.filter(a => a.audience === "All" || a.audience === "Students").length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: C.t3 }}>No new announcements.</div>
                )}
              </div>
            </div>
          )}

          {/* 2. ACADEMIC RECORDS */}
          {tab === "academics" && (
            <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
              <style dangerouslySetInnerHTML={{ __html: `
                @page {
                  size: letter portrait;
                  margin: 0.4in;
                }

                @media print {
                  html, body, #root, #root > div, .watermark-bg {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    overflow: visible !important;
                    display: block !important;
                    background: #fff !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }

                  body * { visibility: hidden !important; }

                  .no-print {
                    display: none !important;
                  }

                  #form138-print-root, #form138-print-root * { 
                    visibility: visible !important; 
                  }

                  @page {
                    size: portrait;
                    margin: 0.5in;
                  }

                  #form138-print-root {
                    display: block !important;
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    position: static !important;
                    box-sizing: border-box !important;
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    background: #fff !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }

                  /* Force text wrapping to prevent inline nowrap from forcing table width > page width */
                  #form138-print-root * {
                    white-space: normal !important;
                  }

                  #form138-print-root table {
                    width: 100% !important;
                    table-layout: fixed !important;
                    font-size: 8.5pt !important;
                  }

                  #form138-print-root table th,
                  #form138-print-root table td {
                    padding: 4px 6px !important;
                    word-wrap: break-word !important;
                  }
                }
              ` }} />

              <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Scholastic History & Grades</h1>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Official report card records under Form 138 specification derived from active gradebooks.</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  
                  {/* Toast Notification */}
                  {pdfToast && (
                    <div style={{ 
                      padding: "8px 12px", 
                      borderRadius: 6, 
                      fontSize: 11, 
                      fontWeight: 600,
                      background: pdfToast.type === 'success' ? C.greenBg : C.redBg,
                      color: pdfToast.type === 'success' ? C.green : C.red,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}>
                      {pdfToast.type === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                      {pdfToast.message}
                    </div>
                  )}

                  <button 
                    onClick={handleExportPDF} 
                    disabled={isExportingPDF}
                    style={{ 
                      display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, 
                      color: "#fff", background: isExportingPDF ? C.t3 : C.m700, 
                      border: "none", borderRadius: 8, padding: "8px 16px", cursor: isExportingPDF ? "not-allowed" : "pointer", 
                      transition: "all 0.15s" 
                    }}
                  >
                    {isExportingPDF ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13}/>}
                    {isExportingPDF ? "Generating PDF..." : "Download PDF (SF9)"}
                  </button>
                </div>
              </div>

              {/* Standard DepEd Report Card widget */}
              <div id="form138-print-root" className="printable-report-card-area" style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.borderMed}`, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div id="printable-report-card">
                  <StudentReportCard 
                    student={currentStudent} 
                    subjects={realSubjectGrades}
                  />
                </div>
              </div>

              <div className="no-print grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Visual Grade Trend line chart per year level */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 16 }}>Grade Averages Trend</div>
                  <div style={{ height: 170 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={realGradeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" stroke={C.t3} fontSize={10.5} tickLine={false} axisLine={false} />
                        <YAxis domain={[75, 100]} stroke={C.t3} fontSize={10.5} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.borderMed}` }} formatter={(val: number) => [`${val.toFixed(1)}%`, "Average"]} />
                        <Line type="monotone" dataKey="avg" stroke={C.m700} strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 4, stroke: C.m700, strokeWidth: 2, fill: "#fff" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Standing & Class rank metrics */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Academic Standing Details</div>
                  <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1 }}>Class Ranking</div>
                        <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>Out of {standingInfo.totalStudents} enrolled students in Section Pilot</div>
                      </div>
                      <Stamp label={`Rank ${standingInfo.rank}`} color={C.gold} bg={C.goldLight} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1 }}>Academic Track Recommendation</div>
                        <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>Suggested path for senior high enrolment (Current GPA: {currentGrade10Avg.toFixed(1)})</div>
                      </div>
                      <Stamp label={standingInfo.track} color={C.blue} bg={C.blueBg} />
                    </div>
                  </div>
                </div>
                
                {/* Quiz Grades Details */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, gridColumn: "span 2", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Recent Quiz Performance</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ padding: "20px 24px" }}>
                    {realRecentQuizzes.map((qz, idx) => (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 10, borderBottom: `1px dashed ${C.borderMed}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{qz.s} &middot; <span style={{ color: C.t2, fontWeight: 600 }}>{qz.q}</span></span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.m700 }}>{qz.score}</span>
                        </div>
                        <div style={{ width: "100%", height: 6, background: C.borderMed, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${qz.pct}%`, height: "100%", background: C.m700, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                    {realRecentQuizzes.length === 0 && (
                      <div style={{ gridColumn: "span 2", textAlign: "center", fontSize: 11.5, color: C.t3, padding: 20 }}>
                        No quiz items recorded in active gradebooks yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 3. ATTENDANCE */}
          {tab === "attendance" && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 w-full">
              
              {/* Left Column: Logs & Excuse Letter Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Visual Attendance Trend line chart */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                   <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 16 }}>Attendance Trend (Current Term)</div>
                   <div style={{ height: 160 }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={[
                         { week: "Week 1", rate: 100 }, { week: "Week 2", rate: 95 }, { week: "Week 3", rate: 80 }, { week: "Week 4", rate: 90 }, { week: "Week 5", rate: 98 }
                       ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                         <XAxis dataKey="week" stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} />
                         <YAxis domain={[0, 100]} stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} tickFormatter={val => `${val}%`} />
                         <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(val: number) => [`${val}%`, "Attendance Rate"]} />
                         <Line type="monotone" dataKey="rate" stroke={C.green} strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 4, stroke: C.green, strokeWidth: 2, fill: "#fff" }} />
                       </LineChart>
                     </ResponsiveContainer>
                   </div>
                </div>

                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", background: "#fff" }}>Gate Attendance Logs</div>
                  <div className="overflow-x-auto w-full">
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                    <thead>
                      <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                        {["Date", "Time In", "Time Out", "Status"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 14px", fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {apiGateAttendance
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((row, idx, arr) => {
                          let trendIcon = null;
                          if (idx < arr.length - 1) {
                            const prev = arr[idx + 1];
                            const currH = parseInt(row.time_in?.split(':')[0] || '0');
                            const currM = parseInt(row.time_in?.split(':')[1] || '0');
                            const prevH = parseInt(prev.time_in?.split(':')[0] || '0');
                            const prevM = parseInt(prev.time_in?.split(':')[1] || '0');
                            const currTotal = currH * 60 + currM;
                            const prevTotal = prevH * 60 + prevM;
                            if (currTotal < prevTotal - 10) trendIcon = <span style={{ color: C.green, fontSize: 10, fontWeight: 700, background: C.greenBg, padding: "2px 6px", borderRadius: 10 }}>Earlier! 🚀</span>;
                            else if (currTotal > prevTotal + 10) trendIcon = <span style={{ color: C.red, fontSize: 10, fontWeight: 700, background: C.redBg, padding: "2px 6px", borderRadius: 10 }}>Later 📉</span>;
                          }
                          return (
                            <tr key={row.id} style={{ borderBottom: idx < arr.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                              <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: C.t1 }}>{row.date}</td>
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", color: C.t2 }}>{formatTimeDisplay(row.time_in) || "--:--"}</div>
                                  {trendIcon}
                                </div>
                              </td>
                              <td style={{ padding: "10px 14px", fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", color: C.t2 }}>{formatTimeDisplay(row.time_out) || "--:--"}</td>
                              <td style={{ padding: "10px 14px" }}>
                                {row.status === "Present" ? (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.greenBg, color: C.green, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}><CheckCircle size={12} /> Present</div>
                                  ) : row.status === "Absent" ? (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.redBg, color: C.red, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}><AlertTriangle size={12} /> Absent</div>
                                  ) : row.status === "Late Arrival" ? (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}><Clock size={12} /> Late</div>
                                  ) : (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.m100, color: C.t2, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{row.status}</div>
                                  )}
                              </td>
                            </tr>
                          );
                      })}
                      {apiGateAttendance.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: C.t3, fontSize: 11 }}>No attendance records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* Excuse Letter Submission form */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 16 }}>Submit Absence Excuse Letter</div>
                  <form onSubmit={handleExcuseSubmit}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Select Teacher / Class</label>
                      <select
                        value={excuseTeacher}
                        onChange={e => setExcuseTeacher(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 12, appearance: "none" }}
                      >
                        <option value="">— Choose a teacher —</option>
                        
                        <optgroup label="Subject Teachers">
                          {teachers.filter(t => t.type === 'subject').map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>

                        <optgroup label="Support Staff">
                          {teachers.filter(t => t.type === 'support').map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Start Date</label>
                        <input type="date" value={excuseStartDate} onChange={e => setExcuseStartDate(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 12 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>End Date</label>
                        <input type="date" value={excuseEndDate} onChange={e => setExcuseEndDate(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 12 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Absence Reason / Explanation</label>
                      <textarea
                        value={excuseText}
                        onChange={e => setExcuseText(e.target.value)}
                        placeholder="Please write why you missed class (e.g. sick, emergency consultation)..."
                        style={{ width: "100%", height: 80, padding: 12, fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", outline: "none", boxSizing: "border-box", resize: "vertical" }}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Attachment (Optional)</label>
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              setExcuseError("File must be smaller than 10MB");
                              setExcuseFile(null);
                            } else {
                              setExcuseFile(file);
                              setExcuseError("");
                            }
                          }
                        }}
                        style={{ width: "100%", padding: "8px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb" }}
                      />
                      <div style={{ fontSize: 9.5, color: C.t3, marginTop: 4 }}>Supported formats: PDF, JPEG, PNG. Max size: 10MB</div>
                    </div>
                    {excuseError && <div style={{ fontSize: 11, color: C.red, marginBottom: 12, background: C.redBg, padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.red}30` }}>{excuseError}</div>}
                    <button type="submit" disabled={isSubmittingExcuse} style={{ background: isSubmittingExcuse ? C.m600 : C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6, cursor: isSubmittingExcuse ? "default" : "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}>
                      <Send size={14} /> {isSubmittingExcuse ? "Submitting..." : "Submit Excuse Letter"}
                    </button>
                    {uploadSuccess && <div style={{ fontSize: 11, color: C.green, marginTop: 12, fontWeight: 600 }}>Excuse letter submitted successfully!</div>}
                  </form>
                </div>
              </div>

              {/* Right Column: Attendance Calendar & submission logs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 16 }}>Attendance Calendar (June 2025)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center" }}>
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                      <span key={d} style={{ fontSize: 8.5, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>{d}</span>
                    ))}
                    {Array.from({ length: 35 }).map((_, idx) => {
                      const day = idx - 2;
                      const valid = day > 0 && day <= 30;
                      
                      const isAbsent = day === 7;
                      const isLate = day === 8;
                      const isHoliday = day === 12;
                      const isWeekend = idx % 7 === 0 || idx % 7 === 6;

                      let bg = "transparent";
                      let c = C.t2;
                      let dot = null;

                      if (valid) {
                        if (isWeekend) {
                          bg = "#f3f4f6";
                          c = C.t3;
                        } else if (isAbsent) {
                          dot = C.red;
                        } else if (isLate) {
                          dot = C.amber;
                        } else if (isHoliday) {
                          bg = C.blueBg;
                          c = C.blue;
                        } else if (day < 11) {
                          dot = C.green;
                        }
                      }

                      return (
                        <div key={idx} style={{
                          height: 30, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          background: bg, borderRadius: 3, fontSize: 11, fontWeight: valid && !isWeekend ? 600 : 400, color: c, position: "relative"
                        }}>
                          {valid ? day : ""}
                          {dot && <div style={{ width: 4, height: 4, borderRadius: 2, background: dot, position: "absolute", bottom: 2 }} />}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.green }}/> Present</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.amber }}/> Late</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.red }}/> Absent</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.blue }}/> Holiday</div>
                  </div>
                </div>

                {/* Submitted excuse letters history */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Excuse Letter Log</div>
                    {apiExcuses.map((log, i) => (
                      <div key={log.id} style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `0.5px solid ${C.border}` }}>
                        <div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.t1 }}>{log.reason || "Absence Excuse"}</div>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>For: {new Date(log.start_date).toLocaleDateString()} - {new Date(log.end_date).toLocaleDateString()}</div>
                          {log.document_id && (
                            <button 
                              onClick={async () => {
                                try {
                                  const presignRes: any = await studentApi.getPresignedDownloadUrl(log.document_id);
                                  const url = presignRes?.url || presignRes?.data?.url;
                                  if (url) {
                                      window.open(url.startsWith('http') ? url : `http://localhost:5000${url}`, '_blank');
                                  } else {
                                      alert("Failed to load attachment");
                                  }
                                } catch (e) {
                                  alert("Failed to load attachment");
                                }
                              }}
                              type="button"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.blue, fontSize: 10, fontWeight: 600, padding: 0, marginTop: 6, cursor: "pointer" }}
                            >
                              <Paperclip size={10} /> View Attachment
                            </button>
                          )}
                        </div>
                        <Stamp label={log.status} color={log.status === "Approved" ? C.green : log.status === "Rejected" ? C.red : C.amber} bg={log.status === "Approved" ? C.greenBg : log.status === "Rejected" ? C.redBg : C.amberBg} />
                      </div>
                    ))}
                    {apiExcuses.length === 0 && (
                      <div style={{ padding: "30px 20px", fontSize: 12, color: C.t3, textAlign: "center" }}>No excuse letters submitted yet.</div>
                    )}
                  </div>
              </div>
            </div>
          )}

          {/* 4. ASSIGNMENTS & TO-DOS */}
          {tab === "assignments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Unified To-Do Task Tracker</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Checked items represent completed assignments.</div>
              </div>

              {/* To-Do Checklist tracker */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>My Assignments Checklist</div>
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {assignments.filter(a => a.section === currentUser?.section).map((todo) => {
                    const isCompleted = assignmentSubmissions.some(s => s.assignmentId === todo.id && s.studentId === currentUser?.id);
                    return (
                      <div 
                        key={todo.id} 
                        style={{ 
                          display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", 
                          border: `1px solid ${C.borderMed}`, borderRadius: 4, 
                          background: isCompleted ? C.greenBg + "20" : "#fff",
                          transition: "all 0.12s"
                        }}
                      >
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${isCompleted ? C.green : C.border}`, background: isCompleted ? C.green : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isCompleted && <Check size={12} color="#fff" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ 
                            fontSize: 12, fontWeight: 600, color: isCompleted ? C.t3 : C.t1,
                            textDecoration: isCompleted ? "line-through" : "none"
                          }}>
                            {todo.title}
                          </span>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{todo.subject} &middot; Due: <strong style={{ color: isCompleted ? C.t3 : C.red }}>{todo.dueDate}</strong></div>
                        </div>
                        <Stamp label={todo.type} color={C.blue} bg={C.blueBg} />
                      </div>
                    );
                  })}
                  {assignments.filter(a => a.section === currentUser?.section).length === 0 && (
                    <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: C.t3 }}>No assignments at this time.</div>
                  )}
                </div>
              </div>

              {/* Upcoming Exams */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Upcoming Exams Schedule</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ padding: 14 }}>
                  {[
                    { title: "First Term Assessment", dates: "June 25 - June 26, 2025", desc: "Covers all modules in Term 1" },
                    { title: "Mathematics Unit 1 Exam", dates: "June 15, 2025", desc: "Focus: Quadratic equations & functions" }
                  ].map((ex, i) => (
                    <div key={i} style={{ border: `1px solid ${C.borderMed}`, padding: 12, borderRadius: 4, background: C.paper }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{ex.title}</div>
                      <div style={{ fontSize: 10.5, color: C.m700, fontWeight: 600, marginTop: 4 }}>{ex.dates}</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>{ex.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* 8. CLINIC RECORD */}
          {tab === "clinic" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Student Health & Medical Log</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Privately logged clinic records and health alerts.</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Medical Profile</div>
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      ["Blood Type", currentUser?.studentProfile?.blood_type || "Unknown"],
                      ["Known Allergies", currentUser?.studentProfile?.allergies || "None logged"],
                      ["Conditions", currentUser?.studentProfile?.medical_conditions || "None logged"]
                    ].map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `0.5px solid ${C.border}` }}>
                        <span style={{ fontSize: 10.5, color: C.t3, fontWeight: 600 }}>{l}</span>
                        <span style={{ fontSize: 11, color: C.t1, fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Medical Notifications & Health Alerts</div>
                  <div style={{ padding: 14 }}>
                    <div style={{ border: `1px solid ${C.borderMed}`, background: C.blueBg, color: C.blue, padding: 12, borderRadius: 4 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700 }}>Annual Physical Examination</div>
                      <div style={{ fontSize: 10, marginTop: 4 }}>Scheduled for July 15, 2026, 9:00 AM at the school main clinic office. Parent consent form required.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Clinic Visits Log</div>
                <div style={{ padding: "12px 14px" }}>
                  {apiClinicRecords.length === 0 ? (
                    <div style={{ fontSize: 11, color: C.t3 }}>No clinic visits logged.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {apiClinicRecords.map((visit: any) => (
                        <div key={visit.id} style={{ borderBottom: `0.5px solid ${C.border}`, paddingBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>
                                {visit.symptoms ? `Symptoms: ${visit.symptoms}` : "No symptoms recorded"}
                              </div>
                              <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                                {visit.diagnosis && <span>Diagnosis: {visit.diagnosis} &middot; </span>}
                                {visit.medications && <span>Medications: {visit.medications} &middot; </span>}
                                Nurse: {visit.recorded_by}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <span style={{ fontSize: 10, color: C.t3 }}>
                                {new Date(visit.date).toLocaleDateString()} {visit.time ? new Date(visit.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                              {(visit.temperature || visit.blood_pressure || visit.heart_rate) && (
                                <span style={{ fontSize: 9.5, color: C.t3, marginTop: 4 }}>
                                  Vitals: {visit.temperature ? `${visit.temperature}°C` : ''} {visit.blood_pressure} {visit.heart_rate ? `${visit.heart_rate}bpm` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          {visit.treatments && (
                            <div style={{ fontSize: 10.5, color: C.t2, marginTop: 6 }}>
                              <span style={{ fontWeight: 600 }}>Treatments:</span> {visit.treatments}
                            </div>
                          )}
                          {visit.notes && (
                            <div style={{ fontSize: 10.5, color: C.t2, marginTop: 2 }}>
                              <span style={{ fontWeight: 600 }}>Notes:</span> {visit.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

                  {/* School Calendar & Class Schedule Tab */}
          {tab === "calendar" && (() => {
            const calYear = calendarDate.getFullYear();
            const calMonth = calendarDate.getMonth();
            const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
            let firstDay = new Date(calYear, calMonth, 1).getDay();
            firstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon=0
            
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            
            return (
            <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1600, width: "100%", margin: "0 auto" }}>
              
              {/* Top Row: Monthly Calendar & Events */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-6">
                {/* Left: Monthly Calendar Preview */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                  <div style={{ background: C.m900, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <button onClick={() => setCalendarDate(new Date(calYear, calMonth - 1, 1))} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}><ChevronLeft size={14} color="#fff" /></button>
                    <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>{monthNames[calMonth]} {calYear}</span>
                    <button onClick={() => setCalendarDate(new Date(calYear, calMonth + 1, 1))} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}><ChevronRight size={14} color="#fff" /></button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${C.borderMed}`, textAlign: "center", background: "#f8fafc" }}>
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, i) => (
                      <div key={i} style={{ padding: "10px 4px", fontSize: 10, fontWeight: 700, color: C.t3, letterSpacing: "0.05em" }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#fff" }}>
                    {[...Array(42)].map((_, idx) => {
                      const day = idx - firstDay + 1;
                      const valid = day >= 1 && day <= daysInMonth;
                      const dayStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const dayEvents = SCHOOL_EVENTS.filter(e => e.date === dayStr && (e.audience === "all" || e.audience === "students"));
                      const isToday = valid && day === new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear();

                      return (
                        <div key={idx} style={{ 
                          minHeight: 80, 
                          padding: 8, 
                          borderRight: `1px solid ${C.border}`, 
                          borderBottom: `1px solid ${C.border}`,
                          background: isToday ? C.m50 : "#fff",
                          boxSizing: "border-box"
                        }}>
                          {valid && (
                            <>
                              <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? C.m700 : idx % 7 >= 5 ? C.t3 : C.t1, marginBottom: 4 }}>{day}</div>
                              {dayEvents.map(ev => {
                                const timeStr = formatTimeDisplay(ev.time);
                                const endStr = formatTimeDisplay(ev.endTime);
                                const fullTime = timeStr ? (endStr ? `${timeStr} - ${endStr}` : timeStr) : "All day";
                                return (
                                  <div key={ev.id} title={ev.title} 
                                    style={{ 
                                      fontSize: 9, 
                                      fontWeight: 700, 
                                      color: C.m700, 
                                      background: C.m50, 
                                      borderRadius: 4, 
                                      padding: "4px 6px", 
                                      marginTop: 4, 
                                      lineHeight: 1.3,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      display: "flex",
                                      flexDirection: "column",
                                      cursor: "default",
                                      border: `1px solid ${C.m700}30`,
                                      transition: "all 0.2s"
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <Lock size={8} /> {ev.title}
                                    </div>
                                    {fullTime && <div style={{ fontSize: 8, color: C.m700, marginTop: 2, opacity: 0.9 }}>{fullTime}</div>}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: School Events list */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                    <CalendarCheck size={18} color={C.m700} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Upcoming Events</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
                    {events.filter(e => e.audience === "all" || e.audience === "students").map(ev => (
                      <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${C.border}`, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: 4, height: 32, background: C.m700, borderRadius: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                           <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                           <div style={{ fontSize: 10, color: C.t3, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><Calendar size={10} /> {ev.date}</div>
                        </div>
                        <Lock size={12} color={C.t3} style={{ flexShrink: 0, opacity: 0.5 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Weekly Timetable */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={18} color={C.m700} /> Weekly Class Timetable (Grade 10 - Pilot)
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.m700, background: C.m50, padding: "4px 12px", borderRadius: 12 }}>Adviser: Ms. Soriano</span>
                </div>
                <div style={{ padding: 20, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", minWidth: 800 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "0 12px 8px 12px", fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", width: 120 }}>Time</th>
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => (
                          <th key={day} style={{ textAlign: "left", padding: "0 12px 8px 12px", fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...Array(7)].map((_, pIdx) => {
                        const timeSlot = CLASS_SCHEDULE.Monday[pIdx]?.time || "";
                        return (
                          <tr key={pIdx}>
                            <td style={{ padding: "0 12px", fontSize: 11.5, fontWeight: 700, color: C.t2, whiteSpace: "nowrap" }}>{timeSlot}</td>
                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => {
                              const period = CLASS_SCHEDULE[day][pIdx];
                              if (!period) return <td key={day} style={{ padding: "0 6px" }} />;
                              return (
                                <td key={day} style={{ padding: "0 6px" }}>
                                  <div style={{ 
                                    background: "#fff", 
                                    border: `1px solid ${C.borderMed}`, 
                                    borderLeft: `4px solid ${C.m700}`, 
                                    padding: "10px 12px", 
                                    borderRadius: 6, 
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                                    transition: "transform 0.15s, box-shadow 0.15s",
                                    cursor: "default"
                                  }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = C.borderHeavy; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02)"; e.currentTarget.style.borderColor = C.borderMed; }}
                                  >
                                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{period.subject}</div>
                                    <div style={{ fontSize: 10, color: C.t2, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><School size={10} color={C.t3} /> {period.room}</div>
                                    <div style={{ fontSize: 9, color: C.t3, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><User size={10} color={C.t3} /> {period.teacher}</div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            );
          })()}

          {/* 8. BOOK APPOINTMENT TAB */}
          {tab === "appointments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Header */}
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif" }}>{STUDENT_TAB_METADATA[tab].title}</h2>
                <p style={{ fontSize: 14, color: C.t3, marginTop: 4 }}>{STUDENT_TAB_METADATA[tab].sub}</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
                {/* Left Column: Form */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 16 }}>Request a Meeting</div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!apptTeacher || !apptDate || !apptTime || !apptPurpose) {
                      setDocError("Please complete all required fields.");
                      return;
                    }
                    setIsSubmittingAppt(true);
                    
                    let excuseDocId, excuseDocName, excuseDocType, excuseDocSize;
                    try {
                      await studentApi.createAppointment({
                        studentId: currentUser?.id,
                        teacherId: apptTeacher,
                        date: apptDate,
                        time: apptTime,
                        purpose: apptPurpose,
                        parentEmail: apptParentEmail || currentUser?.parentEmail || "",
                      });
                      await fetchAppointments();
                      setApptTeacher("");
                      setApptDate("");
                      setApptTime("");
                      setApptPurpose("");
                      setApptParentEmail("");
                      setDocError("");
                      setIsSubmittingAppt(false);
                    } catch (err) {
                      console.error(err);
                      setDocError("Failed to book appointment");
                      setIsSubmittingAppt(false);
                    }
                  }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Parent Email */}
                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Parent / Guardian Email</label>
                      <input
                        type="email"
                        value={apptParentEmail || currentUser?.parentEmail || ""}
                        onChange={e => setApptParentEmail(e.target.value)}
                        placeholder="parent@email.com"
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", boxSizing: "border-box", outline: "none" }}
                      />
                      {currentUser?.parentEmail && !apptParentEmail && (
                        <div style={{ marginTop: 4, fontSize: 9.5, color: C.green, display: "flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle size={10} /> Auto-filled from Settings
                        </div>
                      )}
                    </div>

                    {/* Select Teacher */}
                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Select Teacher</label>
                      <select
                        value={apptTeacher}
                        onChange={e => setApptTeacher(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", color: C.t1, outline: "none", boxSizing: "border-box" }}
                      >
                        <option value="">— Choose a teacher or staff —</option>
                        <optgroup label="Subject Teachers">
                          {teachers.filter(t => t.type === 'subject').map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Support Staff">
                          {teachers.filter(t => t.type === 'support').map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Preferred Date</label>
                        <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)}
                          style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", boxSizing: "border-box", outline: "none" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Preferred Time</label>
                        <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)}
                          style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", boxSizing: "border-box", outline: "none" }} />
                      </div>
                    </div>

                    {/* Purpose */}
                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose / Agenda</label>
                      <textarea
                        value={apptPurpose}
                        onChange={e => setApptPurpose(e.target.value)}
                        placeholder="Describe the purpose of this appointment..."
                        rows={4}
                        maxLength={300}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, resize: "none", background: "#f9fafb", boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif" }}
                      />
                      <div style={{ textAlign: "right", fontSize: 10, color: C.t3, marginTop: 4 }}>{apptPurpose.length} / 300</div>
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={isSubmittingAppt} style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      background: isSubmittingAppt ? C.borderMed : C.m700, color: "#fff", border: "none",
                      padding: "10px 18px", borderRadius: 6, cursor: isSubmittingAppt ? "default" : "pointer",
                      fontSize: 12, fontWeight: 700, width: "100%",
                      boxShadow: isSubmittingAppt ? "none" : "0 2px 8px rgba(29,78,216,0.25)",
                      transition: "all 0.15s",
                      marginTop: 8,
                      opacity: isSubmittingAppt ? 0.7 : 1
                    }}>
                      <Send size={14} /> {isSubmittingAppt ? "Sending..." : "Send Request"}
                    </button>
                  </form>
                </div>

                {/* Right Column: History */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Clock size={16} color={C.m700} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Appointment History</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.t3 }}>{apiAppointments.length} total</span>
                  </div>

                  {apiAppointments.length === 0 ? (
                    <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 48, textAlign: "center" }}>
                      <CalendarCheck size={36} color={C.t3} style={{ opacity: 0.4, marginBottom: 10 }} />
                      <div style={{ fontSize: 13, color: C.t3 }}>No appointments yet. Book your first one!</div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                    {apiAppointments.map(appt => (
                      <div key={appt.id} style={{
                        background: "#fff", border: `1px solid ${C.borderMed}`,
                        borderRadius: 12, padding: "18px 20px",
                        display: "flex", flexDirection: "column", gap: 14,
                        position: "relative"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 16, background: appt.direction === "parent-to-teacher" ? C.m50 : C.purpleBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {appt.direction === "parent-to-teacher" ? <Send size={14} color={C.m700} /> : <Mail size={14} color={C.purple} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, lineHeight: 1.3 }}>{appt.teacherName}</div>
                              <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                {appt.direction === "parent-to-teacher" ? "You → Teacher" : "Teacher → Parent"}
                              </div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: apptStatusColor(appt.status),
                            background: apptStatusBg(appt.status), padding: "3px 10px",
                            borderRadius: 10, border: `1px solid ${apptStatusColor(appt.status)}20`,
                            display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                          }}><div style={{ width: 5, height: 5, borderRadius: 3, background: apptStatusColor(appt.status) }} />{appt.status}</span>
                        </div>

                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t2 }}>
                            <CalendarCheck size={11} color={C.m700} /> {appt.date}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t2 }}>
                            <Clock size={11} color={C.m700} /> {appt.time}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.t2 }}>
                            <Mail size={11} color={C.m700} /> {appt.parentEmail}
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: C.t2, padding: "10px 14px", background: "#f9fafb", borderRadius: 8, borderLeft: `3px solid ${C.m700}` }}>
                          <strong style={{ color: C.t1, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 4 }}>Purpose:</strong> {appt.purpose}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 9.5, color: C.t3 }}>Requested on {appt.createdAt}</span>
                          <button
                            onClick={() => setShowApptEmailPreview(appt.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              background: "#fff", color: C.m700, border: `1px solid ${C.borderMed}`,
                              padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                              fontSize: 10, fontWeight: 600, transition: "all 0.15s",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.m50; e.currentTarget.style.borderColor = `${C.m700}30`; e.currentTarget.style.boxShadow = "none"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = C.borderMed; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02)"; }}
                          >
                            <Eye size={11} /> View Email
                          </button>
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Email Preview Modal for Student Appointments */}
          {showApptEmailPreview && (() => {
            const appt = appointments.find(a => a.id === showApptEmailPreview);
            if (!appt) return null;
            return (
              <div onClick={() => setShowApptEmailPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                <div onClick={e => e.stopPropagation()} className="w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto" style={{
                  background: "#fff", borderRadius: 12,
                  boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
                  animation: "popIn 0.25s ease-out"
                }}>
                  <style>{`@keyframes popIn { 0% { opacity:0; transform:translateY(16px) scale(0.97); } 100% { opacity:1; transform:translateY(0) scale(1); } }`}</style>
                  <div style={{ background: C.paper, padding: "16px 24px", borderBottom: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Mail size={16} color={C.m700} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Email Preview</span>
                    </div>
                    <button onClick={() => setShowApptEmailPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.t3, fontSize: 16 }}>✕</button>
                  </div>
                  <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, width: 50 }}>To:</span>
                      <span style={{ fontSize: 11, color: C.t1 }}>{appt.parentEmail}, {appt.teacherName}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, width: 50 }}>From:</span>
                      <span style={{ fontSize: 11, color: C.t1 }}>noreply@calulut-is.edu.ph</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, width: 50 }}>Subject:</span>
                      <span style={{ fontSize: 11, color: C.t1, fontWeight: 600 }}>Parent-Teacher Appointment Request — Calulut Integrated School</span>
                    </div>
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
                      <div style={{ fontSize: 12, color: C.t1, lineHeight: 1.7, background: C.paper, padding: "16px 18px", borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <p style={{ margin: "0 0 10px" }}>Dear {appt.teacherName} & Parent/Guardian,</p>
                        <p style={{ margin: "0 0 10px" }}>
                          A <strong>parent-teacher appointment</strong> has been requested by the student <strong>{appt.studentName}</strong>.
                        </p>
                        <p style={{ margin: "0 0 6px" }}><strong>Appointment Details:</strong></p>
                        <ul style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: 11.5 }}>
                          <li><strong>Teacher:</strong> {appt.teacherName}</li>
                          <li><strong>Date:</strong> {appt.date}</li>
                          <li><strong>Time:</strong> {appt.time}</li>
                          <li><strong>Purpose:</strong> {appt.purpose}</li>
                          <li><strong>Parent Email:</strong> {appt.parentEmail}</li>
                        </ul>
                        <p style={{ margin: "0 0 10px" }}>Please confirm your availability. The teacher will review this request and respond accordingly.</p>
                        <p style={{ margin: "0", color: C.t3 }}>— Calulut Integrated School</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, background: C.amberBg, padding: "4px 12px", borderRadius: 10, border: `1px solid ${C.amber}30` }}>
                        ⚠ This is a preview — email sending is simulated
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

{/* 9. REQUEST DOCUMENTS TAB */}
          {tab === "doc-requests" && (() => {
            const myRequests = apiDocRequests;
            const totalCount = myRequests.length;
            const submittedCount = myRequests.filter(r => r.current_stage === 1).length;
            const inProgressCount = myRequests.filter(r => r.current_stage >= 2 && r.current_stage < 4 && !r.status.includes("Rejected")).length;
            const completedCount = myRequests.filter(r => r.status === "Completed" || r.status === "Ready for Pickup").length;

            const filteredRequests = docFilter === "all" ? myRequests :
              docFilter === "Submitted" ? myRequests.filter(r => r.current_stage === 1) :
              docFilter === "Teacher Approved" ? myRequests.filter(r => r.current_stage >= 2 && r.current_stage < 4) :
              myRequests.filter(r => r.status === "Completed" || r.status === "Ready for Pickup");

            return (
            <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-8 w-full">
              {/* LEFT SIDEBAR: Request Form */}
              <div style={{ position: "sticky", top: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.borderMed}`, overflow: "hidden", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={16} color={C.m700} /></div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>New Request</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.t3, marginLeft: 36, marginBottom: 20 }}>Request official school documents</div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!docType || !docPurpose) {
                      setDocError("Please select a document type and state the purpose.");
                      return;
                    }
                    setDocSubmitting(true);
                    
                    try {
                      await studentApi.createDocumentRequest({
                        studentId: currentUser?.id || "",
                        studentName: currentUser?.name || "",
                        section: currentUser?.section || "",
                        documentType: docType,
                        purpose: docPurpose,
                      });
                      
                      await fetchDocRequests();
                      
                      setDocType("");
                      setDocPurpose("");
                      setDocError("");
                      setDocSubmitting(false);
                    } catch (err) {
                      console.error(err);
                      setDocError("Failed to submit request.");
                      setDocSubmitting(false);
                    }
                  }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {docError && (
                      <div style={{ padding: "10px 14px", background: C.redBg, border: `1px solid ${C.red}40`, borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <XCircle size={14} /> {docError}
                      </div>
                    )}
                    {docSuccess && (
                      <div style={{ padding: "10px 14px", background: C.greenBg, border: `1px solid ${C.green}40`, borderRadius: 6, color: C.green, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle size={14} /> Document request submitted successfully!
                      </div>
                    )}

                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Document Type</label>
                      <select
                        value={docType}
                        onChange={e => {
                          const val = e.target.value;
                          setDocType(val);
                        }}
                        disabled={docSubmitting}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, background: "#f9fafb", color: C.t1, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                      >
                        <option value="">— Select Document —</option>
                        <option value="Certificate of Good Moral">Certificate of Good Moral</option>
                        <option value="Certificate of Enrollment">Certificate of Enrollment</option>
                        <option value="Form 137 (Permanent Record)">Form 137 (Permanent Record)</option>
                        <option value="Diploma Copy">Diploma Copy</option>
                        <option value="Honorable Dismissal">Honorable Dismissal</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>Purpose of Request</label>
                      <textarea
                        value={docPurpose}
                        onChange={e => setDocPurpose(e.target.value)}
                        disabled={docSubmitting}
                        placeholder="Why do you need this document?"
                        rows={4}
                        maxLength={300}
                        style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1.5px solid ${C.borderMed}`, borderRadius: 8, resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif", background: "#f9fafb" }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                        <div style={{ fontSize: 10, color: C.t3 }}>{docPurpose.length} / 300</div>
                      </div>
                    </div>

                    <button type="submit" disabled={docSubmitting} style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      background: docSubmitting ? C.borderMed : C.m700, color: docSubmitting ? C.t3 : "#fff", border: "none",
                      padding: "10px 18px", borderRadius: 6, cursor: docSubmitting ? "not-allowed" : "pointer",
                      fontSize: 12, fontWeight: 700, width: "100%",
                      boxShadow: docSubmitting ? "none" : "0 2px 8px rgba(29,78,216,0.25)",
                      transition: "all 0.15s"
                    }}>
                      {docSubmitting ? "Submitting..." : "Submit Request"}
                    </button>
                  </form>
                </div>
                </div>
              </div>

              {/* RIGHT MAIN: Request Tracker */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Tracker Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Activity size={18} color={C.m700} />
                  <span style={{ fontSize: 18, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Request Tracker</span>
                  <span style={{ fontSize: 11, color: C.t3, marginLeft: 4 }}>{totalCount} total records on file</span>
                </div>

                {/* Stats Cards */}
                <div style={{ display: "flex", gap: 12 }}>
                  {[
                    { label: "Total", count: totalCount, color: C.t1, bg: "#fff", borderColor: C.borderMed },
                    { label: "Submitted", count: submittedCount, color: "#f59e0b", bg: "#fef3c7", borderColor: "#fde68a" },
                    { label: "In Progress", count: inProgressCount, color: "#f59e0b", bg: "#fffbeb", borderColor: "#fef3c7" },
                    { label: "Completed", count: completedCount, color: C.green, bg: C.greenBg, borderColor: `${C.green}30` },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.borderColor}`, borderRadius: 12, padding: "14px 18px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: "'Fraunces', serif" }}>{s.count}</div>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Request Cards Grid */}
                {filteredRequests.length === 0 ? (
                  <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 48, textAlign: "center" }}>
                    <FileText size={36} color={C.t3} style={{ opacity: 0.4, marginBottom: 10 }} />
                    <div style={{ fontSize: 13, color: C.t3 }}>No document requests found.</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
                    {filteredRequests.map(req => {
                      const isExpanded = expandedDocSteps[req.id] || false;
                      const doneCount = req.status.includes("Rejected") ? 0 : [1,2,3,4].filter(s => req.current_stage > s || (req.current_stage === 4 && s === 4)).length;
                      const progressPct = Math.round((doneCount / 4) * 100);
                      const isCompletedOrApproved = req.status === "Completed" || req.status === "Ready for Pickup" || req.status.includes("Approved");
                      const isRejected = req.status.includes("Rejected");
                      const statusColor = isCompletedOrApproved ? C.green : isRejected ? C.red : "#f59e0b";
                      const statusBg = isCompletedOrApproved ? C.greenBg : isRejected ? C.redBg : "#fef3c7";
                      const statusBorderColor = isCompletedOrApproved ? `${C.green}40` : isRejected ? `${C.red}40` : "#fde68a";
                      
                      return (
                        <div key={req.id} style={{
                          background: "#fff", border: `1px solid ${C.borderMed}`, 
                          borderLeft: `4px solid ${statusColor}`, 
                          borderRadius: 12, overflow: "hidden",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          transition: "all 0.2s"
                        }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = `${C.m700}40`; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = C.borderMed; }}
                        >
                          {/* Card Header */}
                          <div style={{ padding: "16px 18px 14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, lineHeight: 1.3 }}>{req.document_type}</div>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 10, flexShrink: 0,
                                color: statusColor, background: statusBg, border: `1px solid ${statusBorderColor}`,
                                display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                              }}><div style={{ width: 5, height: 5, borderRadius: 3, background: statusColor }} />{req.status}</span>
                            </div>
                            <div style={{ fontSize: 10.5, color: C.t3 }}>Requested {new Date(req.submitted_date).toLocaleDateString()}</div>

                            {/* Progress Bar */}
                            <div style={{ marginTop: 14 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 500, color: C.t3 }}>Progress</span>
                                <span style={{ fontSize: 10, fontWeight: 600, color: C.t2 }}>{doneCount}/4 steps</span>
                              </div>
                              <div style={{ height: 5, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${progressPct}%`, background: statusColor, borderRadius: 3, transition: "width 0.5s ease" }} />
                              </div>
                            </div>
                          </div>

                          {/* Collapsible Steps */}
                          <div style={{ borderTop: `1px solid ${C.border}` }}>
                            <button onClick={() => setExpandedDocSteps(prev => ({ ...prev, [req.id]: !prev[req.id] }))} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                              padding: "10px 18px", background: isExpanded ? "#fff" : "#f9fafb", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: C.t3,
                              transition: "background 0.15s"
                            }}
                              onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                              onMouseLeave={e => e.currentTarget.style.background = isExpanded ? "#fff" : "#f9fafb"}
                            >
                              <span>View steps</span>
                              <ChevronDown size={14} style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                            </button>
                            {isExpanded && (
                              <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column" }}>
                                {req.status.includes("Rejected") ? (
                                  <div style={{ textAlign: "center", color: C.red, fontSize: 12, fontWeight: 600, padding: "12px 0" }}>
                                    <XCircle size={20} style={{ marginBottom: 6 }} />
                                    <div>Request was rejected.</div>
                                    <div style={{ fontSize: 11, color: C.t2, fontWeight: 400, marginTop: 4 }}>
                                      {req.teacherRemarks || req.principalRemarks || "No remarks provided."}
                                    </div>
                                  </div>
                                ) : (
                                  [{stage:1,label:"Submitted",desc:new Date(req.submitted_date).toLocaleDateString()},
                                   {stage:2,label:"Teacher Verified",desc:""},
                                   {stage:3,label:"Principal Approved",desc:""},
                                   {stage:4,label:"Ready for Pickup",desc:""}
                                  ].map((step, i, arr) => {
                                    const isDone = req.current_stage > step.stage || (req.current_stage === 4 && step.stage === 4);
                                    const isActive = req.current_stage === step.stage;
                                    return (
                                      <div key={i} style={{ display: "flex", gap: 14, position: "relative", paddingBottom: i === arr.length - 1 ? 0 : 16 }}>
                                        {i < arr.length - 1 && (
                                          <div style={{ position: "absolute", left: 10, top: 22, bottom: -2, width: 2, background: isDone ? C.green : C.borderMed, zIndex: 1 }} />
                                        )}
                                        <div style={{
                                          width: 22, height: 22, borderRadius: 11, zIndex: 2, flexShrink: 0, marginTop: 1,
                                          background: isDone ? C.green : isActive ? "#f59e0b" : "#fff",
                                          border: `2px solid ${isDone ? C.green : isActive ? "#f59e0b" : C.borderMed}`,
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                          {isDone ? <CheckCircle size={11} color="#fff" /> : isActive ? <Clock size={11} color="#fff" /> : <div style={{ width: 5, height: 5, borderRadius: 3, background: C.borderMed }} />}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                          <span style={{ fontSize: 11.5, fontWeight: isDone || isActive ? 700 : 500, color: isDone ? C.green : isActive ? "#f59e0b" : C.t3 }}>{step.label}</span>
                                          {step.desc && <span style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>{step.desc}</span>}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>

                          {/* Purpose Footer */}
                          <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Purpose:</div>
                            <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5 }}>{req.purpose}</div>
                            {req.status === "Completed" && (
                              <button onClick={() => alert("Downloading " + req.document_type)} style={{
                                display: "flex", alignItems: "center", gap: 6, background: C.green, color: "#fff", border: "none",
                                padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, marginTop: 10,
                                transition: "all 0.15s", boxShadow: "0 2px 6px rgba(16,185,129,0.25)"
                              }}
                                onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                              >
                                <FileText size={12} /> View Document
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            );
          })()}

{/* 10. SETTINGS PAGE */}
          {tab === "settings" && (
            <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-8 py-2.5 w-full" style={{ animation: "fadeIn 0.3s ease-out" }}>
              
              {/* Profile Card */}
              <div style={{ 
                background: "#fff", 
                borderRadius: 16, 
                padding: "32px 24px", 
                textAlign: "center",
                boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.04)",
                height: "fit-content",
                position: "relative",
                overflow: "hidden"
              }}>
                {/* Decorative background element */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, background: `linear-gradient(135deg, ${C.m700}, ${C.m900})`, zIndex: 0 }} />
                
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, position: "relative" }}>
                    <div style={{ 
                      width: 96, height: 96, borderRadius: 48, 
                      background: "#fff", padding: 4,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)"
                    }}>
                      <div style={{ 
                        width: "100%", height: "100%", borderRadius: 50, 
                        background: `linear-gradient(135deg, ${C.m600}, ${C.m800})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        overflow: "hidden"
                      }}>
                        {photoUrl ? (
                          <img src={photoUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 32, fontWeight: 800, color: C.gold, letterSpacing: "-1px" }}>
                            {currentUser?.name ? currentUser.name.split(" ").map(n => n[0]).join("").substring(0,2) : "SJ"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{currentUser?.name || "Student User"}</div>
                  <div style={{ fontSize: 13, color: C.t2 }}>{currentUser?.section || "Grade 10 - Pilot Section"}</div>
                  <div style={{ fontSize: 12, color: C.t3, marginTop: 4, fontWeight: 500 }}>Learner Reference Number: <span style={{ color: C.m700, fontWeight: 700 }}>100001</span></div>
                  
                  <div style={{ marginTop: 24, padding: "16px", background: C.paper, borderRadius: 12, border: `1px solid ${C.borderMed}`, textAlign: "left" }}>
                     <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Account Status</div>
                     <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                       <div style={{ width: 8, height: 8, borderRadius: 4, background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
                       <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Active & Enrolled</span>
                     </div>
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: "none" }} 
                    accept="image/jpeg, image/png"
                    onChange={handlePhotoUpload}
                  />
                  {photoUploadError && <div style={{ color: C.red, fontSize: 12, marginTop: 8, textAlign: "center", fontWeight: 600 }}>{photoUploadError}</div>}
                  <button 
                    disabled={isUploadingPhoto}
                    onClick={() => fileInputRef.current?.click()} 
                    style={{ 
                      marginTop: 24, width: "100%", background: "#fff", 
                      border: `1px solid ${C.m700}`, 
                      padding: "10px 16px", borderRadius: 8, cursor: isUploadingPhoto ? "not-allowed" : "pointer", 
                      fontSize: 13, fontWeight: 700, color: C.m700, 
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "all 0.2s",
                      opacity: isUploadingPhoto ? 0.6 : 1
                    }}
                  >
                    <Upload size={16} />
                    {isUploadingPhoto ? "Uploading..." : "Change Profile Photo"}
                  </button>
                </div>
              </div>

              {/* Settings Forms Container */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Contact Email */}
                <div style={{ 
                  background: "#fff", borderRadius: 16, padding: 32,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.04)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1" }}>
                      <Mail size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Contact Information</h3>
                      <p style={{ fontSize: 12, color: C.t3, margin: "4px 0 0 0" }}>Receive official school communications and alerts.</p>
                    </div>
                  </div>

                  <form onSubmit={handleEmailSave} style={{ marginTop: 24 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 8 }}>Parent / Guardian Email</label>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <input 
                          type="email" 
                          value={emailInputValue} 
                          onChange={e => setEmailInputValue(e.target.value)} 
                          placeholder="parent@email.com" 
                          style={{ 
                            width: "100%", padding: "12px 16px", fontSize: 14, boxSizing: "border-box",
                            background: C.paper, border: `1px solid ${emailError ? C.red : C.borderMed}`, borderRadius: 8, 
                            outline: "none", color: C.t1, transition: "border-color 0.2s" 
                          }} 
                          onFocus={e => e.target.style.borderColor = emailError ? C.red : "#6366f1"}
                          onBlur={e => e.target.style.borderColor = emailError ? C.red : C.borderMed}
                        />
                        {emailError && <div style={{ color: C.red, fontSize: 11, marginTop: 6, fontWeight: 600 }}>{emailError}</div>}
                      </div>
                      <button 
                        type="submit" 
                        disabled={isSavingEmail}
                        style={{ 
                          background: emailSaveSuccess ? C.green : C.m700, color: "#fff", 
                          border: "none", padding: "0 24px", borderRadius: 8, cursor: isSavingEmail ? "not-allowed" : "pointer", 
                          fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8,
                          transition: "all 0.2s", boxShadow: emailSaveSuccess ? `0 4px 12px ${C.green}40` : "none",
                          height: 44, opacity: isSavingEmail ? 0.7 : 1
                        }}
                      >
                        {emailSaveSuccess ? <CheckCircle size={16} /> : <CheckSquare size={16} />}
                        {emailSaveSuccess ? "Saved" : isSavingEmail ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Password Change */}
                <div style={{ 
                  background: "#fff", borderRadius: 16, padding: 32,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.04)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold }}>
                      <Lock size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Security Settings</h3>
                      <p style={{ fontSize: 12, color: C.t3, margin: "4px 0 0 0" }}>Update your password to keep your account secure.</p>
                    </div>
                  </div>

                  <form onSubmit={e => e.preventDefault()} style={{ marginTop: 24 }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 8 }}>Current Password</label>
                        <input 
                          type="password" disabled value="••••••••" placeholder="••••••••" 
                          style={{ 
                            width: "100%", padding: "12px 16px", fontSize: 14, 
                            background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 8, 
                            boxSizing: "border-box", outline: "none", transition: "border-color 0.2s", opacity: 0.7
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 8 }}>New Password</label>
                        <input 
                          type="password" disabled value="" placeholder="••••••••" 
                          style={{ 
                            width: "100%", padding: "12px 16px", fontSize: 14, 
                            background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 8, 
                            boxSizing: "border-box", outline: "none", transition: "border-color 0.2s", opacity: 0.7
                          }}
                        />
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: 16, fontSize: 12, color: C.t3, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertCircle size={14} color={C.m500} />
                      Password changes will be available when secure backend authentication is implemented.
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button 
                        type="button" 
                        disabled
                        style={{ 
                          background: C.borderMed, color: C.t3, 
                          border: "none", padding: "12px 24px", borderRadius: 8, cursor: "not-allowed", 
                          fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8,
                          transition: "all 0.2s"
                        }}
                      >
                        <Shield size={16} />
                        Update Password
                      </button>
                    </div>
                  </form>
                </div>

                {/* Notifications */}
                <div style={{ 
                  background: "#fff", borderRadius: 16, padding: 32,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.04)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}>
                      <Bell size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Notification Preferences</h3>
                      <p style={{ fontSize: 12, color: C.t3, margin: "4px 0 0 0" }}>Control how you receive updates and alerts.</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Toggle 1 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: C.paper, borderRadius: 12, border: `1px solid ${C.borderMed}` }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>SMS Broadcasts</div>
                        <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Receive emergency alerts and tardiness logs on your mobile.</div>
                      </div>
                      <div 
                        onClick={() => {
                          updateCurrentUser({ smsAlerts: !currentUser?.smsAlerts }).catch(console.error);
                        }}
                        style={{ 
                          width: 44, height: 24, borderRadius: 12, 
                          background: currentUser?.smsAlerts ? C.green : C.borderMed, 
                          position: "relative", cursor: "pointer", transition: "background 0.3s"
                        }}
                      >
                        <div style={{ 
                          width: 18, height: 18, borderRadius: 9, background: "#fff", 
                          position: "absolute", top: 3, left: currentUser?.smsAlerts ? 23 : 3, 
                          transition: "left 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" 
                        }} />
                      </div>
                    </div>

                    {/* Toggle 2 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: C.paper, borderRadius: 12, border: `1px solid ${C.borderMed}` }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Weekly Email Reports</div>
                        <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Get a summary of scholastic averages and grading checklists.</div>
                      </div>
                      <div 
                        onClick={() => {
                          updateCurrentUser({ emailAlerts: !currentUser?.emailAlerts }).catch(console.error);
                        }}
                        style={{ 
                          width: 44, height: 24, borderRadius: 12, 
                          background: currentUser?.emailAlerts ? C.green : C.borderMed, 
                          position: "relative", cursor: "pointer", transition: "background 0.3s"
                        }}
                      >
                        <div style={{ 
                          width: 18, height: 18, borderRadius: 9, background: "#fff", 
                          position: "absolute", top: 3, left: currentUser?.emailAlerts ? 23 : 3, 
                          transition: "left 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" 
                        }} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
          {/* FALLBACK UI FOR INVALID ROUTES */}
          {!["dashboard", "academics", "attendance", "assignments", "resources", "behavior", "clinic", "settings", "calendar", "announcements", "messages", "appointments", "doc-requests"].includes(tab) && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: C.m50, padding: 32, textAlign: "center", minHeight: "80vh" }}>
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "40px 32px", maxWidth: 400, width: "100%", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 32, background: C.m50, border: `2px solid ${C.m200}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertCircle size={28} color={C.t3} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 6 }}>Page Not Found</h3>
                  <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>The requested section could not be found or you don't have access to it.</p>
                </div>
                <button onClick={() => setTab("dashboard")} style={{ padding: "10px 20px", background: C.m700, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 8 }}>Return to Dashboard</button>
              </div>
            </div>
          )}

        </div>
      </div>



      {/* AI ACADEMIC BUDDY */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 900, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
        {aiBuddyOpen && (
          <div style={{ width: 320, background: "#fff", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", border: `1px solid ${C.m700}`, overflow: "hidden", animation: "popIn 0.2s ease-out" }}>
            <div style={{ background: "#fff", borderBottom: `1px solid ${C.borderMed}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: C.green }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.m800 }}>AI Support</div>
                  <div style={{ fontSize: 10, color: C.green }}>Online</div>
                </div>
              </div>
              <button onClick={() => setAiBuddyOpen(false)} style={{ background: "none", border: "none", color: C.t3, cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: 300, overflowY: "auto", background: C.paper }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ background: "#f3f4f6", padding: "10px 14px", borderRadius: "10px 10px 10px 0", fontSize: 11.5, color: C.t1, lineHeight: 1.4, maxWidth: "85%" }}>
                  Hi Miguel! I noticed you are struggling with Mathematics (74 Avg). Would you like to review Quadratic Functions?
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignSelf: "flex-end", maxWidth: "85%" }}>
                <div style={{ background: "#6366f1", padding: "10px 14px", borderRadius: "10px 10px 0 10px", fontSize: 11.5, color: "#fff", lineHeight: 1.4 }}>
                  Yes, please give me a summary.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ background: "#f3f4f6", padding: "10px 14px", borderRadius: "10px 10px 10px 0", fontSize: 11.5, color: C.t1, lineHeight: 1.4, maxWidth: "85%" }}>
                  A quadratic function is a polynomial function with one or more variables in which the highest-degree term is of the second degree. The standard form is: <b>f(x) = ax² + bx + c</b>. Try this practice quiz: <a href="#" style={{ color: "#6366f1", fontWeight: 700 }}>Quadratic Functions Quiz</a>
                </div>
              </div>
            </div>
            <div style={{ padding: 12, borderTop: `1px solid ${C.borderMed}`, background: "#fff", display: "flex", gap: 8 }}>
              <input type="text" placeholder="Type your message..." style={{ flex: 1, padding: "8px 12px", borderRadius: 4, border: `1px solid ${C.borderMed}`, background: "#fff", fontSize: 11, outline: "none" }} />
              <button style={{ background: "#6366f1", border: "none", color: "#fff", width: 36, height: 36, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={16} /></button>
            </div>
            <div style={{ padding: "8px 12px", background: "#fff", borderTop: `1px solid ${C.borderMed}`, textAlign: "center", fontSize: 9, color: C.t3 }}>
              Powered by Asyntai
            </div>
          </div>
        )}
        <button 
          onClick={() => setAiBuddyOpen(!aiBuddyOpen)}
          style={{ padding: "0 20px", height: 48, borderRadius: 24, background: C.m700, border: "none", color: "#fff", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 6px 16px rgba(139,30,30,0.3)", cursor: "pointer", transition: "transform 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <Sparkles size={18} color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>AI Assistant</span>
        </button>
      </div>

      {/* 4. DIGITAL QR ID CARD MODAL */}
      {showQRModal && (
        <div 
          onClick={() => setShowQRModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
            animation: "fadeIn 0.2s ease-out",
            cursor: "pointer"
          }}
        >
          <div onClick={e => e.stopPropagation()} className="w-[90vw] max-w-[340px]" style={{ position: "relative", cursor: "default" }}>

            {/* Premium ID Card Design */}
            <div style={{
              width: "100%",
              background: "#fff",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.1)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              animation: "popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}>
              <style>{`
                @keyframes popIn {
                  0% { opacity: 0; transform: translateY(20px) scale(0.95); }
                  100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes fadeIn {
                  0% { opacity: 0; }
                  100% { opacity: 1; }
                }
              `}</style>
              
              {/* Lanyard hole punch */}
              <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 50, height: 8, borderRadius: 4, background: "rgba(0,0,0,0.15)", borderTop: "1px solid rgba(0,0,0,0.1)", borderBottom: "1px solid rgba(255,255,255,0.2)", zIndex: 10 }} />
              
              {/* Top Banner & Profile */}
              <div style={{ 
                background: `linear-gradient(135deg, ${C.m800} 0%, ${C.m600} 100%)`, 
                padding: "40px 24px 24px", 
                color: "#fff", 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center", 
                textAlign: "center",
                position: "relative"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <School size={16} color={C.gold} />
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", color: "#fff" }}></span>
                </div>
                
                <div style={{ width: 100, height: 100, borderRadius: 50, border: "4px solid #fff", overflow: "hidden", marginBottom: 16, boxShadow: "0 8px 16px rgba(0,0,0,0.2)" }}>
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face" alt="Student Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Fraunces', serif" }}>{currentUser?.name || "Student User"}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>
                  {currentUser?.section || "GRADE 10 - PILOT SECTION"}
                </div>
              </div>
              
              {/* Bottom Info & QR */}
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, background: "#fafafa" }}>
                
                {/* Stats Row */}
                <div style={{ display: "flex", width: "100%", justifyContent: "space-between", borderBottom: `1px dashed ${C.borderMed}`, paddingBottom: 16 }}>
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Grade & Section</div>
                    <div style={{ fontSize: 13, color: C.t1, fontWeight: 800, marginTop: 4 }}>10 - Pilot</div>
                  </div>
                  <div style={{ width: 1, background: C.borderMed }} />
                  <div style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Learner Ref No.</div>
                    <div style={{ fontSize: 13, color: C.t1, fontWeight: 800, marginTop: 4, fontFamily: "monospace" }}>100001</div>
                  </div>
                </div>

                {/* QR Code Graphic */}
                <div style={{ 
                  width: 150, 
                  height: 150, 
                  background: "#fff",
                  borderRadius: 12, 
                  padding: 10, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  border: `1px solid ${C.border}`
                }}>
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=Calulut Integrated School-Student-100001" alt="QR Code" style={{ width: "100%", height: "100%", display: "block" }} />
                </div>
                
                <div style={{ fontSize: 10, color: C.t3, textAlign: "center", lineHeight: 1.5 }}>
                  This acts as your official digital ID.<br/>Scan at school gate terminal for validation.
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600, letterSpacing: "0.02em", animation: "fadeIn 0.4s ease-out 0.2s both" }}>
              Tap anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
function cardStatColor(s: string) {
  return s === "Submitted" ? C.green : s === "Pending" ? C.amber : C.red;
}
function cardStatBg(s: string) {
  return s === "Submitted" ? C.greenBg : s === "Pending" ? C.amberBg : C.redBg;
}
