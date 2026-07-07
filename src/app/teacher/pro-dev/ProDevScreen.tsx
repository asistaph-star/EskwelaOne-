import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, Upload, Award, Star, X } from 'lucide-react';
import { CERTS, SEMINARS } from '../../shared/constants/seedData';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';
import { levelColor } from '../../shared/utils/helpers';

export function ProDevScreen() {
  const [activeTab, setActiveTab] = useState<"certs"|"seminars"|"points">("certs");
  const [uploadModal, setUploadModal] = useState(false);
  const totalHours = CERTS.reduce((s,c)=>s+c.hours, 0);
  const totalPoints = CERTS.reduce((s,c)=>s+c.points, 0);

  return (
    <div style={{ flex:1, overflowY:"auto", padding:24, background:C.paper }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Professional Development</div>
          <div style={{ fontSize:12, color:C.t3, marginTop:3 }}>Training records, seminars, and promotion points tracking</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          <StatBox label="Total Certificates" value={CERTS.length}    sub="on record"           accent={C.m700} />
          <StatBox label="Training Hours"      value={totalHours}      sub="total logged"        accent={C.blue} />
          <StatBox label="Promotion Points"    value={totalPoints}     sub="accumulated"         accent={C.gold} />
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderRadius:"4px 4px 0 0", display:"flex", borderBottom:`2px solid ${C.m700}` }}>
        {[{id:"certs",label:"Certificate Vault",icon:Award},{id:"seminars",label:"Seminar Calendar",icon:Calendar},{id:"points",label:"Promotion Points",icon:Star}].map(t => {
          const Icon = t.icon;
          const act = activeTab===t.id;
          return (
            <button key={t.id} onClick={()=>setActiveTab(t.id as typeof activeTab)}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"12px 20px", background:act?C.m800:"transparent", border:"none", cursor:"pointer", color:act?"#fff":C.t2, fontSize:12, fontWeight:act?700:400, transition:"all 0.12s" }}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ background:"#fff", border:`1px solid ${C.borderMed}`, borderTop:"none", borderRadius:"0 0 4px 4px" }}>

        {/* Certificate Vault */}
        {activeTab==="certs" && (
          <div>
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:12, color:C.t3 }}>{CERTS.length} certificates on record · {totalHours} training hours logged</div>
              <button onClick={() => setUploadModal(true)} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:4, padding:"7px 12px", cursor:"pointer" }}>
                <Upload size={12} /> Upload Certificate
              </button>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:C.m50, borderBottom:`1px solid ${C.borderMed}` }}>
                  {["Certificate / Training Title","Level","Hours","Date Completed","Points","Action"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"9px 14px", fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CERTS.map((cert,i) => {
                  const lc = levelColor(cert.level);
                  return (
                    <tr key={i} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                      <td style={{ padding:"11px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{cert.title}</td>
                      <td style={{ padding:"11px 14px" }}>
                        <Stamp label={cert.level} color={lc.text} bg={lc.bg} />
                      </td>
                      <td style={{ padding:"11px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.t2 }}>{cert.hours}h</td>
                      <td style={{ padding:"11px 14px", fontSize:11, color:C.t2 }}>{cert.date}</td>
                      <td style={{ padding:"11px 14px", fontSize:13, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:C.gold }}>{cert.points}</td>
                      <td style={{ padding:"11px 14px" }}>
                        <button style={{ fontSize:10, color:C.m700, background:C.m100, border:"none", borderRadius:4, padding:"4px 8px", cursor:"pointer" }}>View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Seminar Calendar */}
        {activeTab==="seminars" && (
          <div>
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontSize:12, color:C.t3 }}>Upcoming DepEd seminars, division trainings, and LAC sessions</div>
              <button style={{ fontSize:11, fontWeight:600, color:C.m700, background:C.m100, border:`1px solid rgba(139,30,30,0.2)`, borderRadius:4, padding:"5px 10px", cursor:"pointer" }}>+ Add Event</button>
            </div>
            {SEMINARS.map((s,i) => {
              const lc = levelColor(s.level);
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", borderBottom:`0.5px solid ${C.border}` }}>
                  <div style={{ width:48, textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:C.m700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{s.date.split(" ")[0]}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:C.t1, fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>{s.date.split(" ")[1]}</div>
                  </div>
                  <div style={{ width:1, height:36, background:C.borderMed, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.t1, marginBottom:5 }}>{s.title}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <Stamp label={s.level} color={lc.text} bg={lc.bg} />
                      <Stamp label={s.status} color={s.status==="confirmed"?C.green:C.amber} bg={s.status==="confirmed"?C.greenBg:C.amberBg} />
                    </div>
                  </div>
                  <button style={{ fontSize:10, color:C.m700, background:C.m100, border:"none", borderRadius:4, padding:"5px 10px", cursor:"pointer" }}>Register</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Promotion Points Tracker */}
        {activeTab==="points" && (
          <div style={{ padding:20 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:10 }}>Points by Training Level</div>
                {[["National","#FF6B00","6"],["Regional","#1E3A8A","4"],["Division","#4C1D95","2"],["District","#0E6674","2"],["School","#8B1E1E","1.5"]].map(([l,c,p]) => (
                  <div key={l} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", marginBottom:4, background:C.paper, border:`0.5px solid ${C.border}`, borderRadius:4 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:c, flexShrink:0 }} />
                    <span style={{ fontSize:12, color:C.t1, flex:1 }}>{l} level</span>
                    <span style={{ fontSize:14, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:c }}>{p} pts</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:10 }}>Promotion Progress</div>
                <div style={{ background:C.m50, border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"16px 20px" }}>
                  <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:4 }}>Current Designation</div>
                  <div style={{ fontSize:16, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif", marginBottom:12 }}>Teacher I</div>
                  <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:4 }}>Accumulated Points</div>
                  <div style={{ fontSize:28, fontWeight:700, color:C.gold, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{totalPoints}</div>
                  <div style={{ marginTop:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:10, color:C.t3 }}>Target: 20 pts for Teacher II</span>
                      <span style={{ fontSize:10, color:C.m700, fontFamily:"'JetBrains Mono',monospace" }}>{Math.round(totalPoints/20*100)}%</span>
                    </div>
                    <div style={{ height:6, background:C.m100, borderRadius:3 }}>
                      <div style={{ height:"100%", width:`${Math.min(100,totalPoints/20*100)}%`, background:C.m700, borderRadius:3 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {uploadModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(15,8,8,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.paper, borderRadius: 8, width: "100%", maxWidth: 400, overflow: "hidden", boxShadow: "0 24px 60px rgba(74,10,16,0.3)" }}>
            <div style={{ background: C.m800, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'Fraunces',serif" }}>Upload Certificate</div>
              <button onClick={() => setUploadModal(false)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Training / Seminar Title</label>
                  <input type="text" placeholder="Enter title" style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Level</label>
                    <select style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box", background: "#fff" }}>
                      <option>School Level</option>
                      <option>Division</option>
                      <option>Regional</option>
                      <option>National</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Hours Completed</label>
                    <input type="number" placeholder="0" style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Upload File (PDF/Image)</label>
                  <div style={{ border: `1px dashed ${C.borderHeavy}`, background: C.m50, borderRadius: 4, padding: 20, textAlign: "center", cursor: "pointer" }}>
                    <Upload size={20} color={C.m700} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 11, color: C.t2, fontWeight: 600 }}>Click to browse or drag file here</div>
                  </div>
                </div>
                <button onClick={() => { setUploadModal(false); alert("Certificate uploaded successfully! Pending verification."); }} style={{ background: C.m700, color: "#fff", border: "none", padding: "10px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 700, marginTop: 10 }}>
                  Submit Certificate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
