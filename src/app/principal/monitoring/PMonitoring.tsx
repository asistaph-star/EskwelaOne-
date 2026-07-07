import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { PTableHeader } from '../shared/PTableHeader';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { P_TEACHERS, P_WELFARE } from '../../shared/constants/seedData';
import { useAppContext } from '../../shared/AppContext';
import { Stamp } from '../../shared/components/Stamp';
import { Users, LogOut, Clock } from 'lucide-react';

export function PMonitoring() {
  const [chartView, setChartView] = useState("Weekly");
  const { gateAttendance } = useAppContext();
  return (
    <div style={{ flex:1, overflowY:"auto", background: "transparent", padding:24 }}>
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

      {/* Comprehensive Attendance Analytics */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Attendance Analytics</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["Daily", "Weekly", "Monthly", "By Grade", "By Section"].map(v => (
              <button key={v} onClick={() => setChartView(v)} style={{ 
                fontSize: 10, fontWeight: chartView === v ? 700 : 500, 
                color: chartView === v ? "#fff" : C.t2, 
                background: chartView === v ? C.m700 : "#fff", 
                border: chartView === v ? `1px solid ${C.m700}` : `1px solid ${C.borderMed}`, 
                borderRadius: 4, padding: "4px 10px", cursor: "pointer" 
              }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 200, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartView === "Weekly" ? (
              <LineChart data={[
                { day: "Mon", rate: 92.1 }, { day: "Tue", rate: 93.5 }, { day: "Wed", rate: 91.8 }, { day: "Thu", rate: 92.9 }, { day: "Fri", rate: 94.2 }
              ]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} dy={10} />
                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} tickFormatter={val => `${val}%`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(val: number) => [`${val}%`, "Attendance Rate"]} />
                <Line type="monotone" dataKey="rate" stroke={C.green} strokeWidth={3} dot={{ r: 4, fill: C.green, strokeWidth: 2, stroke: "#fff" }} />
              </LineChart>
            ) : chartView === "Monthly" ? (
              <LineChart data={[
                { month: "Aug", rate: 91.2 }, { month: "Sep", rate: 94.1 }, { month: "Oct", rate: 93.5 }, { month: "Nov", rate: 95.0 }, { month: "Dec", rate: 96.2 }
              ]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} dy={10} />
                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} tickFormatter={val => `${val}%`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(val: number) => [`${val}%`, "Attendance Rate"]} />
                <Line type="monotone" dataKey="rate" stroke={C.blue} strokeWidth={3} dot={{ r: 4, fill: C.blue, strokeWidth: 2, stroke: "#fff" }} />
              </LineChart>
            ) : chartView === "Daily" ? (
              <LineChart data={[
                { hour: "6:00 AM", rate: 20.1 }, { hour: "6:30 AM", rate: 65.4 }, { hour: "7:00 AM", rate: 88.2 }, { hour: "7:30 AM", rate: 94.2 }, { hour: "8:00 AM", rate: 94.2 }
              ]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} dy={10} />
                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} tickFormatter={val => `${val}%`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(val: number) => [`${val}%`, "Arrival % of Population"]} />
                <Line type="monotone" dataKey="rate" stroke={C.teal} strokeWidth={3} dot={{ r: 4, fill: C.teal, strokeWidth: 2, stroke: "#fff" }} />
              </LineChart>
            ) : chartView === "By Grade" ? (
              <BarChart data={[
                { grade: "Grade 7", rate: 92.5 }, { grade: "Grade 8", rate: 89.4 }, { grade: "Grade 9", rate: 91.1 }, { grade: "Grade 10", rate: 95.8 }
              ]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="grade" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} dy={10} />
                <YAxis domain={[80, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} tickFormatter={val => `${val}%`} />
                <Tooltip cursor={{ fill: C.m50 }} contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(val: number) => [`${val}%`, "Attendance Rate"]} />
                <Bar dataKey="rate" fill={C.m700} radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            ) : (
              <BarChart data={[
                { section: "10-Pilot", rate: 98.5 }, { section: "10-Einstein", rate: 96.1 }, { section: "9-Newton", rate: 89.2 }, { section: "8-Rizal", rate: 92.4 }, { section: "7-Makulay", rate: 93.1 }
              ]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="section" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} dy={10} />
                <YAxis domain={[80, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: C.t3 }} tickFormatter={val => `${val}%`} />
                <Tooltip cursor={{ fill: C.m50 }} contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(val: number) => [`${val}%`, "Attendance Rate"]} />
                <Bar dataKey="rate" fill={C.gold} radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
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
              <tr style={{ borderBottom:`0.5px solid ${C.border}`, background: C.goldLight+"30" }}>
                <td style={{ padding:"9px 14px", fontSize:12, fontWeight:700, color:C.m700 }}>Santos, Maria (Teacher)</td>
                <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>Faculty</td>
                <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>8:03 AM</td>
                <td style={{ padding:"9px 14px" }}>
                  <Stamp label="In" color={C.green} bg={C.greenBg} />
                </td>
              </tr>
              <tr style={{ borderBottom:`0.5px solid ${C.border}`, background: C.goldLight+"30" }}>
                <td style={{ padding:"9px 14px", fontSize:12, fontWeight:700, color:C.m700 }}>Dela Cruz, Anna (Teacher)</td>
                <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>Faculty</td>
                <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>8:55 AM</td>
                <td style={{ padding:"9px 14px" }}>
                  <Stamp label="Out" color={C.blue} bg={C.blueBg} />
                </td>
              </tr>
              {gateAttendance.map((g,i)=>(
                <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}` }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{g.studentName}</td>
                  <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>Grade 10 - Rizal</td>
                  <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{g.time}</td>
                  <td style={{ padding:"9px 14px" }}>
                    <div style={{ display:"flex", gap:5 }}>
                      <Stamp label="In" color={C.green} bg={C.greenBg} />
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
                {gateAttendance.filter(g => g.time > "7:30 AM").map((g,i)=>(
                  <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                    <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.amber }}>{g.studentName}</td>
                    <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>Grade 10 - Rizal</td>
                    <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{g.time}</td>
                    <td style={{ padding:"9px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:C.amber }}>+10m</td>
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