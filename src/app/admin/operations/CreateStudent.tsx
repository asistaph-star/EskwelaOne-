import React, { useState } from "react";
import { GraduationCap, Save, User, Mail, Phone, MapPin, Calendar, Users, BookOpen, Lock, CheckCircle, Hash, Heart } from "lucide-react";
import { C } from "../../shared/constants/tokens";

interface StudentFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  lrn: string;
  gender: string;
  birthDate: string;
  birthPlace: string;
  grade: string;
  section: string;
  studentEmail: string;
  parentName: string;
  parentRelationship: string;
  parentEmail: string;
  parentPhone: string;
  parentAltPhone: string;
  address: string;
  barangay: string;
  municipality: string;
  province: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  medicalConditions: string;
}

const INITIAL_FORM: StudentFormData = {
  firstName: "", middleName: "", lastName: "", suffix: "",
  lrn: "", gender: "Male", birthDate: "", birthPlace: "",
  grade: "7", section: "",
  studentEmail: "",
  parentName: "", parentRelationship: "Mother",
  parentEmail: "", parentPhone: "", parentAltPhone: "",
  address: "", barangay: "", municipality: "Angeles City", province: "Pampanga",
  emergencyName: "", emergencyRelation: "", emergencyPhone: "",
  medicalConditions: "",
};

const GRADE_SECTIONS: Record<string, string[]> = {
  "7": ["Rizal", "Bonifacio", "Mabini", "Luna"],
  "8": ["Rizal", "Einstein", "Newton", "Galileo"],
  "9": ["Einstein", "Newton", "Curie", "Darwin"],
  "10": ["Pilot", "Rizal", "Emerald", "Sapphire"],
};

