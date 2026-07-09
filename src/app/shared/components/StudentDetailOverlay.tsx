import React, { useState } from 'react';
import { C } from '../constants/tokens';
import { X, BookMarked, Eye, ChevronLeft, Printer, Download, ArrowRight } from 'lucide-react';
import { StudentReportCard, getDynamicGrades } from '../../student/components/StudentReportCard';
import { Stamp } from './Stamp';

export function StudentDetailOverlay({ student, onClose }: { student:{id:number,surname:string,first:string,avg:number,status:string}, onClose:()=>void }) {
  const [showCard, setShowCard] = useState(false);
  const atRisk = student.status==="At Risk" || student.status==="Failing";
  
  const dynamicSubs = getDynamicGrades(student.surname, student.avg);
  const subjectGrades = dynamicSubs.map(sg=>({
    name:sg.short, full:sg.name, avg: Math.round((sg.q1+sg.q2+sg.q3)/3*10)/10,
  }));

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(15,8,8,0.65)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"32px 20px", overflowY:"auto" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:"100%", maxWidth:700, background:"#fff", borderRadius:4, overflow:"hidden", boxShadow:"0 20px 60px rgba(74,10,16,0.4)" }}>

        {showCard ? (
          <>
            <div style={{ background:C.m900, padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <button onClick={()=>setShowCard(false)} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"rgba(255,255,255,0.7)", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:3, padding:"4px 10px", cursor:"pointer" }}>
                ← Back to student overview
              </button>
              <div style={{ display:"flex", gap:7 }}>
                <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.7)", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:3, padding:"4px 10px", cursor:"pointer" }}><Printer size={11}/> Print</button>
                <button style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.7)", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:3, padding:"4px 10px", cursor:"pointer" }}><Download size={11}/> PDF</button>
                <button onClick={onClose} style={{ width:26, height:26, borderRadius:3, background:"rgba(255,255,255,0.08)", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={14}/></button>
              </div>
            </div>
            <StudentReportCard student={{ surname:student.surname, first:student.first, lrn:`20000${student.id}`, grade:8, section:"Rizal", adviser:"Ana R. Soriano", gender:"male", avg:student.avg }} />
          </>
        ) : (
          <>
            {/* Overlay topbar */}
            <div style={{ background:C.m800, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ color:"rgba(255,255,255,0.7)", fontSize:11 }}>Student Detail - {student.surname}, {student.first}</span>
              <button onClick={onClose} style={{ width:26, height:26, borderRadius:3, background:"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={14}/></button>
            </div>

            {/* Student info + Overall Grade Card */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 220px", borderBottom:`2px solid ${C.m700}` }}>
              {/* Student basic info */}
              <div style={{ padding:"18px 20px", borderRight:`1px solid ${C.borderMed}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <div style={{ width:46, height:46, borderRadius:30, background:C.m600, border:`2.5px solid ${C.gold}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:C.gold }}>{student.surname[0]}{student.first[0]}</span>
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>{student.surname}, {student.first}</div>
                    <div style={{ fontSize:11, color:C.t3, marginTop:2 }}>Grade 8 - Rizal · LRN 20000{student.id} · SY 2025–2026</div>
                  </div>
                </div>
                {[["Adviser","Ana R. Soriano"],["Section","Rizal"],["School Year","SY 2025–2026"],["LRN",`20000${student.id}`]].map(([l,v])=>(
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`0.5px solid ${C.border}` }}>
                    <span style={{ fontSize:10, color:C.t3, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>{l}</span>
                    <span style={{ fontSize:11, color:C.t1, fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Overall Grade Card - large stamped box */}
              <div style={{ padding:"18px 16px", background:atRisk?C.redBg:"#fff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
                <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700 }}>General Average</div>
                <div style={{ fontSize:48, fontWeight:800, color:atRisk?C.red:student.avg>=90?C.green:C.t1, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{student.avg.toFixed(1)}</div>
                <Stamp label={student.status.toUpperCase()} color={atRisk?"#fff":C.green} bg={atRisk?C.red:C.greenBg} />
                <button onClick={()=>setShowCard(true)} style={{ marginTop:10, display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:4, padding:"7px 14px", cursor:"pointer" }}>
                  View full report card <ArrowRight size={11}/>
                </button>
              </div>
            </div>

            {/* Subject breakdown */}
            <div style={{ padding:"14px 20px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Subject Grade Breakdown</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 16px" }}>
                {subjectGrades.map(sg=>{
                  const fail = sg.avg<75;
                  return (
                    <div key={sg.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 10px", borderRadius:3, background:fail?C.redBg:C.paper, border:`0.5px solid ${fail?C.red+"40":C.border}` }}>
                      <span style={{ fontSize:12, color:fail?C.red:C.t1, fontWeight:fail?600:400 }}>{sg.full}</span>
                      <span style={{ fontSize:13, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:fail?C.red:sg.avg>=90?C.green:C.t2 }}>{sg.avg.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}