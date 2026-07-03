const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'teacher', 'clinic', 'ClinicVisitsScreen.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add useAppContext import
content = content.replace(
  "import { RC_SUBJECTS } from '../../shared/constants/seedData';",
  "import { RC_SUBJECTS } from '../../shared/constants/seedData';\nimport { useAppContext } from '../../shared/AppContext';\nimport { Plus } from 'lucide-react';"
);

// 2. Add state and logic
content = content.replace(
  "export function ClinicVisitsScreen() {",
  `export function ClinicVisitsScreen() {
  const { clinicReferrals, addClinicReferral } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [reason, setReason] = useState("");
  const submitReferral = () => {
    if(!studentName || !reason) return;
    addClinicReferral({
      id: "ref-" + Date.now(),
      studentName,
      teacherName: "Ana R. Soriano",
      reason,
      timestamp: "Just now",
      status: "Pending"
    });
    setShowModal(false);
    setStudentName("");
    setReason("");
  };`
);

// 3. Update filter
const oldFilter = `  const filtered = CLINIC_DATA.filter(r=>{
    const matchSec = section==="All sections" || r.section.includes(section.split(" ")[1]??section);
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    return matchSec && matchSearch;
  });`;

const newFilter = `  const filtered = clinicReferrals.filter(r=>{
    const matchSearch = !search || r.studentName.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });`;
content = content.replace(oldFilter, newFilter);

// 4. Update the Controls
content = content.replace(
  `<Stamp label="Read-only — clinic records are managed by the school nurse" color={C.teal} bg={C.tealBg} />`,
  `<Stamp label="Read-only — clinic records are managed by the school nurse" color={C.teal} bg={C.tealBg} />
          <button onClick={() => setShowModal(true)} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:700, color:"#fff", background:C.m700, border:"none", borderRadius:4, padding:"6px 12px", cursor:"pointer" }}>
            <Plus size={12}/> New Referral
          </button>`
);

// 5. Update Table Headers
content = content.replace(
  `{["Student","Section","Date & Time","Complaint / Reason","Action Taken","Nurse","Status","Excused"].map(h=>(`,
  `{["Student","Referred By","Date & Time","Reason","Status"].map(h=>(`
);

// 6. Update Table Body
const oldTableBody = `              {filtered.map((r,i)=>(
                <tr key={i} style={{ borderBottom:i===filtered.length-1?"none":\`0.5px solid \${C.borderMed}\`, background:i%2===0?"#fff":C.paper }}>
                  <td style={{ padding:"9px 12px", fontSize:12, fontWeight:600, color:C.t1 }}>{r.name}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t2 }}>{r.section}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{r.date}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t2 }}>{r.complaint}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t2 }}>{r.action}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t3 }}>{r.by}</td>
                  <td style={{ padding:"9px 12px" }}>
                    <Stamp label={r.status} color={statusColor(r.status)} bg={statusBg(r.status)} />
                  </td>
                  <td style={{ padding:"9px 12px" }}>
                    {r.excused ? <span style={{ fontSize:10, fontWeight:700, color:C.green }}>Yes</span> : <span style={{ fontSize:10, color:C.t3 }}>No</span>}
                  </td>
                </tr>
              ))}`;

const newTableBody = `              {filtered.map((r,i)=>(
                <tr key={r.id} style={{ borderBottom:i===filtered.length-1?"none":\`0.5px solid \${C.borderMed}\`, background:i%2===0?"#fff":C.paper }}>
                  <td style={{ padding:"9px 12px", fontSize:12, fontWeight:600, color:C.t1 }}>{r.studentName}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t3 }}>{r.teacherName}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, fontFamily:"'JetBrains Mono',monospace", color:C.t3 }}>{r.timestamp}</td>
                  <td style={{ padding:"9px 12px", fontSize:11, color:C.t2 }}>{r.reason}</td>
                  <td style={{ padding:"9px 12px" }}>
                    <Stamp label={r.status} color={r.status==="Acknowledged"?C.green:C.amber} bg={r.status==="Acknowledged"?C.greenBg:C.amberBg} />
                  </td>
                </tr>
              ))}`;
content = content.replace(oldTableBody, newTableBody);

// 7. Add Modal to the bottom
content = content.replace(
  `</div>
    </div>
  );
}`,
  `</div>
      {showModal && (
        <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.4)" }}>
          <div style={{ background:"#fff", width:400, borderRadius:8, padding:24, boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin:"0 0 16px 0", fontSize:16, color:C.t1 }}>New Clinic Referral</h3>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.t2, marginBottom:4 }}>Student Name</label>
              <input value={studentName} onChange={e=>setStudentName(e.target.value)} style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px", borderRadius:4, border:\`1px solid \${C.borderMed}\` }} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.t2, marginBottom:4 }}>Reason for Referral</label>
              <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px", borderRadius:4, border:\`1px solid \${C.borderMed}\`, resize:"none" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={()=>setShowModal(false)} style={{ padding:"8px 16px", borderRadius:4, border:\`1px solid \${C.borderMed}\`, background:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>Cancel</button>
              <button onClick={submitReferral} style={{ padding:"8px 16px", borderRadius:4, border:"none", background:C.m700, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>Submit Referral</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done clinic teacher update!');
