const fs = require('fs');
const path = require('path');

// 1. AppContext.tsx
let acPath = path.join(__dirname, 'src', 'app', 'shared', 'AppContext.tsx');
let acContent = fs.readFileSync(acPath, 'utf8');

acContent = acContent.replace(
  `export type BehaviorLog = { id: string; date: string; teacher: string; note: string };`,
  `export type BehaviorLog = { id: string; studentName: string; section: string; type: string; date: string; status: string; note: string };`
);

const oldSeed = `const SEED_BEHAVIOR_LOGS: BehaviorLog[] = [
  { id: "log-1", date: "June 25, 2026", teacher: "Ana R. Soriano", note: "Using mobile phone during lecture despite multiple warnings." },
  { id: "log-2", date: "July 5, 2026", teacher: "Ana R. Soriano", note: "Consistently disruptive during group activities." }
];`;

const newSeed = `const SEED_BEHAVIOR_LOGS: BehaviorLog[] = [
  { id: "log-1", studentName: "Juan Dela Cruz", section: "Grade 10 - Rizal", type: "Misconduct", date: "Today", status: "Under investigation", note: "Using mobile phone during lecture despite multiple warnings." },
  { id: "log-2", studentName: "Juan Dela Cruz", section: "Grade 10 - Rizal", type: "Disruption", date: "Yesterday", status: "Parent notified", note: "Consistently disruptive during group activities." }
];`;

acContent = acContent.replace(oldSeed, newSeed);
fs.writeFileSync(acPath, acContent, 'utf8');

// 2. PWelfare.tsx
let pwPath = path.join(__dirname, 'src', 'app', 'principal', 'welfare', 'PWelfare.tsx');
let pwContent = fs.readFileSync(pwPath, 'utf8');

// I already added useAppContext to PWelfare, let's extract behaviorLogs from it.
pwContent = pwContent.replace(
  `const { clinicReferrals, resolveClinicReferral } = useAppContext();`,
  `const { clinicReferrals, resolveClinicReferral, behaviorLogs } = useAppContext();`
);

const oldPwTable = `            <tbody>
              {[["Ocampo, Renz A.","10-Pilot","Misconduct","Jun 10","Under investigation"],["Reyes, Carlo J.","9-Einstein","Tardiness","Jun 9","Warning issued"],["Bautista, Ryan P.","10-Pilot","Disruption","Jun 8","Parent notified"],["Bondoc, Ramon Jr.","8-Rizal","Truancy","Jun 7","Counseling"]].map(([n,s,t,d,st],i)=>(
                <tr key={n} style={{ borderBottom:i<3?\`0.5px solid \${C.border}\`:"none" }}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{n}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t3 }}>{s}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t2 }}>{t}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{d}</td>
                  <td style={{ padding:"9px 14px" }}><Stamp label={st} color={C.amber} bg={C.amberBg} /></td>
                </tr>
              ))}
            </tbody>`;

const newPwTable = `            <tbody>
              {behaviorLogs.map((log,i)=>(
                <tr key={log.id} style={{ borderBottom:i<behaviorLogs.length-1?\`0.5px solid \${C.border}\`:"none" }}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{log.studentName}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t3 }}>{log.section}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t2 }}>{log.type}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{log.date}</td>
                  <td style={{ padding:"9px 14px" }}><Stamp label={log.status} color={C.amber} bg={C.amberBg} /></td>
                </tr>
              ))}
            </tbody>`;

pwContent = pwContent.replace(oldPwTable, newPwTable);
fs.writeFileSync(pwPath, pwContent, 'utf8');

console.log('Done behavior updates part 1');
