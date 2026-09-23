import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { X, CheckCircle, Clock } from 'lucide-react';
import { useAppContext } from '../../shared/AppContext';
import { Stamp } from '../../shared/components/Stamp';

export function AssignmentReviewModal({ assignmentId, classStudents, onClose }: { assignmentId: string, classStudents: any[], onClose: () => void }) {
  const { assignments, assignmentSubmissions, updateAssignmentSubmission, currentUser } = useAppContext();
  const assignment = assignments.find(a => a.id === assignmentId);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [gradeInput, setGradeInput] = useState<string>("");

  if (!assignment) return null;

  // Logical left join
  const rosterData = classStudents.map(student => {
    const sub = assignmentSubmissions.find(s => s.assignmentId === assignmentId && s.studentId === student.id);
    return {
      student,
      submission: sub,
      status: sub ? sub.status : "Not Submitted",
      grade: sub?.grade,
      date: sub?.submittedAt
    };
  });

  const handleGradeSubmit = async (subId: string, studentId: string) => {
    const num = parseFloat(gradeInput);
    if (isNaN(num) || num < 0 || num > 100) {
      alert("Invalid grade. Must be between 0 and 100.");
      return;
    }
    if (subId) {
      await updateAssignmentSubmission(subId, { grade: num, status: "Graded" });
    } else {
      alert("Cannot grade a non-existent submission in this prototype. Student must submit first.");
    }
    setEditingId(null);
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:16 }}>
      <div className="w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto" style={{ background:"#fff", borderRadius:8, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.borderMed}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:C.m50 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Review Submissions</div>
            <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>{assignment.title}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.t2 }}><X size={20}/></button>
        </div>
        
        <div style={{ padding: 20 }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:C.paper, borderBottom:`1px solid ${C.borderMed}` }}>
                <th style={{ textAlign:"left", padding:"9px 14px", fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Student</th>
                <th style={{ textAlign:"left", padding:"9px 14px", fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Status</th>
                <th style={{ textAlign:"right", padding:"9px 14px", fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {rosterData.map((row, i) => (
                <tr key={row.student.id} style={{ borderBottom:`0.5px solid ${C.border}`, background:i%2===0?"#fff":C.paper }}>
                  <td style={{ padding:"10px 14px", fontSize:12, fontWeight:600, color:C.t1 }}>{row.student.surname}, {row.student.first}</td>
                  <td style={{ padding:"10px 14px" }}>
                    <Stamp label={row.status} color={row.status==="Graded"?C.green:row.status==="Submitted"?C.blue:C.t3} bg={row.status==="Graded"?C.greenBg:row.status==="Submitted"?C.blueBg:C.m100} />
                  </td>
                  <td style={{ padding:"10px 14px", textAlign:"right" }}>
                    {editingId === row.student.id ? (
                      <div style={{ display:"flex", alignItems:"center", gap:4, justifyContent:"flex-end" }}>
                        <input autoFocus value={gradeInput} onChange={e=>setGradeInput(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter")handleGradeSubmit(row.submission?.id||"", row.student.id); if(e.key==="Escape")setEditingId(null);}}
                          style={{ width:50, padding:"4px 8px", fontSize:12, borderRadius:4, border:`1px solid ${C.borderMed}`, textAlign:"center" }} />
                        <button onClick={()=>handleGradeSubmit(row.submission?.id||"", row.student.id)} style={{ padding:"4px", background:C.m700, color:"#fff", border:"none", borderRadius:4, cursor:"pointer" }}><CheckCircle size={14}/></button>
                      </div>
                    ) : (
                      <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"flex-end" }}>
                        <span style={{ fontSize:13, fontWeight:700, color:row.grade ? C.m700 : C.t3 }}>{row.grade ?? "-"}</span>
                        {row.submission && (
                          <button onClick={()=>{setEditingId(row.student.id); setGradeInput(row.grade?.toString()||"");}} 
                            style={{ fontSize:10, padding:"4px 8px", borderRadius:4, border:`1px solid ${C.border}`, background:"#fff", cursor:"pointer" }}>Edit</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
