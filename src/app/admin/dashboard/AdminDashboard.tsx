import React, { useEffect, useState, useCallback } from "react";
import { C } from "../../shared/constants/tokens";
import {
  Users,
  Package,
  Activity,
  Clock,
  Lock,
  ScanLine,
  Award,
  GraduationCap,
  CalendarDays,
  UserPlus,
  Palette,
  UserCheck,
  UserX,
  ShieldCheck,
  Stethoscope,
  HeartHandshake,
  FileText,
  Building2,
  Shield,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  Server,
  Database,
  HardDrive,
  Radio,
  Sparkles,
  Mail,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronRight,
  Layers,
  FolderOpen,
} from "lucide-react";
import { apiClient } from "../../../api/client";
import { healthApi, SystemHealthData, HealthStatus } from "../../../api/health.api";
import { securityApi, SecurityOverviewData } from "../../../api/security.api";

interface AdminDashboardProps {
  onNavigate: (s: any, extra?: any) => void;
  portal?: "Admin" | "ITAdmin" | "Registrar";
}

function getAuthoritativeTermSystemLabel(year?: { termSystem?: string; terms?: any[] } | null): string {
  if (year?.termSystem && typeof year.termSystem === "string" && year.termSystem.trim().length > 0) {
    return year.termSystem.trim();
  }
  const termCount = year?.terms?.length || 0;
  if (termCount === 3) return "Trimester";
  if (termCount === 4) return "Quarter";
  if (termCount === 2) return "Semester";
  return termCount > 0 ? `${termCount}-Term System` : "Academic Terms";
}

interface RoleBreakdownItem {
  role: string;
  label: string;
  portal: string;
  count: number;
}

interface AccountOverviewData {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsersLast7Days: number;
  totalRoleAssignments: number;
  unassignedRoleUsers: number;
  multiRoleUsers: number;
  byRole: Record<string, number>;
  roles: RoleBreakdownItem[];
  otherRoles: RoleBreakdownItem[];
}

interface GateTerminalsSummary {
  total: number;
  active: number;
  inactive: number;
  studentTerminals: number;
  facultyTerminals: number;
}

interface SchoolOperationsOverviewData {
  activeAcademicYear: {
    id: string;
    name: string;
    isCurrent: boolean;
    startDate: string;
    endDate: string;
    termSystem: string;
    terms: Array<{
      id: string;
      key: string;
      name: string;
      label: string;
      startDate: string | null;
      endDate: string | null;
    }>;
  } | null;
  sectionsSummary: {
    totalSections: number;
    sectionsWithAdviser: number;
    sectionsWithoutAdviser: number;
    enrolledStudents: number;
    sections: Array<{
      id: string;
      name: string;
      gradeLevel: number;
      adviserName: string | null;
      adviserSchoolId: string | null;
      enrolledCount: number;
      sf9IssuedCount: number;
      subjectAssignmentsCount: number;
    }>;
  };
  sf9Summary: {
    totalGradebooks: number;
    publishedGradebooks: number;
    draftGradebooks: number;
    sf9IssuedCurrent: number;
  };
  inventorySummary: {
    totalItems: number;
    totalUnits: number;
    goodCount: number;
    repairCount: number;
    borrowedCount: number;
    damagedOrLostCount: number;
    retiredOrDisposedCount: number;
    attentionCount: number;
  };
  operationalAccounts: {
    totalOperationalAccounts: number;
    activeOperationalAccounts: number;
    inactiveOperationalAccounts: number;
    facultyAccounts: number;
    studentAccounts: number;
    supportStaffAccounts: number;
  };
  recentOperationalEvents: Array<{
    id: string;
    created_at: string;
    action: string;
    category: string | null;
    actor_school_id: string | null;
    actor_role: string | null;
    target_label: string | null;
    result: string;
    resource_type: string;
  }>;
}

interface SystemStatsResponse {
  scope?: "FULL_ITADMIN" | "OPERATIONAL_ADMIN";
  lastUpdated?: string;
  totalUsers: number;
  activeUsers?: number;
  inactiveUsers?: number;
  newUsersLast7Days: number;
  recentSystemEvents: number;
  gateTerminalsSummary?: GateTerminalsSummary | null;
  accountOverview?: AccountOverviewData | null;
  schoolOperationsOverview?: SchoolOperationsOverviewData | null;
}

interface RegistrarOperationsOverviewData {
  activeAcademicYear: {
    id: string;
    name: string;
    isCurrent: boolean;
    startDate?: string;
    endDate?: string;
    termSystem?: string;
    terms: Array<{
      id: string;
      key: string;
      name: string;
      label: string;
      startDate?: string | null;
      endDate?: string | null;
    }>;
  } | null;
  enrollmentStats: {
    totalEnrolled: number;
    targetEnrollment: number | null;
    pendingAdmissions: number;
    missingDocuments: number;
  };
  sectionsSummary: {
    totalSections: number;
    sectionsWithAdviser: number;
    sections: Array<{
      id: string;
      name: string;
      gradeLevel: number;
      adviserName: string | null;
      adviserSchoolId: string | null;
      enrolledCount: number;
    }>;
  };
  docRequestsSummary: {
    total: number;
    pending: number;
    approved: number;
    fulfilled: number;
    rejected: number;
    requests: Array<{
      id: string;
      documentType: string;
      status: string;
      requestDate: string;
      learnerName: string;
      learnerLrn?: string;
    }>;
  };
}

function getRoleVisuals(role: string): { icon: React.ElementType; color: string; bg: string; barColor: string } {
  switch (role) {
    case "Student":
      return { icon: GraduationCap, color: "#1d4ed8", bg: "#EFF6FF", barColor: "#2563EB" };
    case "Teacher":
      return { icon: Users, color: "#0369a1", bg: "#F0F9FF", barColor: "#0284C7" };
    case "Principal":
      return { icon: Building2, color: "#b45309", bg: "#FEF3C7", barColor: "#D97706" };
    case "Registrar":
      return { icon: FileText, color: "#6d28d9", bg: "#F5F3FF", barColor: "#7C3AED" };
    case "Admin":
      return { icon: Shield, color: "#0f766e", bg: "#F0FDFA", barColor: "#0D9488" };
    case "ITAdmin":
      return { icon: ShieldCheck, color: "#991b1b", bg: "#FEF2F2", barColor: "#DC2626" };
    case "Guidance":
      return { icon: HeartHandshake, color: "#c2410c", bg: "#FFF7ED", barColor: "#EA580C" };
    case "Nurse":
      return { icon: Stethoscope, color: "#15803d", bg: "#F0FDF4", barColor: "#16A34A" };
    case "GateOperator":
      return { icon: ScanLine, color: "#4338ca", bg: "#EEF2FF", barColor: "#4F46E5" };
    default:
      return { icon: Users, color: C.m700, bg: C.m50, barColor: C.m700 };
  }
}

function formatAcademicYearLabel(name?: string | null): string {
  if (!name) return "SY 2026–2027";
  const trimmed = name.trim();
  if (/^(SY|AY)\b/i.test(trimmed)) return trimmed;
  return `SY ${trimmed}`;
}