export function CreateStudent() {
  const [form, setForm] = useState<StudentFormData>(INITIAL_FORM);
  const [success, setSuccess] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{ username: string; password: string } | null>(null);

  function updateField(field: keyof StudentFormData, value: string) {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      // Reset section when grade changes
      if (field === "grade") {
        updated.section = "";
      }
      return updated;
    });
  }

  function generateCredentials() {
    const lastName = form.lastName.toLowerCase().replace(/[^a-z]/g, "");
    const firstName = form.firstName.toLowerCase().replace(/[^a-z]/g, "");
    const username = `${firstName}.${lastName}@cis.edu.ph`;
    const password = `cis${form.lrn || "2026"}`;
    return { username, password };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const creds = generateCredentials();
    setGeneratedCreds(creds);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setGeneratedCreds(null);
    }, 8000);
  }

  function handleReset() {
    setForm(INITIAL_FORM);
    setSuccess(false);
    setGeneratedCreds(null);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13,
    boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.2s",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, background: "#fff", appearance: "auto" as any,
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700,
    color: C.t2, marginBottom: 6,
  };

  const sectionStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: C.t3,
    textTransform: "uppercase", letterSpacing: "0.05em",
    marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
    paddingBottom: 10, borderBottom: `1px solid ${C.border}`,
  };

  const availableSections = GRADE_SECTIONS[form.grade] || [];

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto", paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 6, fontFamily: "'Fraunces', serif", margin: 0 }}>
            Student Account Creator
          </h1>
          <p style={{ fontSize: 13, color: C.t3, margin: "6px 0 0" }}>
            Register a new student, capture parent/guardian details, and provision their system login credentials.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          style={{
            padding: "8px 18px", background: "none", border: `1px solid ${C.borderMed}`,
            borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.t2, cursor: "pointer",
          }}
        >
          Clear Form
        </button>
      </div>

      {/* Success Banner */}
      {success && generatedCreds && (
        <div style={{
          background: C.greenBg, border: `1px solid ${C.green}30`,
          borderRadius: 12, padding: "20px 24px", marginBottom: 24,
          display: "flex", gap: 16, alignItems: "flex-start",
          animation: "fadeIn 0.3s ease-out",
        }}>
          <CheckCircle size={22} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 6 }}>
              Student account successfully created!
            </div>
            <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.6 }}>
              <strong>{form.firstName} {form.lastName}</strong> — Grade {form.grade} {form.section && `– ${form.section}`}
            </div>
            <div style={{
              marginTop: 12, background: "#fff", border: `1px solid ${C.borderMed}`,
              borderRadius: 8, padding: "14px 18px", display: "flex", gap: 32,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Username</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.m700, fontFamily: "monospace" }}>{generatedCreds.username}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Temp. Password</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.m700, fontFamily: "monospace" }}>{generatedCreds.password}</div>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: C.t3, marginTop: 8, fontStyle: "italic" }}>
              Student will be prompted to change their password on first login.
            </div>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 16, padding: 32, boxShadow: "0 4px 16px rgba(0,0,0,0.03)" }}>
        <form onSubmit={handleSubmit}>

          {/* ── Section 1: Personal Information ── */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={sectionStyle}>
              <User size={14} /> Student Information
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.5fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>First Name *</label>
                <input required type="text" placeholder="e.g. Juan" value={form.firstName} onChange={e => updateField("firstName", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}>Middle Name</label>
                <input type="text" placeholder="e.g. Reyes" value={form.middleName} onChange={e => updateField("middleName", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}>Last Name *</label>
                <input required type="text" placeholder="e.g. Dela Cruz" value={form.lastName} onChange={e => updateField("lastName", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}>Suffix</label>
                <select value={form.suffix} onChange={e => updateField("suffix", e.target.value)} style={selectStyle}>
                  <option value="">None</option>
                  <option value="Jr.">Jr.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
              <div>
                <label style={labelStyle}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Hash size={11} /> LRN *</span></label>
                <input required type="text" placeholder="e.g. 200017" maxLength={12} value={form.lrn} onChange={e => updateField("lrn", e.target.value.replace(/\D/g, ""))} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}>Gender *</label>
                <select required value={form.gender} onChange={e => updateField("gender", e.target.value)} style={selectStyle}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> Date of Birth *</span></label>
                <input required type="date" value={form.birthDate} onChange={e => updateField("birthDate", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}>Place of Birth</label>
                <input type="text" placeholder="e.g. Angeles City" value={form.birthPlace} onChange={e => updateField("birthPlace", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
            </div>
          </div>

          {/* ── Section 2: Enrollment Details ── */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={sectionStyle}>
              <BookOpen size={14} /> Enrollment Details
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Grade Level *</label>
                <select required value={form.grade} onChange={e => updateField("grade", e.target.value)} style={selectStyle}>
                  <option value="7">Grade 7</option>
                  <option value="8">Grade 8</option>
                  <option value="9">Grade 9</option>
                  <option value="10">Grade 10</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Section *</label>
                <select required value={form.section} onChange={e => updateField("section", e.target.value)} style={selectStyle}>
                  <option value="">Select section...</option>
                  {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} /> Student Email</span></label>
                <input type="email" placeholder="e.g. juan.dc@cis.edu.ph" value={form.studentEmail} onChange={e => updateField("studentEmail", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
                <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>Auto-generated if left blank.</div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Parent / Guardian ── */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={sectionStyle}>
              <Users size={14} /> Parent / Guardian Information
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Parent/Guardian Full Name *</label>
                <input required type="text" placeholder="e.g. Mrs. Maria Dela Cruz" value={form.parentName} onChange={e => updateField("parentName", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}>Relationship *</label>
                <select required value={form.parentRelationship} onChange={e => updateField("parentRelationship", e.target.value)} style={selectStyle}>
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Grandparent">Grandparent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
              <div>
                <label style={labelStyle}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} /> Parent Email *</span></label>
                <input required type="email" placeholder="e.g. maria.dc@email.com" value={form.parentEmail} onChange={e => updateField("parentEmail", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} /> Contact Number *</span></label>
                <input required type="tel" placeholder="e.g. 0917-834-5621" value={form.parentPhone} onChange={e => updateField("parentPhone", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} /> Alt. Contact Number</span></label>
                <input type="tel" placeholder="Optional" value={form.parentAltPhone} onChange={e => updateField("parentAltPhone", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
            </div>
          </div>

          {/* ── Section 4: Address ── */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={sectionStyle}>
              <MapPin size={14} /> Home Address
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Street / House No. / Purok *</label>
                <input required type="text" placeholder="e.g. Purok 5, Blk. 3, Lot 10" value={form.address} onChange={e => updateField("address", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
              <div>
                <label style={labelStyle}>Barangay *</label>
                <input required type="text" placeholder="e.g. Calulut" value={form.barangay} onChange={e => updateField("barangay", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}>Municipality / City *</label>
                <input required type="text" value={form.municipality} onChange={e => updateField("municipality", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}>Province *</label>
                <input required type="text" value={form.province} onChange={e => updateField("province", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
            </div>
          </div>

          {/* ── Section 5: Emergency Contact ── */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={sectionStyle}>
              <Heart size={14} /> Emergency Contact
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Contact Person *</label>
                <input required type="text" placeholder="e.g. Mrs. Maria Dela Cruz" value={form.emergencyName} onChange={e => updateField("emergencyName", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}>Relationship *</label>
                <input required type="text" placeholder="e.g. Mother" value={form.emergencyRelation} onChange={e => updateField("emergencyRelation", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
              <div>
                <label style={labelStyle}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} /> Contact Number *</span></label>
                <input required type="tel" placeholder="e.g. 0917-834-5621" value={form.emergencyPhone} onChange={e => updateField("emergencyPhone", e.target.value)} style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = C.m500}
                  onBlur={e => e.currentTarget.style.borderColor = C.borderMed} />
              </div>
            </div>
          </div>

          {/* ── Section 6: Medical / Additional ── */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={sectionStyle}>
              <Heart size={14} /> Medical & Additional Information
            </h3>
            <div>
              <label style={labelStyle}>Known Medical Conditions / Allergies</label>
              <textarea
                placeholder="e.g. Asthma, peanut allergy (leave blank if none)"
                value={form.medicalConditions}
                onChange={e => updateField("medicalConditions", e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: "none" }}
                onFocus={e => e.currentTarget.style.borderColor = C.m500}
                onBlur={e => e.currentTarget.style.borderColor = C.borderMed}
              />
            </div>
          </div>

          {/* ── Section 7: Credentials Preview ── */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={sectionStyle}>
              <Lock size={14} /> System Credentials (Auto-Generated)
            </h3>
            <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: "18px 20px", display: "flex", gap: 32, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Username</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.m700, fontFamily: "monospace" }}>
                  {form.firstName && form.lastName
                    ? `${form.firstName.toLowerCase().replace(/[^a-z]/g, "")}.${form.lastName.toLowerCase().replace(/[^a-z]/g, "")}@cis.edu.ph`
                    : "firstname.lastname@cis.edu.ph"
                  }
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Temp. Password</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.m700, fontFamily: "monospace" }}>
                  cis{form.lrn || "XXXXXX"}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Role</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Student</div>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: C.t3, marginTop: 8, fontStyle: "italic" }}>
              Student will be prompted to change their password on first login. Credentials can be printed or emailed to the parent.
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <button
              type="button"
              onClick={handleReset}
              style={{ padding: "10px 20px", background: "none", border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.t2, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                background: C.m800, color: "#fff", padding: "12px 28px", borderRadius: 8,
                border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.m700}
              onMouseLeave={e => e.currentTarget.style.background = C.m800}
            >
              <Save size={16} /> Create Student Account
            </button>
          </div>

        </form>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
