const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'student', 'StudentPortal.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  `const { gradesStatus } = useAppContext();`,
  `const { gradesStatus, behaviorLogs } = useAppContext();`
);

const oldBehaviorTab = `              {/* Achievements & honors list */}
              <div style={{ background: "#fff", border: \`1px solid \${C.borderMed}\`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: \`0.5px solid \${C.border}\`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Certificates & Honors Award Badges</div>`;

const newBehaviorTab = `              {/* Disciplinary Records */}
              <div style={{ background: "#fff", border: \`1px solid \${C.borderMed}\`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: \`0.5px solid \${C.border}\`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", display: "flex", justifyContent: "space-between" }}>
                  <span>Disciplinary & Incident Records</span>
                  <span style={{ fontSize:10, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{behaviorLogs.filter(b=>b.studentName==="Juan Dela Cruz").length} records</span>
                </div>
                {behaviorLogs.filter(b=>b.studentName==="Juan Dela Cruz").length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: C.t3 }}>No behavioral incidents logged. Keep up the good work!</div>
                ) : (
                  behaviorLogs.filter(b=>b.studentName==="Juan Dela Cruz").map((log, idx, arr) => (
                    <div key={log.id} style={{ padding: "12px 14px", borderBottom: idx < arr.length - 1 ? \`0.5px solid \${C.border}\` : "none", background: C.paper }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>{log.type}</div>
                        <span style={{ fontSize: 10, color: C.t3, fontFamily: "'JetBrains Mono',monospace" }}>{log.date}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.t2, marginBottom: 8 }}>{log.note}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: C.t3 }}>Logged by: {log.teacher || log.section}</span>
                        <Stamp label={log.status} color={log.status==="Resolved"?C.green:C.amber} bg={log.status==="Resolved"?C.greenBg:C.amberBg} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Achievements & honors list */}
              <div style={{ background: "#fff", border: \`1px solid \${C.borderMed}\`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: \`0.5px solid \${C.border}\`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Certificates & Honors Award Badges</div>`;

content = content.replace(oldBehaviorTab, newBehaviorTab);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done behavior student update!');