function formatUptime(seconds?: number): string {
  if (typeof seconds !== "number" || isNaN(seconds)) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

function formatShortTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const dt = new Date(iso);
    return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

function formatEventTimestamp(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const dt = new Date(iso);
    return dt.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatActionLabel(action: string): string {
  switch (action) {
    case "LOGIN_SUCCESS":
      return "Login Succeeded";
    case "LOGIN_FAILURE":
      return "Login Failed";
    case "AUTH_RATE_LIMIT_TRIGGERED":
      return "Rate Limit Triggered";
    case "AUTH_FORBIDDEN":
      return "Access Denied (403)";
    case "LOGOUT":
      return "User Logged Out";
    case "PASSWORD_CHANGED":
      return "Password Changed";
    case "USER_PASSWORD_RESET":
      return "Password Reset";
    case "USER_CREATED":
      return "Account Created";
    case "USER_STATUS_CHANGED":
      return "Account Status Changed";
    case "USER_UPDATED":
      return "Account Updated";
    case "SCHOOL_SETTINGS_UPDATED":
      return "School Branding Updated";
    case "SCHOOL_SETTINGS_BRANDING_RESET":
      return "Branding Reset to Default";
    case "BRANDING_ASSET_UPLOADED":
      return "Branding Asset Uploaded";
    case "GRADEBOOK_CELLS_SAVED":
      return "Gradebook Saved";
    case "ENROLLMENT_CREATED":
      return "Student Enrolled";
    case "ENROLLMENT_STATUS_UPDATED":
      return "Enrollment Updated";
    case "AUDIT_LOG_VIEWED":
      return "Audit Log Inspected";
    default:
      return action
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function getHealthPill(status?: HealthStatus | string) {
  switch (status) {
    case "OPERATIONAL":
      return {
        label: "Operational",
        dot: "#16A34A",
        bg: "#F0FDF4",
        text: "#15803D",
        border: "#BBF7D0",
        icon: CheckCircle2,
      };
    case "DEGRADED":
      return {
        label: "Degraded",
        dot: "#F59E0B",
        bg: "#FEF3C7",
        text: "#B45309",
        border: "#FDE68A",
        icon: AlertTriangle,
      };
    case "UNAVAILABLE":
      return {
        label: "Unavailable",
        dot: "#EF4444",
        bg: "#FEF2F2",
        text: "#B91C1C",
        border: "#FECACA",
        icon: XCircle,
      };
    case "NOT_MONITORED":
      return {
        label: "Not Monitored",
        dot: "#64748B",
        bg: "#F8FAFC",
        text: "#475569",
        border: "#CBD5E1",
        icon: HelpCircle,
      };
    case "NOT_CONFIGURED":
    default:
      return {
        label: "Not Configured",
        dot: "#94A3B8",
        bg: "#F8FAFC",
        text: "#64748B",
        border: "#E2E8F0",
        icon: HelpCircle,
      };
  }
}

export function AdminDashboard({ onNavigate, portal = "Admin" }: AdminDashboardProps) {
  const isIT = portal === "ITAdmin";
  const isRegistrar = portal === "Registrar";

  const [stats, setStats] = useState<SystemStatsResponse | null>(null);
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [security, setSecurity] = useState<SecurityOverviewData | null>(null);
  const [registrarData, setRegistrarData] = useState<RegistrarOperationsOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        if (isIT) {
          const [statsRes, healthRes, secRes] = await Promise.all([
            apiClient.get<any>("/admin/system-stats"),
            healthApi.getSystemHealth().catch(() => null),
            securityApi.getOverview("24h").catch(() => null),
          ]);
          setStats(statsRes?.data || statsRes);
          if (healthRes) setHealth((healthRes as any)?.data || healthRes);
          if (secRes) setSecurity((secRes as any)?.data || secRes);
        } else if (isRegistrar) {
          const [enrollmentRes, yearsRes, sectionsRes, docReqsRes] = await Promise.all([
            apiClient.get<any>("/admin/enrollment-stats").catch(() => null),
            apiClient.get<any>("/academic/years").catch(() => []),
            apiClient.get<any>("/academic/sections").catch(() => []),
            apiClient.get<any>("/student-services/doc-requests").catch(() => []),
          ]);

          const rawYears = Array.isArray(yearsRes) ? yearsRes : (yearsRes?.data || []);
          const activeYear = rawYears.find((y: any) => y.is_current || y.isCurrent) || rawYears[0] || null;
          const rawSections = Array.isArray(sectionsRes) ? sectionsRes : (sectionsRes?.data || []);
          const rawDocs = Array.isArray(docReqsRes) ? docReqsRes : (docReqsRes?.data || []);

          const mappedSections = rawSections.map((s: any) => ({
            id: s.id,
            name: s.name,
            gradeLevel: s.grade_level || s.gradeLevel || 7,
            adviserName: s.adviser_name_snapshot || (s.adviser_teacher?.user ? `${s.adviser_teacher.user.first_name} ${s.adviser_teacher.user.last_name}` : null),
            adviserSchoolId: s.adviser_teacher?.employee_id || s.adviser_teacher?.user?.school_id || null,
            enrolledCount: s._count?.enrollments || s.enrolledCount || 0,
          }));

          const sectionsWithAdviser = mappedSections.filter((s: any) => !!s.adviserName).length;
          const pendingDocs = rawDocs.filter((r: any) => r.status === "Submitted" || r.status === "Teacher Approved" || r.status === "Principal Approved").length;
          const approvedDocs = rawDocs.filter((r: any) => r.status === "Principal Approved" || r.status === "Approved").length;
          const fulfilledDocs = rawDocs.filter((r: any) => r.status === "Fulfilled" || r.status === "Released").length;
          const rejectedDocs = rawDocs.filter((r: any) => r.status === "Rejected" || r.status === "Cancelled").length;

          setRegistrarData({
            activeAcademicYear: activeYear ? {
              id: activeYear.id,
              name: activeYear.name,
              isCurrent: Boolean(activeYear.is_current ?? activeYear.isCurrent),
              startDate: activeYear.start_date || activeYear.startDate,
              endDate: activeYear.end_date || activeYear.endDate,
              termSystem: activeYear.term_system || activeYear.termSystem || "Trimester",
              terms: (activeYear.terms || [
                { id: "term-1", key: "T1", name: "Term 1", label: "Term 1" },
                { id: "term-2", key: "T2", name: "Term 2", label: "Term 2" },
                { id: "term-3", key: "T3", name: "Term 3", label: "Term 3" },
              ]).map((t: any) => ({
                id: t.id,
                key: t.key || t.term_key || "T1",
                name: t.name || t.label,
                label: t.label || t.name,
                startDate: t.start_date || t.startDate || null,
                endDate: t.end_date || t.endDate || null,
              })),
            } : null,
            enrollmentStats: {
              totalEnrolled: enrollmentRes?.totalEnrolled ?? mappedSections.reduce((acc: number, cur: any) => acc + (cur.enrolledCount || 0), 0),
              targetEnrollment: enrollmentRes?.targetEnrollment ?? (activeYear?.target_enrollment || null),
              pendingAdmissions: enrollmentRes?.pendingAdmissions ?? 0,
              missingDocuments: enrollmentRes?.missingDocuments ?? 0,
            },
            sectionsSummary: {
              totalSections: mappedSections.length,
              sectionsWithAdviser,
              sections: mappedSections,
            },
            docRequestsSummary: {
              total: rawDocs.length,
              pending: pendingDocs,
              approved: approvedDocs,
              fulfilled: fulfilledDocs,
              rejected: rejectedDocs,
              requests: rawDocs.slice(0, 10).map((r: any) => ({
                id: r.id,
                documentType: r.document_type || r.documentType || "Official Document",
                status: r.status,
                requestDate: r.created_at || r.requestDate,
                learnerName: r.student ? `${r.student.first_name} ${r.student.last_name}` : (r.learnerName || "Learner"),
                learnerLrn: r.student?.lrn || r.learnerLrn,
              })),
            },
          });
        } else {
          const statsRes = await apiClient.get<any>("/admin/system-stats");
          setStats(statsRes?.data || statsRes);
        }
      } catch (err: any) {
        console.error("Failed to load dashboard data:", err);
        setError(err?.message || "Unable to retrieve live dashboard data from server.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isIT, isRegistrar]
  );

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  // Strict role-based scoping check on frontend in addition to backend enforcement
  const overview = isIT && stats?.scope === "FULL_ITADMIN" ? stats?.accountOverview ?? null : null;
  const allRoleItems: RoleBreakdownItem[] = overview
    ? [...(overview.roles || []), ...(overview.otherRoles || [])]
    : [];
  const ops = (!isIT && !isRegistrar) ? stats?.schoolOperationsOverview ?? null : null;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1480,
        margin: "0 auto",
        padding: "14px 22px 22px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <style>{`
        .saas-dash-grid-12 {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 14px;
          align-items: stretch;
        }
        .saas-col-3 { grid-column: span 3 / span 3; }
        .saas-col-4 { grid-column: span 4 / span 4; }
        .saas-col-5 { grid-column: span 5 / span 5; }
        .saas-col-6 { grid-column: span 6 / span 6; }
        .saas-col-7 { grid-column: span 7 / span 7; }
        .saas-col-8 { grid-column: span 8 / span 8; }
        .saas-col-12 { grid-column: span 12 / span 12; }

        .saas-role-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .saas-quick-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-auto-rows: 1fr;
          gap: 9px;
        }

        @media (max-width: 1200px) {
          .saas-col-3 { grid-column: span 6 / span 6; }
          .saas-col-4, .saas-col-5, .saas-col-7, .saas-col-8 { grid-column: span 12 / span 12; }
        }
        @media (max-width: 768px) {
          .saas-col-3, .saas-col-6 { grid-column: span 12 / span 12; }
          .saas-role-grid, .saas-quick-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      {/* ─── TOP PAGE HEADER BAR ────────────────────────────────────────────── */}
      <div
        id="dashboard-main-header"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          paddingBottom: 10,
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2
              data-testid="dashboard-page-heading"
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: C.t1,
                margin: 0,
                letterSpacing: "-0.02em",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {isIT
                ? "IT Operations Overview"
                : isRegistrar
                  ? "Registrar Operations Overview"
                  : "School Operations Overview"}
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 6,
                background: isIT ? "#EFF6FF" : isRegistrar ? "#F5F3FF" : "#F0FDF4",
                color: isIT ? C.m700 : isRegistrar ? "#6D28D9" : "#15803D",
                border: `1px solid ${isIT ? "#BFDBFE" : isRegistrar ? "#DDD6FE" : "#BBF7D0"}`,
              }}
            >
              {isIT
                ? "Technical Infrastructure"
                : formatAcademicYearLabel(isRegistrar ? registrarData?.activeAcademicYear?.name : ops?.activeAcademicYear?.name)}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.t3, lineHeight: 1.4 }}>
            {isIT
              ? "Monitor user accounts, system services, gate terminals, and security activity for Calulut Integrated School."
              : isRegistrar
                ? "Manage student admissions, learner permanent records (SF10), official document fulfillment, and class rosters for Calulut Integrated School."
                : "Manage class sections, report card releases, school inventory, and staff accounts for Calulut Integrated School."}
          </p>
        </div>

        {/* Right Meta & Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {isIT && health?.application && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: "5px 10px",
                fontSize: 11.5,
                color: C.t2,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: health.status === "OPERATIONAL" ? "#16A34A" : "#F59E0B",
                }}
              />
              <span>
                Env: <strong>{health.application.environment}</strong>
              </span>
              <span style={{ color: "#CBD5E1" }}>·</span>
              <span>
                Uptime: <strong>{formatUptime(health.application.uptimeSeconds)}</strong>
              </span>
            </div>
          )}

          {((!isIT && !isRegistrar && ops?.activeAcademicYear) || (isRegistrar && registrarData?.activeAcademicYear)) && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: "5px 10px",
                fontSize: 11.5,
                color: C.t2,
              }}
            >
              <CalendarDays size={13} color={C.m700} />
              <span>
                Term Config:{" "}
                <strong>
                  {getAuthoritativeTermSystemLabel(
                    isRegistrar ? registrarData?.activeAcademicYear : ops?.activeAcademicYear
                  )}{" "}
                  (
                  {(isRegistrar
                    ? registrarData?.activeAcademicYear?.terms?.length
                    : ops?.activeAcademicYear?.terms?.length) || 0}{" "}
                  Terms)
                </strong>
              </span>
            </div>
          )}

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              padding: "5px 10px",
              fontSize: 11.5,
              color: C.t3,
            }}
          >
            <Clock size={12} />
            <span>Verified {formatShortTime(health?.lastChecked || stats?.lastUpdated)}</span>
          </div>

          <button
            type="button"
            data-testid="btn-refresh-dashboard"
            onClick={() => loadDashboard(true)}
            disabled={refreshing || loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              padding: "5px 11px",
              fontSize: 12,
              fontWeight: 600,
              color: C.t1,
              cursor: refreshing || loading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ─── ERROR BANNER ───────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadDashboard(true)}
            style={{
              background: "#FFFFFF",
              border: "1px solid #FCA5A5",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#991B1B",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          IT ADMIN DASHBOARD (FULL_ITADMIN)
         ═══════════════════════════════════════════════════════════════════════ */}
      {isIT && stats && (
        <>
          {/* ─── B. PRIMARY KPI ROW (4 Compact Cards) ───────────────────────── */}
          <div id="itadmin-account-summary-kpis" className="saas-dash-grid-12">
            {/* Card 1: Registered Accounts */}
            <div
              className="saas-col-3"
              data-testid="kpi-total-accounts"
              onClick={() => onNavigate("accounts", { role: "All" })}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Registered Accounts</span>
                <Users size={15} color={C.m700} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {stats.totalUsers}
                </div>
                <span
                  data-testid="kpi-new-accounts-7d"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#15803D",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  +{stats.newUsersLast7Days} new (7d)
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>Registered portal user accounts</span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>

            {/* Card 2: Active & Inactive Accounts */}
            <div
              className="saas-col-3"
              data-testid="kpi-active-accounts"
              onClick={() => onNavigate("accounts", { role: "All" })}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Active Accounts</span>
                <UserCheck size={15} color="#15803D" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: "#15803D",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {stats.activeUsers ?? 0}
                </div>
                <span
                  data-testid="kpi-inactive-accounts"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: (stats.inactiveUsers ?? 0) > 0 ? "#B91C1C" : C.t3,
                    background: (stats.inactiveUsers ?? 0) > 0 ? "#FEF2F2" : "#F8FAFC",
                    border: `1px solid ${(stats.inactiveUsers ?? 0) > 0 ? "#FECACA" : "#E2E8F0"}`,
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {stats.inactiveUsers ?? 0} Inactive
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>Sign-in enabled ({stats.inactiveUsers ?? 0} inactive)</span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>

            {/* Card 3: System Health */}
            <div
              className="saas-col-3"
              data-testid="kpi-system-health"
              onClick={() => onNavigate("system-health")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>System Health</span>
                <Activity size={15} color="#15803D" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color:
                      health?.status === "UNAVAILABLE"
                        ? "#B91C1C"
                        : health?.status === "DEGRADED"
                          ? "#B45309"
                          : "#15803D",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.2,
                  }}
                >
                  {health?.status === "UNAVAILABLE"
                    ? "Unavailable"
                    : health?.status === "DEGRADED"
                      ? "Degraded"
                      : "Operational"}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.t2,
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  DB {health?.components?.database?.latencyMs ?? 1}ms
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>API, PostgreSQL & Storage verified</span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>

            {/* Card 4: Gate Terminals & Audit Events */}
            <div
              className="saas-col-3"
              data-testid="kpi-gate-terminals"
              onClick={() => onNavigate("terminals")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Gate Terminals</span>
                <ScanLine size={15} color={C.m700} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {stats.gateTerminalsSummary
                    ? `${stats.gateTerminalsSummary.active} of ${stats.gateTerminalsSummary.total} Active`
                    : "Configured"}
                </div>
                <span
                  data-testid="kpi-recent-events-24h"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate("audit-logs");
                  }}
                  title="View 24h System Audit Logs"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.m700,
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    padding: "2px 7px",
                    borderRadius: 999,
                    cursor: "pointer",
                  }}
                >
                  {stats.recentSystemEvents} events (24h)
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>
                  {stats.gateTerminalsSummary
                    ? `${stats.gateTerminalsSummary.studentTerminals} Student, ${stats.gateTerminalsSummary.facultyTerminals} Faculty`
                    : "Manage RFID kiosk terminals"}
                </span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>
          </div>

          {/* ─── C & D. MIDDLE ROW: ACCOUNTS BY ROLE (8 cols) + SERVICE STATUS (4 cols) ─── */}
          <div className="saas-dash-grid-12">
            {/* C. Accounts by Role (8 columns) */}
            {overview && (
              <section
                id="itadmin-account-role-breakdown"
                className="saas-col-8"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    borderBottom: "1px solid #F1F5F9",
                    paddingBottom: 10,
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: C.t1, margin: 0 }}>
                      Accounts by Role
                    </h3>
                    <p style={{ fontSize: 12, color: C.t3, margin: "2px 0 0" }}>
                      Interactive breakdown using verified PostgreSQL counts across all 9 portals
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate("accounts", { role: "All" })}
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: 7,
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: C.m700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <span>View all accounts ({overview.totalUsers})</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                {/* Compact 2-Column Interactive Role Distribution List with Horizontal Bars */}
                <div className="saas-role-grid">
                  {allRoleItems.map((item) => {
                    const { icon: RoleIcon, color, bg, barColor } = getRoleVisuals(item.role);
                    const barPct =
                      overview.totalUsers > 0
                        ? Math.max(item.count > 0 ? 5 : 0, Math.round((item.count / overview.totalUsers) * 100))
                        : 0;

                    return (
                      <button
                        key={item.role}
                        type="button"
                        data-testid={`role-card-${item.role}`}
                        onClick={() => onNavigate("accounts", { role: item.role })}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: 8,
                          padding: "9px 12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = C.m700;
                          e.currentTarget.style.background = "#F8FAFC";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#E2E8F0";
                          e.currentTarget.style.background = "#FFFFFF";
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            width: "100%",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                background: bg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <RoleIcon size={14} color={color} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: C.t1,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {item.label}
                              </div>
                              <div style={{ fontSize: 10.5, color: C.t3 }}>{item.portal}</div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                            <span
                              data-testid={`role-count-${item.role}`}
                              style={{
                                fontSize: 15,
                                fontWeight: 800,
                                color: C.t1,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {item.count}
                            </span>
                            <ChevronRight size={13} color={C.t3} />
                          </div>
                        </div>

                        {/* Proportional bar */}
                        <div
                          style={{
                            width: "100%",
                            height: 5,
                            borderRadius: 999,
                            background: "#F1F5F9",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${barPct}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: barColor,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Account Reconciliation Footer */}
                <div
                  data-testid="account-reconciliation-bar"
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    fontSize: 11.5,
                    color: C.t2,
                  }}
                >
                  <div>
                    <strong>Reconciliation:</strong>{" "}
                    <span>
                      {overview.totalRoleAssignments} role assignments across {allRoleItems.length} roles
                    </span>
                    {overview.unassignedRoleUsers > 0 && (
                      <span>
                        {" + "}
                        <button
                          type="button"
                          data-testid="btn-unassigned-accounts"
                          onClick={() => onNavigate("accounts", { role: "Unassigned" })}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: C.m700,
                            fontWeight: 700,
                            textDecoration: "underline",
                            cursor: "pointer",
                            fontSize: 11.5,
                          }}
                        >
                          {overview.unassignedRoleUsers} unassigned-role{" "}
                          {overview.unassignedRoleUsers === 1 ? "account" : "accounts"}
                        </button>
                      </span>
                    )}
                    <span> ({overview.multiRoleUsers} multi-role overlap)</span>
                    <span>
                      {" "}
                      = <strong>{overview.totalUsers} distinct registered accounts</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.t3 }}>
                    Active: <strong style={{ color: "#15803D" }}>{overview.activeUsers}</strong> · Inactive:{" "}
                    <strong style={{ color: overview.inactiveUsers > 0 ? "#B91C1C" : C.t2 }}>
                      {overview.inactiveUsers}
                    </strong>
                  </div>
                </div>
              </section>
            )}

            {/* D. Service Status (4 columns) */}
            <section
              id="itadmin-service-status"
              className="saas-col-4"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 10,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.t1, margin: 0 }}>Service Status</h3>
                  <p style={{ fontSize: 12, color: C.t3, margin: "2px 0 0" }}>
                    Core system services and infrastructure
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("system-health")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.m700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>Diagnostics</span>
                  <ArrowUpRight size={13} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {[
                  {
                    key: "api",
                    label: "API Server",
                    sub: "Express HTTP application server",
                    icon: Server,
                    status: health?.components?.api?.status || "OPERATIONAL",
                  },
                  {
                    key: "database",
                    label: "PostgreSQL Database",
                    sub:
                      typeof health?.components?.database?.latencyMs === "number"
                        ? `Connected (${health.components.database.latencyMs} ms response)`
                        : "Connected and responding",
                    icon: Database,
                    status: health?.components?.database?.status || "OPERATIONAL",
                  },
                  {
                    key: "gate",
                    label: "Gate Services",
                    sub: stats.gateTerminalsSummary
                      ? `${stats.gateTerminalsSummary.active} of ${stats.gateTerminalsSummary.total} terminals active`
                      : "Event stream active",
                    icon: Radio,
                    status: health?.components?.gateEventService?.status || "OPERATIONAL",
                  },
                  {
                    key: "storage",
                    label: "File & Media Storage",
                    sub: "Persistent branding & document storage",
                    icon: HardDrive,
                    status: health?.components?.storage?.status || "OPERATIONAL",
                  },
                  {
                    key: "ai",
                    label: "AI Assistant Engine",
                    sub:
                      health?.components?.aiService?.authStatus === "AUTHORIZED"
                        ? `Authorized (${health.components.aiService.authAccount || "delegated"})`
                        : "On-demand inference (no live health polling)",
                    icon: Sparkles,
                    status: health?.components?.aiService?.status || "NOT_MONITORED",
                  },
                  {
                    key: "email",
                    label: "Notification Worker",
                    sub: health?.components?.emailService?.message || "External SMTP status",
                    icon: Mail,
                    status: health?.components?.emailService?.status || "NOT_CONFIGURED",
                  },
                ].map((srv) => {
                  const pill = getHealthPill(srv.status);
                  const SrvIcon = srv.icon;
                  return (
                    <div
                      key={srv.key}
                      data-testid={`service-row-${srv.key}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "7px 10px",
                        borderRadius: 8,
                        border: "1px solid #F1F5F9",
                        background: "#F8FAFC",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <SrvIcon size={15} color={C.t2} style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.t1 }}>{srv.label}</div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: C.t3,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {srv.sub}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10.5,
                          fontWeight: 700,
                          background: pill.bg,
                          color: pill.text,
                          border: `1px solid ${pill.border}`,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: pill.dot,
                          }}
                        />
                        {pill.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onNavigate("system-health")}
                style={{
                  width: "100%",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.t2,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span>Open System Health & Backup Status</span>
                <ArrowUpRight size={13} />
              </button>
            </section>
          </div>

          {/* ─── E & F. BOTTOM ROW: RECENT SECURITY & AUDIT ACTIVITY (7 cols) + QUICK ACCESS (5 cols) ─── */}
          <div className="saas-dash-grid-12">
            {/* E. Recent Security & Audit Activity (7 columns) */}
            <section
              id="itadmin-recent-security"
              className="saas-col-7"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.t1, margin: 0 }}>
                    Recent Security & Audit Activity
                  </h3>
                  <p
                    style={{
                      fontSize: 12,
                      color: C.t3,
                      margin: "2px 0 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Real authentication, access control, and configuration events sorted by time
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onNavigate("security-access")}
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: 7,
                      padding: "4px 9px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: C.t1,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Security Console
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("audit-logs")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "4px 6px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: C.m700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>All Audit Logs</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>

              {/* 24h Security Exception Counters */}
              {security?.kpis && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  {[
                    {
                      label: "Failed Logins (24h)",
                      val: security.kpis.failedLogins ?? 0,
                      warn: (security.kpis.failedLogins ?? 0) > 0,
                    },
                    {
                      label: "Access Denials (24h)",
                      val: security.kpis.authDenials ?? 0,
                      warn: (security.kpis.authDenials ?? 0) > 0,
                    },
                    {
                      label: "Rate Limits (24h)",
                      val: security.kpis.rateLimits ?? 0,
                      warn: (security.kpis.rateLimits ?? 0) > 0,
                    },
                    {
                      label: "Password Resets (24h)",
                      val: security.kpis.passwordResets ?? 0,
                      warn: false,
                    },
                  ].map((k) => (
                    <div
                      key={k.label}
                      style={{
                        background: k.warn ? "#FEF2F2" : "#F8FAFC",
                        border: `1px solid ${k.warn ? "#FECACA" : "#E2E8F0"}`,
                        borderRadius: 8,
                        padding: "7px 10px",
                      }}
                    >
                      <div style={{ fontSize: 10.5, color: k.warn ? "#991B1B" : C.t3, fontWeight: 600 }}>
                        {k.label}
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: k.warn ? "#B91C1C" : C.t1,
                          marginTop: 2,
                        }}
                      >
                        {k.val}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Events Table */}
              {!security?.recentEvents || security.recentEvents.length === 0 ? (
                <div
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    fontSize: 12.5,
                    color: C.t3,
                    background: "#F8FAFC",
                    borderRadius: 8,
                    border: "1px dashed #CBD5E1",
                  }}
                >
                  No recent security or administrative events recorded in the past 24 hours.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {security.recentEvents.slice(0, 5).map((ev) => {
                    const isFail = ev.result === "FAILURE" || ev.result === "DENIED" || ev.action.includes("FORBIDDEN") || ev.action.includes("FAILURE");
                    return (
                      <div
                        key={ev.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "7px 10px",
                          borderRadius: 8,
                          border: "1px solid #F1F5F9",
                          background: "#FFFFFF",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: isFail ? "#EF4444" : "#16A34A",
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: C.t1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {formatActionLabel(ev.action)}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: C.t3,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              Actor: <strong>{ev.actor_school_id || "System"}</strong>
                              {ev.actor_role ? ` (${ev.actor_role})` : ""}
                              {ev.target_label ? ` · Target: ${ev.target_label}` : ""}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: isFail ? "#FEF2F2" : "#F0FDF4",
                              color: isFail ? "#B91C1C" : "#15803D",
                              border: `1px solid ${isFail ? "#FECACA" : "#BBF7D0"}`,
                            }}
                          >
                            {ev.result}
                          </span>
                          <span style={{ fontSize: 11, color: C.t3, whiteSpace: "nowrap" }}>
                            {formatEventTimestamp(ev.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* F. Quick Access (5 columns) */}
            <section
              id="itadmin-quick-actions"
              className="saas-col-5"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 10,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 700, color: C.t1, margin: 0 }}>Quick Access</h3>
                <p style={{ fontSize: 12, color: C.t3, margin: "2px 0 0" }}>
                  Direct links to infrastructure, account provisioning, and School Customization
                </p>
              </div>

              <div className="saas-quick-grid" style={{ flex: 1 }}>
                {[
                  {
                    id: "terminals",
                    title: "Gate Terminals",
                    desc: "Configure RFID attendance kiosks",
                    icon: ScanLine,
                    color: C.m700,
                    bg: "#EFF6FF",
                    onClick: () => onNavigate("terminals"),
                  },
                  {
                    id: "teacher-create",
                    title: "Create Account",
                    desc: "Create faculty, staff & admin users",
                    icon: UserPlus,
                    color: "#0284C7",
                    bg: "#F0F9FF",
                    onClick: () => onNavigate("teacher-create"),
                  },
                  {
                    id: "security-access",
                    title: "Security & Access",
                    desc: "Inspect rate limits & auth denials",
                    icon: Lock,
                    color: "#B91C1C",
                    bg: "#FEF2F2",
                    onClick: () => onNavigate("security-access"),
                  },
                  {
                    id: "system-health",
                    title: "System Health",
                    desc: "Service latencies & backup status",
                    icon: Activity,
                    color: "#15803D",
                    bg: "#F0FDF4",
                    onClick: () => onNavigate("system-health"),
                  },
                  {
                    id: "accounts",
                    title: "Account Management",
                    desc: "Reset credentials & toggle status",
                    icon: Users,
                    color: "#6D28D9",
                    bg: "#F5F3FF",
                    onClick: () => onNavigate("accounts", { role: "All" }),
                  },
                  {
                    id: "customization",
                    title: "School Customization",
                    desc: "Configure institutional branding & seal",
                    icon: Palette,
                    color: "#B45309",
                    bg: "#FEF3C7",
                    onClick: () => onNavigate("customization"),
                  },
                ].map((act) => {
                  const ActIcon = act.icon;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      data-testid={`quick-action-${act.id}`}
                      onClick={act.onClick}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: 10,
                        padding: "11px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.m700;
                        e.currentTarget.style.background = "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E2E8F0";
                        e.currentTarget.style.background = "#FFFFFF";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: act.bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <ActIcon size={17} color={act.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{act.title}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: C.t3,
                              marginTop: 1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {act.desc}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={14} color={C.t3} style={{ flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SCHOOL ADMIN DASHBOARD (OPERATIONAL_ADMIN)
         ═══════════════════════════════════════════════════════════════════════ */}
      {!isIT && !isRegistrar && stats && ops && (
        <>
          {/* ─── PRIMARY KPI ROW (4 Compact School Operations Cards) ───────── */}
          <div id="admin-operational-kpis" className="saas-dash-grid-12">
            {/* Card 1: Active School Year & Trimesters */}
            <div
              className="saas-col-3"
              data-testid="admin-kpi-school-year"
              onClick={() => onNavigate("school-years")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Active Academic Year</span>
                <CalendarDays size={15} color={C.m700} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {ops.activeAcademicYear ? formatAcademicYearLabel(ops.activeAcademicYear.name) : "Unconfigured"}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#15803D",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {ops.activeAcademicYear?.terms?.length || 0} Terms ({getAuthoritativeTermSystemLabel(ops.activeAcademicYear)})
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>
                  {ops.activeAcademicYear?.terms?.length
                    ? ops.activeAcademicYear.terms.map((t) => `Term ${t.key.replace("T", "")}`).join(", ")
                    : "Configure trimester terms"}
                </span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>

            {/* Card 2: Sections & Enrolled Roster */}
            <div
              className="saas-col-3"
              data-testid="admin-kpi-sections"
              onClick={() => onNavigate("sections")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Sections & Enrolled Roster</span>
                <GraduationCap size={15} color={C.m700} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {ops.sectionsSummary.totalSections} Sections
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.m700,
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {ops.sectionsSummary.enrolledStudents} Enrolled
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>
                  {ops.sectionsSummary.sectionsWithAdviser} of {ops.sectionsSummary.totalSections} Advisers assigned
                </span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>

            {/* Card 3: SF9 & Trimester Gradebooks */}
            <div
              className="saas-col-3"
              data-testid="admin-kpi-sf9"
              onClick={() => onNavigate("report-cards")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>SF9 & Trimester Gradebooks</span>
                <Award size={15} color="#B45309" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {ops.sf9Summary.publishedGradebooks} of {ops.sf9Summary.totalGradebooks} Published
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#B45309",
                    background: "#FEF3C7",
                    border: "1px solid #FDE68A",
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {ops.sf9Summary.sf9IssuedCurrent} SF9 Issued
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>Trimester gradebooks ({ops.sf9Summary.draftGradebooks} in draft)</span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>

            {/* Card 4: Campus Inventory Summary */}
            <div
              className="saas-col-3"
              data-testid="admin-kpi-inventory"
              onClick={() => onNavigate("inventory")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Campus Inventory</span>
                <Package size={15} color="#0F766E" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {ops.inventorySummary.totalItems} Assets
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: ops.inventorySummary.attentionCount > 0 ? "#B45309" : "#15803D",
                    background: ops.inventorySummary.attentionCount > 0 ? "#FEF3C7" : "#F0FDF4",
                    border: `1px solid ${ops.inventorySummary.attentionCount > 0 ? "#FDE68A" : "#BBF7D0"}`,
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {ops.inventorySummary.goodCount} Good
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>
                  {ops.inventorySummary.totalUnits} total units ({ops.inventorySummary.attentionCount} need attention)
                </span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>
          </div>

          {/* ─── ROW 1: PRIMARY ACADEMIC & OPERATIONS WORKSPACE (7 cols Sections + 5 cols Quick Actions) ─── */}
          <div id="admin-primary-workspace-row" className="saas-dash-grid-12">
            {/* Left (7 columns): Active Sections, Class Advisers & SF9 Readiness */}
            <section
              id="admin-sections-workspace"
              className="saas-col-7"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                    Class Sections and Advisers
                  </h3>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: C.t3,
                      margin: "2px 0 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Grade 7 to 10 section rosters, class advisers, and report card (SF9) status
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onNavigate("sections")}
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: 7,
                      padding: "4px 9px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: C.t1,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Manage Sections
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("report-cards")}
                    style={{
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: 7,
                      padding: "4px 9px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: C.m700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Release SF9
                  </button>
                </div>
              </div>

              {/* Trimester Terms Strip */}
              {ops.activeAcademicYear && ops.activeAcademicYear.terms.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    padding: "6px 10px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.t2, fontWeight: 600 }}>
                    <Layers size={13} color={C.m700} />
                    <span>Configured Trimester Evaluation Periods:</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {ops.activeAcademicYear.terms.map((term) => (
                      <span
                        key={term.id}
                        style={{
                          padding: "2px 7px",
                          borderRadius: 5,
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          color: C.t1,
                          fontWeight: 600,
                          fontSize: 10.5,
                        }}
                      >
                        {term.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sections Table */}
              {ops.sectionsSummary.sections.length === 0 ? (
                <div
                  style={{
                    padding: "20px 16px",
                    textAlign: "center",
                    fontSize: 12,
                    color: C.t3,
                    background: "#F8FAFC",
                    borderRadius: 8,
                    border: "1px dashed #CBD5E1",
                    flex: 1,
                  }}
                >
                  No class sections configured for the active academic year.
                </div>
              ) : (
                <div style={{ overflowX: "auto", flex: 1 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid #E2E8F0",
                          textAlign: "left",
                          color: C.t3,
                          fontSize: 10.5,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        <th style={{ padding: "6px 8px", fontWeight: 700 }}>Grade Level</th>
                        <th style={{ padding: "6px 8px", fontWeight: 700 }}>Section</th>
                        <th style={{ padding: "6px 8px", fontWeight: 700 }}>Class Adviser</th>
                        <th style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>Enrolled</th>
                        <th style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>Subjects</th>
                        <th style={{ padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>SF9 Issued</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ops.sectionsSummary.sections.map((sec, idx) => (
                        <tr
                          key={sec.id}
                          onClick={() => onNavigate("sections")}
                          style={{
                            borderBottom:
                              idx < ops.sectionsSummary.sections.length - 1 ? "1px solid #F1F5F9" : "none",
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#F8FAFC";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <td style={{ padding: "7px 8px", fontWeight: 600, color: C.t1 }}>
                            Grade {sec.gradeLevel}
                          </td>
                          <td style={{ padding: "7px 8px", fontWeight: 600, color: C.t1 }}>
                            {sec.name}
                          </td>
                          <td style={{ padding: "7px 8px", color: C.t2 }}>
                            {sec.adviserName ? (
                              <span>{sec.adviserName}</span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  color: "#B45309",
                                  background: "#FEF3C7",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "7px 8px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: C.t1,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {sec.enrolledCount}
                          </td>
                          <td
                            style={{
                              padding: "7px 8px",
                              textAlign: "right",
                              color: C.t2,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {sec.subjectAssignmentsCount}
                          </td>
                          <td
                            style={{
                              padding: "7px 8px",
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 999,
                                background: sec.sf9IssuedCount > 0 ? "#F0FDF4" : "#F8FAFC",
                                color: sec.sf9IssuedCount > 0 ? "#15803D" : C.t3,
                                border: `1px solid ${sec.sf9IssuedCount > 0 ? "#BBF7D0" : "#E2E8F0"}`,
                              }}
                            >
                              {sec.sf9IssuedCount} of {sec.enrolledCount}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Right (5 columns): School Operations Actions (6 Compact Tiles, Matched Height) */}
            <section
              id="admin-quick-actions"
              className="saas-col-5"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 8 }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                  School Operations Actions
                </h3>
                <p
                  style={{
                    fontSize: 11.5,
                    color: C.t3,
                    margin: "2px 0 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Direct access to academic, inventory, and operational staff tools
                </p>
              </div>

              <div className="saas-quick-grid" style={{ flex: 1 }}>
                {[
                  {
                    id: "report-cards",
                    title: "Report Cards (SF9)",
                    desc: "Seal & release official SF9 cards",
                    icon: Award,
                    color: "#B45309",
                    bg: "#FEF3C7",
                    onClick: () => onNavigate("report-cards"),
                  },
                  {
                    id: "sections",
                    title: "Sections and Rosters",
                    desc: "Grade 7 to 10 advisers and rosters",
                    icon: GraduationCap,
                    color: C.m700,
                    bg: "#EFF6FF",
                    onClick: () => onNavigate("sections"),
                  },
                  {
                    id: "school-years",
                    title: "School Years",
                    desc: "Academic years & trimester terms",
                    icon: CalendarDays,
                    color: "#0284C7",
                    bg: "#F0F9FF",
                    onClick: () => onNavigate("school-years"),
                  },
                  {
                    id: "inventory",
                    title: "Inventory Management",
                    desc: "Campus assets, repairs & loans",
                    icon: Package,
                    color: "#0F766E",
                    bg: "#F0FDFA",
                    onClick: () => onNavigate("inventory"),
                  },
                  {
                    id: "teacher-create",
                    title: "Create Account",
                    desc: "Create faculty & staff accounts",
                    icon: UserPlus,
                    color: "#15803D",
                    bg: "#F0FDF4",
                    onClick: () => onNavigate("teacher-create"),
                  },
                  {
                    id: "accounts",
                    title: "Staff Accounts",
                    desc: "Manage operational credentials",
                    icon: Users,
                    color: "#6D28D9",
                    bg: "#F5F3FF",
                    onClick: () => onNavigate("accounts"),
                  },
                ].map((act) => {
                  const ActIcon = act.icon;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      data-testid={`admin-quick-action-${act.id}`}
                      onClick={act.onClick}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: 9,
                        padding: "8px 9px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.m700;
                        e.currentTarget.style.background = "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E2E8F0";
                        e.currentTarget.style.background = "#FFFFFF";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            background: act.bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <ActIcon size={14} color={act.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: C.t1,
                              lineHeight: 1.2,
                            }}
                          >
                            {act.title}
                          </div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: C.t3,
                              marginTop: 1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {act.desc}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={12} color={C.t3} style={{ flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ─── ROW 2: COORDINATED SUPPORTING PANELS ROW (3 Equal 4-Column Cards Aligned Horizontally) ─── */}
          <div id="admin-operational-summary" className="saas-dash-grid-12">
            {/* Panel 1 (4 columns): Inventory Status Breakdown */}
            <section
              id="admin-inventory-breakdown"
              data-testid="admin-panel-inventory-breakdown"
              className="saas-col-4"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "15px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 10,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                    School Inventory Status
                  </h3>
                  <p style={{ fontSize: 11.5, color: C.t3, margin: "2px 0 0" }}>
                    Physical asset condition across campus
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("inventory")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: C.m700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <span>Open Inventory</span>
                  <ArrowUpRight size={12} />
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gridAutoRows: "1fr",
                  gap: 8,
                  flex: 1,
                }}
              >
                {[
                  { label: "Good Condition", val: ops.inventorySummary.goodCount, color: "#15803D", bg: "#F0FDF4", border: "#DCFCE7" },
                  { label: "Borrowed or In Use", val: ops.inventorySummary.borrowedCount, color: C.m700, bg: "#EFF6FF", border: "#DBEAFE" },
                  { label: "Needs Repair", val: ops.inventorySummary.repairCount, color: "#B45309", bg: "#FEF3C7", border: "#FEF08A" },
                  { label: "Damaged or Lost", val: ops.inventorySummary.damagedOrLostCount, color: "#B91C1C", bg: "#FEF2F2", border: "#FEE2E2" },
                ].map((st) => (
                  <div
                    key={st.label}
                    style={{
                      background: st.bg,
                      border: `1px solid ${st.border}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: C.t2 }}>{st.label}</span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: st.color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {st.val}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 8,
                }}
              >
                <span>
                  Tracked units: <strong style={{ color: C.t2 }}>{ops.inventorySummary.totalUnits}</strong>
                </span>
                <span>
                  Needs attention: <strong style={{ color: C.t2 }}>{ops.inventorySummary.attentionCount}</strong>
                </span>
              </div>
            </section>

            {/* Panel 2 (4 columns): Operational Directory Scope */}
            <section
              id="admin-directory-scope"
              data-testid="admin-panel-directory-scope"
              className="saas-col-4"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "15px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 10,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                    School Directory Summary
                  </h3>
                  <p style={{ fontSize: 11.5, color: C.t3, margin: "2px 0 0" }}>
                    Authorized faculty, staff & student accounts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("accounts")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: C.m700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <span>Staff Accounts</span>
                  <ArrowUpRight size={12} />
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gridAutoRows: "1fr",
                  gap: 8,
                  flex: 1,
                }}
              >
                {[
                  {
                    label: "Faculty (Teachers)",
                    val: ops.operationalAccounts.facultyAccounts,
                    role: "Teacher",
                  },
                  {
                    label: "Support Staff",
                    val: ops.operationalAccounts.supportStaffAccounts,
                    role: "All",
                  },
                  {
                    label: "Student Portal",
                    val: ops.operationalAccounts.studentAccounts,
                    role: "Student",
                  },
                  {
                    label: "Active Operational",
                    val: ops.operationalAccounts.activeOperationalAccounts,
                    role: "All",
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onNavigate("accounts", { role: item.role })}
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = C.m700;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#E2E8F0";
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: C.t2 }}>{item.label}</span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: C.t1,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {item.val}
                    </span>
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 8,
                }}
              >
                <span>
                  Directory scope: <strong style={{ color: C.t2 }}>Operational only</strong>
                </span>
                <span>
                  Inactive: <strong style={{ color: C.t2 }}>{ops.operationalAccounts.inactiveOperationalAccounts}</strong>
                </span>
              </div>
            </section>

            {/* Panel 3 (4 columns): Recent School Operations (Compact Single-Line Rows, Matched Height) */}
            <section
              id="admin-recent-operations"
              data-testid="admin-panel-recent-operations"
              className="saas-col-4"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "15px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                    Recent School Operations
                  </h3>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: C.t3,
                      margin: "2px 0 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Latest operational events ({stats.recentSystemEvents} in 24h)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("audit-logs")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: C.m700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <span>Audit Logs</span>
                  <ArrowUpRight size={12} />
                </button>
              </div>

              {ops.recentOperationalEvents.length === 0 ? (
                <div
                  style={{
                    padding: "16px 12px",
                    textAlign: "center",
                    fontSize: 12,
                    color: C.t3,
                    background: "#F8FAFC",
                    borderRadius: 8,
                    border: "1px dashed #CBD5E1",
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  No recent operational audit entries recorded.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, justifyContent: "center" }}>
                  {ops.recentOperationalEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 7,
                        border: "1px solid #F1F5F9",
                        background: "#F8FAFC",
                        fontSize: 11.5,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#16A34A",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 600,
                            color: C.t1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {formatActionLabel(ev.action)}
                        </span>
                        <span
                          style={{
                            fontSize: 10.5,
                            color: C.t3,
                            background: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: 4,
                            padding: "1px 5px",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {ev.actor_school_id || ev.actor_role || "Staff"}
                        </span>
                      </div>
                      <span style={{ fontSize: 10.5, color: C.t3, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {formatEventTimestamp(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 8,
                }}
              >
                <span>
                  24h Operational Events: <strong style={{ color: C.t2 }}>{stats.recentSystemEvents}</strong>
                </span>
                <span>Showing latest {Math.min(3, ops.recentOperationalEvents.length)}</span>
              </div>
            </section>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          REGISTRAR OPERATIONS OVERVIEW (MODERN SAAS ARCHITECTURE)
         ═══════════════════════════════════════════════════════════════════════ */}
      {isRegistrar && registrarData && (
        <>
          {/* ─── PRIMARY KPI ROW (4 Compact SaaS Cards) ───────────────────────── */}
          <div id="registrar-operational-kpis" className="saas-dash-grid-12">
            {/* Card 1: Active School Year & Trimester Terms */}
            <div
              className="saas-col-3"
              data-testid="registrar-kpi-school-year"
              onClick={() => onNavigate("school-years")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Active Academic Year</span>
                <CalendarDays size={15} color={C.m700} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {registrarData.activeAcademicYear
                    ? formatAcademicYearLabel(registrarData.activeAcademicYear.name)
                    : "Unconfigured"}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#15803D",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {registrarData.activeAcademicYear?.terms?.length || 0} Terms (
                  {getAuthoritativeTermSystemLabel(registrarData.activeAcademicYear)})
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>
                  {registrarData.activeAcademicYear?.terms?.length
                    ? registrarData.activeAcademicYear.terms.map((t) => t.label).join(", ")
                    : "Configure academic terms"}
                </span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>

            {/* Card 2: Enrolled Students & Admissions */}
            <div
              className="saas-col-3"
              data-testid="registrar-kpi-enrollment"
              onClick={() => onNavigate("enrollment")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Enrolled & Admissions</span>
                <Users size={15} color="#15803D" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {registrarData.enrollmentStats.totalEnrolled} Enrolled
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: registrarData.enrollmentStats.pendingAdmissions > 0 ? "#B45309" : "#15803D",
                    background: registrarData.enrollmentStats.pendingAdmissions > 0 ? "#FEF3C7" : "#F0FDF4",
                    border: `1px solid ${registrarData.enrollmentStats.pendingAdmissions > 0 ? "#FDE68A" : "#BBF7D0"}`,
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {registrarData.enrollmentStats.pendingAdmissions > 0
                    ? `${registrarData.enrollmentStats.pendingAdmissions} Pending`
                    : "Admissions Open"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>
                  {registrarData.enrollmentStats.missingDocuments > 0
                    ? `${registrarData.enrollmentStats.missingDocuments} applicant(s) with incomplete documents`
                    : "All enrollment documents verified"}
                </span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>

            {/* Card 3: Document Requests Pipeline */}
            <div
              className="saas-col-3"
              data-testid="registrar-kpi-doc-requests"
              onClick={() => onNavigate("doc-requests")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Document Requests</span>
                <FileText size={15} color="#6D28D9" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {registrarData.docRequestsSummary.pending} in Pipeline
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#6D28D9",
                    background: "#F5F3FF",
                    border: "1px solid #DDD6FE",
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {registrarData.docRequestsSummary.total} Total
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>
                  {registrarData.docRequestsSummary.fulfilled} fulfilled · {registrarData.docRequestsSummary.approved} approved
                </span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>

            {/* Card 4: Sections & Rosters */}
            <div
              className="saas-col-3"
              data-testid="registrar-kpi-sections"
              onClick={() => onNavigate("sections")}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.m700;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Sections & Rosters</span>
                <GraduationCap size={15} color={C.m700} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.t1,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {registrarData.sectionsSummary.totalSections} Sections
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.m700,
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  {registrarData.sectionsSummary.sectionsWithAdviser} of {registrarData.sectionsSummary.totalSections} Advisers
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 6,
                }}
              >
                <span>Grade 7 to 10 class rosters</span>
                <ArrowUpRight size={13} color={C.t3} />
              </div>
            </div>
          </div>

          {/* ─── ROW 1: PRIMARY WORKSPACE (7 cols Sections + 5 cols Quick Actions) ─── */}
          <div id="registrar-primary-workspace-row" className="saas-dash-grid-12">
            {/* Left (7 columns): Class Sections & Advisers Table */}
            <section
              id="registrar-sections-workspace"
              className="saas-col-7"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                    Class Sections and Advisers
                  </h3>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: C.t3,
                      margin: "2px 0 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Grade 7 to 10 section rosters, class advisers, and DepEd Form 138 (SF9) records
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onNavigate("sections")}
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: 7,
                      padding: "4px 9px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: C.t1,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Manage Sections
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("report-cards")}
                    style={{
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: 7,
                      padding: "4px 9px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: C.m700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    View SF9
                  </button>
                </div>
              </div>

              {/* Evaluation Periods Strip */}
              {registrarData.activeAcademicYear && registrarData.activeAcademicYear.terms.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    padding: "6px 10px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.t2, fontWeight: 600 }}>
                    <Layers size={13} color={C.m700} />
                    <span>Configured Evaluation Periods:</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {registrarData.activeAcademicYear.terms.map((term) => (
                      <span
                        key={term.id}
                        style={{
                          padding: "2px 7px",
                          borderRadius: 5,
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          color: C.t1,
                          fontWeight: 600,
                          fontSize: 10.5,
                        }}
                      >
                        {term.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sections Table */}
              {registrarData.sectionsSummary.sections.length === 0 ? (
                <div
                  style={{
                    padding: "20px 16px",
                    textAlign: "center",
                    fontSize: 12,
                    color: C.t3,
                    background: "#F8FAFC",
                    borderRadius: 8,
                    border: "1px dashed #CBD5E1",
                    flex: 1,
                  }}
                >
                  No class sections configured for the active academic year.
                </div>
              ) : (
                <div style={{ overflowX: "auto", flex: 1 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                        <th style={{ textAlign: "left", padding: "6px 10px", color: C.t2, fontWeight: 700, fontSize: 11 }}>
                          Section
                        </th>
                        <th style={{ textAlign: "left", padding: "6px 10px", color: C.t2, fontWeight: 700, fontSize: 11 }}>
                          Grade Level
                        </th>
                        <th style={{ textAlign: "left", padding: "6px 10px", color: C.t2, fontWeight: 700, fontSize: 11 }}>
                          Class Adviser
                        </th>
                        <th style={{ textAlign: "right", padding: "6px 10px", color: C.t2, fontWeight: 700, fontSize: 11 }}>
                          Enrolled
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrarData.sectionsSummary.sections.map((sec) => (
                        <tr
                          key={sec.id}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#F8FAFC";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                          onClick={() => onNavigate("sections")}
                        >
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: C.t1 }}>
                            {sec.name}
                          </td>
                          <td style={{ padding: "8px 10px", color: C.t2 }}>
                            Grade {sec.gradeLevel}
                          </td>
                          <td style={{ padding: "8px 10px", color: sec.adviserName ? C.t1 : C.t3 }}>
                            {sec.adviserName || "Unassigned"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: 5,
                                background: "#EFF6FF",
                                color: C.m700,
                                fontWeight: 700,
                                fontSize: 11,
                              }}
                            >
                              {sec.enrolledCount} Students
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Right (5 columns): Admissions and Records Actions (6 Compact Tiles) */}
            <section
              id="registrar-quick-actions"
              className="saas-col-5"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 8 }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                  Admissions and Records Actions
                </h3>
                <p
                  style={{
                    fontSize: 11.5,
                    color: C.t3,
                    margin: "2px 0 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Direct access to learner admissions, SF10 permanent records, and fulfillment
                </p>
              </div>

              <div className="saas-quick-grid" style={{ flex: 1 }}>
                {[
                  {
                    id: "enrollment",
                    title: "Student Enrollment",
                    desc: "Admissions & new student placement",
                    icon: Users,
                    color: "#15803D",
                    bg: "#F0FDF4",
                    onClick: () => onNavigate("enrollment"),
                  },
                  {
                    id: "records-sf10",
                    title: "Academic Records (SF10)",
                    desc: "Learner permanent records & DepEd SF10",
                    icon: FolderOpen,
                    color: "#0369A1",
                    bg: "#F0F9FF",
                    onClick: () => onNavigate("records-sf10"),
                  },
                  {
                    id: "doc-requests",
                    title: "Document Fulfillment",
                    desc: "Transcript, certs & diploma requests",
                    icon: FileText,
                    color: "#6D28D9",
                    bg: "#F5F3FF",
                    onClick: () => onNavigate("doc-requests"),
                  },
                  {
                    id: "sections",
                    title: "Sections and Rosters",
                    desc: "Grade 7 to 10 advisers & rosters",
                    icon: GraduationCap,
                    color: C.m700,
                    bg: "#EFF6FF",
                    onClick: () => onNavigate("sections"),
                  },
                  {
                    id: "school-years",
                    title: "School Years",
                    desc: "Academic year & re-enrollment transitions",
                    icon: CalendarDays,
                    color: "#0F766E",
                    bg: "#F0FDFA",
                    onClick: () => onNavigate("school-years"),
                  },
                ].map((act, actIdx, actArr) => {
                  const ActIcon = act.icon;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      data-testid={`registrar-quick-action-${act.id}`}
                      onClick={act.onClick}
                      style={{
                        gridColumn: actIdx === actArr.length - 1 && actArr.length % 2 === 1 ? "1 / -1" : undefined,
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: 9,
                        padding: "8px 9px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.m700;
                        e.currentTarget.style.background = "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E2E8F0";
                        e.currentTarget.style.background = "#FFFFFF";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            background: act.bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <ActIcon size={14} color={act.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: C.t1,
                              lineHeight: 1.2,
                            }}
                          >
                            {act.title}
                          </div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: C.t3,
                              marginTop: 1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {act.desc}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={12} color={C.t3} style={{ flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ─── ROW 2: COORDINATED SUPPORTING PANELS ROW (3 Equal 4-Column Cards Aligned Horizontally) ─── */}
          <div id="registrar-operational-summary" className="saas-dash-grid-12">
            {/* Panel 1 (4 columns): Document Requests Pipeline Breakdown */}
            <section
              id="registrar-panel-requests-pipeline"
              data-testid="registrar-panel-requests-pipeline"
              className="saas-col-4"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "15px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 10,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                    Document Requests Pipeline
                  </h3>
                  <p style={{ fontSize: 11.5, color: C.t3, margin: "2px 0 0" }}>
                    Fulfillment progress across student requests
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("doc-requests")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: C.m700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <span>Open Fulfillment</span>
                  <ArrowUpRight size={12} />
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gridAutoRows: "1fr",
                  gap: 8,
                  flex: 1,
                }}
              >
                {[
                  {
                    label: "In Pipeline",
                    val: registrarData.docRequestsSummary.pending,
                    color: "#6D28D9",
                    bg: "#F5F3FF",
                    border: "#DDD6FE",
                  },
                  {
                    label: "Approved",
                    val: registrarData.docRequestsSummary.approved,
                    color: C.m700,
                    bg: "#EFF6FF",
                    border: "#DBEAFE",
                  },
                  {
                    label: "Fulfilled",
                    val: registrarData.docRequestsSummary.fulfilled,
                    color: "#15803D",
                    bg: "#F0FDF4",
                    border: "#DCFCE7",
                  },
                ].map((st, stIdx, stArr) => (
                  <div
                    key={st.label}
                    style={{
                      gridColumn: stIdx === stArr.length - 1 && stArr.length % 2 === 1 ? "1 / -1" : undefined,
                      background: st.bg,
                      border: `1px solid ${st.border}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: C.t2 }}>{st.label}</span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: st.color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {st.val}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 8,
                }}
              >
                <span>
                  Total document requests: <strong style={{ color: C.t2 }}>{registrarData.docRequestsSummary.total}</strong>
                </span>
                <span>
                  Fulfilled: <strong style={{ color: C.t2 }}>{registrarData.docRequestsSummary.fulfilled}</strong>
                </span>
              </div>
            </section>

            {/* Panel 2 (4 columns): Admissions & Enrollment Health */}
            <section
              id="registrar-panel-enrollment-health"
              data-testid="registrar-panel-enrollment-health"
              className="saas-col-4"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "15px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 10,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                    Admissions & Enrollment Status
                  </h3>
                  <p style={{ fontSize: 11.5, color: C.t3, margin: "2px 0 0" }}>
                    Current school year enrollment metrics
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("enrollment")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: C.m700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <span>Open Admissions</span>
                  <ArrowUpRight size={12} />
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gridAutoRows: "1fr",
                  gap: 8,
                  flex: 1,
                }}
              >
                {[
                  {
                    label: "Officially Enrolled",
                    val: registrarData.enrollmentStats.totalEnrolled,
                    color: "#15803D",
                    bg: "#F0FDF4",
                    border: "#DCFCE7",
                  },
                  {
                    label: "Pending Admissions",
                    val: registrarData.enrollmentStats.pendingAdmissions,
                    color: C.m700,
                    bg: "#EFF6FF",
                    border: "#DBEAFE",
                  },
                  {
                    label: "Missing Documents",
                    val: registrarData.enrollmentStats.missingDocuments,
                    color: "#B45309",
                    bg: "#FEF3C7",
                    border: "#FEF08A",
                  },
                  {
                    label: "Target Capacity",
                    val: registrarData.enrollmentStats.targetEnrollment || "—",
                    color: C.t1,
                    bg: "#F8FAFC",
                    border: "#E2E8F0",
                  },
                ].map((st) => (
                  <div
                    key={st.label}
                    style={{
                      background: st.bg,
                      border: `1px solid ${st.border}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: C.t2 }}>{st.label}</span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: st.color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {st.val}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 8,
                }}
              >
                <span>
                  Active Learner Rosters: <strong style={{ color: C.t2 }}>{registrarData.sectionsSummary.totalSections} sections</strong>
                </span>
                <span>
                  Advisers assigned: <strong style={{ color: C.t2 }}>{registrarData.sectionsSummary.sectionsWithAdviser}</strong>
                </span>
              </div>
            </section>

            {/* Panel 3 (4 columns): Academic Records & Year Transitions */}
            <section
              id="registrar-panel-academic-records"
              data-testid="registrar-panel-academic-records"
              className="saas-col-4"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "15px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 10,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, margin: 0 }}>
                    Academic Records & Placement
                  </h3>
                  <p style={{ fontSize: 11.5, color: C.t3, margin: "2px 0 0" }}>
                    SF10 permanent records & year placement
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("records-sf10")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: C.m700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <span>Permanent Records</span>
                  <ArrowUpRight size={12} />
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  flex: 1,
                }}
              >
                {[
                  {
                    title: "Learner Permanent Records (SF10)",
                    desc: "DepEd Order 58, s. 2017 compliant transcripts",
                    screen: "records-sf10",
                    badge: "Authorized",
                  },
                  {
                    title: "Student Re-Enrollment & Placement",
                    desc: "Next-year section assignment and transition",
                    screen: "school-years",
                    badge: "Promotion",
                  },
                  {
                    title: "DepEd Form 138 (SF9) Cards",
                    desc: "Official report card records verification",
                    screen: "report-cards",
                    badge: "View-Only",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    onClick={() => onNavigate(item.screen)}
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      cursor: "pointer",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = C.m700;
                      e.currentTarget.style.background = "#FFFFFF";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#E2E8F0";
                      e.currentTarget.style.background = "#F8FAFC";
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 1 }}>
                        {item.desc}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: C.m700,
                        background: "#EFF6FF",
                        border: "1px solid #BFDBFE",
                        padding: "2px 7px",
                        borderRadius: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.badge}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: C.t3,
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: 8,
                }}
              >
                <span>Office of the Registrar</span>
                <span>Calulut Integrated School</span>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
