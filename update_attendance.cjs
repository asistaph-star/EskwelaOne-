const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'teacher', 'attendance', 'AttendanceHub.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add useAppContext import
content = content.replace(
  "import { STUDENTS_GR8 } from '../../App';",
  "import { STUDENTS_GR8 } from '../../App';\nimport { useAppContext } from '../../shared/AppContext';"
);

content = content.replace(
  "export function AttendanceHub({ students }: { students: typeof STUDENTS_GR8 }) {",
  "export function AttendanceHub({ students }: { students: typeof STUDENTS_GR8 }) {\n  const { gateAttendance } = useAppContext();"
);

// 2. Map gateAttendance instead of QR_LOG
content = content.replace(
  "{QR_LOG.length} scans today",
  "{gateAttendance.length} scans today"
);

content = content.replace(
  "{QR_LOG.length} scan entries · June 10, 2025",
  "{gateAttendance.length} scan entries today"
);

const searchBlock = `              {QR_LOG.map((r,i)=>(
                <tr key={i} style={{ borderBottom:\`0.5px solid \${C.border}\`, background:i%2===0?"#fff":C.paper }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.t2, whiteSpace:"nowrap" }}>{r.time}</td>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{r.name}</td>
                  <td style={{ padding:"9px 14px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>{r.lrn}</td>
                  <td style={{ padding:"9px 14px" }}>
                    <Stamp label={r.type} color={r.type==="Tap in"?C.blue:C.t2} bg={r.type==="Tap in"?C.blueBg:C.ledger} />
                  </td>
                  <td style={{ padding:"9px 14px" }}>
                    <Stamp label={r.status} color={sColor(r.status)} bg={sBg(r.status)} />
                  </td>
                </tr>
              ))}`;

const replaceBlock = `              {gateAttendance.map((r,i)=>(
                <tr key={i} style={{ borderBottom:\`0.5px solid \${C.border}\`, background:i%2===0?"#fff":C.paper }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.m50;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=i%2===0?"#fff":C.paper;}}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:C.t2, whiteSpace:"nowrap" }}>{r.time}</td>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{r.studentName}</td>
                  <td style={{ padding:"9px 14px", fontSize:11, color:C.t3, fontFamily:"'JetBrains Mono',monospace" }}>-</td>
                  <td style={{ padding:"9px 14px" }}>
                    <Stamp label="Tap in" color={C.blue} bg={C.blueBg} />
                  </td>
                  <td style={{ padding:"9px 14px" }}>
                    <Stamp label="Present" color={C.green} bg={C.greenBg} />
                  </td>
                </tr>
              ))}`;

content = content.replace(searchBlock, replaceBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');
