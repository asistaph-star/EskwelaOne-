import { useAppContext } from '../../shared/AppContext';
import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';

import { studentApi } from '../../../api/student.api';
import { useEffect } from 'react';

export function StudentClinic({ setTab, currentUser }: any) {
  const [apiClinicRecords, setApiClinicRecords] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (currentUser?.id) {
      studentApi.getClinicRecords(currentUser.id).then(setApiClinicRecords).catch(console.error);
    }
  }, [currentUser?.id]);
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Student Health & Medical Log</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Privately logged clinic records and health alerts.</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Medical Profile</div>
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      ["Blood Type", currentUser?.studentProfile?.blood_type || "Unknown"],
                      ["Known Allergies", currentUser?.studentProfile?.allergies || "None logged"],
                      ["Conditions", currentUser?.studentProfile?.medical_conditions || "None logged"]
                    ].map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `0.5px solid ${C.border}` }}>
                        <span style={{ fontSize: 10.5, color: C.t3, fontWeight: 600 }}>{l}</span>
                        <span style={{ fontSize: 11, color: C.t1, fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                  <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Medical Notifications & Health Alerts</div>
                  <div style={{ padding: 14 }}>
                    <div style={{ border: `1px solid ${C.borderMed}`, background: C.blueBg, color: C.blue, padding: 12, borderRadius: 4 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700 }}>Annual Physical Examination</div>
                      <div style={{ fontSize: 10, marginTop: 4 }}>Scheduled for July 15, 2026, 9:00 AM at the school main clinic office. Parent consent form required.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Clinic Visits Log</div>
                <div style={{ padding: "12px 14px" }}>
                  {apiClinicRecords.length === 0 ? (
                    <div style={{ fontSize: 11, color: C.t3 }}>No clinic visits logged.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {apiClinicRecords.map((visit: any) => (
                        <div key={visit.id} style={{ borderBottom: `0.5px solid ${C.border}`, paddingBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>
                                {visit.symptoms ? `Symptoms: ${visit.symptoms}` : "No symptoms recorded"}
                              </div>
                              <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                                {visit.diagnosis && <span>Diagnosis: {visit.diagnosis} &middot; </span>}
                                {visit.medications && <span>Medications: {visit.medications} &middot; </span>}
                                Nurse: {visit.recorded_by}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <span style={{ fontSize: 10, color: C.t3 }}>
                                {new Date(visit.date).toLocaleDateString()} {visit.time ? new Date(visit.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                              {(visit.temperature || visit.blood_pressure || visit.heart_rate) && (
                                <span style={{ fontSize: 9.5, color: C.t3, marginTop: 4 }}>
                                  Vitals: {visit.temperature ? `${visit.temperature}┬░C` : ''} {visit.blood_pressure} {visit.heart_rate ? `${visit.heart_rate}bpm` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          {visit.treatments && (
                            <div style={{ fontSize: 10.5, color: C.t2, marginTop: 6 }}>
                              <span style={{ fontWeight: 600 }}>Treatments:</span> {visit.treatments}
                            </div>
                          )}
                          {visit.notes && (
                            <div style={{ fontSize: 10.5, color: C.t2, marginTop: 2 }}>
                              <span style={{ fontWeight: 600 }}>Notes:</span> {visit.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
  );
}
