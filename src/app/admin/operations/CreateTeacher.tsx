import React, { useState } from "react";
import { UserPlus, Save, Building, CheckCircle, Copy, AlertCircle, ShieldAlert, GraduationCap, Shield } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { apiClient } from "../../../api/client";
import { useAppContext } from "../../shared/AppContext";

export function CreateAccount() {
  const { currentUser } = useAppContext();
  const isITAdmin = currentUser?.rawRoles?.includes('ITAdmin') || currentUser?.role === 'ITAdmin';

  const [role, setRole] = useState<string>("Teacher");
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    status: "active" as "active" | "inactive",
    schoolId: "",
    // Student Profile
    studentId: "",
    lrn: "",
    gradeLevel: 10,
    gender: "Male",
    guardianFirstName: "",
    guardianLastName: "",
    guardianPhone: "",
    street: "",
    city: "",
    stateProvince: "",
    zipCode: "",
    // Teacher & Staff Profile
    employeeId: "",
    department: "English",
    position: "Teacher I",
    specialization: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionedData, setProvisionedData] = useState<{
    temporaryPassword: string;
    role: string;
    name: string;
    schoolId: string;
    email: string;
    isStudent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setError(null);
    if (newRole === "Teacher") {
      setForm(prev => ({ ...prev, department: "English", position: "Teacher I" }));
    } else if (newRole === "Principal") {
      setForm(prev => ({ ...prev, department: "Administration", position: "School Principal IV" }));
    } else if (newRole === "Registrar") {
      setForm(prev => ({ ...prev, department: "Registrar Office", position: "Registrar I" }));
    } else if (newRole === "Guidance") {
      setForm(prev => ({ ...prev, department: "Guidance Office", position: "Guidance Counselor III" }));
    } else if (newRole === "Nurse") {
      setForm(prev => ({ ...prev, department: "School Clinic", position: "School Nurse II" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProvisionedData(null);
    setCopied(false);

    try {
      const payload: any = {
        email: form.email ? form.email : undefined,
        firstName: form.firstName,
        middleName: form.middleName ? form.middleName : undefined,
        lastName: form.lastName,
        roles: [role],
      };

      let effectiveSchoolId = "";
      if (role === "Student") {
        effectiveSchoolId = form.studentId;
        payload.schoolId = form.studentId;
        payload.studentProfile = {
          studentNumber: form.studentId,
          lrn: form.lrn,
          gradeLevel: Number(form.gradeLevel),
          gender: form.gender || undefined,
          guardianFirstName: form.guardianFirstName || undefined,
          guardianLastName: form.guardianLastName || undefined,
          guardianPhone: form.guardianPhone || undefined,
          street: form.street || undefined,
          city: form.city || undefined,
          stateProvince: form.stateProvince || undefined,
          zipCode: form.zipCode || undefined,
        };
      } else if (role === "Teacher") {
        effectiveSchoolId = form.employeeId || `EMP-T-${Math.floor(1000 + Math.random() * 9000)}`;
        payload.teacherProfile = {
          employeeId: effectiveSchoolId,
          department: form.department,
          position: form.position,
          specialization: form.specialization || undefined,
        };
      } else if (["Principal", "Registrar", "Guidance", "Nurse"].includes(role)) {
        effectiveSchoolId = form.employeeId || `EMP-S-${Math.floor(1000 + Math.random() * 9000)}`;
        payload.staffProfile = {
          employeeId: effectiveSchoolId,
          department: form.department,
          position: form.position,
        };
      } else if (["Admin", "ITAdmin", "GateOperator"].includes(role)) {
        effectiveSchoolId = form.schoolId;
        payload.schoolId = form.schoolId;
      }

      const res = await apiClient.post('/users', payload);
      const responseData = (res as any).data || res;
      const temporaryPassword = responseData.temporaryPassword || "Temporary password provisioned (default generated)";
      const createdUser = responseData.user || responseData;

      setProvisionedData({
        temporaryPassword,
        role,
        name: `${form.firstName} ${form.lastName}`,
        schoolId: createdUser.school_id || createdUser.schoolId || effectiveSchoolId,
        email: form.email,
        isStudent: role === "Student",
      });

      // Clear common fields for next entry
      setForm(prev => ({
        ...prev,
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        schoolId: "",
        studentId: "",
        lrn: "",
        employeeId: "",
        specialization: "",
      }));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || "Failed to provision account");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (provisionedData?.temporaryPassword) {
      navigator.clipboard.writeText(provisionedData.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const creatableRoles = [
    { id: "Student", label: "Student", desc: "Enrolled learner with academic & attendance tracking" },
    { id: "Teacher", label: "Teacher", desc: "Faculty member with gradebook & classroom tools" },
    { id: "Principal", label: "Principal", desc: "School head with institutional oversight & analytics" },
    { id: "Registrar", label: "Registrar", desc: "Enrollment & official academic document officer" },
    { id: "Guidance", label: "Guidance", desc: "Counseling, behavioral & intervention specialist" },
    { id: "Nurse", label: "Nurse", desc: "Clinic visit & student medical health administrator" },
    { id: "GateOperator", label: "Gate Operator", desc: "Human attendant managing gate attendance kiosks" },
    ...(isITAdmin ? [
      { id: "Admin", label: "Admin", desc: "School operations administrator (Non-IT)" },
      { id: "ITAdmin", label: "ITAdmin", desc: "Full system superadministrator" },
    ] : [])
  ];

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: "0 auto", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 6, fontFamily: "'Fraunces', serif" }}>
            Provision Account
          </h1>
          <p style={{ fontSize: 13, color: C.t3, margin: 0 }}>
            Create and provision new DigiSkwela system credentials with role-aware profile linkage.
          </p>
        </div>
      </div>

      {/* Provisioning Success Modal / Card */}
      {provisionedData && (
        <div style={{ background: "#ecfdf5", border: `1.5px solid ${C.green}`, padding: 24, borderRadius: 12, marginBottom: 24, boxShadow: "0 6px 20px rgba(16, 185, 129, 0.1)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <CheckCircle color={C.green} size={24} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, color: "#065f46", fontSize: 16, fontWeight: 800 }}>
                  Account Provisioned Successfully!
                </h3>
                {provisionedData.isStudent && (
                  <span style={{ background: "#dbeafe", color: "#1e40af", padding: "4px 10px", borderRadius: 16, fontSize: 11, fontWeight: 700, border: "1px solid #bfdbfe" }}>
                    Account Created — Not Yet Enrolled
                  </span>
                )}
              </div>
              
              <p style={{ margin: "6px 0 12px", color: "#047857", fontSize: 13 }}>
                Provisioned user: <strong>{provisionedData.name}</strong> as <strong>{provisionedData.role}</strong>.
              </p>

              <div style={{ background: "#fff", border: `1px solid ${C.green}40`, padding: "10px 14px", borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>Login School ID:</span>
                <code style={{ fontSize: 14, fontWeight: 800, color: C.m800, fontFamily: "'JetBrains Mono', monospace" }}>{provisionedData.schoolId}</code>
              </div>

              {provisionedData.isStudent && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#1e3a8a", lineHeight: 1.5 }}>
                  <strong>Next Step:</strong> The student account has been created, but they are not yet assigned to an academic section. Section enrollment is processed via the Registrar portal.
                </div>
              )}

              <div style={{ background: "#fff", border: `1px dashed ${C.green}`, padding: "14px 18px", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Generated Temporary Password:
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <code style={{ fontSize: 18, fontWeight: 800, color: C.t1, letterSpacing: "0.15em", fontFamily: "'JetBrains Mono', monospace" }}>
                    {provisionedData.temporaryPassword}
                  </code>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: copied ? C.green : C.paper,
                      color: copied ? "#fff" : C.green,
                      border: `1px solid ${C.green}`,
                      borderRadius: 6,
                      padding: "6px 14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      transition: "all 0.2s"
                    }}
                  >
                    <Copy size={13} /> {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: "#b45309" }}>
                  ⚠️ Copy this temporary password now. It will not be shown again. The user will be required to change it on their first login.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}40`, color: C.red, padding: "14px 18px", borderRadius: 8, marginBottom: 24, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Provisioning Form */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 32, boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
        <form onSubmit={handleSubmit}>
          
          {/* Role Selection */}
          <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${C.borderLight}` }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: C.t2, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Account Role *
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {creatableRoles.map(r => (
                <div
                  key={r.id}
                  onClick={() => handleRoleChange(r.id)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: role === r.id ? `2px solid ${C.m700}` : `1px solid ${C.borderMed}`,
                    background: role === r.id ? C.m50 : "#fff",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: role === r.id ? C.m800 : C.t1 }}>
                      {r.label}
                    </span>
                    {role === r.id && <span style={{ width: 8, height: 8, borderRadius: 4, background: C.m700 }} />}
                  </div>
                  <span style={{ fontSize: 11, color: C.t3, lineHeight: 1.3 }}>{r.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Personal Information */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <UserPlus size={15} /> Personal & Account Information
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>First Name *</label>
                <input required type="text" placeholder="e.g. Juan" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Middle Name</label>
                <input type="text" placeholder="e.g. Santos" value={form.middleName} onChange={e => setForm({...form, middleName: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Last Name *</label>
                <input required type="text" placeholder="e.g. Dela Cruz" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13 }} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                  Email Address {role === 'Student' ? '(Optional Contact Email)' : '*'}
                </label>
                <input required={role !== 'Student'} type="email" placeholder={role === 'Student' ? 'e.g. parent.guardian@email.com (optional)' : 'e.g. juan.delacruz@calulut.edu.ph'} value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Initial Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Role-Specific Profile Sections */}
          {role === "Student" && (
            <div style={{ marginBottom: 28, padding: 20, background: C.paper, borderRadius: 8, border: `1px solid ${C.borderMed}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: 12, fontWeight: 800, color: C.m800, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <GraduationCap size={16} /> Student Profile & Learner Record
                </h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Student ID *</label>
                  <input required type="text" placeholder="e.g. 2026-00123" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }} />
                  <div style={{ fontSize: 10.5, color: C.t3, marginTop: 4 }}>Student ID — used to sign in to DigiSkwela</div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>DepEd LRN (Learner Reference Number) *</label>
                  <input required type="text" placeholder="12-digit LRN" value={form.lrn} onChange={e => setForm({...form, lrn: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }} />
                  <div style={{ fontSize: 10.5, color: C.t3, marginTop: 4 }}>LRN — official learner record identifier</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Grade Level *</label>
                  <select value={form.gradeLevel} onChange={e => setForm({...form, gradeLevel: Number(e.target.value)})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }}>
                    <option value={7}>Grade 7</option>
                    <option value={8}>Grade 8</option>
                    <option value={9}>Grade 9</option>
                    <option value={10}>Grade 10</option>
                    <option value={11}>Grade 11 (SHS)</option>
                    <option value={12}>Grade 12 (SHS)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Gender</label>
                  <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Guardian Contact Phone</label>
                  <input type="text" placeholder="09xxxxxxxxx" value={form.guardianPhone} onChange={e => setForm({...form, guardianPhone: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }} />
                </div>
              </div>
            </div>
          )}

          {role === "Teacher" && (
            <div style={{ marginBottom: 28, padding: 20, background: C.paper, borderRadius: 8, border: `1px solid ${C.borderMed}` }}>
              <h3 style={{ fontSize: 12, fontWeight: 800, color: C.m800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Building size={16} /> Teacher Profile & Department Assignment
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Employee ID *</label>
                  <input required type="text" placeholder="e.g. EMP-00101" value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }} />
                  <div style={{ fontSize: 10.5, color: C.t3, marginTop: 4 }}>Employee ID — used as School ID to sign in to DigiSkwela</div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Academic Department</label>
                  <select value={form.department} onChange={e => setForm({...form, department: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }}>
                    <option>English</option>
                    <option>Mathematics</option>
                    <option>Science</option>
                    <option>Filipino</option>
                    <option>Araling Panlipunan</option>
                    <option>MAPEH</option>
                    <option>TLE</option>
                    <option>Values Education</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Position Rank</label>
                  <select value={form.position} onChange={e => setForm({...form, position: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }}>
                    <option>Teacher I</option>
                    <option>Teacher II</option>
                    <option>Teacher III</option>
                    <option>Master Teacher I</option>
                    <option>Master Teacher II</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Subject Specialization</label>
                  <input type="text" placeholder="e.g. Geometry, Biology" value={form.specialization} onChange={e => setForm({...form, specialization: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }} />
                </div>
              </div>
            </div>
          )}

          {["Principal", "Registrar", "Guidance", "Nurse"].includes(role) && (
            <div style={{ marginBottom: 28, padding: 20, background: C.paper, borderRadius: 8, border: `1px solid ${C.borderMed}` }}>
              <h3 style={{ fontSize: 12, fontWeight: 800, color: C.m800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Building size={16} /> Staff Profile ({role})
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Staff / Employee ID *</label>
                  <input required type="text" placeholder="e.g. EMP-00001" value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }} />
                  <div style={{ fontSize: 10.5, color: C.t3, marginTop: 4 }}>Employee ID — used as School ID to sign in to DigiSkwela</div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Department / Unit</label>
                  <input type="text" value={form.department} onChange={e => setForm({...form, department: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>Official Position</label>
                  <input type="text" value={form.position} onChange={e => setForm({...form, position: e.target.value})} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }} />
                </div>
              </div>
            </div>
          )}

          {["Admin", "ITAdmin", "GateOperator"].includes(role) && (
            <div style={{ marginBottom: 28, padding: 20, background: C.paper, borderRadius: 8, border: `1px solid ${C.borderMed}` }}>
              <h3 style={{ fontSize: 12, fontWeight: 800, color: C.m800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Shield size={16} /> Institutional School ID ({role})
              </h3>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 6 }}>School ID *</label>
                <input
                  required
                  type="text"
                  placeholder={role === "Admin" ? "e.g. ADM-001" : role === "ITAdmin" ? "e.g. IT-001" : "e.g. GATE-001"}
                  value={form.schoolId}
                  onChange={e => setForm({...form, schoolId: e.target.value})}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: "#fff" }}
                />
                <div style={{ fontSize: 10.5, color: C.t3, marginTop: 4 }}>School / Staff ID — used to sign in to DigiSkwela</div>
              </div>
              {role === "GateOperator" && (
                <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.4 }}>
                  <strong>Gate Operator Account:</strong> Provisions the human attendant's login credentials. Gate hardware terminals maintain independent hardware identities and tokens under Gate Terminals.
                </div>
              )}
              {(role === "Admin" || role === "ITAdmin") && (
                <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.4 }}>
                  <strong>Privileged Administrative Account:</strong> This role grants broad system and user management capabilities. Provision strictly for verified school administrative staff.
                </div>
              )}
            </div>
          )}

          {/* Submit Action */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: C.m800,
                color: "#fff",
                padding: "12px 24px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}
            >
              <Save size={16} /> {loading ? "Provisioning..." : `Provision ${role} Account`}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// Backward-compatible alias export
export const CreateTeacher = CreateAccount;
