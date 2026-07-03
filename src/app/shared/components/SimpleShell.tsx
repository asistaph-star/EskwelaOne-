import React from 'react';
import { Role } from '../types';
import { C } from '../constants/tokens';
import { Stamp } from './Stamp';
export function SimpleShell({ role, onLogout }: { role:Role, onLogout:()=>void }) {
  const user = {
    Parent: { initials: "PA", name: "Parent Portal", sub: "Student academic progress monitoring" },
    Registrar: { initials: "RE", name: "Registrar Office", sub: "Learner Permanent Records (SF10) Management" }
  }[role as any] || { initials: "ST", name: "User", sub: "" };
  return (
    <div style={{ minHeight:"100vh", background:C.paper, fontFamily:"'Inter',sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:60, height:60, borderRadius:10, background:C.m700, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:20, fontWeight:800, color:"#fff" }}>{user.initials}</span>
      </div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:20, fontWeight:700, color:C.t1, fontFamily:"'Fraunces',serif" }}>Welcome, {user.name}</div>
        <div style={{ fontSize:13, color:C.t3, marginTop:4 }}>{user.sub}</div>
        <Stamp label={role} color="#fff" bg={C.m700} />
      </div>
      <div style={{ fontSize:12, color:C.t3, textAlign:"center", maxWidth:320 }}>
        The {role} dashboard experience is available in the full build. You are currently viewing the Teacher-focused design prototype.
      </div>
      <button onClick={onLogout} style={{ marginTop:8, padding:"9px 24px", background:C.m700, color:"#fff", borderRadius:4, border:"none", cursor:"pointer", fontSize:13, fontWeight:600 }}>
        Sign out
      </button>
    </div>
  );
}

/* ─── Report Card Data ──────────────────────────────────────── */

