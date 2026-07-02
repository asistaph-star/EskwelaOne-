import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Sparkles, Zap, Star, Users, Layers, ArrowRight } from 'lucide-react';
import { DocPanel } from '../../shared/components/DocPanel';
import { Stamp } from '../../shared/components/Stamp';
import { STUDENTS_GR8 } from '../../App';
export function AIToolsScreen() {
  const [active, setActive] = useState<string|null>(null);

  const TOOLS = [
    { id:"rec",  icon:Users,  label:"Recitation Manager", sub:"Random student picker with participation tracking and scoring", color:C.blue, bg:C.blueBg },
    { id:"proj", icon:Layers, label:"Project Tracker",    sub:"Manage class projects with deadlines, groups, and rubrics",    color:C.teal, bg:C.tealBg },
  ];

  return (
    <div style={{ flex:1, overflowY:"auto", padding:24, background:C.paper }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>AI Quick Tools</div>
        <div style={{ fontSize:12, color:C.t3, marginTop:3 }}>AI-powered tools for your daily teaching workflow</div>
      </div>

      {/* Tool cards — horizontal strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {TOOLS.map(t => {
          const Icon = t.icon;
          const act = active===t.id;
          return (
            <button key={t.id} onClick={()=>setActive(act?null:t.id)}
              style={{ background:"#fff", border:`1px solid ${act?t.color+"60":C.borderMed}`, borderTop:`3px solid ${act?t.color:C.borderMed}`, borderRadius:4, padding:"16px", textAlign:"left", cursor:"pointer", transition:"all 0.15s" } as React.CSSProperties}
              onMouseEnter={e=>{if(!act){(e.currentTarget as HTMLElement).style.borderTopColor=t.color;}}}
              onMouseLeave={e=>{if(!act){(e.currentTarget as HTMLElement).style.borderTopColor=C.borderMed;}}}>
              <div style={{ width:36, height:36, borderRadius:7, background:t.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
                <Icon size={18} color={t.color} strokeWidth={2} />
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:C.t1, marginBottom:5, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{t.label}</div>
              <div style={{ fontSize:11, color:C.t3, lineHeight:1.5 }}>{t.sub}</div>
              <div style={{ marginTop:12, fontSize:11, fontWeight:600, color:t.color, display:"flex", alignItems:"center", gap:4 }}>
                {act?"Close":"Open"} <ArrowRight size={11} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Recitation Manager */}
      {active==="rec" && (
        <DocPanel title="Recitation Manager — Random Student Picker" icon={Users}>
          <div style={{ padding:20 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:10 }}>Participation Tracker</div>
                <div style={{ background:C.m50, border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"16px", textAlign:"center", marginBottom:12 }}>
                  <div style={{ fontSize:11, color:C.t3, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.07em" }}>Current Student</div>
                  <div style={{ fontSize:22, fontWeight:700, color:C.m700, fontFamily:"'Fraunces',serif" }}>Ferrer, Joshua</div>
                  <div style={{ fontSize:11, color:C.t3, marginTop:4 }}>Grade 8 — Rizal · LRN 200006</div>
                  <button style={{ marginTop:12, padding:"8px 20px", background:C.m700, color:"#fff", borderRadius:4, border:"none", cursor:"pointer", fontSize:12, fontWeight:600 }}>Pick Next</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:10 }}>Participation Log</div>
                {STUDENTS_GR8.slice(0,5).map((s,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:`0.5px solid ${C.border}` }}>
                    <div style={{ width:22, height:22, borderRadius:3, background:C.m100, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:9, fontWeight:700, color:C.m700 }}>{i+1}</span>
                    </div>
                    <span style={{ fontSize:12, color:C.t1, flex:1 }}>{s.surname}, {s.first}</span>
                    <Stamp label={i<3?"Called":"—"} color={i<3?C.green:C.t3} bg={i<3?C.greenBg:C.ledger} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DocPanel>
      )}

      {/* Project Tracker */}
      {active==="proj" && (
        <DocPanel title="Project Tracker" icon={Layers}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                {["Project","Section","Due Date","Submitted","Pending","Status"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"9px 14px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Science Investigatory Project","Gr. 9 Einstein","Jun 20","12","24","In Progress"],
                ["Math Problem Set #3",          "Gr. 8 Rizal",    "Jun 14","30","9", "Due Soon"],
                ["Filipino Essay Compilation",   "Gr. 10 Pilot",   "Jun 25","18","14","In Progress"],
              ].map(([proj,sec,due,sub,pen,stat],i) => (
                <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}` }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                  <td style={{ padding:"10px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{proj}</td>
                  <td style={{ padding:"10px 14px", fontSize:11, color:C.t2 }}>{sec}</td>
                  <td style={{ padding:"10px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t2 }}>{due}</td>
                  <td style={{ padding:"10px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.green, fontWeight:600 }}>{sub}</td>
                  <td style={{ padding:"10px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.amber, fontWeight:600 }}>{pen}</td>
                  <td style={{ padding:"10px 14px" }}><Stamp label={stat} color={stat==="Due Soon"?C.red:C.amber} bg={stat==="Due Soon"?C.redBg:C.amberBg} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocPanel>
      )}
    </div>
  );
}

/* ─── SCREEN 5 — Professional Development ───────────────────── */