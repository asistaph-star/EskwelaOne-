import React, { useState, useEffect } from "react";
import { authApi } from "../api/auth.api";
import { X, Search, Bell, ChevronDown, BookMarked } from "lucide-react";
import { Role, TScreen, GradeCardInfo } from "./shared/types";
import { C } from "./shared/constants/tokens";

// 1. Export hooks and mock data needed by other components
export function useLayout() {
  const get = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    return { isMobile: w < 768, isTablet: w >= 768 && w < 1060 };
  };
  const [l, setL] = useState(get);
  useEffect(() => {
    const h = () => setL(get());
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return l;
}

export const ROLE_USER = {
  Admin: { initials: "RS", name: "Dr. Roberto Santos", sub: "School Administrator" },
  ITAdmin: { initials: "IT", name: "System Administrator", sub: "Admin / IT Operations" },
  Teacher: { initials: "AS", name: "Ana R. Soriano", sub: "Adviser, Grade 10 - Pilot" },
  Student: { initials: "JM", name: "Juan Miguel Santos", sub: "Grade 10 - Pilot (LRN 100001)" },
  Parent: { initials: "PA", name: "Parent Portal", sub: "Student academic progress monitoring" },
  Registrar: { initials: "RE", name: "Registrar Office", sub: "Learner Permanent Records (SF10) Management" },
  Guidance: { initials: "GC", name: "Counselor Perez", sub: "School Guidance Counselor" },
};


export const TODAY_SCHED = [
  { time: "7:30–8:30", subject: "Mathematics 8", section: "Gr. 8 Rizal", room: "Rm 101", status: "done" },
  { time: "8:30–9:30", subject: "Science 9", section: "Gr. 9 Einstein", room: "Rm 204", status: "done" },
  { time: "9:30–10:00", subject: "-", section: "Break", room: "", status: "break" },
  { time: "10:00–11:00", subject: "Filipino 10", section: "Gr. 10 Pilot", room: "Rm 312", status: "active" },
  { time: "11:00–12:00", subject: "Mathematics 8", section: "Gr. 8 Rizal", room: "Rm 101", status: "upcoming" },
  { time: "1:00–2:00", subject: "Advisory Period", section: "Gr. 8 Rizal", room: "Rm 101", status: "upcoming" },
];

export const UPCOMING = [
  { date: "Jun 13", label: "LAC Session - Numeracy", type: "lac", urgent: false },
  { date: "Jun 14", label: "Q1 Grading deadline", type: "deadline", urgent: true },
  { date: "Jun 17", label: "Regional seminar - ICT Tools", type: "seminar", urgent: false },
  { date: "Jun 20", label: "Parent-Teacher Conference", type: "ptc", urgent: false },
  { date: "Jun 25", label: "SF2 submission - Division", type: "deadline", urgent: true },
];

export const STUDENTS_GR8 = [
  { id: 1, lrn: "200001", surname: "Aguilar", first: "Liza Marie", gender: "F", avg: 88.1, att: "Good Standing", status: "Passed" },
  { id: 2, lrn: "200002", surname: "Bondoc", first: "Ramon Jr.", gender: "M", avg: 76.8, att: "At Risk", status: "At Risk" },
  { id: 3, lrn: "200003", surname: "Cruz", first: "Trisha Ann", gender: "F", avg: 93.1, att: "Good Standing", status: "Passed" },
  { id: 4, lrn: "200004", surname: "Delos Reyes", first: "Daniel", gender: "M", avg: 89.0, att: "Good Standing", status: "Passed" },
  { id: 5, lrn: "200005", surname: "Espino", first: "Hannah Grace", gender: "F", avg: 68.5, att: "Poor", status: "Failing" },
  { id: 6, lrn: "200006", surname: "Ferrer", first: "Joshua", gender: "M", avg: 90.3, att: "Good Standing", status: "Passed" },
  { id: 7, lrn: "200007", surname: "Gomez", first: "Angelica", gender: "F", avg: 91.2, att: "Good Standing", status: "Passed" },
  { id: 8, lrn: "200008", surname: "Hernandez", first: "Mark Ryan", gender: "M", avg: 71.0, att: "At Risk", status: "Failing" },
];

export const STUDENTS_GR9 = [
  { id: 9, lrn: "200009", surname: "Mendoza", first: "Kevin", gender: "M", avg: 77.5, att: "At Risk", status: "At Risk" },
  { id: 10, lrn: "200010", surname: "Tolentino", first: "Bianca", gender: "F", avg: 85.0, att: "Good Standing", status: "Passed" },
  { id: 11, lrn: "200011", surname: "Bautista", first: "Paulo", gender: "M", avg: 69.2, att: "Poor", status: "Failing" },
  { id: 12, lrn: "200012", surname: "Navarro", first: "Chloe", gender: "F", avg: 91.5, att: "Good Standing", status: "Passed" },
];

export const STUDENTS_GR10 = [
  { id: 13, lrn: "200013", surname: "Garcia", first: "Ana Kristine", gender: "F", avg: 95.2, att: "Good Standing", status: "Passed" },
  { id: 14, lrn: "200014", surname: "Santos", first: "Juan Miguel", gender: "M", avg: 89.5, att: "Good Standing", status: "Passed" },
  { id: 15, lrn: "200015", surname: "Ocampo", first: "Renz Adrian", gender: "M", avg: 75.2, att: "At Risk", status: "At Risk" },
  { id: 16, lrn: "200016", surname: "Rivera", first: "Miguel", gender: "M", avg: 68.0, att: "Poor", status: "Failing" },
];

export const GRADEBOOK = [
  { name: "Aguilar, Liza Marie", ww: [88, 90, 86, 92, 89], pt: [91, 94, 88], qa: 90 },
  { name: "Bondoc, Ramon Jr.", ww: [70, 72, 68, 74, 73], pt: [75, 73, 71], qa: 72 },
  { name: "Cruz, Trisha Ann", ww: [94, 96, 93, 97, 95], pt: [97, 98, 95], qa: 96 },
  { name: "Delos Reyes, Daniel", ww: [80, 83, 79, 84, 82], pt: [83, 86, 81], qa: 82 },
  { name: "Espino, Hannah Grace", ww: [62, 65, 58, 70, 64], pt: [68, 70, 60], qa: 65 },
  { name: "Ferrer, Joshua", ww: [90, 92, 88, 94, 91], pt: [92, 95, 90], qa: 90 },
  { name: "Gomez, Angelica", ww: [76, 78, 75, 80, 78], pt: [80, 82, 78], qa: 78 },
  { name: "Hernandez, Mark Ryan", ww: [68, 70, 65, 72, 70], pt: [72, 74, 68], qa: 70 },
];

export const GRADEBOOK_GR9 = [
  { name: "Mendoza, Kevin", ww: [70, 72, 68, 74, 73], pt: [75, 73, 71], qa: 72 },
  { name: "Tolentino, Bianca", ww: [82, 85, 80, 86, 84], pt: [85, 88, 83], qa: 85 },
  { name: "Bautista, Paulo", ww: [62, 65, 58, 70, 64], pt: [68, 70, 60], qa: 65 },
  { name: "Navarro, Chloe", ww: [90, 92, 88, 94, 91], pt: [92, 95, 90], qa: 90 },
];

export const GRADEBOOK_GR10 = [
  { name: "Garcia, Ana Kristine", ww: [94, 96, 93, 97, 95], pt: [97, 98, 95], qa: 96 },
  { name: "Santos, Juan Miguel", ww: [88, 90, 86, 92, 89], pt: [91, 94, 88], qa: 90 },
  { name: "Ocampo, Renz Adrian", ww: [70, 72, 68, 74, 73], pt: [75, 73, 71], qa: 72 },
  { name: "Rivera, Miguel", ww: [62, 65, 58, 70, 64], pt: [68, 70, 60], qa: 65 },
];

// 2. Import Modular Screen Components
import { LoginScreen } from "./auth/login/LoginScreen";
import { SimpleShell } from "./shared/components/SimpleShell";
import { StudentPortal } from "./student/StudentPortal";

import { NurseApp } from "./nurse/NurseApp";
import { TSidebar } from "./teacher/shared/TSidebar";
import { DashboardScreen } from "./teacher/dashboard/DashboardScreen";
import { ClassroomHub } from "./teacher/classroom/ClassroomHub";
import { GradebookFullScreen } from "./teacher/grades/GradebookFullScreen";
import { TermSummaryScreen } from "./teacher/grades/TermSummaryScreen";
import { GradesDirectScreen } from "./teacher/grades/GradesDirectScreen";
import { AttendanceDirectScreen } from "./teacher/attendance/AttendanceDirectScreen";
import { ClinicVisitsScreen } from "./teacher/clinic/ClinicVisitsScreen";
import { AIToolsScreen } from "./teacher/ai-tools/AIToolsScreen";
import { ProDevScreen } from "./teacher/pro-dev/ProDevScreen";
import { CalendarScreen } from "./teacher/calendar/CalendarScreen";
import { TemplateHubScreen } from "./teacher/templates/TemplateHubScreen";

import { StubScreen } from "./shared/components/StubScreen";
import { StudentDetailOverlay } from "./shared/components/StudentDetailOverlay";
import { NotificationDropdown } from "./shared/components/NotificationDropdown";
import { AIAssistantWidget } from "./shared/components/AIAssistantWidget";

// 3. Main Routing App Shell Orchestrator

import { TeacherApp } from "./teacher/TeacherApp";
import { PrincipalApp } from "./principal/PrincipalApp";
import { RegistrarApp } from "./principal/RegistrarApp";
import { AdminApp } from "./admin/AdminApp";
import { GuidanceApp } from "./guidance/GuidanceApp";

import { useAppContext } from "./shared/AppContext";

export default function App() {
  const { currentUser, setCurrentUser } = useAppContext();

  if (!currentUser) {
    return <LoginScreen />;
  }

  const role = currentUser.role;

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error("Logout failed on backend", err);
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  if (role === "Principal") {
    return <PrincipalApp onLogout={handleLogout} />;
  }
  if (role === "Admin") {
    return <AdminApp onLogout={handleLogout} />;
  }
  if (role === "Registrar") {
    return <RegistrarApp onLogout={handleLogout} />;
  }
  if (role === "Student") {
    return <StudentPortal onLogout={handleLogout} />;
  }
  if (role === "Parent") {
    return <SimpleShell role={role as any} onLogout={handleLogout} />;
  }
  if (role === "Nurse") {
    return <NurseApp onLogout={handleLogout} />;
  }
  if (role === "Guidance") {
    return <GuidanceApp onLogout={handleLogout} />;
  }
  
  return <TeacherApp onLogout={handleLogout} />;
}
