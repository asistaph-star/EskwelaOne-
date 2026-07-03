import React from 'react';
import { C } from '../constants/tokens';

export function StubScreen({ icon: Icon, label, desc }: { icon: React.ElementType; label: string; desc: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: C.m50, padding: 32, textAlign: "center" }}>
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "40px 32px", maxWidth: 400, width: "100%", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: 36, background: C.m100, border: `2px solid ${C.m700}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.m700, boxShadow: "0 4px 12px rgba(139,30,30,0.1)" }}>
          <Icon size={32} />
        </div>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 6 }}>{label}</h3>
          <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>{desc}</p>
        </div>
        <div style={{ marginTop: 8, padding: "8px 16px", background: C.m100, color: C.m700, borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid rgba(139,30,30,0.1)` }}>
          Feature Coming Soon
        </div>
      </div>
    </div>
  );
}