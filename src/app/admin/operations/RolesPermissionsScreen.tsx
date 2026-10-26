import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Layers,
  Users,
  Key,
  Lock,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { C } from "../../shared/constants/tokens";
import {
  rolesPermissionsApi,
  RolesPermissionsData,
  ModuleGroup,
  CapabilityItem,
  AccessLevel,
} from "../../../api/rolesPermissions.api";

// Visual config for access indicators
function getAccessBadge(access: AccessLevel, condition?: string) {
  switch (access) {
    case "ALLOWED":
      return {
        label: "Allowed",
        icon: CheckCircle2,
        bg: "#f0fdf4",
        text: "#15803d",
        border: "#bbf7d0",
        tooltip: "Unconditional access granted by backend authorization.",
      };
    case "CONDITIONAL":
      return {
        label: "Conditional",
        icon: AlertTriangle,
        bg: "#fffbeb",
        text: "#b45309",
        border: "#fde68a",
        tooltip: condition || "Contextual / ownership constraint enforced at runtime.",
      };
    case "DENIED":
    default:
      return {
        label: "Denied",
        icon: XCircle,
        bg: "#f8fafc",
        text: "#64748b",
        border: "#e2e8f0",
        tooltip: "Role does not hold permission or route rejects request (403 Forbidden).",
      };
  }
}

