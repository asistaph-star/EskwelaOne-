import React from 'react';
import { C } from '../shared/constants/tokens';
import { ClinicStudent, ClinicVisit } from '../shared/types';
import { Stethoscope, Activity, Pill, User } from 'lucide-react';

export function PrintableClinicReport({ student, visits }: { student: ClinicStudent | null, visits: ClinicVisit[] }) {
  if (!student) return null;

  return (
    <div className="printable-clinic-report" style={{ display: 'none' }}>
      
      {/* HEADER / LETTERHEAD */}
      <div style={{ textAlign: "center", borderBottom: `4px solid ${C.m800}`, paddingBottom: 24, marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: C.m800, margin: "0 0 8px 0", letterSpacing: "0.02em" }}></h1>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t2, margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.1em" }}>School Clinic Department</h2>
        <p style={{ fontSize: 12, color: C.t3, margin: 0 }}>City of San Fernando, Pampanga</p>
        
        <div style={{ marginTop: 24, padding: "8px 0", borderTop: `1px solid ${C.m200}`, borderBottom: `1px solid ${C.m200}` }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: C.t1, margin: 0, textTransform: "uppercase", letterSpacing: "0.1em" }}>Medical Report / Clearance</h3>
        </div>
      </div>

      {/* PATIENT INFO BLOCK */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32, padding: 20, background: "#fafafa", border: `1px solid ${C.borderMed}`, borderRadius: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Patient Name</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>{student.name}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Grade & Section</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t2 }}>Grade {student.grade} - {student.section}</div>
        </div>
        
        <div style={{ gridColumn: "1 / -1", height: 1, background: C.borderMed, margin: "8px 0" }} />

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Blood Type</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>{student.bloodType}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Emergency Contact</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{student.emergencyContact}</div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Allergies</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: student.allergies === "None" ? C.t2 : C.amber }}>{student.allergies}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 4 }}>Known Medical Conditions</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: student.medicalConditions === "None" ? C.t2 : C.t1 }}>{student.medicalConditions}</div>
        </div>
      </div>

      {/* CONSULTATION DETAILS */}
      <h4 style={{ fontSize: 14, fontWeight: 800, color: C.m800, margin: "0 0 16px 0", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `2px solid ${C.m200}`, paddingBottom: 8 }}>Consultation History</h4>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {visits.length === 0 ? (
          <p style={{ fontStyle: "italic", color: C.t3, fontSize: 13 }}>No clinic visits recorded for this student.</p>
        ) : (
          visits.map((v) => (
            <div key={v.id} style={{ breakInside: "avoid", paddingBottom: 24, borderBottom: `1px dashed ${C.borderMed}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{v.date}</div>
                <div style={{ fontSize: 12, color: C.t3 }}>Time in: {v.time}</div>
              </div>
              
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <Activity size={16} color={C.amber} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 2 }}>Chief Complaint / Symptoms</div>
                  <div style={{ fontSize: 13, color: C.t1 }}>{v.symptoms}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <Stethoscope size={16} color={C.m700} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 2 }}>Diagnosis</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{v.diagnoses}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <Pill size={16} color={C.blue} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 2 }}>Treatment & Medications Administered</div>
                  <div style={{ fontSize: 13, color: C.t2 }}>{v.treatments} {v.medications !== "None" && `(${v.medications})`}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* SIGN-OFF FOOTER */}
      <div style={{ marginTop: 60, display: "flex", justifyContent: "space-between", breakInside: "avoid" }}>
        <div style={{ width: 250 }}>
          <div style={{ borderBottom: "1px solid #000", height: 24, marginBottom: 8 }} />
          <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", textTransform: "uppercase", color: C.t1 }}>Attending School Nurse</div>
          <div style={{ fontSize: 10, textAlign: "center", color: C.t3 }}>Signature over Printed Name</div>
        </div>
        
        <div style={{ width: 250 }}>
          <div style={{ borderBottom: "1px solid #000", height: 24, marginBottom: 8 }} />
          <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", textTransform: "uppercase", color: C.t1 }}>Clinic Physician / Admin</div>
          <div style={{ fontSize: 10, textAlign: "center", color: C.t3 }}>Signature over Printed Name</div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-clinic-report, .printable-clinic-report * {
            visibility: visible;
          }
          .printable-clinic-report {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 40px;
            background: #fff;
          }
        }
      `}} />
    </div>
  );
}
