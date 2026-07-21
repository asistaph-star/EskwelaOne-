import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { HeartHandshake, CheckCircle, XCircle, Clock, Calendar, Plus, Mail } from 'lucide-react';
import type { Appointment } from '../../shared/AppContext';

export function GCounselingScreen() {
  const { appointments, updateAppointment } = useAppContext();
  
  // Filtering for guidance counseling type sessions (using existing mock data for now)
  const counselingAppts = appointments; // In a real app we might filter by type/direction
  
  const pending = counselingAppts.filter(a => a.status === "Pending");
  const confirmed = counselingAppts.filter(a => a.status === "Confirmed");

  function handleStatus(id: string, status: "Confirmed" | "Declined" | "Completed") {
    updateAppointment(id, status);
  }

  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Counseling Sessions</h1>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Manage appointments for student counseling and parent consultations.</div>
          </div>
          <button style={{
            background: C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6,
            fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
          }}>
            <Plus size={14} /> Schedule Session
          </button>
        </div>

        {/* 2 Column Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          
          {/* Pending Requests */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} color="#f59e0b" /> Pending Requests
            </div>
            
            {pending.length === 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
                <CheckCircle size={32} color={C.t3} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: C.t2 }}>No pending session requests.</div>
              </div>
            ) : (
              pending.map(appt => (
                <div key={appt.id} style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{appt.studentName}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{appt.date} • {appt.time}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "#fef3c7", padding: "4px 10px", borderRadius: 12 }}>Pending</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.t2, background: C.paper, padding: 12, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <strong>Purpose:</strong> {appt.purpose}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <button onClick={() => alert(`Drafting email to parent of ${appt.studentName}...`)} style={{ flex: 1, padding: "8px", background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Mail size={14} /> Email Parent
                    </button>
                    <button onClick={() => handleStatus(appt.id, "Confirmed")} style={{ flex: 1, padding: "8px", background: C.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <CheckCircle size={14} /> Accept
                    </button>
                    <button onClick={() => handleStatus(appt.id, "Declined")} style={{ flex: 1, padding: "8px", background: "#fff", color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <XCircle size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Confirmed Sessions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={16} color={C.blue} /> Scheduled Sessions
            </div>
            
            {confirmed.length === 0 ? (
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
                <Calendar size={32} color={C.t3} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: C.t2 }}>No upcoming sessions.</div>
              </div>
            ) : (
              confirmed.map(appt => (
                <div key={appt.id} style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{appt.studentName}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 2, color: C.blue, fontWeight: 600 }}>{appt.date} • {appt.time}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.blue, background: C.blueBg, padding: "4px 10px", borderRadius: 12 }}>Confirmed</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.t2 }}>
                    <strong>Purpose:</strong> {appt.purpose}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <button onClick={() => alert(`Drafting email to parent of ${appt.studentName}...`)} style={{ flex: 1, padding: "8px", background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Mail size={14} /> Email Parent
                    </button>
                    <button onClick={() => handleStatus(appt.id, "Completed")} style={{ flex: 1, padding: "8px", background: "transparent", color: C.m700, border: `1px solid ${C.m700}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Mark as Completed
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
