import React, { useState, useMemo } from 'react';
import { C } from '../../shared/constants/tokens';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck, Download,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';
import { studentApi } from '../../../api/student.api';
import { useEffect } from 'react';

import { StudentReportCard } from '../components/StudentReportCard';
import { Form138PDFDocument } from '../components/Form138PDFDocument';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { getStudentRankAndStanding, getStudentRecentQuizzes, getStudentSubjectGrades } from '../../shared/utils/gradesService';


export function StudentAcademics({ setTab, currentUser }: any) {
  const studentId = currentUser?.id;
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfToast, setPdfToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const realSubjectGrades = useMemo(() => {
    if (!studentId) return [];
    return getStudentSubjectGrades(studentId, {});
  }, [studentId]);

  const realRecentQuizzes = useMemo(() => getStudentRecentQuizzes(studentId, {}), [studentId]);

  const currentGrade10Avg = useMemo(() => {
    if (realSubjectGrades.length === 0) return 0;
    const total = realSubjectGrades.reduce((sum, s) => sum + (s.term1 + s.term2 + s.term3) / 3, 0);
    return Math.round((total / realSubjectGrades.length) * 10) / 10;
  }, [realSubjectGrades]);

  const standingInfo = useMemo(() => getStudentRankAndStanding(currentGrade10Avg), [currentGrade10Avg]);

  async function handleExportPDF() {
    setIsExportingPDF(true);
    setPdfToast(null);
    try {
      const blob = await pdf(<Form138PDFDocument student={currentUser} subjects={realSubjectGrades} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ReportCard_${currentUser?.name || "Student"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setPdfToast({ message: "PDF Downloaded Successfully!", type: "success" });
    } catch (err) {
      console.error(err);
      setPdfToast({ message: "Failed to generate PDF. Please try again.", type: "error" });
    } finally {
      setIsExportingPDF(false);
      setTimeout(() => setPdfToast(null), 4000);
    }
  }

  const realGradeTrendData = [
    { label: "Term 1", val: 88 },
    { label: "Term 2", val: 90 },
    { label: "Term 3", val: 92 },
  ];

  
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
              <style dangerouslySetInnerHTML={{ __html: `
                @page {
                  size: letter portrait;
                  margin: 0.4in;
                }

                @media print {
                  html, body, #root, #root > div, .watermark-bg {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    overflow: visible !important;
                    display: block !important;
                    background: #fff !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }

                  body * { visibility: hidden !important; }

                  .no-print {
                    display: none !important;
                  }

                  #form138-print-root, #form138-print-root * { 
                    visibility: visible !important; 
                  }

                  @page {
                    size: portrait;
                    margin: 0.5in;
                  }

                  #form138-print-root {
                    display: block !important;
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    position: static !important;
                    box-sizing: border-box !important;
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    background: #fff !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }

                  /* Force text wrapping to prevent inline nowrap from forcing table width > page width */
                  #form138-print-root * {
                    white-space: normal !important;
                  }

                  #form138-print-root table {
                    width: 100% !important;
                    table-layout: fixed !important;
                    font-size: 8.5pt !important;
                  }

                  #form138-print-root table th,
                  #form138-print-root table td {
                    padding: 4px 6px !important;
                    word-wrap: break-word !important;
                  }
                }
              ` }} />

              <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Scholastic History & Grades</h1>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Official report card records under Form 138 specification derived from active gradebooks.</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  
                  {/* Toast Notification */}
                  {pdfToast && (
                    <div style={{ 
                      padding: "8px 12px", 
                      borderRadius: 6, 
                      fontSize: 11, 
                      fontWeight: 600,
                      background: pdfToast.type === 'success' ? C.greenBg : C.redBg,
                      color: pdfToast.type === 'success' ? C.green : C.red,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}>
                      {pdfToast.type === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                      {pdfToast.message}
                    </div>
                  )}

                  <button 
                    onClick={handleExportPDF} 
                    disabled={isExportingPDF}
                    style={{ 
                      display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, 
                      color: "#fff", background: isExportingPDF ? C.t3 : C.m700, 
                      border: "none", borderRadius: 8, padding: "8px 16px", cursor: isExportingPDF ? "not-allowed" : "pointer", 
                      transition: "all 0.15s" 
                    }}
                  >
                    {isExportingPDF ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13}/>}
                    {isExportingPDF ? "Generating PDF..." : "Download PDF (SF9)"}
                  </button>
                </div>
              </div>

              {/* Standard DepEd Report Card widget */}
              <div id="form138-print-root" className="printable-report-card-area" style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.borderMed}`, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                <div id="printable-report-card">
                  <StudentReportCard 
                    student={currentUser} 
                    subjects={realSubjectGrades}
                  />
                </div>
              </div>

              <div className="no-print grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Visual Grade Trend line chart per year level */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif", marginBottom: 16 }}>Grade Averages Trend</div>
                  <div style={{ height: 170 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={realGradeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" stroke={C.t3} fontSize={10.5} tickLine={false} axisLine={false} />
                        <YAxis domain={[75, 100]} stroke={C.t3} fontSize={10.5} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.borderMed}` }} formatter={(val: number) => [`${val.toFixed(1)}%`, "Average"]} />
                        <Line type="monotone" dataKey="avg" stroke={C.m700} strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 4, stroke: C.m700, strokeWidth: 2, fill: "#fff" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Standing & Class rank metrics */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Academic Standing Details</div>
                  <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1 }}>Class Ranking</div>
                        <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>Out of {standingInfo.totalStudents} enrolled students in Section Pilot</div>
                      </div>
                      <Stamp label={`Rank ${standingInfo.rank}`} color={C.gold} bg={C.goldLight} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1 }}>Academic Track Recommendation</div>
                        <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>Suggested path for senior high enrolment (Current GPA: {currentGrade10Avg.toFixed(1)})</div>
                      </div>
                      <Stamp label={standingInfo.track} color={C.blue} bg={C.blueBg} />
                    </div>
                  </div>
                </div>
                
                {/* Quiz Grades Details */}
                <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, overflow: "hidden", borderRadius: 12, gridColumn: "span 2", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Recent Quiz Performance</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ padding: "20px 24px" }}>
                    {realRecentQuizzes.map((qz, idx) => (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 10, borderBottom: `1px dashed ${C.borderMed}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{qz.s} &middot; <span style={{ color: C.t2, fontWeight: 600 }}>{qz.q}</span></span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.m700 }}>{qz.score}</span>
                        </div>
                        <div style={{ width: "100%", height: 6, background: C.borderMed, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${qz.pct}%`, height: "100%", background: C.m700, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                    {realRecentQuizzes.length === 0 && (
                      <div style={{ gridColumn: "span 2", textAlign: "center", fontSize: 11.5, color: C.t3, padding: 20 }}>
                        No quiz items recorded in active gradebooks yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
  );
}
