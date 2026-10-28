import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  Server,
  Database,
  HardDrive,
  Radio,
  Sparkles,
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
  Info,
  ShieldAlert,
  Archive,
  ShieldCheck,
} from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { healthApi, SystemHealthData, HealthStatus, ComponentHealth } from "../../../api/health.api";
import { backupApi, BackupStatusOverview } from "../../../api/backup.api";

// Helper to format uptime into a readable string
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

// Visual status configuration
function getStatusBadgeConfig(status: HealthStatus) {
  switch (status) {
    case "OPERATIONAL":
      return {
        label: "Operational",
        icon: CheckCircle2,
        bg: "#f0fdf4",
        text: "#15803d",
        border: "#bbf7d0",
        dotColor: "#22c55e",
      };
    case "DEGRADED":
      return {
        label: "Degraded",
        icon: AlertTriangle,
        bg: "#fef3c7",
        text: "#b45309",
        border: "#fde68a",
        dotColor: "#f59e0b",
      };
    case "UNAVAILABLE":
      return {
        label: "Unavailable",
        icon: XCircle,
        bg: "#fef2f2",
        text: "#b91c1c",
        border: "#fecaca",
        dotColor: "#ef4444",
      };
    case "NOT_MONITORED":
      return {
        label: "Not Monitored",
        icon: HelpCircle,
        bg: "#f8fafc",
        text: "#64748b",
        border: "#cbd5e1",
        dotColor: "#94a3b8",
      };
    case "NOT_CONFIGURED":
    default:
      return {
        label: "Not Configured",
        icon: HelpCircle,
        bg: "#f8fafc",
        text: "#94a3b8",
        border: "#e2e8f0",
        dotColor: "#cbd5e1",
      };
  }
}

interface ComponentCardProps {
  icon: React.ElementType;
  title: string;
  component: ComponentHealth;
  isITAdmin: boolean;
  extraMeta?: string;
}

function ComponentCard({ icon: Icon, title, component, isITAdmin, extraMeta }: ComponentCardProps) {
  const badge = getStatusBadgeConfig(component.status);
  const BadgeIcon = badge.icon;

  return (
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "#f8fafc",
                color: C.navy,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #f1f5f9",
              }}
            >
              <Icon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{title}</div>
              {extraMeta && (
                <div style={{ fontSize: 11, color: C.navyMuted, marginTop: 1 }}>{extraMeta}</div>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: badge.bg,
              color: badge.text,
              border: `1px solid ${badge.border}`,
            }}
          >
            <BadgeIcon size={12} />
            {badge.label}
          </span>
        </div>

        {/* Diagnostic Message */}
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 12px", lineHeight: 1.5 }}>
          {component.message}
        </p>
      </div>

      {/* Latency & Diagnostic Context (ITAdmin scope) */}
      <div
        style={{
          borderTop: "1px solid #f1f5f9",
          paddingTop: 10,
          marginTop: 6,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: "#94a3b8",
        }}
      >
        <span>
          Checked {new Date(component.lastChecked).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
        </span>
        {isITAdmin && typeof component.latencyMs === "number" && (
          <span style={{ fontFamily: "monospace", color: "#64748b", fontWeight: 500 }}>
            {component.latencyMs}ms response
          </span>
        )}
      </div>
    </div>
  );
}

// Helper to format relative elapsed freshness locally without server requests
function formatRelativeFreshness(lastCheckedDate: Date | null, now: Date): string {
  if (!lastCheckedDate || isNaN(lastCheckedDate.getTime())) return "";
  const diffMs = Math.max(0, now.getTime() - lastCheckedDate.getTime());
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 10) {
    return "Checked just now";
  }
  if (diffSec < 60) {
    return `Checked ${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) {
    return "Checked 1 minute ago";
  }
  if (diffMin < 60) {
    return `Checked ${diffMin} minutes ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) {
    return "Checked 1 hour ago";
  }
  return `Checked ${diffHours} hours ago`;
}

