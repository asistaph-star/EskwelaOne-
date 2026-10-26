import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Lock,
  AlertTriangle,
  RefreshCw,
  Users,
  KeyRound,
  UserCheck,
  UserX,
  ExternalLink,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { securityApi, SecurityOverviewData, SecurityTimeWindow } from "../../../api/security.api";
import { AdminScreen } from "../AdminApp";

interface SecurityAccessScreenProps {
  onNavigate?: (screen: AdminScreen) => void;
}

// Friendly display mapping for audit machine actions
function formatEventLabel(action: string): string {
  switch (action) {
    case "LOGIN_SUCCESS":
      return "Login Succeeded";
    case "LOGIN_FAILURE":
      return "Login Failed";
    case "AUTH_RATE_LIMIT_TRIGGERED":
      return "Login Rate Limit Triggered";
    case "AUTH_FORBIDDEN":
      return "Authorization Denied";
    case "LOGOUT":
      return "User Logged Out";
    case "PASSWORD_CHANGED":
      return "Password Changed";
    case "PASSWORD_CHANGE_FAILED":
      return "Password Change Failed";
    case "USER_PASSWORD_RESET":
      return "Password Reset by Admin";
    case "USER_CREATED":
      return "Account Provisioned";
    case "USER_STATUS_CHANGED":
      return "Account Status Changed";
    case "USER_UPDATED":
      return "Account Updated";
    case "SCHOOL_SETTINGS_UPDATED":
      return "School Settings Updated";
    case "SCHOOL_SETTINGS_BRANDING_RESET":
      return "School Branding Reset";
    case "BRANDING_ASSET_UPLOADED":
      return "Branding Asset Uploaded";
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

export function SecurityAccessScreen({ onNavigate }: SecurityAccessScreenProps) {
  const [timeWindow, setTimeWindow] = useState<SecurityTimeWindow>("24h");
  const [data, setData] = useState<SecurityOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await securityApi.getOverview(timeWindow);
      setData(response);
    } catch (err: any) {
      setError(err?.message || "Failed to load security overview data.");
    } finally {
      setLoading(false);
    }
  }, [timeWindow]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const isITAdmin = data?.scope === "FULL_ITADMIN";

  return (
    <div style={{ padding: "28px 36px", maxWidth: 1400, margin: "0 auto" }}>
      {/* ─── Header & Controls ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "#ecfdf5",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #a7f3d0",
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.navy,
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Security & Access
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: C.navyMuted,
                  margin: "2px 0 0",
                }}
              >
                Monitor authentication, authorization, and privileged account activity.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Time Window Selector */}
          <div
            style={{
              display: "flex",
              backgroundColor: "#f1f5f9",
              borderRadius: 8,
              padding: 3,
              border: "1px solid #e2e8f0",
            }}
          >
            <button
              onClick={() => setTimeWindow("24h")}
              style={{
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: timeWindow === "24h" ? "#ffffff" : "transparent",
                color: timeWindow === "24h" ? C.navy : C.navyMuted,
                boxShadow: timeWindow === "24h" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Last 24 Hours
            </button>
            <button
              onClick={() => setTimeWindow("7d")}
              style={{
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: timeWindow === "7d" ? "#ffffff" : "transparent",
                color: timeWindow === "7d" ? C.navy : C.navyMuted,
                boxShadow: timeWindow === "7d" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Last 7 Days
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchOverview}
            disabled={loading}
            title="Refresh Security Metrics"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              color: C.navy,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <RefreshCw
              size={14}
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── Standard Admin Operational Scope Banner ────────────────────────── */}
      {!isITAdmin && data && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            backgroundColor: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
            color: "#334155",
          }}
        >
          <Info size={16} color="#0284c7" />
          <span>
            <strong>Operational Scope:</strong> You are viewing administrative account activity and status metrics. Low-level security events and authentication denial metrics are scoped to IT Administrators.
          </span>
        </div>
      )}

      {/* ─── Error Alert State ──────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#991b1b",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchOverview}
            style={{
              padding: "4px 10px",
              backgroundColor: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── KPI Metric Cards ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {/* Failed Logins (ITAdmin only) */}
        {isITAdmin && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 10,
              padding: "20px 22px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.navyMuted }}>
                  Failed Logins
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: data?.kpis.failedLogins ? "#fef2f2" : "#f8fafc",
                    color: data?.kpis.failedLogins ? "#dc2626" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AlertCircle size={16} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, margin: "10px 0 2px" }}>
                {loading ? "..." : (data?.kpis.failedLogins ?? 0)}
              </div>
              <div style={{ fontSize: 12, color: C.navyMuted }}>
                {timeWindow === "24h" ? "Past 24 hours" : "Past 7 days"}
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate("audit-logs")}
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#2563eb",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Inspect in Audit Logs <ExternalLink size={11} />
              </button>
            )}
          </div>
        )}

        {/* Rate Limits Triggered (ITAdmin only) */}
        {isITAdmin && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 10,
              padding: "20px 22px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.navyMuted }}>
                  Rate Limits
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: data?.kpis.rateLimits ? "#fffbeb" : "#f8fafc",
                    color: data?.kpis.rateLimits ? "#d97706" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AlertTriangle size={16} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, margin: "10px 0 2px" }}>
                {loading ? "..." : (data?.kpis.rateLimits ?? 0)}
              </div>
              <div style={{ fontSize: 12, color: C.navyMuted }}>
                Threshold triggers
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate("audit-logs")}
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#2563eb",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Inspect in Audit Logs <ExternalLink size={11} />
              </button>
            )}
          </div>
        )}

        {/* Authorization Denials (ITAdmin only) */}
        {isITAdmin && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 10,
              padding: "20px 22px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.navyMuted }}>
                  Auth Denials
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: data?.kpis.authDenials ? "#fef2f2" : "#f8fafc",
                    color: data?.kpis.authDenials ? "#dc2626" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Lock size={16} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, margin: "10px 0 2px" }}>
                {loading ? "..." : (data?.kpis.authDenials ?? 0)}
              </div>
              <div style={{ fontSize: 12, color: C.navyMuted }}>
                403 / Access forbidden
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate("audit-logs")}
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#2563eb",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Inspect in Audit Logs <ExternalLink size={11} />
              </button>
            )}
          </div>
        )}

        {/* Password Resets (Available to both ITAdmin & Admin) */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 10,
            padding: "20px 22px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.navyMuted }}>
                Password Resets
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  backgroundColor: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <KeyRound size={16} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, margin: "10px 0 2px" }}>
              {loading ? "..." : (data?.kpis.passwordResets ?? 0)}
            </div>
            <div style={{ fontSize: 12, color: C.navyMuted }}>
              Administrative resets
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("audit-logs")}
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: "#2563eb",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Inspect in Audit Logs <ExternalLink size={11} />
            </button>
          )}
        </div>

        {/* Status Changes (Available to both ITAdmin & Admin) */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 10,
            padding: "20px 22px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.navyMuted }}>
                Account Changes
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  backgroundColor: "#f0fdf4",
                  color: "#16a34a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserCheck size={16} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, margin: "10px 0 2px" }}>
              {loading ? "..." : (data?.kpis.statusChanges ?? 0)}
            </div>
            <div style={{ fontSize: 12, color: C.navyMuted }}>
              Activations & deactivations
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("audit-logs")}
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: "#2563eb",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Inspect in Audit Logs <ExternalLink size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Account Status Section (Live Database State) ───────────────────── */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 10,
          padding: "22px 24px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: 0 }}>
              Account Access & Governance
            </h2>
            <p style={{ fontSize: 12, color: C.navyMuted, margin: "3px 0 0" }}>
              Live identity state across all provisioned accounts in the school database.
            </p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("accounts")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: C.navy,
                cursor: "pointer",
              }}
            >
              <Users size={13} />
              Manage Accounts
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              backgroundColor: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontSize: 12, color: C.navyMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <UserCheck size={14} color="#16a34a" />
              Active Accounts
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
              {loading ? "..." : (data?.accountStatus.activeAccounts ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Normal authentication permitted
            </div>
          </div>

          <div
            style={{
              padding: "14px 16px",
              backgroundColor: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontSize: 12, color: C.navyMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <UserX size={14} color="#dc2626" />
              Inactive Accounts
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#dc2626", marginTop: 4 }}>
              {loading ? "..." : (data?.accountStatus.inactiveAccounts ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Authentication blocked
            </div>
          </div>

          <div
            style={{
              padding: "14px 16px",
              backgroundColor: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontSize: 12, color: C.navyMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <KeyRound size={14} color="#d97706" />
              Password Change Required
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#d97706", marginTop: 4 }}>
              {loading ? "..." : (data?.accountStatus.passwordChangeRequired ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Mandatory first-login state
            </div>
          </div>

          <div
            style={{
              padding: "14px 16px",
              backgroundColor: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontSize: 12, color: C.navyMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={14} color="#2563eb" />
              Total User Identities
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginTop: 4 }}>
              {loading ? "..." : (data?.accountStatus.totalAccounts ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Provisioned directory accounts
            </div>
          </div>
        </div>
      </div>

      {/* ─── Recent Security & Privileged Events ───────────────────────────── */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: 0 }}>
              Recent Security & Administrative Events
            </h2>
            <p style={{ fontSize: 12, color: C.navyMuted, margin: "3px 0 0" }}>
              Latest authenticated security, authentication, and privileged modifications (up to 15 records).
            </p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("audit-logs")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#2563eb",
                cursor: "pointer",
              }}
            >
              View Full Audit Trail <ArrowRight size={13} />
            </button>
          )}
        </div>

        {/* Events Table / Zero State */}
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: C.navyMuted, fontSize: 13 }}>
            <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            Loading security event history...
          </div>
        ) : !data?.recentEvents || data.recentEvents.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
                color: "#94a3b8",
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>
              No security events recorded in the selected period
            </div>
            <div style={{ fontSize: 12, color: C.navyMuted, marginTop: 4 }}>
              Zero authentication failures, rate limit events, or privileged alterations occurred in this time window.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "12px 18px", color: C.navyMuted, fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: "12px 18px", color: C.navyMuted, fontWeight: 600 }}>Event</th>
                  <th style={{ padding: "12px 18px", color: C.navyMuted, fontWeight: 600 }}>Actor</th>
                  <th style={{ padding: "12px 18px", color: C.navyMuted, fontWeight: 600 }}>Target / Resource</th>
                  <th style={{ padding: "12px 18px", color: C.navyMuted, fontWeight: 600 }}>Source IP</th>
                  <th style={{ padding: "12px 18px", color: C.navyMuted, fontWeight: 600 }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.map((evt) => {
                  const isSuccess = evt.result === "SUCCESS";
                  const isDenied = evt.result === "DENIED";
                  const isFailure = evt.result === "FAILURE";

                  return (
                    <tr
                      key={evt.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background-color 0.1s ease",
                      }}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: "12px 18px", color: C.navy, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock size={13} color="#94a3b8" />
                          <span>{new Date(evt.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}</span>
                        </div>
                      </td>

                      {/* Event */}
                      <td style={{ padding: "12px 18px", fontWeight: 600, color: C.navy }}>
                        {formatEventLabel(evt.action)}
                      </td>

                      {/* Actor */}
                      <td style={{ padding: "12px 18px", color: "#334155" }}>
                        {evt.actor_school_id ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              backgroundColor: "#f1f5f9",
                              padding: "3px 8px",
                              borderRadius: 4,
                              fontWeight: 500,
                            }}
                          >
                            <span>{evt.actor_school_id}</span>
                            {evt.actor_role && (
                              <span style={{ fontSize: 10, color: "#64748b" }}>({evt.actor_role})</span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>System / Anonymous</span>
                        )}
                      </td>

                      {/* Target / Resource */}
                      <td style={{ padding: "12px 18px", color: "#334155" }}>
                        {evt.target_label || evt.resource_type || "—"}
                      </td>

                      {/* Source IP */}
                      <td style={{ padding: "12px 18px", color: "#475569", fontFamily: "monospace", fontSize: 11 }}>
                        {evt.ip_address || "—"}
                      </td>

                      {/* Result */}
                      <td style={{ padding: "12px 18px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: isSuccess ? "#f0fdf4" : isDenied ? "#fef3c7" : "#fef2f2",
                            color: isSuccess ? "#15803d" : isDenied ? "#b45309" : "#b91c1c",
                            border: `1px solid ${isSuccess ? "#bbf7d0" : isDenied ? "#fde68a" : "#fecaca"}`,
                          }}
                        >
                          {isSuccess ? (
                            <CheckCircle2 size={11} />
                          ) : isDenied ? (
                            <AlertTriangle size={11} />
                          ) : (
                            <XCircle size={11} />
                          )}
                          {evt.result}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
