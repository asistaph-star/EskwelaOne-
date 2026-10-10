import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { PTableHeader } from '../shared/PTableHeader';
import { Stamp } from '../../shared/components/Stamp';
import { Sparkles, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../api/client';

export interface AcademicAnalyticsResponse {
  schoolAverageByGradeLevel: {
    gradeLevel: number;
    average: number;
  }[];
  trendAverages: {
    gradeLevel: number;
    t1: number | null;
    t2: number | null;
    t3: number | null;
    trend: string;
  }[];
  lowestPerformingSubjects: {
    subjectName: string;
    gradeLevel: number;
    average: number;
  }[];
  passingVsFailingByGradeLevel: {
    gradeLevel: number;
    passing: number;
    failing: number;
    rate: number;
  }[];
  topSections: {
    sectionName: string;
    gradeLevel: number;
    average: number;
  }[];
  topPerformers: {
    studentId: string;
    studentName: string;
    sectionName: string;
    generalAverage: number;
  }[];
  gradeDistribution: {
    bucket: string;
    count: number;
  }[];
}

export function PAcademics() {
  const [data, setData] = useState<AcademicAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiClient.get('/admin/analytics/academics')
      .then((res: any) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: C.t3 }}>Loading academic analytics...</div>;
  }

  if (error || !data) {
    return <div style={{ padding: 40, textAlign: "center", color: C.red }}>Failed to load academic analytics. Please check your connection.</div>;
  }

  const {
    schoolAverageByGradeLevel,
    trendAverages,
    lowestPerformingSubjects,
    passingVsFailingByGradeLevel,
    topSections,
    topPerformers,
    gradeDistribution
  } = data;

  return (
    <div style={{ flex:1, minHeight: 0, overflowY:"auto", background: "transparent", padding:24 }}>
      
      {/* Grade Distribution Analytics */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14, padding: "16px 20px" }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:2 }}>Current Year Grade Distribution</div>
        <div style={{ fontSize:11, color:C.t3, marginBottom:16 }}>Distribution of term grades across all subjects.</div>
        
        <div style={{ height: 210, width: "100%" }}>
          {gradeDistribution.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.t3, fontSize: 12 }}>No grade data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RBarChart data={gradeDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="bucket" stroke={C.t3} fontSize={10} tickLine={false} />
                <YAxis stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ background: "#fff", border: `1px solid ${C.borderMed}`, fontSize: 11, borderRadius: 4 }}
                  labelStyle={{ fontWeight: "bold", color: C.t1 }}
                />
                <Bar name="Number of Grades" dataKey="count" fill={C.m700} radius={[2, 2, 0, 0]} maxBarSize={50} />
              </RBarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Grade averages */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14 }}>
        <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>School Average by Grade Level</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
          {schoolAverageByGradeLevel.length === 0 ? (
            <div style={{ gridColumn: "span 4", padding: "16px 20px", fontSize: 12, color: C.t3, textAlign: "center" }}>No grades submitted yet.</div>
          ) : schoolAverageByGradeLevel.map((g, i) => (
            <div key={g.gradeLevel} style={{ padding:"16px 20px", borderRight: i < schoolAverageByGradeLevel.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
              <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Grade {g.gradeLevel}</div>
              <div style={{ fontSize:32, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color: g.average >= 85 ? C.green : g.average >= 80 ? C.m700 : C.amber, lineHeight:1 }}>
                {g.average.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* T1 vs T2 vs T3 trend table */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14 }}>
        <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>School Performance Trends (T1 / T2 / T3)</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><PTableHeader cols={["Grade Level","T1 Average","T2 Average","T3 Average","Trend"]} /></thead>
          <tbody>
            {trendAverages.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", fontSize: 12, color: C.t3 }}>No trend data available.</td></tr>
            ) : trendAverages.map((t) => (
              <tr key={t.gradeLevel} style={{ borderBottom:`0.5px solid ${C.border}` }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                <td style={{ padding:"10px 16px", fontSize:12, fontWeight:600, color:C.t1 }}>Grade {t.gradeLevel}</td>
                <td style={{ padding:"10px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:C.t2 }}>{t.t1 || '-'}</td>
                <td style={{ padding:"10px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:C.t2 }}>{t.t2 || '-'}</td>
                <td style={{ padding:"10px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:C.t2 }}>{t.t3 || '-'}</td>
                <td style={{ padding:"10px 16px" }}><Stamp label={t.trend} color={t.trend.includes("↑") ? C.green : t.trend.includes("↓") ? C.red : C.t3} bg={t.trend.includes("↑") ? C.greenBg : t.trend.includes("↓") ? C.redBg : C.m100} /></td>
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
            {lowestPerformingSubjects.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", fontSize: 12, color: C.t3 }}>No subject data available.</td></tr>
            ) : lowestPerformingSubjects.map((s, i) => (
              <tr key={i} style={{ borderBottom: i < lowestPerformingSubjects.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                <td style={{ padding:"9px 16px", fontSize:12, fontWeight:600, color: s.average < 75 ? C.red : C.amber }}>{s.subjectName}</td>
                <td style={{ padding:"9px 16px", fontSize:11, color:C.t3 }}>Grade {s.gradeLevel}</td>
                <td style={{ padding:"9px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color: s.average < 75 ? C.red : C.amber }}>{s.average.toFixed(1)}</td>
                <td style={{ padding:"9px 16px", fontSize:11, color:C.t2 }}>
                  {s.average < 75 ? "🔴 Critical Remediation Required" : "🟠 Watchlist"}
                </td>
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
              {passingVsFailingByGradeLevel.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", fontSize: 12, color: C.t3 }}>No data available.</td></tr>
              ) : passingVsFailingByGradeLevel.map((p, i) => (
                <tr key={p.gradeLevel} style={{ borderBottom: i < passingVsFailingByGradeLevel.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                  <td style={{ padding:"9px 16px", fontSize:12, color:C.t1 }}>Grade {p.gradeLevel}</td>
                  <td style={{ padding:"9px 16px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.green, fontWeight:600 }}>{p.passing}</td>
                  <td style={{ padding:"9px 16px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.red, fontWeight:600 }}>{p.failing}</td>
                  <td style={{ padding:"9px 16px" }}><Stamp label={`${p.rate}%`} color={p.rate >= 85 ? C.green : C.amber} bg={p.rate >= 85 ? C.greenBg : C.amberBg} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Top sections */}
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Top Performing Sections</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><PTableHeader cols={["Section","Grade","Average"]} /></thead>
            <tbody>
              {topSections.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", fontSize: 12, color: C.t3 }}>No section data available.</td></tr>
              ) : topSections.map((s, i) => (
                <tr key={s.sectionName} style={{ borderBottom: i < topSections.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                  <td style={{ padding:"9px 16px", fontSize:12, fontWeight:600, color:C.t1 }}>{s.sectionName}</td>
                  <td style={{ padding:"9px 16px", fontSize:11, color:C.t3 }}>Grade {s.gradeLevel}</td>
                  <td style={{ padding:"9px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:C.green }}>{s.average.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 Performers (School-Wide) */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden", marginBottom:14 }}>
        <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Top Performers (School-Wide)</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><PTableHeader cols={["Rank","Student Name","Grade & Section","General Average"]} /></thead>
          <tbody>
            {topPerformers.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", fontSize: 12, color: C.t3 }}>No student performance data available.</td></tr>
            ) : topPerformers.map((p, i) => (
              <tr key={p.studentId} style={{ borderBottom: i < topPerformers.length - 1 ? `0.5px solid ${C.border}` : "none" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                <td style={{ padding:"9px 16px", fontSize:12, fontWeight:800, color:C.m700 }}>#{i + 1}</td>
                <td style={{ padding:"9px 16px", fontSize:12, fontWeight:700, color:C.t1 }}>{p.studentName}</td>
                <td style={{ padding:"9px 16px", fontSize:11, color:C.t3 }}>{p.sectionName}</td>
                <td style={{ padding:"9px 16px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:800, color:C.green }}>{p.generalAverage.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI Summary removed as per user instruction to not generate fake narratives */}
    </div>
  );
}