export function SystemHealthScreen() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatusOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  const isFetchingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  const executeFetch = useCallback(async (isManual: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isManual) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [healthResponse, backupResponse] = await Promise.all([
        healthApi.getSystemHealth(),
        backupApi.getBackupStatus().catch(() => null),
      ]);

      if (!isMountedRef.current) return;

      setData(healthResponse);
      setBackupStatus(backupResponse);
      setError(null);
      setIsStale(false);
      lastFetchTimeRef.current = Date.now();
    } catch (err: any) {
      if (!isMountedRef.current) return;
      const msg = err?.message || "Unable to retrieve system health information.";
      setError(msg);
      setData((prev) => {
        if (prev) {
          setIsStale(true);
        }
        return prev;
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
        isFetchingRef.current = false;
      }
    }
  }, []);

  const scheduleNextRefresh = useCallback(() => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }

    if (typeof document !== "undefined" && document.visibilityState === "visible" && (typeof navigator === "undefined" || navigator.onLine !== false)) {
      autoRefreshTimerRef.current = setInterval(() => {
        if (document.visibilityState === "visible" && (typeof navigator === "undefined" || navigator.onLine !== false)) {
          executeFetch(false);
        }
      }, 60_000);
    }
  }, [executeFetch]);

  const handleManualRefresh = useCallback(() => {
    executeFetch(true);
    scheduleNextRefresh();
  }, [executeFetch, scheduleNextRefresh]);

  useEffect(() => {
    isMountedRef.current = true;

    executeFetch(true);
    scheduleNextRefresh();

    // 1-second local timer for relative freshness updating without server requests
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleNextRefresh();
        const elapsed = Date.now() - lastFetchTimeRef.current;
        if (elapsed >= 60_000 || isStale) {
          executeFetch(false);
        }
      } else {
        if (autoRefreshTimerRef.current) {
          clearInterval(autoRefreshTimerRef.current);
          autoRefreshTimerRef.current = null;
        }
      }
    };

    const handleOnline = () => {
      scheduleNextRefresh();
      executeFetch(false);
    };

    const handleOffline = () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
      setIsStale(true);
      setError("Network connection lost. Displaying cached system health data.");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMountedRef.current = false;
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
      clearInterval(clockInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [executeFetch, scheduleNextRefresh, isStale]);

  const isITAdmin = data?.scope === "FULL_ITADMIN";
  const overallBadge = data ? getStatusBadgeConfig(data.status) : null;
  const OverallIcon = overallBadge?.icon || CheckCircle2;

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: "#f0fdf4",
              color: "#15803d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #bbf7d0",
            }}
          >
            <Activity size={20} />
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
              System Health
            </h1>
            <p
              style={{
                fontSize: 13,
                color: C.navyMuted,
                margin: "2px 0 0",
              }}
            >
              Monitor the availability of DigiSkwela's core application services.
            </p>
          </div>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={loading || refreshing}
          title="Refresh System Health Status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            color: C.navy,
            cursor: (loading || refreshing) ? "not-allowed" : "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <RefreshCw
            size={14}
            style={{
              animation: (loading || refreshing) ? "spin 1s linear infinite" : "none",
            }}
          />
          {loading ? "Checking..." : refreshing ? "Refreshing..." : "Refresh Status"}
        </button>
      </div>

      {/* ─── Stale Data Warning Alert ────────────────────────────────────────── */}
      {error && data && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            color: "#92400e",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} style={{ color: "#d97706" }} />
            <span>
              <strong>Update Alert:</strong> {error}. Displaying last verified health inspection from{" "}
              {new Date(data.lastChecked).toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}.
            </span>
          </div>
          <button
            onClick={handleManualRefresh}
            style={{
              padding: "4px 10px",
              backgroundColor: "#d97706",
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

      {/* ─── Complete Initial Failure Alert ─────────────────────────────────── */}
      {error && !data && (
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
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={handleManualRefresh}
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

      {/* ─── Overall System Status Banner ───────────────────────────────────── */}
      {data && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 10,
            padding: "20px 24px",
            border: `1px solid ${overallBadge?.border || "#e2e8f0"}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            marginBottom: 26,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: overallBadge?.bg || "#f8fafc",
                color: overallBadge?.text || C.navy,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${overallBadge?.border || "#e2e8f0"}`,
              }}
            >
              <OverallIcon size={24} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.navyMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Overall System Status
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: overallBadge?.text || C.navy, marginTop: 2 }}>
                {overallBadge?.label || "Operational"}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right", fontSize: 12, color: C.navyMuted }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
              <Clock size={13} />
              <span>
                Last checked: {new Date(data.lastChecked).toLocaleString("en-US", {
                  timeZone: "Asia/Manila",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: isStale ? "#b45309" : "#15803d",
                  backgroundColor: isStale ? "#fef3c7" : "#f0fdf4",
                  padding: "2px 8px",
                  borderRadius: 12,
                  border: `1px solid ${isStale ? "#fde68a" : "#bbf7d0"}`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: isStale ? "#f59e0b" : "#22c55e",
                  }}
                />
                {isStale ? "Stale data" : formatRelativeFreshness(new Date(data.lastChecked), currentTime)}
              </span>

              {refreshing && (
                <span style={{ fontSize: 11, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} />
                  Auto-refreshing...
                </span>
              )}

              <span style={{ fontSize: 11, color: "#64748b" }}>
                {isITAdmin ? "Diagnostic Inspection (ITAdmin)" : "Operational Summary (Admin)"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Core Application Dependencies ──────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: "0 0 14px" }}>
          Core Dependencies
        </h2>

        {loading && !data ? (
          <div style={{ padding: 48, textAlign: "center", color: C.navyMuted, fontSize: 13 }}>
            <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            Checking system health...
          </div>
        ) : data ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {/* API Server */}
            <ComponentCard
              icon={Server}
              title={data.components.api.name}
              component={data.components.api}
              isITAdmin={isITAdmin}
              extraMeta={`Uptime: ${formatUptime(data.application.uptimeSeconds)}`}
            />

            {/* PostgreSQL Database */}
            <ComponentCard
              icon={Database}
              title={data.components.database.name}
              component={data.components.database}
              isITAdmin={isITAdmin}
              extraMeta="Prisma Engine / Postgres"
            />

            {/* Storage */}
            <ComponentCard
              icon={HardDrive}
              title={data.components.storage.name}
              component={data.components.storage}
              isITAdmin={isITAdmin}
              extraMeta="Persistent Local Storage"
            />

            {/* Gate Event Service */}
            <ComponentCard
              icon={Radio}
              title={data.components.gateEventService.name}
              component={data.components.gateEventService}
              isITAdmin={isITAdmin}
              extraMeta="SSE Real-time Stream"
            />
          </div>
        ) : null}
      </div>

      {/* ─── Auxiliary & Configured Services ────────────────────────────────── */}
      {data && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: "0 0 14px" }}>
            Auxiliary & Configured Services
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {/* AI Service */}
            <ComponentCard
              icon={Sparkles}
              title={data.components.aiService.name}
              component={data.components.aiService}
              isITAdmin={isITAdmin}
              extraMeta="Free-tier AI Policy"
            />

            {/* Email Service */}
            <ComponentCard
              icon={Mail}
              title={data.components.emailService.name}
              component={data.components.emailService}
              isITAdmin={isITAdmin}
              extraMeta="Transactional Mailer"
            />
          </div>
        </div>
      )}

      {/* ─── Application Information (Verified Metadata Only) ───────────────── */}
      {data && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 10,
            padding: "20px 24px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Info size={16} color="#0284c7" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>
              Application Information
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              fontSize: 12,
            }}
          >
            <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
              <div style={{ color: C.navyMuted }}>Application Core</div>
              <div style={{ fontWeight: 600, color: C.navy, marginTop: 4 }}>
                {data.application.name}
              </div>
            </div>

            <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
              <div style={{ color: C.navyMuted }}>Verified Version</div>
              <div style={{ fontWeight: 600, color: C.navy, marginTop: 4, fontFamily: "monospace" }}>
                v{data.application.version}
              </div>
            </div>

            <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
              <div style={{ color: C.navyMuted }}>Runtime Environment</div>
              <div style={{ fontWeight: 600, color: C.navy, marginTop: 4 }}>
                {data.application.environment}
              </div>
            </div>

            <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
              <div style={{ color: C.navyMuted }}>Process Uptime</div>
              <div style={{ fontWeight: 600, color: C.navy, marginTop: 4 }}>
                {formatUptime(data.application.uptimeSeconds)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Disaster Recovery & Operational Backup Status (Phase 4 Verified) ── */}
      {backupStatus && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 10,
            padding: "20px 24px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            marginTop: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Archive size={18} color="#059669" />
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: 0 }}>
                  Disaster Recovery & Operational Backup Status
                </h2>
                <div style={{ fontSize: 12, color: C.navyMuted, marginTop: 1 }}>
                  Calulut Integrated National High School — PostgreSQL 17 Native Archive & Media Volume
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 4,
                  backgroundColor: backupStatus.lastBackupResult === "SUCCESS" ? "#f0fdf4" : "#f8fafc",
                  color: backupStatus.lastBackupResult === "SUCCESS" ? "#15803d" : "#64748b",
                  border: `1px solid ${backupStatus.lastBackupResult === "SUCCESS" ? "#bbf7d0" : "#e2e8f0"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {backupStatus.lastBackupResult === "SUCCESS" ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {backupStatus.lastBackupResult === "SUCCESS" ? "Backup Verified" : "Pending First Snapshot"}
              </span>

              {backupStatus.lastRestoreTestDate && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 4,
                    backgroundColor: "#eff6ff",
                    color: "#1d4ed8",
                    border: "1px solid #bfdbfe",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <ShieldCheck size={12} />
                  Restore Tested
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
              <div style={{ color: C.navyMuted }}>Last Successful Backup</div>
              <div style={{ fontWeight: 600, color: C.navy, marginTop: 4 }}>
                {backupStatus.lastBackupTime ? new Date(backupStatus.lastBackupTime).toLocaleString() : "Never recorded"}
              </div>
            </div>

            <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
              <div style={{ color: C.navyMuted }}>Integrity Verification</div>
              <div style={{ fontWeight: 600, color: C.navy, marginTop: 4 }}>
                {backupStatus.verificationStatus === "VERIFIED" ? "SHA-256 Checksums & Catalog Valid" : "Unverified"}
              </div>
            </div>

            <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
              <div style={{ color: C.navyMuted }}>Last Sandbox Restore Test</div>
              <div style={{ fontWeight: 600, color: C.navy, marginTop: 4 }}>
                {backupStatus.lastRestoreTestDate ? new Date(backupStatus.lastRestoreTestDate).toLocaleString() : "Pending Verification Test"}
              </div>
            </div>

            <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: 8 }}>
              <div style={{ color: C.navyMuted }}>Total Backup Archives</div>
              <div style={{ fontWeight: 600, color: C.navy, marginTop: 4 }}>
                {backupStatus.totalBackupsCount} active {backupStatus.totalBackupsCount === 1 ? "archive" : "archives"} on disk
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 6,
              fontSize: 12,
              color: "#166534",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <strong>Operational Policy: </strong>
              {backupStatus.operationalMessage}
            </div>
            <div style={{ fontSize: 11, color: "#15803d", fontStyle: "italic" }}>
              Read-Only Status • Recovery restricted to authorized offline procedures
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
