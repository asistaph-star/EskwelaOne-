const fs = require('fs');
const path = require('path');

let chPath = path.join(__dirname, 'src', 'app', 'teacher', 'classroom', 'ClassroomHub.tsx');
let chContent = fs.readFileSync(chPath, 'utf8');

chContent = chContent.replace(
  "import { StudentReportCard } from '../../student/components/StudentReportCard';",
  "import { StudentReportCard } from '../../student/components/StudentReportCard';\nimport { useAppContext } from '../../shared/AppContext';"
);

chContent = chContent.replace(
  "  const [profileStudent, setProfileStudent] = useState<typeof activeStudents[0]|null>(null);",
  "  const [profileStudent, setProfileStudent] = useState<typeof activeStudents[0]|null>(null);\n  const { addBehaviorLog } = useAppContext();\n  const [behaviorStudent, setBehaviorStudent] = useState<typeof activeStudents[0]|null>(null);\n  const [behaviorType, setBehaviorType] = useState('Misconduct');\n  const [behaviorNote, setBehaviorNote] = useState('');\n  const submitBehavior = () => { if(behaviorStudent && behaviorNote) { addBehaviorLog({ id: 'log-'+Date.now(), studentName: behaviorStudent.first + ' ' + behaviorStudent.surname, section: 'Grade ' + cls.grade + ' - ' + cls.section, type: behaviorType, date: 'Today', status: 'Pending', note: behaviorNote }); setBehaviorStudent(null); setBehaviorNote(''); } };"
);

const oldActionCol = `                    <td style={{ padding:"10px 14px", display:"flex", gap:5 }}>
                      <button onClick={()=>onShowGradeCard?.({name:\`\${s.surname}, \${s.first}\`,section:cls.section,grade:cls.grade})} style={{ fontSize:10, color:C.m700, background:C.m100, border:"none", borderRadius:4, padding:"4px 8px", cursor:"pointer" }}>Grades</button>
                      <button onClick={()=>setProfileStudent(s)} style={{ fontSize:10, color:C.t2, background:C.paper, border:\`1px solid \${C.border}\`, borderRadius:4, padding:"4px 8px", cursor:"pointer" }}>Profile</button>
                    </td>`;

const newActionCol = `                    <td style={{ padding:"10px 14px", display:"flex", gap:5 }}>
                      <button onClick={()=>onShowGradeCard?.({name:\`\${s.surname}, \${s.first}\`,section:cls.section,grade:cls.grade})} style={{ fontSize:10, color:C.m700, background:C.m100, border:"none", borderRadius:4, padding:"4px 8px", cursor:"pointer" }}>Grades</button>
                      <button onClick={()=>setProfileStudent(s)} style={{ fontSize:10, color:C.t2, background:C.paper, border:\`1px solid \${C.border}\`, borderRadius:4, padding:"4px 8px", cursor:"pointer" }}>Profile</button>
                      <button onClick={()=>setBehaviorStudent(s)} style={{ fontSize:10, color:C.amber, background:C.amberBg, border:"none", borderRadius:4, padding:"4px 8px", cursor:"pointer" }}>Log</button>
                    </td>`;
chContent = chContent.replace(oldActionCol, newActionCol);

const behaviorModal = `      {behaviorStudent && (
        <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.4)" }}>
          <div style={{ background:"#fff", width:400, borderRadius:8, padding:24, boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin:"0 0 16px 0", fontSize:16, color:C.t1 }}>Log Behavior Incident</h3>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.t2, marginBottom:4 }}>Student</label>
              <div style={{ fontSize:14, fontWeight:700, color:C.t1 }}>{behaviorStudent.first} {behaviorStudent.surname}</div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.t2, marginBottom:4 }}>Incident Type</label>
              <select value={behaviorType} onChange={e=>setBehaviorType(e.target.value)} style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px", borderRadius:4, border:\`1px solid \${C.borderMed}\`, fontSize:12 }}>
                <option>Misconduct</option>
                <option>Disruption</option>
                <option>Tardiness</option>
                <option>Truancy</option>
                <option>Other</option>
              </select>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.t2, marginBottom:4 }}>Details</label>
              <textarea value={behaviorNote} onChange={e=>setBehaviorNote(e.target.value)} rows={3} style={{ width:"100%", boxSizing:"border-box", padding:"8px 12px", borderRadius:4, border:\`1px solid \${C.borderMed}\`, resize:"none" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={()=>setBehaviorStudent(null)} style={{ padding:"8px 16px", borderRadius:4, border:\`1px solid \${C.borderMed}\`, background:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>Cancel</button>
              <button onClick={submitBehavior} style={{ padding:"8px 16px", borderRadius:4, border:"none", background:C.amber, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>Log Incident</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

chContent = chContent.replace(
`    </div>
  );
}`, behaviorModal);

fs.writeFileSync(chPath, chContent, 'utf8');
console.log('Done behavior teacher update');
