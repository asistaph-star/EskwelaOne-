import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { BookMarked, Eye, ChevronLeft, Printer, Download, ArrowRight, X, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { Form138 } from '../../shared/components/Form138';
import { apiClient } from '../../../api/client';

export function TemplateHubScreen({ role = "teacher" }: { role?: "teacher" | "registrar" }) {
  const [modal, setModal] = useState<"rc"|null>(null);
  
  // Real workflow: fetch authorized students
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  
  // Report Card State
  const [rcData, setRcData] = useState<any>(null);
  const [loadingRc, setLoadingRc] = useState(false);
  const [rcError, setRcError] = useState<string|null>(null);
  
  const [viewing, setViewing] = useState<"rc"|null>(null);

  const TEMPLATES = [
    {
      id:"rc" as const, emoji:"📋",
      title:"Report Card",
      desc:"Form 138 - Complete academic history across Grade 7–10. Shows authorized grades from the backend database.",
    }
  ];

  useEffect(() => {
    // Fetch authorized students for this teacher
    async function fetchStudents() {
      setLoadingStudents(true);
      try {
        const data = await apiClient.get<any[]>('/student-services/appointments/students');
        setStudents(data);
        if (data.length > 0) {
          setSelectedStudentId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to load students", err);
      } finally {
        setLoadingStudents(false);
      }
    }
    fetchStudents();
  }, []);

  async function handleView() {
    if (!selectedStudentId) return;
    
    setLoadingRc(true);
    setRcError(null);
    setRcData(null);
    setViewing("rc");
    setModal(null);

    try {
      const data = await apiClient.get<any>(`/academic/report-card/${selectedStudentId}`);
      setRcData(data);
    } catch (err: any) {
      setRcError(err.message || "An unexpected error occurred.");
    } finally {
      setLoadingRc(false);
    }
  }

  if (viewing) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"transparent" }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden; }
            .printable-doc-area, .printable-doc-area * { visibility: visible; }
            .printable-doc-area {
              position: absolute; left: 0; top: 0; width: 100% !important; height: auto !important;
              overflow: visible !important; padding: 0 !important; margin: 0 !important; background: #fff !important;
            }
            .printable-doc-area > div { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: 100% !important; }
            .no-print { display: none !important; }
          }
        ` }} />

        <div className="no-print" style={{ background:"#fff", borderBottom:`2px solid ${C.m700}`, padding:"0 20px", height:54, display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <button onClick={()=>{ setViewing(null); setRcData(null); setRcError(null); }}
            style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, color:C.m700, background:C.m100, border:`1px solid rgba(139,30,30,0.2)`, padding:"6px 12px", borderRadius:4, cursor:"pointer" }}>
            <ChevronLeft size={13}/> Back to Forms and Records
          </button>
          <div style={{ width:1, height:22, background:C.borderMed }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>
              DigiSkwela SF9 / Form 138 Report Card
            </div>
            <div style={{ fontSize:10, color:C.t3 }}>
              {rcData ? `${rcData.student.name} · ${rcData.school.academicYear}` : "Loading..."}
            </div>
          </div>
          <button onClick={() => window.print()} disabled={!rcData} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:rcData ? C.t2 : C.borderMed, background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"6px 12px", cursor:rcData ? "pointer" : "default" }}>
            <Printer size={13}/> Print
          </button>
        </div>

        <div className="printable-doc-area" style={{ flex:1, minHeight: 0, overflowY:"auto", padding:24 }}>
          {loadingRc && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", color:C.t3 }}>
              <Loader2 className="animate-spin" size={24} style={{ marginBottom: 12 }} />
              <div>Fetching authoritative scholastic records...</div>
            </div>
          )}
          
          {rcError && (
            <div style={{ maxWidth: 500, margin: "40px auto", padding: 24, background: "#fff", border: `1px solid ${C.borderMed}`, borderTop: `4px solid ${C.red}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, color:C.red, fontWeight:700, fontSize:16, marginBottom: 8 }}>
                <AlertCircle size={20} /> Authorization / Data Error
              </div>
              <div style={{ color: C.t2, fontSize: 14, lineHeight: 1.5 }}>
                {rcError}
              </div>
            </div>
          )}

          {rcData && (
            <Form138 data={rcData} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, minHeight: 0, overflowY:"auto", background:"transparent" }}>
      <div style={{ maxWidth:700, margin:"0 auto", padding:40 }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:20, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:6 }}>Forms and Records</div>
          <div style={{ fontSize:13, color:C.t3 }}>Select a document template to view the official record for a student.</div>
          <div style={{ marginTop:8, padding:"8px 12px", background:C.m50, borderRadius:4, border:`1px solid ${C.m200}`, fontSize:11, color:C.m700 }}>
            <strong>Note:</strong> The DigiSkwela SF9 / Form 138 is a system-generated representation of scholastic records and does not replace official LIS-issued forms.
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:20 }}>
          {TEMPLATES.map(t=>(
            <button key={t.id} onClick={()=>setModal(t.id)}
              style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderTop:`3px solid ${C.m700}`, borderRadius:4, padding:"24px", textAlign:"left", cursor:"pointer", display:"flex", flexDirection:"column", gap:12, transition:"box-shadow 0.15s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.boxShadow=`0 4px 20px rgba(139,30,30,0.14)`;}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow="none";}}>
              <div style={{ fontSize:40, lineHeight:1 }}>{t.emoji}</div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:8 }}>{t.title}</div>
                <div style={{ fontSize:12, color:C.t3, lineHeight:1.6 }}>{t.desc}</div>
              </div>
              <div style={{ marginTop:"auto", display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:4, background:C.m700, color:"#fff", fontSize:12, fontWeight:700 }}>
                View {t.title} <ArrowRight size={13}/>
              </div>
            </button>
          ))}
        </div>
      </div>

      {modal && (
        <div style={{ position:"fixed", inset:0, zIndex:400, background:"rgba(15,8,8,0.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={e=>{ if(e.target===e.currentTarget) setModal(null); }}>
          <div style={{ background:"#fff", borderRadius:4, width:"100%", maxWidth:420, overflow:"hidden", boxShadow:"0 20px 60px rgba(74,10,16,0.4)" }}>
            <div style={{ background:C.m800, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:2 }}>Generate document</div>
                <div style={{ fontSize:15, fontWeight:700, color:"#fff", fontFamily:"'Fraunces',serif" }}>Report Card</div>
              </div>
              <button onClick={()=>setModal(null)} style={{ width:28, height:28, borderRadius:4, background:"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X size={15}/>
              </button>
            </div>

            <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Select Authorized Student</label>
                {loadingStudents ? (
                  <div style={{ fontSize: 13, color: C.t3, padding: "9px 10px" }}>Loading students...</div>
                ) : (
                  <div style={{ position:"relative" }}>
                    <select value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)}
                      style={{ width:"100%", border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"9px 28px 9px 10px", fontSize:13, color:C.t1, background:"#fff", outline:"none", appearance:"none", cursor:"pointer" }}>
                      {students.map(s=>(
                        <option key={s.id} value={s.id}>{s.user?.last_name}, {s.user?.first_name} ({s.current_section?.name})</option>
                      ))}
                    </select>
                    <ChevronDown size={12} style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", color:C.t3, pointerEvents:"none" }}/>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding:"14px 20px", borderTop:`1px solid ${C.borderMed}`, display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={()=>setModal(null)} style={{ padding:"9px 18px", background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, cursor:"pointer", fontSize:13, fontWeight:500, color:C.t2 }}>
                Cancel
              </button>
              <button onClick={handleView} disabled={!selectedStudentId} style={{ padding:"9px 22px", background: selectedStudentId ? C.m700 : C.borderMed, color:"#fff", border:"none", borderRadius:4, cursor:selectedStudentId ? "pointer" : "default", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                <Eye size={14}/> Generate Report Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}