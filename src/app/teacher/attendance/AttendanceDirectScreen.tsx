import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { STUDENTS_GR8 } from '../../App';
import { AttendanceHub } from './AttendanceHub';
import { ChevronDown } from 'lucide-react';
export function AttendanceDirectScreen() {
  const [section, setSection] = useState("Gr. 8 Rizal");
  const studentsForSection = section.includes("8") ? STUDENTS_GR8 : STUDENTS_GR8; // all use same dataset for demo
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background: "transparent" }}>
      {/* Section selector header */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.borderMed}`, padding:"9px 18px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <span style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em" }}>Section</span>
        <div style={{ position:"relative" }}>
          <select value={section} onChange={e=>setSection(e.target.value)}
            style={{ border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"5px 26px 5px 9px", fontSize:12, color:C.t1, background:"#fff", outline:"none", appearance:"none", cursor:"pointer" }}>
            <option>Gr. 8 Rizal</option>
            <option>Gr. 9 Einstein</option>
            <option>Gr. 10 Pilot</option>
          </select>
          <ChevronDown size={11} style={{ position:"absolute", right:7, top:"50%", transform:"translateY(-50%)", color:C.t3, pointerEvents:"none" }} />
        </div>
        <div style={{ width:1, height:22, background:C.border }} />
        <span style={{ fontSize:11, color:C.t3 }}>
          {studentsForSection.length} students · {section.includes("8")?"Mathematics 8":section.includes("9")?"Science 9":"Filipino 10"}
        </span>
      </div>
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <AttendanceHub students={studentsForSection} />
      </div>
    </div>
  );
}

/* ─── ClinicVisitsScreen ─────────────────────────────────── */