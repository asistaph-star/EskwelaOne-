import React, { useState, useEffect } from "react";
import { C } from "../../shared/constants/tokens";
import { 
  User, Shield, School, Calendar, CheckCircle2, AlertCircle, 
  Save, RefreshCw, Lock, BadgeCheck, FileText, Info, Key, Clock
} from "lucide-react";
import { useAppContext } from "../../shared/AppContext";
import { usersApi } from "../../../api/users.api";
import { academicApi, AcademicYear, Term } from "../../../api/academic.api";
import { apiClient } from "../../../api/client";
import { toast } from "sonner";

export function PSettingsScreen() {
  const { currentUser, setCurrentUser } = useAppContext();

  // Profile Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [permissionsCount, setPermissionsCount] = useState<number>(0);

  // Status & Feedback State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Academic Information State (Real API Data)
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [academicLoading, setAcademicLoading] = useState(false);

  // Initialize and load user profile & academic information
  const loadData = async () => {
    setIsLoading(true);
    setSaveError(null);
    try {
      // 1. Fetch current user from /api/auth/me
      const meData = await apiClient.get<any>("/auth/me");
      if (meData) {
        setFirstName(meData.firstName || "");
        setLastName(meData.lastName || "");
        setMiddleName(meData.middleName || "");
        setEmail(meData.email || "");
        setUserId(meData.id || "");
        setRoles(meData.roles || []);
        setPermissionsCount(meData.permissions?.length || 0);
      }

      // 2. Fetch academic years and find current active year
      setAcademicLoading(true);
      try {
        const years = await academicApi.getYears();
        const activeYear = (years as any[]).find((y: any) => y.is_current) || years[0] || null;
        setCurrentYear(activeYear);
        if (activeYear?.id) {
          const termsData = await academicApi.getTerms(activeYear.id);
          setTerms(termsData || []);
        }
      } catch (acadErr) {
        console.warn("Failed to fetch academic years for settings oversight:", acadErr);
      } finally {
        setAcademicLoading(false);
      }
    } catch (err: any) {
      console.error("Failed to load user settings:", err);
      setSaveError(err.message || "Failed to load account settings from server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setSaveError("First Name and Last Name are required.");
      return;
    }

    if (!userId) {
      setSaveError("No authenticated user ID found.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await usersApi.updateProfile(userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
      });

      // Update current user in app context so global name reflects immediately
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          name: `${firstName.trim()} ${lastName.trim()}`,
        });
      }

      setSaveSuccess(true);
      toast.success("Profile details updated successfully.");
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error("Profile update failed:", err);
      const errMsg = err.message || "Failed to save profile changes. Please try again.";
      setSaveError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.paper, padding: "28px 36px", fontFamily: "'Inter', sans-serif" }}>
      {/* Executive Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>
              Settings & Institutional Profile
            </h1>
            <span style={{ 
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "rgba(139, 30, 30, 0.08)", color: C.m700,
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              border: "1px solid rgba(139, 30, 30, 0.2)"
            }}>
              <BadgeCheck size={13} />
              EXECUTIVE PROFILE
            </span>
          </div>
          <p style={{ fontSize: 13, color: C.t3, margin: 0 }}>
            Manage your personal profile details, inspect authentication security status, and review institutional academic parameters.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fff", border: `1px solid ${C.borderMed}`,
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            color: C.t2, cursor: isLoading ? "not-allowed" : "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          Refresh Settings
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 260, color: C.t3, fontSize: 14 }}>
          <RefreshCw size={20} className="animate-spin" style={{ marginRight: 10 }} />
          Loading secure account configuration...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1060 }}>
          {/* Top Feedback Banner */}
          {saveSuccess && (
            <div style={{ 
              display: "flex", alignItems: "center", gap: 10,
              background: "#ecfdf5", border: "1px solid #10b981", borderRadius: 8,
              padding: "12px 18px", color: "#065f46", fontSize: 13, fontWeight: 600
            }}>
              <CheckCircle2 size={18} color="#10b981" />
              Your profile changes have been permanently saved and synchronized with the database.
            </div>
          )}

          {saveError && (
            <div style={{ 
              display: "flex", alignItems: "center", gap: 10,
              background: "#fef2f2", border: "1px solid #ef4444", borderRadius: 8,
              padding: "12px 18px", color: "#991b1b", fontSize: 13, fontWeight: 600
            }}>
              <AlertCircle size={18} color="#ef4444" />
              {saveError}
            </div>
          )}

          {/* Section 1: Account & Profile Details (Editable Self-Service) */}
          <div style={{ 
            background: "#fff", borderRadius: 12, border: `1px solid ${C.borderMed}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.03)", padding: "24px 28px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 14 }}>
              <div style={{ 
                width: 38, height: 38, borderRadius: 8, background: "rgba(139, 30, 30, 0.08)",
                display: "flex", alignItems: "center", justifyContent: "center", color: C.m700 
              }}>
                <User size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Fraunces', serif" }}>
                  Account Profile & Name
                </h2>
                <p style={{ fontSize: 12, color: C.t3, margin: 0 }}>
                  Self-service profile fields. Changes are recorded in the system audit logs.
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 24 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                    First Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: 13, borderRadius: 8,
                      border: `1px solid ${C.borderMed}`, background: "#fff", outline: "none",
                      color: C.t1, boxSizing: "border-box"
                    }}
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                    Middle Name <span style={{ fontSize: 11, fontWeight: 400, color: C.t3 }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: 13, borderRadius: 8,
                      border: `1px solid ${C.borderMed}`, background: "#fff", outline: "none",
                      color: C.t1, boxSizing: "border-box"
                    }}
                    placeholder="Enter middle name"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                    Last Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: 13, borderRadius: 8,
                      border: `1px solid ${C.borderMed}`, background: "#fff", outline: "none",
                      color: C.t1, boxSizing: "border-box"
                    }}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              {/* Read-Only Account Identifiers */}
              <div style={{ 
                background: C.m50, borderRadius: 8, padding: "16px 20px", marginBottom: 24,
                border: "1px solid rgba(139, 30, 30, 0.12)", display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>
                    Official Email
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>
                    {email || "principal@demo.com"}
                  </div>
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                    Institutional login credential (Immutable)
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>
                    System Role
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.m700 }}>
                    {roles.length > 0 ? roles.join(", ") : "Principal"}
                  </div>
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                    DepEd Executive Administrative Tier
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>
                    Account Status
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#065f46", fontSize: 12, fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: "#10b981" }} />
                    Active · Authorized
                  </div>
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                    {permissionsCount} system permissions assigned
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>
                    Account ID
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: C.t2, wordBreak: "break-all" }}>
                    {userId}
                  </div>
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                    Database primary identifier
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <span style={{ fontSize: 11, color: C.t3, display: "flex", alignItems: "center", gap: 5 }}>
                  <Info size={13} />
                  Role assignments and official email are managed centrally by System Administration.
                </span>

                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: C.m700, color: "#fff", border: "none",
                    padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: isSaving ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(139, 30, 30, 0.2)",
                    opacity: isSaving ? 0.7 : 1
                  }}
                >
                  <Save size={15} />
                  {isSaving ? "Saving Changes..." : "Save Profile Changes"}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Security & Session Status (Read-Only / Informational) */}
          <div style={{ 
            background: "#fff", borderRadius: 12, border: `1px solid ${C.borderMed}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.03)", padding: "24px 28px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 14 }}>
              <div style={{ 
                width: 38, height: 38, borderRadius: 8, background: "rgba(245, 158, 11, 0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#b45309" 
              }}>
                <Shield size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Fraunces', serif" }}>
                  Security & Authentication Oversight
                </h2>
                <p style={{ fontSize: 12, color: C.t3, margin: 0 }}>
                  Cryptographic session controls and password governance standards.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 20 }}>
              <div style={{ padding: "14px 16px", borderRadius: 8, border: `1px solid ${C.borderLight}`, background: C.paper }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Key size={15} color={C.t2} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Authentication Mode</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>
                  HTTP-Only JWT Cookie & Bearer Token
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                  Stateless signed session with automated expiration.
                </div>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: 8, border: `1px solid ${C.borderLight}`, background: C.paper }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Lock size={15} color={C.t2} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Password Hashing</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>
                  Bcrypt Salt Rounds (Cost: 10)
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                  Zero plaintext credentials stored in database.
                </div>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: 8, border: `1px solid ${C.borderLight}`, background: C.paper }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Clock size={15} color={C.t2} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>Password Policy</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>
                  DepEd Minimum 8-Character Standard
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                  Enforced on all provisioned administrative accounts.
                </div>
              </div>
            </div>

            {/* Honest Architectural Status Note */}
            <div style={{ 
              display: "flex", alignItems: "flex-start", gap: 12,
              background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.2)",
              borderRadius: 8, padding: "14px 18px", color: "#92400e", fontSize: 12, lineHeight: 1.6
            }}>
              <Info size={17} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontWeight: 700 }}>Centralized Credential Provisioning:</strong> In accordance with institutional security policy, administrative login credentials and password resets are provisioned centrally by System Administration (`auth.service`). Self-service password modification is planned for a dedicated security expansion. If you require an immediate password change, contact the division administrator.
              </div>
            </div>
          </div>

          {/* Section 3: Institutional & Academic Oversight (Read-Only Real Data) */}
          <div style={{ 
            background: "#fff", borderRadius: 12, border: `1px solid ${C.borderMed}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.03)", padding: "24px 28px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 14 }}>
              <div style={{ 
                width: 38, height: 38, borderRadius: 8, background: "rgba(16, 185, 129, 0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#065f46" 
              }}>
                <School size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Fraunces', serif" }}>
                  Institutional & Academic Year Oversight
                </h2>
                <p style={{ fontSize: 12, color: C.t3, margin: 0 }}>
                  School institutional identity and active academic calendar configuration.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
              <div style={{ padding: "14px 18px", borderRadius: 8, border: `1px solid ${C.borderLight}`, background: C.paper }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>
                  Institution Name
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>
                  Calulut Integrated School
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                  DepEd School ID: 300971 · San Fernando
                </div>
              </div>

              <div style={{ padding: "14px 18px", borderRadius: 8, border: `1px solid ${C.borderLight}`, background: C.paper }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>
                  Active Academic Year
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.m700, display: "flex", alignItems: "center", gap: 6 }}>
                  {academicLoading ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    currentYear?.name || "AY 2024-2025"
                  )}
                  <span style={{ fontSize: 10, background: "#ecfdf5", color: "#065f46", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                    CURRENT
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                  {currentYear ? `${new Date(currentYear.start_date).toLocaleDateString()} — ${new Date(currentYear.end_date).toLocaleDateString()}` : "Active school year"}
                </div>
              </div>

              <div style={{ padding: "14px 18px", borderRadius: 8, border: `1px solid ${C.borderLight}`, background: C.paper }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>
                  Grading Standard
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>
                  DepEd K-12 Transmutation
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                  Passing Threshold: 75.00% · 4 Grading Terms
                </div>
              </div>
            </div>

            {/* Academic Terms Sub-Table */}
            {terms.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={14} color={C.t2} />
                  Active Academic Terms ({terms.length} Terms Configured)
                </div>
                <div style={{ 
                  borderRadius: 8, border: `1px solid ${C.borderLight}`, overflow: "hidden",
                  display: "grid", gridTemplateColumns: `repeat(${terms.length}, 1fr)` 
                }}>
                  {terms.map((t, idx) => (
                    <div 
                      key={t.id || idx} 
                      style={{ 
                        padding: "10px 14px", 
                        background: idx % 2 === 0 ? "#fff" : C.paper,
                        borderRight: idx < terms.length - 1 ? `1px solid ${C.borderLight}` : "none",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.m700 }}>{t.key}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginTop: 2 }}>{t.label || t.key}</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>
                        {t.start_date ? new Date(t.start_date).toLocaleDateString() : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 11, color: C.t3, display: "flex", alignItems: "center", gap: 5 }}>
              <Info size={13} />
              Academic year lifecycles and enrollment terms are maintained by the Registrar & System Administration (`academic:write`). The Principal retains read-only oversight (`academic:read`).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
