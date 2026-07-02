import React from 'react';
import { C } from '../../shared/constants/tokens';
import { PTableHeader } from '../shared/PTableHeader';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { P_GATE_LOG } from '../../shared/constants/seedData';
import { Stamp } from '../../shared/components/Stamp';
import { Users, LogOut, Clock } from 'lucide-react';

export function PMonitoring() {
  return (
    <div style={{ flex:1, overflowY:"auto", background:C.paper, padding:24 }}>
      {/* Redesigned Gate Cards Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
        {[
          { v: "319", l: "Inside Campus", color: C.green, bg: C.greenBg, icon: Users, desc: "Live student presence" },
          { v: "23", l: "Already Left", color: C.teal, bg: C.tealBg, icon: LogOut, desc: "Checked out of gate" },
          { v: "14", l: "Late Today", color: C.amber, bg: C.amberBg, icon: Clock, desc: "Arrived after 7:30 AM" }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.l}
              style={{
                background: "#fff",
                border: `1.5px solid ${C.borderMed}`,
                borderLeft: `5px solid ${card.color}`,
                borderRadius: 6,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                transition: "transform 0.15s, box-shadow 0.15s",
                cursor: "default"
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-2px)";
                el.style.boxShadow = "0 6px 16px rgba(139,30,30,0.06)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "none";
                el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
              }}
            >
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{card.l}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif", lineHeight: 1 }}>{card.v}</div>
                <div style={{ fontSize: 10, color: C.t3, marginTop: 5 }}>{card.desc}</div>
              </div>
              <div style={{ background: card.bg, width: 38, height: 38, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color={card.color} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {/* Gate log */}
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ background:C.m800, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:10, background:C.green, boxShadow:`0 0 0 3px ${C.greenBg}` }}/>
            <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif" }}>Live QR Gate Feed</span>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><PTableHeader cols={["Student","Grade & Section","Time","Direction"]} /></thead>
            <tbody>
              {P_GATE_LOG.map((g,i)=>(
                <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}` }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{g.name}</td>
                  <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>{g.section}</td>
                  <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{g.time}</td>
                  <td style={{ padding:"9px 14px" }}>
                    <div style={{ display:"flex", gap:5 }}>
                      <Stamp label={g.dir} color={g.dir==="In"?C.green:C.blue} bg={g.dir==="In"?C.greenBg:C.blueBg} />
                      {(g as any).late && <Stamp label="LATE" color={C.amber} bg={C.amberBg} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Late list + parent notifications */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
            <div style={{ padding:"10px 14px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Late Arrivals</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><PTableHeader cols={["Student","Section","Time","Min Late"]} /></thead>
              <tbody>
                {P_GATE_LOG.filter((g:any)=>g.late).map((g,i)=>(
                  <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                    <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.amber }}>{g.name}</td>
                    <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>{g.section}</td>
                    <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{g.time}</td>
                    <td style={{ padding:"9px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:C.amber }}>+{Math.floor(Math.random()*10+5)}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
            <div style={{ padding:"10px 14px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Parent Notification Log</div>
            {[["Santos, Maribel","Santos, J.M.","7:38 AM","Delivered"],["Bondoc, Rommel","Bondoc, R.","7:41 AM","Delivered"],["Espino, Grace","Espino, H.","7:38 AM","Pending"]].map(([parent,student,time,status],i)=>(
              <div key={parent} style={{ display:"flex", justifyContent:"space-between", padding:"8px 14px", borderBottom:i<2?`0.5px solid ${C.border}`:"none" }}>
                <div><div style={{ fontSize:11, fontWeight:600, color:C.t1 }}>{parent}</div><div style={{ fontSize:10, color:C.t3 }}>re: {student}</div></div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{time}</div>
                  <Stamp label={status} color={status==="Delivered"?C.green:C.amber} bg={status==="Delivered"?C.greenBg:C.amberBg} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}