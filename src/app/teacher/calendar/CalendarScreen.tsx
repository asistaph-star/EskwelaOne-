import React from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
export function CalendarScreen() {
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const events = [
    { day:10, label:"Attendance due",     color:C.m700 },
    { day:13, label:"LAC Session",        color:C.blue },
    { day:14, label:"Q1 Grading deadline",color:C.red },
    { day:17, label:"Regional Seminar",   color:C.purple },
    { day:20, label:"PTA Meeting",        color:C.teal },
    { day:25, label:"SF2 submission",     color:C.amber },
  ];
  return (
    <div style={{ flex:1, overflowY:"auto", padding:24, background:C.paper }}>
      <div style={{ fontSize:18, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:20 }}>Academic Calendar — June 2025</div>
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:4, overflow:"hidden" }}>
        <div style={{ background:C.m800, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button style={{ width:28, height:28, borderRadius:4, background:"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><ChevronLeft size={14} color="#fff" /></button>
          <span style={{ color:"#fff", fontSize:14, fontWeight:700, fontFamily:"'Fraunces',serif" }}>June 2025</span>
          <button style={{ width:28, height:28, borderRadius:4, background:"rgba(255,255,255,0.1)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><ChevronRight size={14} color="#fff" /></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:`1px solid ${C.borderMed}` }}>
          {days.map(d => <div key={d} style={{ textAlign:"center", padding:"8px 4px", fontSize:10, fontWeight:700, color:C.t3, letterSpacing:"0.07em", textTransform:"uppercase", borderRight:`0.5px solid ${C.border}` }}>{d}</div>)}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
          {[...Array(6)].map((_,r) => (
            days.map((_,col) => {
              const day = r*7 + col - 1;
              const valid = day >= 1 && day <= 30;
              const ev = events.find(e=>e.day===day);
              const isToday = day===10;
              return (
                <div key={`${r}-${col}`} style={{ minHeight:70, padding:"6px 8px", borderRight:`0.5px solid ${C.border}`, borderBottom:`0.5px solid ${C.border}`, background:isToday?C.m50:"#fff" }}>
                  {valid && <>
                    <div style={{ fontSize:12, fontWeight:isToday?700:400, color:isToday?C.m700:col>=5?C.t3:C.t2, marginBottom:4 }}>{day}</div>
                    {ev && <div style={{ fontSize:9, fontWeight:600, color:"#fff", background:ev.color, borderRadius:3, padding:"2px 6px", lineHeight:1.4, marginTop:2 }}>{ev.label}</div>}
                  </>}
                </div>
              );
            })
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Stub screens ──────────────────────────────────────────── */