// Action type badge styling
function getActionBadge(action: CapabilityItem["action"]) {
  switch (action) {
    case "CREATE":
      return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
    case "READ":
      return { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" };
    case "UPDATE":
      return { bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
    case "DELETE":
      return { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };
    case "APPROVE":
      return { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" };
    case "MANAGE":
      return { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc" };
    case "SPECIAL":
    default:
      return { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
  }
}

export function RolesPermissionsScreen() {
  const [data, setData] = useState<RolesPermissionsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<string>("ALL");
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  const [activeCellDetail, setActiveCellDetail] = useState<{
    capability: CapabilityItem;
    roleName: string;
    roleId: string;
    condition?: string;
    access: AccessLevel;
  } | null>(null);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await rolesPermissionsApi.getMatrix();
      setData(result);
    } catch (err: any) {
      console.error("Failed to load roles & permissions matrix:", err);
      setError(err?.message || "Failed to load roles and permissions data from backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const toggleModuleCollapse = (moduleId: string) => {
    setCollapsedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  // Filtered modules and capabilities
  const filteredModules = useMemo(() => {
    if (!data) return [];

    return data.modules
      .map((mod) => {
        // Module filter check
        if (selectedModule !== "ALL" && mod.id !== selectedModule) {
          return null;
        }

        const filteredCaps = mod.capabilities.filter((cap) => {
          // Search query check (name, description, requiredPermission)
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchesName = cap.name.toLowerCase().includes(query);
            const matchesDesc = cap.description.toLowerCase().includes(query);
            const matchesPerm = cap.requiredPermission?.toLowerCase().includes(query);
            if (!matchesName && !matchesDesc && !matchesPerm) {
              return false;
            }
          }

          // Access level filter check
          if (selectedAccessLevel !== "ALL") {
            if (selectedRole !== "ALL") {
              const access = cap.roleAccess[selectedRole]?.access;
              if (access !== selectedAccessLevel) return false;
            } else {
              // At least one role matches selected access level
              const hasAccess = Object.values(cap.roleAccess).some(
                (e) => e.access === selectedAccessLevel
              );
              if (!hasAccess) return false;
            }
          }

          return true;
        });

        if (filteredCaps.length === 0) return null;

        return {
          ...mod,
          capabilities: filteredCaps,
        };
      })
      .filter(Boolean) as ModuleGroup[];
  }, [data, selectedModule, searchQuery, selectedRole, selectedAccessLevel]);

  // Total matching capability count
  const matchingCapabilitiesCount = useMemo(() => {
    return filteredModules.reduce((acc, m) => acc + m.capabilities.length, 0);
  }, [filteredModules]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ height: "28px", width: "240px", backgroundColor: "#e2e8f0", borderRadius: "6px", marginBottom: "8px" }} />
            <div style={{ height: "16px", width: "400px", backgroundColor: "#f1f5f9", borderRadius: "4px" }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: "90px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }} />
          ))}
        </div>
        <div style={{ height: "400px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: C.slate }}>
            <RefreshCw size={20} className="animate-spin" />
            <span style={{ fontSize: "0.95rem", fontWeight: 500 }}>Loading verified backend RBAC matrix...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "2rem" }}>
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            padding: "1.5rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
            maxWidth: "640px",
          }}
        >
          <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#991b1b", fontSize: "1.05rem", fontWeight: 600 }}>
              Unable to Load Roles & Permissions Matrix
            </h3>
            <p style={{ margin: "0 0 1rem 0", color: "#b91c1c", fontSize: "0.9rem", lineHeight: 1.5 }}>
              {error || "An error occurred while communicating with the backend RBAC service."}
            </p>
            <button
              onClick={fetchMatrix}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                backgroundColor: "#dc2626",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} />
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Banner & Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: C.navy, letterSpacing: "-0.02em" }}>
              Roles & Permissions Matrix
            </h1>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.6rem",
                backgroundColor: data.meta.viewerRole === "ITAdmin" ? "#eff6ff" : "#f0fdf4",
                color: data.meta.viewerRole === "ITAdmin" ? "#1d4ed8" : "#15803d",
                border: `1px solid ${data.meta.viewerRole === "ITAdmin" ? "#bfdbfe" : "#bbf7d0"}`,
                borderRadius: "9999px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {data.meta.viewerRole} View
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.9rem", color: C.slate }}>
            View system roles and their authorized access across DigiSkwela modules, backed by actual backend enforcement.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.35rem 0.75rem",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: "0.8rem",
              color: "#64748b",
            }}
          >
            <Lock size={12} />
            <span>Read-Only Policy</span>
          </div>
          <button
            onClick={fetchMatrix}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.45rem 0.9rem",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 500,
              color: C.navy,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              System Roles
            </span>
            <Users size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: C.navy }}>{data.meta.totalRoles}</div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            All 9 Calulut INHS deployed system roles
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Module Groups
            </span>
            <Layers size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: C.navy }}>{data.meta.totalModules}</div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Core administrative & academic domains
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Verified Capabilities
            </span>
            <Key size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: C.navy }}>{data.meta.totalCapabilities}</div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Granular actions traceable to backend routes
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Enforcement Model
            </span>
            <ShieldCheck size={18} color="#059669" />
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: C.navy, marginTop: "0.25rem" }}>
            Role + Context
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Strict JWT, DB roles & ownership guards
          </div>
        </div>
      </div>

      {/* Legend & Notice */}
      <div
        style={{
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          padding: "0.875rem 1.25rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.25rem" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", textTransform: "uppercase" }}>
            Access Vocabulary:
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.2rem 0.5rem",
                backgroundColor: "#f0fdf4",
                color: "#15803d",
                border: "1px solid #bbf7d0",
                borderRadius: "4px",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={12} />
              Allowed
            </span>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Unconditional capability</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.2rem 0.5rem",
                backgroundColor: "#fffbeb",
                color: "#b45309",
                border: "1px solid #fde68a",
                borderRadius: "4px",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={12} />
              Conditional
            </span>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Assigned section / own record only</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.2rem 0.5rem",
                backgroundColor: "#f8fafc",
                color: "#64748b",
                border: "1px solid #e2e8f0",
                borderRadius: "4px",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              <XCircle size={12} />
              Denied
            </span>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>No authorization (403 Forbidden)</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#64748b" }}>
          <Info size={14} color="#3b82f6" />
          <span>Click any cell for constraint details</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          padding: "1rem",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", flex: 1, minWidth: "260px", maxWidth: "420px", position: "relative" }}>
          <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search capability, action, or permission key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.45rem 0.75rem 0.45rem 2.25rem",
              fontSize: "0.85rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
          {/* Module Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>Module:</span>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              style={{
                padding: "0.4rem 0.65rem",
                fontSize: "0.85rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: C.navy,
                outline: "none",
              }}
            >
              <option value="ALL">All Modules ({data.modules.length})</option>
              {data.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                padding: "0.4rem 0.65rem",
                fontSize: "0.85rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: C.navy,
                outline: "none",
              }}
            >
              <option value="ALL">All Roles ({data.roles.length})</option>
              {data.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Access Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>Access:</span>
            <select
              value={selectedAccessLevel}
              onChange={(e) => setSelectedAccessLevel(e.target.value)}
              style={{
                padding: "0.4rem 0.65rem",
                fontSize: "0.85rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: C.navy,
                outline: "none",
              }}
            >
              <option value="ALL">All Access Levels</option>
              <option value="ALLOWED">Allowed Only</option>
              <option value="CONDITIONAL">Conditional Only</option>
              <option value="DENIED">Denied Only</option>
            </select>
          </div>

          {(searchQuery || selectedModule !== "ALL" || selectedRole !== "ALL" || selectedAccessLevel !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedModule("ALL");
                setSelectedRole("ALL");
                setSelectedAccessLevel("ALL");
              }}
              style={{
                padding: "0.4rem 0.75rem",
                fontSize: "0.8rem",
                color: "#b91c1c",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Active Cell Detail Modal / Flyout if clicked */}
      {activeCellDetail && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            padding: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1.5rem",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.15rem 0.5rem",
                  backgroundColor: "#eff6ff",
                  color: "#1d4ed8",
                  borderRadius: "4px",
                  fontWeight: 600,
                }}
              >
                {activeCellDetail.roleName} ({activeCellDetail.roleId})
              </span>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>→</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: C.navy }}>
                {activeCellDetail.capability.name}
              </span>
            </div>

            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.875rem", color: "#475569", lineHeight: 1.5 }}>
              {activeCellDetail.capability.description}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", fontSize: "0.8rem" }}>
              <div>
                <span style={{ color: "#64748b", fontWeight: 500 }}>Access Enforcement: </span>
                {(() => {
                  const badge = getAccessBadge(activeCellDetail.access, activeCellDetail.condition);
                  const Icon = badge.icon;
                  return (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        padding: "0.15rem 0.5rem",
                        backgroundColor: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                        borderRadius: "4px",
                        fontWeight: 600,
                        marginLeft: "0.3rem",
                      }}
                    >
                      <Icon size={12} />
                      {badge.label}
                    </span>
                  );
                })()}
              </div>

              {activeCellDetail.capability.requiredPermission && (
                <div>
                  <span style={{ color: "#64748b", fontWeight: 500 }}>Required Permission: </span>
                  <code style={{ padding: "0.15rem 0.4rem", backgroundColor: "#f1f5f9", borderRadius: "4px", color: "#0f172a" }}>
                    {activeCellDetail.capability.requiredPermission}
                  </code>
                </div>
              )}

              {activeCellDetail.condition && (
                <div style={{ width: "100%", marginTop: "0.35rem", padding: "0.6rem 0.8rem", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", color: "#92400e" }}>
                  <strong>Runtime Rule: </strong>
                  {activeCellDetail.condition}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveCellDetail(null)}
            style={{
              padding: "0.3rem 0.6rem",
              backgroundColor: "#f1f5f9",
              border: "none",
              borderRadius: "4px",
              fontSize: "0.8rem",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Roles & Permissions Matrix Table */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th
                  style={{
                    padding: "0.875rem 1.25rem",
                    fontWeight: 600,
                    color: C.navy,
                    minWidth: "280px",
                    position: "sticky",
                    left: 0,
                    backgroundColor: "#f8fafc",
                    zIndex: 2,
                    boxShadow: "2px 0 4px rgba(0,0,0,0.02)",
                  }}
                >
                  Module & Capability
                </th>
                {data.roles.map((role) => {
                  const isHighlighted = selectedRole === "ALL" || selectedRole === role.id;
                  const isITAdmin = role.id === "ITAdmin";
                  return (
                    <th
                      key={role.id}
                      style={{
                        padding: "0.875rem 0.75rem",
                        fontWeight: 600,
                        color: isITAdmin ? "#1e40af" : C.navy,
                        minWidth: "115px",
                        textAlign: "center",
                        opacity: isHighlighted ? 1 : 0.45,
                        backgroundColor: isITAdmin ? "#f0f7ff" : "#f8fafc",
                        borderLeft: isITAdmin ? "1px solid #dbeafe" : "1px solid #f1f5f9",
                        borderRight: isITAdmin ? "1px solid #dbeafe" : "none",
                      }}
                      title={role.description}
                    >
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{role.name}</span>
                        <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 400 }}>{role.id}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredModules.length === 0 ? (
                <tr>
                  <td colSpan={data.roles.length + 1} style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                      <Search size={28} color="#cbd5e1" />
                      <span style={{ fontSize: "0.95rem", fontWeight: 500 }}>No capabilities matched your search criteria</span>
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Try adjusting your filters or search keywords</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredModules.map((module) => {
                  const isCollapsed = Boolean(collapsedModules[module.id]);

                  return (
                    <React.Fragment key={module.id}>
                      {/* Module Header Row */}
                      <tr
                        onClick={() => toggleModuleCollapse(module.id)}
                        style={{
                          backgroundColor: "#f1f5f9",
                          borderTop: "1px solid #e2e8f0",
                          borderBottom: "1px solid #e2e8f0",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <td
                          colSpan={data.roles.length + 1}
                          style={{
                            padding: "0.6rem 1.25rem",
                            fontWeight: 600,
                            color: C.navy,
                            position: "sticky",
                            left: 0,
                            zIndex: 1,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              <span>{module.name}</span>
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  padding: "0.15rem 0.5rem",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "9999px",
                                  color: "#475569",
                                }}
                              >
                                {module.capabilities.length} capabilities
                              </span>
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 400 }}>
                              {module.description}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Capability Rows */}
                      {!isCollapsed &&
                        module.capabilities.map((cap, capIdx) => {
                          const actionConfig = getActionBadge(cap.action);

                          return (
                            <tr
                              key={cap.id}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                backgroundColor: capIdx % 2 === 0 ? "#ffffff" : "#fafafa",
                                transition: "background-color 0.15s ease",
                              }}
                            >
                              {/* Sticky Capability Column */}
                              <td
                                style={{
                                  padding: "0.75rem 1.25rem",
                                  position: "sticky",
                                  left: 0,
                                  backgroundColor: capIdx % 2 === 0 ? "#ffffff" : "#fafafa",
                                  zIndex: 1,
                                  boxShadow: "2px 0 4px rgba(0,0,0,0.02)",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                                  <span
                                    style={{
                                      fontSize: "0.65rem",
                                      fontWeight: 700,
                                      padding: "0.15rem 0.4rem",
                                      backgroundColor: actionConfig.bg,
                                      color: actionConfig.text,
                                      border: `1px solid ${actionConfig.border}`,
                                      borderRadius: "4px",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {cap.action}
                                  </span>
                                  <span style={{ fontWeight: 600, color: C.navy, fontSize: "0.85rem" }}>
                                    {cap.name}
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.35 }}>
                                  {cap.description}
                                </div>
                                {cap.requiredPermission && (
                                  <div style={{ marginTop: "0.3rem" }}>
                                    <code style={{ fontSize: "0.7rem", color: "#475569", backgroundColor: "#f1f5f9", padding: "0.1rem 0.35rem", borderRadius: "3px" }}>
                                      {cap.requiredPermission}
                                    </code>
                                  </div>
                                )}
                              </td>

                              {/* Role Access Cells */}
                              {data.roles.map((role) => {
                                const entry = cap.roleAccess[role.id] || { access: "DENIED" };
                                const badge = getAccessBadge(entry.access, entry.condition);
                                const Icon = badge.icon;
                                const isHighlighted = selectedRole === "ALL" || selectedRole === role.id;
                                const isITAdmin = role.id === "ITAdmin";

                                return (
                                  <td
                                    key={role.id}
                                    onClick={() =>
                                      setActiveCellDetail({
                                        capability: cap,
                                        roleName: role.name,
                                        roleId: role.id,
                                        condition: entry.condition,
                                        access: entry.access,
                                      })
                                    }
                                    style={{
                                      padding: "0.6rem 0.4rem",
                                      textAlign: "center",
                                      cursor: "pointer",
                                      opacity: isHighlighted ? 1 : 0.45,
                                      backgroundColor: isITAdmin ? "#fbfdff" : undefined,
                                      borderLeft: isITAdmin ? "1px solid #dbeafe" : "1px solid #f8fafc",
                                      borderRight: isITAdmin ? "1px solid #dbeafe" : "none",
                                    }}
                                    title={entry.condition || badge.tooltip}
                                  >
                                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "0.15rem" }}>
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "0.25rem",
                                          padding: "0.2rem 0.45rem",
                                          backgroundColor: badge.bg,
                                          color: badge.text,
                                          border: `1px solid ${badge.border}`,
                                          borderRadius: "4px",
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Icon size={12} />
                                        {badge.label}
                                      </span>

                                      {entry.condition && (
                                        <span
                                          style={{
                                            fontSize: "0.65rem",
                                            color: "#b45309",
                                            fontWeight: 500,
                                            maxWidth: "95px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          Scoped
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info & Verification Notice */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          fontSize: "0.8rem",
          color: "#64748b",
          borderTop: "1px solid #e2e8f0",
          paddingTop: "1rem",
        }}
      >
        <div>
          Showing <strong>{matchingCapabilitiesCount}</strong> of <strong>{data.meta.totalCapabilities}</strong> verified backend capabilities across <strong>{data.meta.totalModules}</strong> modules.
        </div>
        <div>
          Matrix generated on: {new Date(data.meta.generatedAt).toLocaleString()} • Calulut Integrated National High School
        </div>
      </div>
    </div>
  );
}
