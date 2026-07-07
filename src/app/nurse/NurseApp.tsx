import React, { useState } from 'react';
import { C } from '../shared/constants/tokens';
import { CLINIC_STUDENTS, CLINIC_VISITS_SEED } from '../shared/constants/seedData';
import { ClinicVisit, ClinicStudent } from '../shared/types';
import { X, Plus, User, Stethoscope, Search, Pill, Activity, FileText, ChevronRight, LogOut, HeartPulse, Bell } from 'lucide-react';
import { AIAssistantWidget } from '../shared/components/AIAssistantWidget';
import { NotificationDropdown } from '../shared/components/NotificationDropdown';
import { NSidebar, NScreen } from './shared/NSidebar';
import { useLayout } from '../App';
import { PrintableClinicReport } from './PrintableClinicReport';

function Stamp({ label, color, bg }: { label:string; color:string; bg:string }) {
  return (
    <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

// ── Medical History Drawer ──
function MedicalHistoryDrawer({ student, visits, onClose }: { student: ClinicStudent, visits: ClinicVisit[], onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,5,5,0.45)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 401, width: 480, background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(74,10,16,0.25)", overflow: "hidden" }}>
        
        <div style={{ background: C.m800, padding: "20px", display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User size={24} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, fontFamily: "'Fraunces',serif", lineHeight: 1.2 }}>{student.name}</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>Grade {student.grade} - {student.section}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", background: C.paper }}>
          {/* Medical Profile */}
          <div style={{ padding: 20, background: "#fff", borderBottom: `1px solid ${C.borderMed}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Medical Profile</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Blood Type</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>{student.bloodType}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Allergies</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: student.allergies==="None"?C.t2:C.amber }}>{student.allergies}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Known Medical Conditions</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: student.medicalConditions==="None"?C.t2:C.t1 }}>{student.medicalConditions}</div>
              </div>
              <div style={{ gridColumn: "1 / -1", padding: 12, background: C.m50, borderRadius: 6, border: `1px solid ${C.m200}` }}>
                <div style={{ fontSize: 10, color: C.m700, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Emergency Contact</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.m800 }}>{student.emergencyContact}</div>
              </div>
            </div>
          </div>

          {/* Visit History */}
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Clinic Visit History</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {visits.length === 0 ? (
                <div style={{ fontSize: 13, color: C.t3, fontStyle: "italic" }}>No previous clinic visits recorded.</div>
              ) : (
                visits.map((v, i) => (
                  <div key={v.id} style={{ borderLeft: `2px solid ${C.borderMed}`, paddingLeft: 16, position: "relative" }}>
                    <div style={{ position: "absolute", left: -6, top: 0, width: 10, height: 10, borderRadius: 5, background: C.m600, border: "2px solid #fff" }} />
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.m800 }}>{v.date}</div>
                      <div style={{ fontSize: 11, color: C.t3 }}>{v.time}</div>
                    </div>
                    
                    <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
                        <Stethoscope size={14} color={C.m700} style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", marginBottom: 2 }}>Diagnosis / Reason</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{v.diagnoses}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
                        <Activity size={14} color={C.amber} style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", marginBottom: 2 }}>Symptoms</div>
                          <div style={{ fontSize: 12, color: C.t2 }}>{v.symptoms}</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
                        <Pill size={14} color={C.blue} style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", marginBottom: 2 }}>Treatment & Meds</div>
                          <div style={{ fontSize: 12, color: C.t2 }}>{v.treatments} {v.medications !== "None" && `(${v.medications})`}</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingTop: 12, borderTop: `1px dashed ${C.border}` }}>
                        <FileText size={14} color={C.t3} style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", marginBottom: 2 }}>Notes</div>
                          <div style={{ fontSize: 12, color: C.t2, fontStyle: "italic" }}>"{v.notes}"</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── New Visit Form Drawer ──
function RecordVisitDrawer({ students, onSave, onClose }: { students: ClinicStudent[], onSave: (v: ClinicVisit) => void, onClose: () => void }) {
  const [formData, setFormData] = useState({
    studentId: "",
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    symptoms: "",
    diagnoses: "",
    medications: "None",
    treatments: "",
    notes: "",
    temp: "",
    bp: "",
    hr: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    if (!formData.studentId) return alert("Please select a student.");
    const newVisit: ClinicVisit = {
      id: `V-${Date.now()}`,
      studentId: formData.studentId,
      date: formData.date,
      time: formData.time,
      symptoms: formData.symptoms,
      diagnoses: formData.diagnoses,
      medications: formData.medications,
      treatments: formData.treatments,
      notes: formData.notes,
      vitalSigns: {
        temperature: formData.temp ? `${formData.temp}°C` : "",
        bloodPressure: formData.bp,
        heartRate: formData.hr ? `${formData.hr} bpm` : ""
      }
    };
    onSave(newVisit);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,5,5,0.45)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 401, width: 440, background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(74,10,16,0.25)", overflow: "hidden" }}>
        
        <div style={{ background: C.m800, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>Record New Clinic Visit</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* Student Select */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Select Student</label>
              <select name="studentId" value={formData.studentId} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none", background: "#fff" }}>
                <option value="">-- Choose Student --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Gr. {s.grade} - {s.section})</option>
                ))}
              </select>
            </div>

            {/* Date & Time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Date</label>
                <input name="date" type="date" value={formData.date} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Time</label>
                <input name="time" type="time" value={formData.time} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} />
              </div>
            </div>

            {/* Vitals */}
            <div style={{ border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: 12, background: C.m50 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.m700, textTransform: "uppercase", marginBottom: 12 }}>Vital Signs</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.t2, marginBottom: 4 }}>Temp (°C)</label>
                  <input name="temp" value={formData.temp} onChange={handleChange} placeholder="e.g. 36.5" style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.t2, marginBottom: 4 }}>BP (mmHg)</label>
                  <input name="bp" value={formData.bp} onChange={handleChange} placeholder="e.g. 110/70" style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: C.t2, marginBottom: 4 }}>HR (bpm)</label>
                  <input name="hr" value={formData.hr} onChange={handleChange} placeholder="e.g. 80" style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12, outline: "none" }} />
                </div>
              </div>
            </div>

            {/* Symptoms & Diagnosis */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Chief Complaint / Symptoms</label>
              <textarea name="symptoms" value={formData.symptoms} onChange={handleChange} rows={2} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none", resize: "vertical" }} placeholder="e.g. Headache, dizziness" />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Diagnosis / Assessment</label>
              <input name="diagnoses" value={formData.diagnoses} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} placeholder="e.g. Tension headache" />
            </div>

            {/* Treatment & Meds */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Treatments Provided</label>
              <input name="treatments" value={formData.treatments} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} placeholder="e.g. Rested for 30 mins, applied cold compress" />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Medications Administered/Prescribed</label>
              <input name="medications" value={formData.medications} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} placeholder="e.g. Paracetamol 500mg" />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Additional Notes & Disposition</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none", resize: "vertical" }} placeholder="e.g. Returned to class feeling better." />
            </div>

          </div>
        </div>

        <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "flex-end", gap: 12, background: C.paper }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 4, border: `1px solid ${C.borderMed}`, background: "#fff", color: C.t2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "8px 16px", borderRadius: 4, border: "none", background: C.m700, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Save Visit Record
          </button>
        </div>
      </div>
    </>
  );
}


// ── Main Nurse App Shell ──
export function NurseApp({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<NScreen>("n-dashboard");
  const [visits, setVisits] = useState<ClinicVisit[]>(CLINIC_VISITS_SEED);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<ClinicStudent | null>(null);
  const [search, setSearch] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Report Filters
  const [reportGrade, setReportGrade] = useState("All");
  const [reportSection, setReportSection] = useState("All");
  const [reportStudentName, setReportStudentName] = useState("");
  const [selectedReportStudent, setSelectedReportStudent] = useState<ClinicStudent | null>(null);

  const { isMobile, isTablet } = useLayout();
  const nav = (s: NScreen) => { setScreen(s); setMenuOpen(false); };

  const reportFilteredStudents = CLINIC_STUDENTS.filter(s => {
    const matchGrade = reportGrade === "All" || s.grade.toString() === reportGrade;
    const matchSection = reportSection === "All" || s.section === reportSection;
    const matchName = s.name.toLowerCase().includes(reportStudentName.toLowerCase());
    return matchGrade && matchSection && matchName;
  });

  const handleAddVisit = (v: ClinicVisit) => {
    setVisits([v, ...visits]); // Add to top
    setIsRecordOpen(false);
  };

  const getStudent = (id: string) => CLINIC_STUDENTS.find(s => s.id === id);

  // Filter visits based on search
  const filteredVisits = visits.filter(v => {
    const s = getStudent(v.studentId);
    if (!s) return false;
    const term = search.toLowerCase();
    return s.name.toLowerCase().includes(term) || v.diagnoses.toLowerCase().includes(term) || v.symptoms.toLowerCase().includes(term);
  });

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: C.paper, fontFamily: "'Inter',sans-serif" }}>
      {!isMobile && <NSidebar active={screen} onNav={nav} onLogout={onLogout} />}
      {isMobile && menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div onClick={() => setMenuOpen(false)} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ width: 280 }}>
            <NSidebar active={screen} onNav={(s) => { nav(s); setMenuOpen(false); }} onLogout={onLogout} />
          </div>
          <button onClick={() => setMenuOpen(false)}
            style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#fff" />
          </button>
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* Top Header for Content Area */}
        <div style={{ background: "#fff", borderBottom: `2px solid ${C.m700}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isMobile && (
              <button onClick={() => setMenuOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: C.m700 }}>
                <span style={{ fontSize: 18 }}>☰</span>
              </button>
            )}
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>
                {screen === 'n-dashboard' ? "Dashboard Overview" : "Clinic Operations"}
              </h1>
              <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>Tuesday, June 10, 2025</div>
            </div>
          </div>
          
          {/* Right Area: Search, Theme sun, Notification Bell & Profile dropdown */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Search bar mockup */}
              <div style={{ display: "flex", alignItems: "center", position: "relative", width: 220 }}>
                <Search size={13} color={C.t3} style={{ position: "absolute", left: 10 }} />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  style={{
                    width: "100%",
                    padding: "6px 12px 6px 30px",
                    fontSize: 11,
                    color: C.t1,
                    background: C.m50,
                    border: "1.5px solid " + C.borderMed,
                    borderRadius: 20,
                    outline: "none",
                    transition: "all 0.15s"
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = C.m700;
                    e.currentTarget.style.background = "#fff";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = C.borderMed;
                    e.currentTarget.style.background = C.m50;
                  }}
                />
              </div>

              {/* Action buttons and Profile */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>

                {/* Notification Bell */}
                <div style={{ position: "relative" }}>
                  <button 
                    onClick={() => setNotifOpen(true)}
                    style={{
                      background: notifOpen ? C.m50 : "transparent",
                      border: "none",
                      borderRadius: 16,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      position: "relative",
                      transition: "background 0.2s"
                    }}
                  >
                    <Bell size={18} color={notifOpen ? C.m700 : C.t2} />
                    <div style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      background: C.red,
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 700,
                      borderRadius: 10,
                      width: 14,
                      height: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1.5px solid #fff"
                    }}>5</div>
                  </button>
                  <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          
          {(screen === "n-dashboard" || screen === "n-clinic") ? (
            <>
              {/* Quick Stats & Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Health Records</h2>
            <p style={{ fontSize: 13, color: C.t3, margin: "4px 0 0 0" }}>Manage student visits, diagnoses, and medical profiles.</p>
          </div>
          <button onClick={() => setIsRecordOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 6, background: C.m700, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(153,27,27,0.2)" }}>
            <Plus size={16} /> Record New Visit
          </button>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "Total Visits (Today)", value: visits.filter(v => v.date === new Date().toISOString().split('T')[0]).length, icon: Activity, color: C.m700 },
            { label: "Active Consultations", value: 0, icon: Stethoscope, color: C.amber },
            { label: "Total Records", value: visits.length, icon: FileText, color: C.blue }
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={24} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Data Table Container */}
        <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.paper }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Recent Clinic Logs</div>
            <div style={{ display: "flex", alignItems: "center", position: "relative", width: 280 }}>
              <Search size={14} color={C.t3} style={{ position: "absolute", left: 12 }} />
              <input 
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by student name or diagnosis..." 
                style={{ width: "100%", padding: "8px 12px 8px 34px", border: `1px solid ${C.borderMed}`, borderRadius: 20, fontSize: 12, outline: "none", background: "#fff" }} 
              />
            </div>
          </div>
          
          <div style={{ overflow: "auto", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                  {["Date & Time", "Student", "Symptoms / Complaint", "Diagnosis", "Treatment / Meds", "Actions"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVisits.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: C.t3, fontSize: 13 }}>No clinic records found.</td></tr>
                ) : filteredVisits.map((v, i) => {
                  const s = getStudent(v.studentId);
                  if (!s) return null;
                  return (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.m50; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
                      onClick={() => setViewingStudent(s)}
                    >
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{v.date}</div>
                        <div style={{ fontSize: 11, color: C.t3 }}>{v.time}</div>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: C.t3 }}>Gr. {s.grade} - {s.section}</div>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.t2, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.symptoms}</td>
                      <td style={{ padding: "14px 20px", fontSize: 12, fontWeight: 600, color: C.t1 }}>{v.diagnoses}</td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.t2, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.treatments}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <button onClick={(e) => { e.stopPropagation(); setViewingStudent(s); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.m700, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>
                          History <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
            </>
          ) : screen === "n-reports" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Clinic Reports</h2>
                <p style={{ fontSize: 13, color: C.t3, margin: "4px 0 0 0" }}>Generate and print detailed medical records for students.</p>
              </div>

              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: C.m800, margin: "0 0 16px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>Search Filters</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 16, marginBottom: 24 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Year Level</label>
                    <select value={reportGrade} onChange={e => setReportGrade(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13 }}>
                      <option value="All">All Grades</option>
                      <option value="7">Grade 7</option>
                      <option value="8">Grade 8</option>
                      <option value="9">Grade 9</option>
                      <option value="10">Grade 10</option>
                      <option value="11">Grade 11</option>
                      <option value="12">Grade 12</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Section</label>
                    <select value={reportSection} onChange={e => setReportSection(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13 }}>
                      <option value="All">All Sections</option>
                      <option value="Pilot">Pilot</option>
                      <option value="Regular">Regular</option>
                      <option value="A">Section A</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Student Name</label>
                    <div style={{ position: "relative" }}>
                      <Search size={14} color={C.t3} style={{ position: "absolute", left: 12, top: 12 }} />
                      <input 
                        value={reportStudentName} onChange={e => setReportStudentName(e.target.value)}
                        placeholder="Type to search..." 
                        style={{ width: "100%", padding: "10px 12px 10px 34px", border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 13, outline: "none" }} 
                      />
                    </div>
                  </div>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 800, color: C.t1, margin: "0 0 12px 0" }}>Select Student</h3>
                <div style={{ border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
                  {reportFilteredStudents.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: C.t3, fontSize: 13 }}>No students match the filters.</div>
                  ) : (
                    reportFilteredStudents.map(s => (
                      <div key={s.id} onClick={() => setSelectedReportStudent(s)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selectedReportStudent?.id === s.id ? C.m50 : "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 16, background: C.borderMed, display: "flex", alignItems: "center", justifyContent: "center" }}><User size={16} color={C.t3} /></div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: C.t3 }}>Grade {s.grade} - {s.section}</div>
                          </div>
                        </div>
                        {selectedReportStudent?.id === s.id && <div style={{ fontSize: 11, fontWeight: 700, color: C.m700, background: C.m100, padding: "4px 8px", borderRadius: 4 }}>SELECTED</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedReportStudent && (
                <div style={{ background: C.m900, borderRadius: 12, padding: 32, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", boxShadow: "0 12px 32px rgba(139,30,30,0.2)" }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px 0", fontFamily: "'Fraunces',serif" }}>Ready to Print</h3>
                    <p style={{ fontSize: 13, margin: 0, color: "rgba(255,255,255,0.7)" }}>Generate a comprehensive medical report for <strong>{selectedReportStudent.name}</strong>.</p>
                  </div>
                  <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 8, background: "#fff", color: C.m800, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                    <FileText size={18} /> Print Medical Report
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: C.m50, padding: 32, textAlign: "center", borderRadius: 12 }}>
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "40px 32px", maxWidth: 400, width: "100%", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: 36, background: C.m100, border: `2px solid ${C.m700}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.m700, boxShadow: "0 4px 12px rgba(139,30,30,0.1)" }}>
                  <span style={{ fontSize: 32 }}>🚧</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 6 }}>Module Locked</h3>
                  <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>This nurse module is currently being finalized.</p>
                </div>
                <div style={{ marginTop: 8, padding: "8px 16px", background: C.m100, color: C.m700, borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid rgba(139,30,30,0.1)` }}>
                  Feature Coming Soon
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isRecordOpen && <RecordVisitDrawer students={CLINIC_STUDENTS} onSave={handleAddVisit} onClose={() => setIsRecordOpen(false)} />}
      {viewingStudent && <MedicalHistoryDrawer student={viewingStudent} visits={visits.filter(v => v.studentId === viewingStudent.id)} onClose={() => setViewingStudent(null)} />}
      <AIAssistantWidget role="Nurse" />
      
      {/* Hidden printable report component */}
      <PrintableClinicReport student={selectedReportStudent} visits={selectedReportStudent ? visits.filter(v => v.studentId === selectedReportStudent.id) : []} />
    </div>
  );
}
