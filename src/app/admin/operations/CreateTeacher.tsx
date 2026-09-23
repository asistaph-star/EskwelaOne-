import React, { useState } from "react";
import { UserPlus, Save, Building, Lock, CheckCircle, Copy } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { apiClient } from "../../../api/client";

export function CreateTeacher() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "English",
    primaryRole: "Teacher I"
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionedPassword, setProvisionedPassword] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProvisionedPassword(null);

    try {
      const payload = {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        roles: ["Teacher"],
        teacherProfile: {
          employeeId: "EMP-" + Math.floor(Math.random() * 10000), // Simple mock generation
          department: form.department,
          position: form.primaryRole,
        }
      };

      const res = await apiClient.post('/users', payload);
      // Depending on apiClient unwrapping behavior, the response might be { success: true, data: { user, temporaryPassword } }
      // Or just { user, temporaryPassword } if unwrapped. Let's handle both.
      const responseData = (res as any).data || res;
      
      setProvisionedPassword(responseData.temporaryPassword || "UNKNOWN (check logs)");
      setForm({ firstName: "", lastName: "", email: "", department: "English", primaryRole: "Teacher I" });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || "Failed to provision account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 8, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Provision Account</h1>
          <p style={{ fontSize: 13, color: C.t3 }}>Create a new system account for faculty and assign initial roles.</p>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 32, boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
        
        {provisionedPassword && (
          <div style={{ background: C.greenBg, border: `1px solid ${C.green}`, padding: 20, borderRadius: 8, marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
            <CheckCircle color={C.green} style={{ marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, color: C.green, fontSize: 15, fontWeight: 700 }}>Account Provisioned Successfully!</h3>
              <p style={{ margin: "8px 0 0", color: C.t2, fontSize: 13 }}>Please securely share this temporary password with the teacher. They will be prompted to change it on their first login.</p>
              <div style={{ marginTop: 12, background: "#fff", padding: "12px 16px", borderRadius: 6, border: `1px dashed ${C.green}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <code style={{ fontSize: 16, fontWeight: 800, color: C.t1, letterSpacing: "0.1em" }}>{provisionedPassword}</code>
                <button onClick={() => navigator.clipboard.writeText(provisionedPassword)} style={{ background: "transparent", border: "none", color: C.green, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
                  <Copy size={14} /> Copy
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: C.redBg, color: C.red, padding: "12px 16px", borderRadius: 8, marginBottom: 24, fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <UserPlus size={14} /> Personal Information
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>First Name</label>
                <input required type="text" placeholder="e.g. Juan" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>Last Name</label>
                <input required type="text" placeholder="e.g. Dela Cruz" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14 }} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>Email Address</label>
                <input required type="email" placeholder="e.g. juan.delacruz@sindalannhs.edu.ph" value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14 }} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.borderLight}` }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Building size={14} /> Assignment Details
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>Department</label>
                {/* DELIBERATE PLACEHOLDER: Department and Primary Role are unconstrained String fields in the schema with no existing lookups. Hardcoding sensible defaults here. */}
                <select value={form.department} onChange={e => setForm({...form, department: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14, background: "#fff" }}>
                  <option>English</option>
                  <option>Mathematics</option>
                  <option>Science</option>
                  <option>Filipino</option>
                  <option>Araling Panlipunan</option>
                  <option>MAPEH</option>
                  <option>TLE</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>Primary Role</label>
                <select value={form.primaryRole} onChange={e => setForm({...form, primaryRole: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14, background: "#fff" }}>
                  <option>Teacher I</option>
                  <option>Teacher II</option>
                  <option>Teacher III</option>
                  <option>Master Teacher</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
            <button type="submit" disabled={loading} style={{ background: C.m800, color: "#fff", padding: "12px 24px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
              <Save size={16} /> {loading ? "Provisioning..." : "Provision Account"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
