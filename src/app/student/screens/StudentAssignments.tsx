import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';

export function StudentAssignments({ setTab, currentUser, assignments, assignmentSubmissions, addAssignmentSubmission }: any) {
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Unified To-Do Task Tracker</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Checked items represent completed assignments.</div>
              </div>

              {/* To-Do Checklist tracker */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>My Assignments Checklist</div>
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {assignments.filter(a => a.section === currentUser?.section).map((todo) => {
                    const isCompleted = assignmentSubmissions.some(s => s.assignmentId === todo.id && s.studentId === currentUser?.id);
                    return (
                      <div 
                        key={todo.id} 
                        style={{ 
                          display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", 
                          border: `1px solid ${C.borderMed}`, borderRadius: 4, 
                          background: isCompleted ? C.greenBg + "20" : "#fff",
                          transition: "all 0.12s"
                        }}
                      >
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${isCompleted ? C.green : C.border}`, background: isCompleted ? C.green : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isCompleted && <Check size={12} color="#fff" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ 
                            fontSize: 12, fontWeight: 600, color: isCompleted ? C.t3 : C.t1,
                            textDecoration: isCompleted ? "line-through" : "none"
                          }}>
                            {todo.title}
                          </span>
                          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{todo.subject} &middot; Due: <strong style={{ color: isCompleted ? C.t3 : C.red }}>{todo.dueDate}</strong></div>
                        </div>
                        <Stamp label={todo.type} color={C.blue} bg={C.blueBg} />
                      </div>
                    );
                  })}
                  {assignments.filter(a => a.section === currentUser?.section).length === 0 && (
                    <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: C.t3 }}>No assignments at this time.</div>
                  )}
                </div>
              </div>

              {/* Upcoming Exams */}
              <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 4 }}>
                <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Upcoming Exams Schedule</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ padding: 14 }}>
                  {[
                    { title: "First Term Assessment", dates: "June 25 - June 26, 2025", desc: "Covers all modules in Term 1" },
                    { title: "Mathematics Unit 1 Exam", dates: "June 15, 2025", desc: "Focus: Quadratic equations & functions" }
                  ].map((ex, i) => (
                    <div key={i} style={{ border: `1px solid ${C.borderMed}`, padding: 12, borderRadius: 4, background: C.paper }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{ex.title}</div>
                      <div style={{ fontSize: 10.5, color: C.m700, fontWeight: 600, marginTop: 4 }}>{ex.dates}</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>{ex.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
  );
}
