const fs = require('fs');

let hub = fs.readFileSync('src/app/teacher/classroom/ClassroomHub.tsx', 'utf8');
hub = hub.replace(/\r\n/g, '\n');

// 1. Add states
const stateTarget = `  const [profileStudent, setProfileStudent] = useState<typeof STUDENTS_GR8[0]|null>(null);`;
const stateAdd = `  const [profileStudent, setProfileStudent] = useState<typeof STUDENTS_GR8[0]|null>(null);
  const [students, setStudents] = useState<typeof STUDENTS_GR8>(() => {
    try {
      const saved = localStorage.getItem('hub_students');
      if (saved) return JSON.parse(saved);
    } catch(e){}
    return STUDENTS_GR8;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ lrn: '', surname: '', first: '' });

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!newStudent.lrn || !newStudent.surname || !newStudent.first) return;
    const added = [...students, {
      id: "s" + Date.now(),
      lrn: newStudent.lrn,
      surname: newStudent.surname,
      first: newStudent.first,
      avg: "—",
      att: "Good Standing",
      status: "—",
      gender: "unspecified"
    }];
    setStudents(added);
    localStorage.setItem('hub_students', JSON.stringify(added));
    setShowAddModal(false);
    setNewStudent({ lrn: '', surname: '', first: '' });
  };`;

hub = hub.replace(stateTarget, stateAdd);

// 2. Change the add student button
const btnTarget = `<button style={{ fontSize:10, fontWeight:600, color:C.m900, background:C.gold, border:"none", borderRadius:4, padding:"4px 10px", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>+ Add Student</button>`;
const btnAdd = `<button onClick={()=>setShowAddModal(true)} style={{ fontSize:10, fontWeight:600, color:C.m900, background:C.gold, border:"none", borderRadius:4, padding:"4px 10px", cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>+ Add Student</button>`;
hub = hub.replace(btnTarget, btnAdd);

// 3. Replace STUDENTS_GR8.map with students.map
hub = hub.replace(/\{STUDENTS_GR8\.map/g, '{students.map');

// 4. Pass students to AttendanceHub
hub = hub.replace(/<AttendanceHub students=\{STUDENTS_GR8\} \/>/g, '<AttendanceHub students={students} />');

// 5. Add Modal before the closing div
const modalStr = `
      {/* ── Add Student Modal ── */}
      {showAddModal && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(15,8,8,0.6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:400, background:"#fff", borderRadius:8, padding:24, boxShadow:"0 20px 60px rgba(74,10,16,0.4)" }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.t1, marginBottom:16, fontFamily:"'Fraunces', serif" }}>Add New Student</div>
            <form onSubmit={handleAddStudent} style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:C.t2 }}>LRN (Learner Reference Number)</label>
                <input value={newStudent.lrn} onChange={e=>setNewStudent({...newStudent, lrn:e.target.value})} style={{ width:"100%", padding:"8px 12px", borderRadius:4, border:\`1px solid \${C.borderMed}\`, marginTop:4, outline:"none", fontSize:12 }} required />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:C.t2 }}>First Name</label>
                  <input value={newStudent.first} onChange={e=>setNewStudent({...newStudent, first:e.target.value})} style={{ width:"100%", padding:"8px 12px", borderRadius:4, border:\`1px solid \${C.borderMed}\`, marginTop:4, outline:"none", fontSize:12 }} required />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:C.t2 }}>Surname</label>
                  <input value={newStudent.surname} onChange={e=>setNewStudent({...newStudent, surname:e.target.value})} style={{ width:"100%", padding:"8px 12px", borderRadius:4, border:\`1px solid \${C.borderMed}\`, marginTop:4, outline:"none", fontSize:12 }} required />
                </div>
              </div>
              <div style={{ display:"flex", gap:12, marginTop:12, justifyContent:"flex-end" }}>
                <button type="button" onClick={()=>setShowAddModal(false)} style={{ padding:"8px 16px", borderRadius:4, border:\`1px solid \${C.borderMed}\`, background:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>Cancel</button>
                <button type="submit" style={{ padding:"8px 16px", borderRadius:4, border:"none", background:C.m700, color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>Save Student</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}`;

hub = hub.replace(/    <\/div>\n  \);\n}$/, modalStr);

fs.writeFileSync('src/app/teacher/classroom/ClassroomHub.tsx', hub);
console.log("ClassroomHub updated for Add Student feature.");
