import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Activity,
  FileText,
  Calendar,
  X,
  Lock,
  ChevronLeft,
  ChevronRight,
  Server,
  Globe,
  Hash,
  AlertCircle,
} from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { useAppContext } from "../../shared/AppContext";
import {
  auditApi,
  AuditLogItem,
  AuditQueryParams,
  AuditSummary,
} from "../../../api/audit.api";

// Human-friendly mapping for machine actions
function formatActionLabel(action: string): string {
  switch (action) {
    case "LOGIN_SUCCESS":
      return "Login Succeeded";
    case "LOGIN_FAILURE":
      return "Login Failed";
    case "AUTH_RATE_LIMIT_TRIGGERED":
      return "Login Rate Limit Triggered";
    case "LOGOUT":
      return "User Logged Out";
    case "PASSWORD_CHANGED":
      return "Password Changed";
    case "PASSWORD_CHANGE_FAILED":
      return "Password Change Failed";
    case "USER_CREATED":
      return "Account Provisioned";
    case "USER_UPDATED":
      return "Account Updated";
    case "USER_STATUS_CHANGED":
      return "Account Status Changed";
    case "USER_PASSWORD_RESET":
      return "Password Reset by Admin";
    case "SCHOOL_SETTINGS_UPDATED":
      return "School Settings Updated";
    case "SCHOOL_SETTINGS_BRANDING_RESET":
      return "School Branding Reset";
    case "BRANDING_ASSET_UPLOADED":
      return "Branding Asset Uploaded";
    case "GRADEBOOK_CELLS_SAVED":
      return "Gradebook Saved";
    case "ENROLLMENT_CREATED":
      return "Student Enrolled";
    case "ENROLLMENT_STATUS_UPDATED":
      return "Enrollment Status Changed";
    case "CLASS_ATTENDANCE_RECORDED":
      return "Class Attendance Recorded";
    case "CLASS_ATTENDANCE_CORRECTED":
      return "Attendance Corrected";
    case "CLINIC_VISIT_CREATED":
      return "Clinic Visit Logged";
    case "CREATE_GUIDANCE_RECORD":
      return "Guidance Referral Logged";
    case "BEHAVIOR_INCIDENT_REPORTED":
      return "Behavior Incident Reported";
    case "EXCUSE_LETTER_APPROVED":
      return "Excuse Letter Approved";
    case "EXCUSE_LETTER_REJECTED":
      return "Excuse Letter Rejected";
    case "AUTH_FORBIDDEN":
      return "Authorization Denied";
    case "AUDIT_LOG_VIEWED":
      return "Audit Log Inspected";
    case "AUDIT_LOG_EXPORTED":
      return "Audit Logs Exported";
    default:
      return action
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

// Category badge colors
function getCategoryColor(category: string | null): { bg: string; text: string; border: string } {
  switch (category) {
    case "AUTHENTICATION":
      return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
    case "ACCOUNT":
      return { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" };
    case "CONFIGURATION":
      return { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF" };
    case "ACADEMIC":
      return { bg: "#FEFCE8", text: "#A16207", border: "#FEF08A" };
    case "ATTENDANCE":
      return { bg: "#ECFDF5", text: "#0F766E", border: "#99F6E4" };
    case "STUDENT_SERVICES":
      return { bg: "#FFF7ED", text: "#C2410C", border: "#FFEDD5" };
    case "SECURITY":
      return { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" };
    case "SYSTEM":
      return { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" };
    default:
      return { bg: "#F1F5F9", text: "#334155", border: "#CBD5E1" };
  }
}

// Result badge styling
function getResultBadge(result: string): { bg: string; text: string; icon: React.ReactNode } {
  switch (result) {
    case "SUCCESS":
      return {
        bg: "#DCFCE7",
        text: "#15803D",
        icon: <CheckCircle2 size={13} style={{ marginRight: 4 }} />,
      };
    case "FAILURE":
      return {
        bg: "#FEE2E2",
        text: "#B91C1C",
        icon: <XCircle size={13} style={{ marginRight: 4 }} />,
      };
    case "DENIED":
      return {
        bg: "#FEF3C7",
        text: "#B45309",
        icon: <AlertTriangle size={13} style={{ marginRight: 4 }} />,
      };
    default:
      return {
        bg: "#F1F5F9",
        text: "#475569",
        icon: null,
      };
  }
}

export function AuditLogsScreen() {
  const { currentUser } = useAppContext();
  const isITAdmin = Boolean(
    currentUser?.rawRoles?.includes("ITAdmin") || currentUser?.role === "ITAdmin"
  );

  // Query & Pagination State
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary Metrics
  const [summary, setSummary] = useState<AuditSummary>({
    eventsToday: 0,
    failedAuthToday: 0,
    denialsToday: 0,
    adminChangesToday: 0,
  });

  // Filter States
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [result, setResult] = useState("ALL");
  const [actorRole, setActorRole] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch Audit Logs from Backend
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: AuditQueryParams = {
        page,
        pageSize,
        search: search.trim() || undefined,
        category: category !== "ALL" ? category : undefined,
        action: action !== "ALL" ? action : undefined,
        result: result !== "ALL" ? result : undefined,
        actorRole: actorRole !== "ALL" ? actorRole : undefined,
        startDate: startDate || undefined,
        endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
      };

      const response = await auditApi.getAuditLogs(params);
      setLogs(response.items);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
      setSummary(response.summary);
    } catch (err: any) {
      console.error("Failed to load audit logs:", err);
      setError(err?.message || "Failed to load audit logs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, category, action, result, actorRole, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Open Log Detail
  const handleOpenDetail = async (item: AuditLogItem) => {
    setSelectedLog(item);
    setDetailLoading(true);
    try {
      const fullDetail = await auditApi.getAuditLogById(item.id);
      setSelectedLog(fullDetail);
    } catch (err) {
      console.error("Failed to fetch log details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch("");
    setCategory("ALL");
    setAction("ALL");
    setResult("ALL");
    setActorRole("ALL");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search) ||
    category !== "ALL" ||
    action !== "ALL" ||
    result !== "ALL" ||
    actorRole !== "ALL" ||
    Boolean(startDate) ||
    Boolean(endDate);

  // CSV Export
  const handleExportCsv = () => {
    const exportUrl = auditApi.exportCsvUrl({
      search: search.trim() || undefined,
      category: category !== "ALL" ? category : undefined,
      action: action !== "ALL" ? action : undefined,
      result: result !== "ALL" ? result : undefined,
      actorRole: actorRole !== "ALL" ? actorRole : undefined,
      startDate: startDate || undefined,
      endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
    });
    window.open(exportUrl, "_blank");
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto", color: C.t1 }}>
      {/* Top Header & Export Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                backgroundColor: C.m900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
                Audit Logs &amp; Security Trail
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: C.t3, marginTop: 2 }}>
                Trustworthy chronological record answering Who, What, Target, When, Where, and Result.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              backgroundColor: "#fff",
              fontSize: 13,
              fontWeight: 500,
              color: C.t2,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            title="Refresh logs"
          >
            <RefreshCw size={14} className={loading ? "spin-animation" : ""} />
            <span>Refresh</span>
          </button>

          {isITAdmin ? (
            <button
              onClick={handleExportCsv}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 6,
                backgroundColor: C.m700,
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              }}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 6,
                backgroundColor: "#F1F5F9",
                color: C.t3,
                fontSize: 12,
                border: `1px solid ${C.border}`,
              }}
              title="CSV export is restricted to IT Administrators."
            >
              <Lock size={13} />
              <span>Export (ITAdmin Only)</span>
            </div>
          )}
        </div>
      </div>

      {/* Standard Admin Limited Visibility Banner */}
      {!isITAdmin && (
        <div
          style={{
            backgroundColor: "#EFF6FF",
            border: "1px solid #BFDBFE",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 13,
            color: "#1E40AF",
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Operational Audit Access:</strong> As a Standard Administrator, you are viewing
            operational records (Account Management, School Settings, Academic, Attendance, and
            Student Services). Sensitive security and system administration events remain restricted
            to ITAdmin.
          </div>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: "16px 20px",
            border: `1px solid ${C.border}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.t3, textTransform: "uppercase" }}>
              Events Today
            </span>
            <Activity size={16} color={C.m700} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.t1, marginTop: 8 }}>
            {summary.eventsToday.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: "16px 20px",
            border: `1px solid ${C.border}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.t3, textTransform: "uppercase" }}>
              Failed Authentication
            </span>
            <XCircle size={16} color={C.red} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.red, marginTop: 8 }}>
            {summary.failedAuthToday.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: "16px 20px",
            border: `1px solid ${C.border}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.t3, textTransform: "uppercase" }}>
              Authorization Denials
            </span>
            <AlertTriangle size={16} color={C.amber} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.amber, marginTop: 8 }}>
            {summary.denialsToday.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: "16px 20px",
            border: `1px solid ${C.border}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.t3, textTransform: "uppercase" }}>
              Administrative Changes
            </span>
            <FileText size={16} color={C.green} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.green, marginTop: 8 }}>
            {summary.adminChangesToday.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          padding: 16,
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {/* Search Box */}
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: C.t3,
              }}
            />
            <input
              type="text"
              placeholder="Search action, target, school ID, IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "8px 10px 8px 32px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Category Filter */}
          <div style={{ minWidth: 140 }}>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                backgroundColor: "#fff",
                outline: "none",
              }}
            >
              <option value="ALL">All Categories</option>
              {isITAdmin && <option value="AUTHENTICATION">Authentication</option>}
              <option value="ACCOUNT">Account Management</option>
              <option value="CONFIGURATION">Configuration</option>
              <option value="ACADEMIC">Academic</option>
              <option value="ATTENDANCE">Attendance</option>
              <option value="STUDENT_SERVICES">Student Services</option>
              {isITAdmin && <option value="SECURITY">Security</option>}
              {isITAdmin && <option value="SYSTEM">System</option>}
            </select>
          </div>

          {/* Result Filter */}
          <div style={{ minWidth: 120 }}>
            <select
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                backgroundColor: "#fff",
                outline: "none",
              }}
            >
              <option value="ALL">All Results</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
              <option value="DENIED">Denied</option>
            </select>
          </div>

          {/* Role Filter */}
          <div style={{ minWidth: 130 }}>
            <select
              value={actorRole}
              onChange={(e) => {
                setActorRole(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                backgroundColor: "#fff",
                outline: "none",
              }}
            >
              <option value="ALL">All Roles</option>
              <option value="ITAdmin">ITAdmin</option>
              <option value="Admin">Admin</option>
              <option value="Principal">Principal</option>
              <option value="Teacher">Teacher</option>
              <option value="Student">Student</option>
              <option value="Registrar">Registrar</option>
              <option value="Guidance">Guidance</option>
              <option value="Nurse">Nurse</option>
              <option value="GateOperator">GateOperator</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: C.t3 }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "7px 10px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 12,
                backgroundColor: "#fff",
                outline: "none",
              }}
            />
          </div>

          {/* Date Range End */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: C.t3 }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "7px 10px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 12,
                backgroundColor: "#fff",
                outline: "none",
              }}
            />
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              style={{
                padding: "7px 12px",
                borderRadius: 6,
                border: "none",
                backgroundColor: "#F1F5F9",
                color: C.t2,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Audit Logs Table */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "#F8FAFC",
                  borderBottom: `1px solid ${C.border}`,
                  color: C.t3,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "12px 16px" }}>Timestamp</th>
                <th style={{ padding: "12px 16px" }}>Actor</th>
                <th style={{ padding: "12px 16px" }}>Action</th>
                <th style={{ padding: "12px 16px" }}>Target</th>
                <th style={{ padding: "12px 16px" }}>Result</th>
                <th style={{ padding: "12px 16px" }}>Category</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: "center", color: C.t3 }}>
                    <RefreshCw size={24} className="spin-animation" style={{ margin: "0 auto 12px" }} />
                    <div>Loading audit logs...</div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: "center", color: C.red }}>
                    <AlertTriangle size={24} style={{ margin: "0 auto 12px" }} />
                    <div>{error}</div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: "center", color: C.t3 }}>
                    <Shield size={28} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                    <div style={{ fontWeight: 600 }}>No audit logs found</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      {hasActiveFilters
                        ? "Try adjusting your search criteria or date filters."
                        : "Audit trail will record security and business mutations as they occur."}
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((item) => {
                  const resultStyle = getResultBadge(item.result);
                  const catStyle = getCategoryColor(item.category);
                  const actorSchoolId = item.actor_school_id || item.actor?.school_id || "System";
                  const actorName = item.actor
                    ? `${item.actor.first_name} ${item.actor.last_name}`
                    : null;
                  const dateObj = new Date(item.created_at);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenDetail(item)}
                      style={{
                        borderBottom: `1px solid ${C.borderLight}`,
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 500, color: C.t1 }}>
                          {dateObj.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                          {dateObj.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Actor */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600, color: C.t1 }}>
                              {actorSchoolId}
                            </div>
                            {actorName && (
                              <div style={{ fontSize: 11, color: C.t3 }}>
                                {actorName}
                              </div>
                            )}
                          </div>
                          {item.actor_role && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "2px 6px",
                                borderRadius: 4,
                                backgroundColor: "#F1F5F9",
                                color: C.t2,
                                border: `1px solid ${C.borderLight}`,
                              }}
                            >
                              {item.actor_role}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, color: C.t1 }}>
                          {formatActionLabel(item.action)}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: "monospace",
                            color: C.t3,
                            marginTop: 2,
                          }}
                        >
                          {item.action}
                        </div>
                      </td>

                      {/* Target */}
                      <td style={{ padding: "14px 16px" }}>
                        <div
                          style={{
                            maxWidth: 240,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: 500,
                            color: C.t1,
                          }}
                          title={item.target_label || item.resource_id || "—"}
                        >
                          {item.target_label || item.resource_id || "—"}
                        </div>
                        <div style={{ fontSize: 11, color: C.t3, textTransform: "capitalize" }}>
                          {item.resource_type}
                        </div>
                      </td>

                      {/* Result */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 12,
                            backgroundColor: resultStyle.bg,
                            color: resultStyle.text,
                          }}
                        >
                          {resultStyle.icon}
                          {item.result}
                        </span>
                      </td>

                      {/* Category */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 4,
                            backgroundColor: catStyle.bg,
                            color: catStyle.text,
                            border: `1px solid ${catStyle.border}`,
                            textTransform: "uppercase",
                          }}
                        >
                          {item.category || "GENERAL"}
                        </span>
                      </td>

                      {/* Detail View Action */}
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(item);
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 4,
                            border: `1px solid ${C.border}`,
                            backgroundColor: "#fff",
                            color: C.t2,
                            cursor: "pointer",
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        {!loading && logs.length > 0 && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "#F8FAFC",
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              fontSize: 12,
              color: C.t2,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>
                Showing <strong>{(page - 1) * pageSize + 1}</strong> to{" "}
                <strong>{Math.min(page * pageSize, total)}</strong> of{" "}
                <strong>{total.toLocaleString()}</strong> events
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: C.t3 }}>Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{
                    padding: "3px 6px",
                    borderRadius: 4,
                    border: `1px solid ${C.border}`,
                    backgroundColor: "#fff",
                    fontSize: 12,
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "5px 10px",
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                  backgroundColor: page <= 1 ? "#F1F5F9" : "#fff",
                  color: page <= 1 ? C.t3 : C.t1,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>

              <span style={{ padding: "0 8px", fontWeight: 500 }}>
                Page {page} of {totalPages || 1}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "5px 10px",
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                  backgroundColor: page >= totalPages ? "#F1F5F9" : "#fff",
                  color: page >= totalPages ? C.t3 : C.t1,
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sanitized Detail Modal / Slide-over */}
      {selectedLog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 580,
              height: "100%",
              backgroundColor: "#fff",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#F8FAFC",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>
                    {formatActionLabel(selectedLog.action)}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 10,
                      backgroundColor: getResultBadge(selectedLog.result).bg,
                      color: getResultBadge(selectedLog.result).text,
                    }}
                  >
                    {selectedLog.result}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>
                  Event ID: {selectedLog.id}
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  color: C.t3,
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", flex: 1 }}>
              {/* Event Metadata Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 24,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: C.t3, display: "block", marginBottom: 2 }}>Timestamp:</span>
                  <strong>{new Date(selectedLog.created_at).toLocaleString()}</strong>
                </div>

                <div>
                  <span style={{ color: C.t3, display: "block", marginBottom: 2 }}>Category:</span>
                  <strong>{selectedLog.category || "GENERAL"}</strong>
                </div>

                <div>
                  <span style={{ color: C.t3, display: "block", marginBottom: 2 }}>Actor School ID:</span>
                  <strong>{selectedLog.actor_school_id || selectedLog.actor?.school_id || "System"}</strong>
                </div>

                <div>
                  <span style={{ color: C.t3, display: "block", marginBottom: 2 }}>Actor Role:</span>
                  <strong>{selectedLog.actor_role || "User"}</strong>
                </div>

                <div>
                  <span style={{ color: C.t3, display: "block", marginBottom: 2 }}>Target Type:</span>
                  <strong>{selectedLog.resource_type}</strong>
                </div>

                <div>
                  <span style={{ color: C.t3, display: "block", marginBottom: 2 }}>Target ID:</span>
                  <strong style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {selectedLog.resource_id || "—"}
                  </strong>
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: C.t3, display: "block", marginBottom: 2 }}>Target Label:</span>
                  <strong>{selectedLog.target_label || "—"}</strong>
                </div>

                {selectedLog.reason && (
                  <div style={{ gridColumn: "span 2" }}>
                    <span style={{ color: C.t3, display: "block", marginBottom: 2 }}>Reason / Note:</span>
                    <strong style={{ color: C.red }}>{selectedLog.reason}</strong>
                  </div>
                )}
              </div>

              {/* Technical / Request Context Strip */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 6,
                  padding: 14,
                  border: `1px solid ${C.borderLight}`,
                  marginBottom: 24,
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600, color: C.t2, marginBottom: 8 }}>
                  Request &amp; Environment Context
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>
                    <span style={{ color: C.t3 }}>Request ID (Correlation):</span>{" "}
                    <code style={{ fontSize: 11, backgroundColor: "#E2E8F0", padding: "1px 4px", borderRadius: 3 }}>
                      {selectedLog.correlation_id || "—"}
                    </code>
                  </div>
                  <div>
                    <span style={{ color: C.t3 }}>Client IP:</span>{" "}
                    <strong>{selectedLog.ip_address || "127.0.0.1"}</strong>
                  </div>
                  <div>
                    <span style={{ color: C.t3 }}>User-Agent:</span>{" "}
                    <span style={{ color: C.t2, fontSize: 11 }}>
                      {selectedLog.user_agent || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sanitized Metadata / State Differences */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: C.t1 }}>
                  State Changes &amp; Sanitized Metadata
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>
                  Sensitive data (passwords, tokens, cookies, counseling notes, medical details) are
                  strictly redacted before logging.
                </div>

                {selectedLog.previous_state && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>Previous State:</span>
                    <pre
                      style={{
                        backgroundColor: "#F8FAFC",
                        padding: 12,
                        borderRadius: 6,
                        border: `1px solid ${C.borderLight}`,
                        fontSize: 11,
                        overflowX: "auto",
                        marginTop: 4,
                      }}
                    >
                      {JSON.stringify(selectedLog.previous_state, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_state && (
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>New State:</span>
                    <pre
                      style={{
                        backgroundColor: "#F8FAFC",
                        padding: 12,
                        borderRadius: 6,
                        border: `1px solid ${C.borderLight}`,
                        fontSize: 11,
                        overflowX: "auto",
                        marginTop: 4,
                      }}
                    >
                      {JSON.stringify(selectedLog.new_state, null, 2)}
                    </pre>
                  </div>
                )}

                {!selectedLog.previous_state && !selectedLog.new_state && (
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: "#F8FAFC",
                      borderRadius: 6,
                      border: `1px solid ${C.borderLight}`,
                      color: C.t3,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    No secondary payload state recorded for this event.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: `1px solid ${C.border}`,
                backgroundColor: "#F8FAFC",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  backgroundColor: "#fff",
                  color: C.t2,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
