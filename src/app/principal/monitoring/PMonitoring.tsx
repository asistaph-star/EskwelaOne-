import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { C } from '../../shared/constants/tokens';
import { PTableHeader } from '../shared/PTableHeader';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { P_WELFARE } from '../../shared/constants/seedData';
import { useAppContext } from '../../shared/AppContext';
import { Stamp } from '../../shared/components/Stamp';
import { Users, LogOut, Clock, School } from 'lucide-react';
import { useGateAttendanceSSE } from '../../shared/hooks/useGateAttendanceSSE';
import { facultyAttendanceApi, FacultyAttendanceItem } from '../../../api/facultyAttendance.api';

export function PMonitoring() {
  const [chartView, setChartView] = useState("Weekly");
  const [feedMode, setFeedMode] = useState<'student' | 'faculty'>('student');
  const [facultyList, setFacultyList] = useState<FacultyAttendanceItem[]>([]);
  const { gateAttendance, invalidScans } = useAppContext();

  const fetchFacultyAttendance = useCallback(() => {
    facultyAttendanceApi.getList({ limit: 100 })
      .then(res => {
        const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setFacultyList(items);
      })
      .catch(err => {
        console.error('Failed to load faculty attendance for monitoring:', err);
        setFacultyList([]);
      });
  }, []);

  useEffect(() => {
    fetchFacultyAttendance();
  }, [fetchFacultyAttendance]);

  const sseStatus = useGateAttendanceSSE(fetchFacultyAttendance);

  // Transform flat daily records into discrete chronological events
  const feedEvents = useMemo(() => {
    const events: { id: string, studentName: string, direction: 'IN' | 'OUT' | 'INVALID', timestamp: Date, metadata?: string }[] = [];
    
    (gateAttendance || []).forEach(record => {
      if (record.timeIn) {
        events.push({
          id: `${record.id}-in`,
          studentName: record.studentName,
          direction: 'IN',
          timestamp: new Date(record.timeIn)
        });
      }
      if (record.timeOut) {
        events.push({
          id: `${record.id}-out`,
          studentName: record.studentName,
          direction: 'OUT',
          timestamp: new Date(record.timeOut)
        });
      }
    });

    invalidScans?.forEach(scan => {
      events.push({
        id: `invalid-${scan.time}-${scan.barcode}`,
        studentName: 'Unknown',
        direction: 'INVALID',
        timestamp: new Date(scan.time),
        metadata: scan.barcode
      });
    });

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [gateAttendance, invalidScans]);

  // Transform authoritative FacultyAttendance rows into chronological events (newest first)
  const facultyFeedEvents = useMemo(() => {
    const events: {
      id: string;
      name: string;
      employeeId: string;
      department: string;
      position: string;
      direction: 'IN' | 'OUT';
      timestamp: Date;
      captureSource: string | null;
    }[] = [];

    (facultyList || []).forEach(item => {
      if (item.timeIn) {
        events.push({
          id: `${item.teacherId}-in`,
          name: item.name,
          employeeId: item.employeeId,
          department: item.department || 'Faculty',
          position: item.position || 'Teacher',
          direction: 'IN',
          timestamp: new Date(item.timeIn),
          captureSource: item.captureSource,
        });
      }
      if (item.timeOut) {
        events.push({
          id: `${item.teacherId}-out`,
          name: item.name,
          employeeId: item.employeeId,
          department: item.department || 'Faculty',
          position: item.position || 'Teacher',
          direction: 'OUT',
          timestamp: new Date(item.timeOut),
          captureSource: item.captureSource,
        });
      }
    });

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [facultyList]);

  return (
    <div style={{ flex:1, minHeight: 0, overflowY:"auto", background: "transparent", padding:24 }}>
      {/* Redesigned Gate Cards Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
        {[
          { v: gateAttendance.length.toString(), l: "Inside Campus", color: C.green, bg: C.greenBg, icon: Users, desc: "Live student presence" },
          { v: "23", l: "Already Left", color: C.teal, bg: C.tealBg, icon: LogOut, desc: "Checked out of gate" },
          { v: gateAttendance.filter(g => g.time > "07:30 AM").length.toString(), l: "Late Today", color: C.amber, bg: C.amberBg, icon: Clock, desc: "Arrived after 7:30 AM" }
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
                { section: "10 Pilot", rate: 98.5 }, { section: "10 Einstein", rate: 96.1 }, { section: "9 Newton", rate: 89.2 }, { section: "8 Rizal", rate: 92.4 }, { section: "7 Makulay", rate: 93.1 }
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
        {/* Live Gate & Presence Feed */}
        <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, overflow:"hidden" }}>
          <div style={{ background:C.m800, padding:"10px 16px", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <div style={{
              width:7, height:7, borderRadius:10,
              background: sseStatus === 'live' ? C.green : C.amber,
              boxShadow: sseStatus === 'live' ? `0 0 0 3px ${C.greenBg}` : `0 0 0 3px ${C.amberBg}`
            }}/>
            <span style={{ color:"#fff", fontSize:12, fontWeight:700, fontFamily:"'Fraunces',serif" }}>Live Gate & Presence Feed</span>
            
            {/* Segmented Control */}
            <div style={{ display:"inline-flex", background:"rgba(255,255,255,0.15)", borderRadius:4, padding:2, marginLeft:12 }}>
              <button
                type="button"
                onClick={() => setFeedMode('student')}
                style={{
                  fontSize:10, fontWeight:feedMode === 'student' ? 700 : 500,
                  color:feedMode === 'student' ? C.m800 : '#fff',
                  background:feedMode === 'student' ? '#fff' : 'transparent',
                  border:'none', borderRadius:3, padding:'3px 9px', cursor:'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Students ({feedEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setFeedMode('faculty')}
                style={{
                  fontSize:10, fontWeight:feedMode === 'faculty' ? 700 : 500,
                  color:feedMode === 'faculty' ? C.m800 : '#fff',
                  background:feedMode === 'faculty' ? '#fff' : 'transparent',
                  border:'none', borderRadius:3, padding:'3px 9px', cursor:'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Faculty ({facultyFeedEvents.length})
              </button>
            </div>

            <span style={{ marginLeft:'auto', fontSize:9, color: sseStatus === 'live' ? C.green : C.amber, fontWeight:600 }}>
              {sseStatus === 'live' ? 'LIVE UPDATES' : 'RECONNECTING...'}
            </span>
          </div>

          {feedMode === 'student' ? (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><PTableHeader cols={["Student","Grade & Section","Time","Direction"]} /></thead>
              <tbody>
                {feedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding:"24px 14px", textAlign:"center", fontSize:11, color:C.t3 }}>
                      No student gate scans recorded today.
                    </td>
                  </tr>
                ) : (
                  feedEvents.map((ev) => (
                    <tr key={ev.id} style={{ borderBottom:`0.5px solid ${C.border}` }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                      <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color: ev.direction === 'INVALID' ? C.t3 : C.t1 }}>
                        {ev.studentName}
                      </td>
                      <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>
                        {ev.direction === 'INVALID' ? `Scanned: ${ev.metadata}` : 'Grade 10 - Rizal'}
                      </td>
                      <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>
                        {ev.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding:"9px 14px" }}>
                        <div style={{ display:"flex", gap:5 }}>
                          {ev.direction === 'INVALID' ? (
                            <Stamp label="Invalid" color={C.red} bg={C.redBg} />
                          ) : ev.direction === 'OUT' ? (
                            <Stamp label="Out" color={C.blue} bg={C.blueBg} />
                          ) : (
                            <Stamp label="In" color={C.green} bg={C.greenBg} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><PTableHeader cols={["Teacher Name","Department & ID","Time","Direction"]} /></thead>
              <tbody>
                {facultyFeedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding:"24px 14px", textAlign:"center", fontSize:11, color:C.t3 }}>
                      No faculty gate scans recorded today.
                    </td>
                  </tr>
                ) : (
                  facultyFeedEvents.map((ev) => (
                    <tr key={ev.id} style={{ borderBottom:`0.5px solid ${C.border}` }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                      <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>
                        {ev.name}
                      </td>
                      <td style={{ padding:"9px 14px", fontSize:11, color:C.t2 }}>
                        {ev.department} • <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10 }}>{ev.employeeId}</span>
                      </td>
                      <td style={{ padding:"9px 14px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>
                        {ev.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding:"9px 14px" }}>
                        <div style={{ display:"flex", gap:5 }}>
                          {ev.direction === 'OUT' ? (
                            <Stamp label="Out" color={C.blue} bg={C.blueBg} />
                          ) : (
                            <Stamp label="In" color={C.green} bg={C.greenBg} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
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