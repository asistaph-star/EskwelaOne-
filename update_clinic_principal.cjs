const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'principal', 'welfare', 'PWelfare.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "import { Stamp } from '../../shared/components/Stamp';",
  "import { Stamp } from '../../shared/components/Stamp';\nimport { useAppContext } from '../../shared/AppContext';"
);

content = content.replace(
  "export function PWelfare() {",
  "export function PWelfare() {\n  const { clinicReferrals, resolveClinicReferral } = useAppContext();"
);

content = content.replace(
  "<span style={{ fontSize:12, fontFamily:\"'JetBrains Mono',monospace\", fontWeight:700, color:C.teal }}>6 today · 18 this week</span>",
  "<span style={{ fontSize:12, fontFamily:\"'JetBrains Mono',monospace\", fontWeight:700, color:C.teal }}>{clinicReferrals.length} referrals</span>"
);

content = content.replace(
  `<thead><PTableHeader cols={["Student","Date","Reason","Returned"]} /></thead>`,
  `<thead><PTableHeader cols={["Student","Referred By","Date","Reason","Status","Action"]} /></thead>`
);

const oldTableBody = `            <tbody>
              {[["Reyes, Carlo J.","Jun 10 9:14","Headache","Yes"],["Mendoza, Lea G.","Jun 10 10:02","Stomach ache","No"],["Santos, Juan M.","Jun 9 2:30","Cuts (PE)","Yes"],["Torres, Bea A.","Jun 8 11:20","Fever","No"]].map(([n,d,r,ret],i)=>(
                <tr key={n} style={{ borderBottom:i<3?\`0.5px solid \${C.border}\`:"none" }}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{n}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{d}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t2 }}>{r}</td>
                  <td style={{ padding:"9px 14px" }}><Stamp label={ret} color={ret==="Yes"?C.green:C.red} bg={ret==="Yes"?C.greenBg:C.redBg} /></td>
                </tr>
              ))}
            </tbody>`;

const newTableBody = `            <tbody>
              {clinicReferrals.map((r,i)=>(
                <tr key={r.id} style={{ borderBottom:i<clinicReferrals.length-1?\`0.5px solid \${C.border}\`:"none" }}>
                  <td style={{ padding:"9px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{r.studentName}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t3 }}>{r.teacherName}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{r.timestamp}</td>
                  <td style={{ padding:"9px 14px", fontSize:10, color:C.t2 }}>{r.reason}</td>
                  <td style={{ padding:"9px 14px" }}><Stamp label={r.status} color={r.status==="Acknowledged"?C.green:C.amber} bg={r.status==="Acknowledged"?C.greenBg:C.amberBg} /></td>
                  <td style={{ padding:"9px 14px" }}>
                    {r.status === "Pending" && (
                      <button onClick={()=>resolveClinicReferral(r.id)} style={{ fontSize:10, fontWeight:700, background:C.m700, color:"#fff", border:"none", borderRadius:3, padding:"4px 8px", cursor:"pointer" }}>Resolve</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>`;

content = content.replace(oldTableBody, newTableBody);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done clinic principal update!');
