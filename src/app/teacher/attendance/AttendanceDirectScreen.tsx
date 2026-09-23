import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { AttendanceHub } from './AttendanceHub';
import { ChevronDown, Loader2, Users } from 'lucide-react';
import { useMyClasses } from '../shared/useMyClasses';
import { EmptyState } from '../../shared/components/EmptyState';

export function AttendanceDirectScreen() {
  const { myClasses: classes, isLoading } = useMyClasses();
  const [activeClassId, setActiveClassId] = useState<string>('');

  useEffect(() => {
    if (classes && classes.length > 0 && !activeClassId) {
      setActiveClassId(classes[0].id);
    }
  }, [classes, activeClassId]);

  if (isLoading) {
    return <div style={{ padding: 20, color: C.t3, display:"flex", alignItems:"center", gap: 8 }}><Loader2 className="animate-spin" size={16}/> Loading classes...</div>;
  }
  if (!classes || classes.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <EmptyState
          icon={Users}
          title="No Classes Assigned"
          description="You don't have any sections assigned for this academic year yet."
          guidance="Once an administrator assigns you to a section, your attendance records will appear here."
        />
      </div>
    );
  }

  const activeClass = classes.find(c => c.id === activeClassId) || classes[0];

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background: "transparent" }}>
      {/* Section selector header */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.borderMed}`, padding:"9px 18px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <span style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:"0.09em" }}>Section</span>
        <div style={{ position:"relative" }}>
          <select 
            value={activeClassId} 
            onChange={e => setActiveClassId(e.target.value)}
            style={{ border:`1px solid ${C.borderMed}`, borderRadius:4, padding:"5px 26px 5px 9px", fontSize:12, color:C.t1, background:"#fff", outline:"none", appearance:"none", cursor:"pointer" }}>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                Grade {c.grade} {c.section}
              </option>
            ))}
          </select>
          <ChevronDown size={11} style={{ position:"absolute", right:7, top:"50%", transform:"translateY(-50%)", color:C.t3, pointerEvents:"none" }} />
        </div>
        <div style={{ width:1, height:22, background:C.border }} />
        <span style={{ fontSize:11, color:C.t3 }}>
          {activeClass.students} students · {activeClass.subject}
        </span>
      </div>
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
        {activeClassId && <AttendanceHub key={activeClassId} classId={activeClassId} />}
      </div>
    </div>
  );
}