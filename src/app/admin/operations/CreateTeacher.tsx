import React, { useState } from "react";
import { UserPlus, Save, ArrowLeft, Building, Lock } from "lucide-react";
import { C } from "../../shared/constants/tokens";

export function CreateTeacher() {
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
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
        <form onSubmit={handleSubmit}>
          
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <UserPlus size={14} /> Personal Information
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>First Name</label>
                <input required type="text" placeholder="e.g. Juan" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>Last Name</label>
                <input required type="text" placeholder="e.g. Dela Cruz" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14 }} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>Email Address</label>
                <input required type="email" placeholder="e.g. juan.delacruz@sindalannhs.edu.ph" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14 }} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${C.borderLight}` }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Building size={14} /> Assignment Details
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>Department</label>
                <select style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14, background: "#fff" }}>
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
                <select style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14, background: "#fff" }}>
                  <option>Teacher I</option>
                  <option>Teacher II</option>
                  <option>Teacher III</option>
                  <option>Master Teacher</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Lock size={14} /> Security Credentials
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 8 }}>Temporary Password</label>
                <input required type="password" placeholder="••••••••" defaultValue="sindalan2025" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14, background: C.m50 }} readOnly />
                <p style={{ fontSize: 10, color: C.t3, marginTop: 6 }}>Auto-generated. Teacher will be prompted to change this on first login.</p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
            {success && <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>Account successfully provisioned!</span>}
            <button type="submit" style={{ background: C.m800, color: "#fff", padding: "12px 24px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = C.m700} onMouseLeave={e => e.currentTarget.style.background = C.m800}>
              <Save size={16} /> Provision Account
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
