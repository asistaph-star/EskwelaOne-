import React, { useState, useEffect, useCallback } from "react";
import { Users, Search, Trash2, KeyRound, ShieldAlert, CheckCircle2, Copy, AlertCircle, RefreshCw, UserX, UserCheck } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { apiClient } from "../../../api/client";
import { useAppContext } from "../../shared/AppContext";

interface ManagedUser {
  id: string;
  school_id: string;
  email?: string | null;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  user_roles: Array<{ role: { name: string } }>;
  student?: { grade_level?: number; lrn?: string } | null;
  teacher?: { employee_id?: string; department?: string; position?: string } | null;
  staff?: { employee_id?: string; department?: string; position?: string } | null;
}

export function AccountManagement() {
  const { currentUser } = useAppContext();
  const isITAdmin = currentUser?.rawRoles?.includes('ITAdmin') || currentUser?.role === 'ITAdmin';

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  const [confirmModal, setConfirmModal] = useState<{
    type: "status_toggle" | "reset";
    user: ManagedUser;
    targetStatus?: "active" | "inactive";
  } | null>(null);

  const [resetResult, setResetResult] = useState<{
    userName: string;
    schoolId: string;
    email?: string | null;
    temporaryPassword: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<any>('/users');
      const data = res?.data || res;
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAction = async () => {
    if (!confirmModal) return;

    try {
      if (confirmModal.type === "status_toggle") {
        const newStatus = confirmModal.targetStatus || (confirmModal.user.status === "active" ? "inactive" : "active");
        await apiClient.patch(`/users/${confirmModal.user.id}`, { status: newStatus });
        showToast(`Account for ${confirmModal.user.first_name} ${confirmModal.user.last_name} set to ${newStatus}.`);
        fetchUsers();
      } else {
        const res = await apiClient.post<any>(`/users/${confirmModal.user.id}/reset-password`);
        const responseData = res?.data || res;
        const tempPass = responseData.temporaryPassword;
        setResetResult({
          userName: `${confirmModal.user.first_name} ${confirmModal.user.last_name}`,
          schoolId: confirmModal.user.school_id,
          email: confirmModal.user.email,
          temporaryPassword: tempPass,
        });
        showToast(`Password for ${confirmModal.user.first_name} ${confirmModal.user.last_name} reset successfully.`);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err.message || "Action failed");
    } finally {
      setConfirmModal(null);
    }
  };

  const handleCopyPassword = () => {
    if (resetResult?.temporaryPassword) {
      navigator.clipboard.writeText(resetResult.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const filteredUsers = users.filter(u => {
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const sid = (u.school_id || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = fullName.includes(query) || email.includes(query) || sid.includes(query);

    const roles = u.user_roles?.map(ur => ur.role.name) || [];
    const matchesRole = roleFilter === "All" || roles.includes(roleFilter);

    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto", position: "relative", minHeight: "100%", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={24} color={C.m700} /> Account Management
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.t3 }}>
            Manage system access, reset user credentials, or toggle account activation status.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: "#fff",
            border: `1px solid ${C.borderMed}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: C.t2,
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}40`, color: C.red, padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={14} color={C.t3} style={{ position: "absolute", left: 14, top: 11 }} />
          <input 
            type="text" 
            placeholder="Search name or email..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, fontFamily: "'Inter', sans-serif" }}
          />
        </div>
        <select 
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, fontFamily: "'Inter', sans-serif", background: "#fff" }}
        >
          <option value="All">All Roles</option>
          <option value="Student">Student</option>
          <option value="Teacher">Teacher</option>
          <option value="Principal">Principal</option>
          <option value="Registrar">Registrar</option>
          <option value="Guidance">Guidance</option>
          <option value="Nurse">Nurse</option>
          <option value="GateOperator">Gate Operator</option>
          <option value="Admin">Admin</option>
          <option value="ITAdmin">ITAdmin</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.paper, borderBottom: `1px solid ${C.borderMed}` }}>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>User</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Role & Profile</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Created</th>
              <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: C.t3, fontSize: 13 }}>
                  Loading accounts...
                </td>
              </tr>
            ) : filteredUsers.map(u => {
              const roles = u.user_roles?.map(ur => ur.role.name) || [];
              const primaryRole = roles[0] || "User";
              const isTargetAdmin = roles.includes("Admin") || roles.includes("ITAdmin");
              const canModify = isITAdmin || !isTargetAdmin;

              const deptOrGrade = u.student ? `Grade ${u.student.grade_level}` :
                                  u.teacher ? u.teacher.department || u.teacher.position :
                                  u.staff ? u.staff.department || u.staff.position : "N/A";

              return (
                <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = C.m50} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 18, background: C.m100, color: C.m700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                        {u.first_name[0]}{u.last_name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{u.first_name} {u.last_name}</div>
                        <div style={{ fontSize: 12, color: C.t3 }}>
                          <span style={{ fontWeight: 600, color: C.t2 }}>ID: {u.school_id}</span>
                          {u.email ? ` • ${u.email}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{primaryRole}</div>
                    <div style={{ fontSize: 11, color: C.t3 }}>{deptOrGrade}</div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{ 
                      display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: u.status === "active" ? C.greenBg : C.redBg,
                      color: u.status === "active" ? C.green : C.red,
                      border: `1px solid ${u.status === "active" ? C.green : C.red}40`
                    }}>
                      {u.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 12, color: C.t2 }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <button 
                        disabled={!canModify}
                        onClick={() => setConfirmModal({ type: "reset", user: u })}
                        style={{
                          padding: "6px 12px",
                          background: "transparent",
                          border: `1px solid ${C.borderMed}`,
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: canModify ? C.t2 : C.t3,
                          cursor: canModify ? "pointer" : "not-allowed",
                          opacity: canModify ? 1 : 0.5
                        }}
                        title={canModify ? "Reset Password" : "Only ITAdmin can reset Admin credentials"}
                      >
                        <KeyRound size={13} /> Reset
                      </button>
                      <button 
                        disabled={!canModify}
                        onClick={() => setConfirmModal({
                          type: "status_toggle",
                          user: u,
                          targetStatus: u.status === "active" ? "inactive" : "active"
                        })}
                        style={{
                          padding: "6px 12px",
                          background: "transparent",
                          border: `1px solid ${u.status === "active" ? C.borderMed : C.green}`,
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: !canModify ? C.t3 : u.status === "active" ? C.red : C.green,
                          cursor: canModify ? "pointer" : "not-allowed",
                          opacity: canModify ? 1 : 0.5
                        }}
                        title={canModify ? (u.status === "active" ? "Deactivate Account" : "Activate Account") : "Cannot modify privileged account"}
                      >
                        {u.status === "active" ? <UserX size={13} /> : <UserCheck size={13} />}
                        {u.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: C.t3, fontSize: 14 }}>
                  No accounts found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: 28, borderRadius: 14, width: 420, maxWidth: "90%", boxShadow: "0 24px 48px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: confirmModal.type === "status_toggle" ? C.amberBg : C.m100, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {confirmModal.type === "status_toggle" ? <ShieldAlert size={22} color={C.amber} /> : <KeyRound size={22} color={C.m700} />}
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: C.t1, margin: "0 0 6px" }}>
                  {confirmModal.type === "status_toggle"
                    ? `${confirmModal.targetStatus === "inactive" ? "Deactivate" : "Reactivate"} Account`
                    : "Reset User Password"}
                </h3>
                <p style={{ fontSize: 13, color: C.t2, margin: 0, lineHeight: 1.5 }}>
                  {confirmModal.type === "status_toggle" 
                    ? `Are you sure you want to set the account for ${confirmModal.user.first_name} ${confirmModal.user.last_name} to ${confirmModal.targetStatus}? Inactive accounts cannot log in.`
                    : `Generate a new temporary password for ${confirmModal.user.first_name} ${confirmModal.user.last_name} (${confirmModal.user.email})? The old password will be invalidated immediately.`
                  }
                </p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 22 }}>
              <button 
                onClick={() => setConfirmModal(null)}
                style={{ padding: "9px 15px", background: "none", border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.t2, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAction}
                style={{
                  padding: "9px 15px",
                  background: confirmModal.type === "status_toggle" ? (confirmModal.targetStatus === "inactive" ? C.red : C.green) : C.m800,
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temporary Password Result Modal */}
      {resetResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", padding: 32, borderRadius: 16, width: 440, maxWidth: "90%", boxShadow: "0 24px 48px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <CheckCircle2 color={C.green} size={28} />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.t1 }}>Password Reset Successful</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: C.t3 }}>
                  User: {resetResult.userName} • <strong>ID: {resetResult.schoolId}</strong>
                  {resetResult.email ? ` (${resetResult.email})` : ''}
                </p>
              </div>
            </div>

            <div style={{ background: C.paper, border: `1.5px dashed ${C.green}`, padding: 18, borderRadius: 10, margin: "20px 0" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                New Temporary Password:
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <code style={{ fontSize: 20, fontWeight: 800, color: C.t1, letterSpacing: "0.15em", fontFamily: "'JetBrains Mono', monospace" }}>
                  {resetResult.temporaryPassword}
                </code>
                <button
                  onClick={handleCopyPassword}
                  style={{
                    background: copied ? C.green : "#fff",
                    color: copied ? "#fff" : C.green,
                    border: `1px solid ${C.green}`,
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  <Copy size={13} /> {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, color: "#b45309", margin: "0 0 24px", lineHeight: 1.4 }}>
              ⚠️ Copy this temporary password now. It will not be shown again. The user will be required to change it on their next login.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setResetResult(null)}
                style={{ padding: "10px 20px", background: C.m800, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Close & Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: 40, right: 40, background: "#1f2937", color: "#fff", padding: "14px 20px", borderRadius: 8,
          display: "flex", alignItems: "center", gap: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", zIndex: 1200
        }}>
          <CheckCircle2 size={18} color={C.green} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
