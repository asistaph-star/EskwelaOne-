import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { PTableHeader } from '../shared/PTableHeader';
import { ChevronLeft, Printer, Download, Eye } from 'lucide-react';

export function PReports() {
  const [viewing, setViewing] = useState<string|null>(null);
  const REPORTS = [
    { id:"sf1",   title:"SF1 School Register",   desc:"Class enrollment list per section and grade level" },
    { id:"sf2",   title:"SF2 Attendance Report",  desc:"Monthly learner attendance record for all sections" },
    { id:"sf9",   title:"SF9 Scholastic Record",  desc:"Quarterly grade sheet — all subjects, all sections" },
    { id:"enroll",title:"Enrollment Report",      desc:"Total enrollment by grade level and section breakdown" },
    { id:"att",   title:"Attendance Summary",     desc:"School-wide attendance rate and trend report" },
    { id:"grade", title:"Grade Report",           desc:"School average, passing/failing rates per grade level" },
    { id:"promo", title:"Promotion Report",       desc:"End-of-year promotion and retention rates per section" },
    { id:"inv",   title:"Inventory Report",       desc:"Full school asset inventory — functional, repair, borrowed" },
  ];
  if (viewing) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"#fff", borderBottom:`2px solid ${C.m700}`, padding:"0 20px", height:54, display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <button onClick={()=>setViewing(null)} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, color:C.m700, background:C.m100, border:`1px solid rgba(139,30,30,0.2)`, padding:"6px 12px", borderRadius:3, cursor:"pointer" }}>
            <ChevronLeft size={13}/> Back to Reports
          </button>
          <div style={{ width:1, height:22, background:C.borderMed }} />
          <span style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>{REPORTS.find(r=>r.id===viewing)?.title} — Preview</span>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:C.t2, background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:3, padding:"6px 12px", cursor:"pointer" }}><Printer size={12}/>Print</button>
            <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:3, padding:"6px 14px", cursor:"pointer" }}><Download size={12}/>Download PDF</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:32, background:C.paper }}>
          <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, padding:28, maxWidth:800, margin:"0 auto" }}>
            <div style={{ textAlign:"center", borderBottom:`2px solid ${C.t1}`, paddingBottom:16, marginBottom:20 }}>
              <div style={{ fontSize:10, fontWeight:600, color:C.t2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Republic of the Philippines · Department of Education · Region III</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.t1, fontFamily:"'Fraunces',serif", marginTop:5 }}>Sindalan National High School</div>
              <div style={{ fontSize:12, color:C.t2, marginTop:3 }}>Sindalan, City of San Fernando, Pampanga · Division of San Fernando City</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.m700, marginTop:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>{REPORTS.find(r=>r.id===viewing)?.title}</div>
              <div style={{ fontSize:11, color:C.t3, marginTop:3 }}>School Year 2025–2026 · Quarter 1</div>
            </div>
            <div style={{ fontSize:12, color:C.t3, textAlign:"center", fontStyle:"italic" }}>
              Full report document will be generated here showing actual school data.<br />
              This is a read-only preview — Admin access only.
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex:1, overflowY:"auto", background:C.paper, padding:24 }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:4 }}>Reports</div>
        <div style={{ fontSize:12, color:C.t3 }}>View and download official school reports. Read-only — admin oversight access.</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {REPORTS.map(r=>(
          <div key={r.id} style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderTop:`3px solid ${C.m700}`, padding:"16px 18px", display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>{r.title}</div>
            <div style={{ fontSize:11, color:C.t3, lineHeight:1.5, flex:1 }}>{r.desc}</div>
            <button onClick={()=>setViewing(r.id)} style={{ alignSelf:"flex-start", display:"flex", alignItems:"center", gap:5, padding:"7px 14px", background:C.m700, color:"#fff", border:"none", borderRadius:3, cursor:"pointer", fontSize:11, fontWeight:700 }}>
              <Eye size={12}/> View
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══ Admin App Shell ══ */