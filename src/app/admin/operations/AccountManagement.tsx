import React, { useContext, useState } from "react";
import { Users, Search, MoreVertical, Trash2, KeyRound, ShieldAlert, CheckCircle2 } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { AppContext, SystemAccount } from "../../shared/AppContext";

export function AccountManagement() {
  const ctx = useContext(AppContext);
  if (!ctx) return null;

  const { systemAccounts, deleteAccount, resetPassword } = ctx;

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  const [confirmModal, setConfirmModal] = useState<{ type: "delete" | "reset"; account: SystemAccount } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredAccounts = systemAccounts.filter(acc => {
    const matchesSearch = acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || acc.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "All" || acc.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleAction = () => {
    if (!confirmModal) return;
    
    if (confirmModal.type === "delete") {
      deleteAccount(confirmModal.account.id);
      showToast(`Account for ${confirmModal.account.name} has been permanently deleted.`);
    } else {
      resetPassword(confirmModal.account.id);
      showToast(`Password for ${confirmModal.account.name} has been reset to the system default.`);
    }
    setConfirmModal(null);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto", position: "relative", minHeight: "100%", paddingBottom: 100 }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={24} color={C.m700} /> Account Management
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.t3 }}>
            Manage system access, reset user credentials, or permanently remove accounts.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <Search size={14} color={C.t3} style={{ position: "absolute", left: 14, top: 11 }} />
          <input 
            type="text" 
            placeholder="Search name or username..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, fontFamily: "'Inter', sans-serif" }}
          />
        </div>
        <select 
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, fontFamily: "'Inter', sans-serif", background: "#fff", appearance: "auto" as any }}
        >
          <option value="All">All Roles</option>
          <option value="Teacher">Teachers</option>
          <option value="Student">Students</option>
          <option value="Staff">Staff</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.paper, borderBottom: `1px solid ${C.borderMed}` }}>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>User</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Role & Dept</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Last Login</th>
              <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map(acc => (
              <tr key={acc.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = C.m50} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: C.m100, color: C.m700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                      {acc.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{acc.name}</div>
                      <div style={{ fontSize: 12, color: C.t3 }}>{acc.username}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{acc.role}</div>
                  <div style={{ fontSize: 11, color: C.t3 }}>{acc.departmentOrGrade || "N/A"}</div>
                </td>
                <td style={{ padding: "16px 20px" }}>
                  <span style={{ 
                    display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: acc.status === "Active" ? C.greenBg : acc.status === "Locked" ? C.redBg : C.yellowBg,
                    color: acc.status === "Active" ? C.green : acc.status === "Locked" ? C.red : C.yellow,
                    border: `1px solid ${acc.status === "Active" ? C.green : acc.status === "Locked" ? C.red : C.yellow}40`
                  }}>
                    {acc.status}
                  </span>
                </td>
                <td style={{ padding: "16px 20px", fontSize: 13, color: C.t2 }}>
                  {acc.lastLogin || "Never"}
                </td>
                <td style={{ padding: "16px 20px", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <button 
                      onClick={() => setConfirmModal({ type: "reset", account: acc })}
                      style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${C.borderMed}`, borderRadius: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.t2, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.m500; e.currentTarget.style.color = C.m700; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderMed; e.currentTarget.style.color = C.t2; }}
                      title="Reset Password"
                    >
                      <KeyRound size={14} /> Reset
                    </button>
                    <button 
                      onClick={() => setConfirmModal({ type: "delete", account: acc })}
                      style={{ width: 32, height: 32, background: "transparent", border: `1px solid ${C.borderMed}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: C.red, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.redBg; e.currentTarget.style.borderColor = C.red; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.borderMed; }}
                      title="Delete Account"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredAccounts.length === 0 && (
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "fadeIn 0.2s ease-out" }}>
          <div style={{ background: "#fff", padding: 32, borderRadius: 16, width: 400, maxWidth: "90%", boxShadow: "0 24px 48px rgba(0,0,0,0.2)", animation: "slideUp 0.2s ease-out" }}>
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: confirmModal.type === "delete" ? C.redBg : C.yellowBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {confirmModal.type === "delete" ? <Trash2 size={24} color={C.red} /> : <ShieldAlert size={24} color={C.yellow} />}
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: "0 0 8px" }}>
                  {confirmModal.type === "delete" ? "Delete Account" : "Reset Password"}
                </h3>
                <p style={{ fontSize: 13, color: C.t2, margin: 0, lineHeight: 1.5 }}>
                  {confirmModal.type === "delete" 
                    ? `Are you sure you want to permanently delete the account for ${confirmModal.account.name}? This action cannot be undone.`
                    : `You are about to reset the password for ${confirmModal.account.name} (${confirmModal.account.username}). They will be required to set a new password on their next login.`
                  }
                </p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
              <button 
                onClick={() => setConfirmModal(null)}
                style={{ padding: "10px 16px", background: "none", border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.t2, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAction}
                style={{ padding: "10px 16px", background: confirmModal.type === "delete" ? C.red : C.m800, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}
              >
                {confirmModal.type === "delete" ? "Yes, Delete" : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: 40, right: 40, background: "#1f2937", color: "#fff", padding: "14px 20px", borderRadius: 8,
          display: "flex", alignItems: "center", gap: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", animation: "slideUp 0.3s ease-out", zIndex: 1100
        }}>
          <CheckCircle2 size={20} color={C.green} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>{toastMessage}</span>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0, transform: translateY(10px); } to { opacity: 1, transform: translateY(0); } }
      `}</style>
    </div>
  );
}
