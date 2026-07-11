import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { PTableHeader } from '../shared/PTableHeader';
import { Stamp } from '../../shared/components/Stamp';
import { Sparkles } from 'lucide-react';
import { useAppContext } from '../../shared/AppContext';

const GRADUATION_DATA = [
  { year: "2020", graduates: 185, rate: 92.5, male: 90, female: 95 },
  { year: "2021", graduates: 210, rate: 94.2, male: 102, female: 108 },
  { year: "2022", graduates: 245, rate: 95.8, male: 118, female: 127 },
  { year: "2023", graduates: 280, rate: 96.5, male: 135, female: 145 },
  { year: "2024", graduates: 310, rate: 97.2, male: 148, female: 162 },
  { year: "2025", graduates: 335, rate: 98.0, male: 160, female: 175 },
  { year: "2026", graduates: 342, rate: 98.8, male: 180, female: 162 }
];

export function PAcademics() {
  const [aiDone, setAiDone] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  const { gradesStatus, setGradeStatus } = useAppContext();
  const pendingApprovals = Object.entries(gradesStatus).filter(([k, v]) => v === "Submitted");

  return (
    <div style={{ flex:1, overflowY:"auto", background: "transparent", padding:24 }}>
      {/* Historical Graduation Analytics */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14, padding: "16px 20px" }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:2 }}>Historical Graduation Performance (2020 – 2026)</div>
        <div style={{ fontSize:11, color:C.t3, marginBottom:16 }}>Track the total number of graduates, annual trends, and gender distribution over the past 7 years.</div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 3.8fr", gap: 24, alignItems: "center" }}>
          {/* Stats Summaries */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: C.m50, border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Cumulative Graduates</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: C.m800, lineHeight: 1 }}>1,907</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>Across all batches (2020 - 2026)</div>
            </div>
            
            <div style={{ background: C.greenBg, border: `1px solid rgba(22,101,52,0.15)`, borderRadius: 4, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, color: C.green, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Average Completion Rate</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: C.green, lineHeight: 1 }}>96.1%</div>
              <div style={{ fontSize: 10, color: C.green, marginTop: 4 }}>▲ Steady rise year-over-year</div>
            </div>

            <div style={{ background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, color: C.t2, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>2026 Graduation Target</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: C.t1, lineHeight: 1 }}>342 / 346</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>98.8% estimated projection</div>
            </div>
          </div>

          {/* Recharts Bar Chart */}
          <div style={{ height: 210, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <RBarChart data={GRADUATION_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="year" stroke={C.t3} fontSize={10} tickLine={false} />
                <YAxis stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: "#fff", border: `1px solid ${C.borderMed}`, fontSize: 11, borderRadius: 4 }}
                  labelStyle={{ fontWeight: "bold", color: C.t1 }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar name="Male Graduates" dataKey="male" fill="#a3a195" radius={[2, 2, 0, 0]} />
                <Bar name="Female Graduates" dataKey="female" fill={C.m700} radius={[2, 2, 0, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pending Grade Approvals Queue */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14 }}>
        <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.m800, fontFamily:"'Fraunces',serif", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Pending Grade Approvals ({pendingApprovals.length})</span>
          {pendingApprovals.length > 0 && <Stamp label="Action Required" bg={C.amberBg} color={C.amber} />}
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><PTableHeader cols={["Section", "Quarter", "Status", "Actions"]} /></thead>
          <tbody>
            {pendingApprovals.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", fontSize: 12, color: C.t3 }}>No pending grade submissions.</td></tr>
            ) : pendingApprovals.map(([key]) => {
              const [gradeSec, q] = key.split("-");
              return (
                <tr key={key} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                  <td style={{ padding:"10px 16px", fontSize:12, fontWeight:600, color:C.t1 }}>{gradeSec}</td>
                  <td style={{ padding:"10px 16px", fontSize:12, color:C.t2 }}>{q}</td>
                  <td style={{ padding:"10px 16px" }}><Stamp label="Submitted for Review" bg={C.amberBg} color={C.amber} /></td>
                  <td style={{ padding:"10px 16px", display: "flex", gap: 8 }}>
                    <button onClick={() => setGradeStatus(key, "Published")} style={{ background: C.green, color: "#fff", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Publish</button>
                    <button onClick={() => setGradeStatus(key, "Returned")} style={{ background: C.red, color: "#fff", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Return for Revision</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Grade averages */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14 }}>
        <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>School Average by Grade Level</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
          {[["Grade 7","83.4",[11,25,38,41,38]],["Grade 8","81.7",[9,22,35,38,36]],["Grade 9","79.2",[8,19,32,35,30]],["Grade 10","84.1",[12,26,40,43,39]]].map(([g,avg,_],i)=>(
            <div key={g as string} style={{ padding:"16px 20px", borderRight:i<3?`0.5px solid ${C.border}`:"none" }}>
              <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{g}</div>
              <div style={{ fontSize:32, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:parseFloat(avg as string)>=85?C.green:parseFloat(avg as string)>=80?C.m700:C.amber, lineHeight:1 }}>{avg}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Q1 vs Q2 vs Q3 trend table */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14 }}>
        <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>School Performance Trends (Q1 / Q2 / Q3)</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><PTableHeader cols={["Grade Level","Q1 Average","Q2 Average","Q3 Average","Trend"]} /></thead>
          <tbody>
            {[["Grade 7","83.4","84.1","83.8","↑ Stable"],["Grade 8","81.7","80.2","79.8","↓ Declining"],["Grade 9","79.2","79.9","80.4","↑ Improving"],["Grade 10","84.1","85.0","84.7","↑ Stable"]].map(([g,q1,q2,q3,t],i)=>(
              <tr key={g} style={{ borderBottom:`0.5px solid ${C.border}` }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                <td style={{ padding:"10px 16px", fontSize:12, fontWeight:600, color:C.t1 }}>{g}</td>
                {[q1,q2,q3].map((v,j)=><td key={j} style={{ padding:"10px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:C.t2 }}>{v}</td>)}
                <td style={{ padding:"10px 16px" }}><Stamp label={t} color={t.includes("↑")?C.green:C.red} bg={t.includes("↑")?C.greenBg:C.redBg} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Subjects with Lowest Performance */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14 }}>
        <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Subjects with Lowest Performance</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><PTableHeader cols={["Subject","Grade Level","Average","Attention Required"]} /></thead>
          <tbody>
            {[["Mathematics","Grade 7","71.2","🔴 Critical Remediation Required"],["Science","Grade 9","72.8","🔴 Curriculum Alignment Review"],["Mathematics","Grade 8","73.5","🟠 Targeted LAC Session"]].map(([s,g,avg,att],i)=>(
              <tr key={i} style={{ borderBottom:i<2?`0.5px solid ${C.border}`:"none" }}>
                <td style={{ padding:"9px 16px", fontSize:12, fontWeight:600, color:C.red }}>{s}</td>
                <td style={{ padding:"9px 16px", fontSize:11, color:C.t3 }}>{g}</td>
                <td style={{ padding:"9px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:C.red }}>{avg}</td>
                <td style={{ padding:"9px 16px", fontSize:11, color:C.t2 }}>{att}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        {/* Passing/failing per grade */}
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Passing vs Failing per Grade Level</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><PTableHeader cols={["Grade","Passing","Failing","Rate"]} /></thead>
            <tbody>
              {[["Grade 7","82","14","85.4%"],["Grade 8","71","16","81.6%"],["Grade 9","68","18","79.1%"],["Grade 10","66","7","90.4%"]].map(([g,p,f,r],i)=>(
                <tr key={g} style={{ borderBottom:i<3?`0.5px solid ${C.border}`:"none" }}>
                  <td style={{ padding:"9px 16px", fontSize:12, color:C.t1 }}>{g}</td>
                  <td style={{ padding:"9px 16px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.green, fontWeight:600 }}>{p}</td>
                  <td style={{ padding:"9px 16px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.red, fontWeight:600 }}>{f}</td>
                  <td style={{ padding:"9px 16px" }}><Stamp label={r} color={parseFloat(r)>=85?C.green:C.amber} bg={parseFloat(r)>=85?C.greenBg:C.amberBg} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Top sections */}
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Top Performing Sections</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><PTableHeader cols={["Section","Grade","Average","Adviser"]} /></thead>
            <tbody>
              {[["10 Pilot","10","87.3","Dela Cruz, C."],["8 Rizal","8","85.1","Soriano, A."],["9 Einstein","9","83.9","Santiago, R."],["7 Makulay","7","83.1","Navarro, P."]].map(([s,g,avg,adv],i)=>(
                <tr key={s} style={{ borderBottom:i<3?`0.5px solid ${C.border}`:"none" }}>
                  <td style={{ padding:"9px 16px", fontSize:12, fontWeight:600, color:C.t1 }}>{s}</td>
                  <td style={{ padding:"9px 16px", fontSize:11, color:C.t3 }}>Grade {g}</td>
                  <td style={{ padding:"9px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:C.green }}>{avg}</td>
                  <td style={{ padding:"9px 16px", fontSize:11, color:C.t2 }}>{adv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 Performers (School-Wide) */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14 }}>
        <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Top 10 Performers (School-Wide)</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><PTableHeader cols={["Rank","Student Name","Grade & Section","General Average"]} /></thead>
          <tbody>
            {[
              ["1", "Valdez, Sophia", "10 Pilot", "98.2"],
              ["2", "Mendoza, Gabriel", "10 Pilot", "97.8"],
              ["3", "Bautista, Chloe", "9 Newton", "97.5"],
              ["4", "Reyes, Miguel", "8 Rizal", "97.1"],
              ["5", "Fernandez, Julia", "10 Einstein", "96.9"],
              ["6", "Aquino, Liam", "7 Makulay", "96.5"],
              ["7", "Cruz, Trisha Ann", "10 Pilot", "96.2"],
              ["8", "Garcia, Ethan", "9 Galileo", "95.8"],
              ["9", "Torres, Isabella", "8 Bonifacio", "95.7"],
              ["10", "Gomez, Lucas", "7 Matapat", "95.5"]
            ].map(([rank, name, sec, avg], i)=>(
              <tr key={rank} style={{ borderBottom:i<9?`0.5px solid ${C.border}`:"none" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                <td style={{ padding:"9px 16px", fontSize:12, fontWeight:800, color:C.m700 }}>#{rank}</td>
                <td style={{ padding:"9px 16px", fontSize:12, fontWeight:700, color:C.t1 }}>{name}</td>
                <td style={{ padding:"9px 16px", fontSize:11, color:C.t3 }}>{sec}</td>
                <td style={{ padding:"9px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:800, color:C.green }}>{avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI Summary */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderLeft:`3px solid ${C.gold}`, padding:"14px 18px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
          <Sparkles size={14} color={C.gold} />
          <span style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>AI Executive School Summary</span>
          {!aiDone && <button onClick={()=>{setAiLoading(true);setTimeout(()=>{setAiLoading(false);setAiDone(true);},1500);}} style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"7px 14px", background:C.gold, color:C.m900, border:"none", borderRadius:3, cursor:"pointer", fontSize:12, fontWeight:700 }}>{aiLoading?"Generating…":"Generate Summary"}</button>}
        </div>
        {aiDone ? (
          <p style={{ fontSize:12, color:C.t1, lineHeight:1.8, margin:0 }}>
            School-wide academic performance for Q1 SY 2025–2026 is at <strong>82.1 general average</strong>. Grade 10 leads at 84.1, while Grade 9 remains the lowest at 79.2. <strong>Mathematics consistently underperforms</strong> across all grade levels - Grades 7 and 8 are critically below threshold (71.2 and 73.5 respectively). Science 9 at 72.8 requires urgent faculty intervention. <strong>Recommended actions:</strong> (1) Schedule targeted remediation for Mathematics teachers; (2) Deploy peer-learning programs in Grades 8–9; (3) Request Division support for Science 9 curriculum alignment. Sections 9 Newton and 7 Matapat are flagged for special monitoring.
          </p>
        ) : <p style={{ fontSize:12, color:C.t3, fontStyle:"italic", margin:0 }}>Click "Generate Summary" to produce an AI-powered diagnostic overview of school performance with intervention recommendations.</p>}
      </div>
    </div>
  );
}