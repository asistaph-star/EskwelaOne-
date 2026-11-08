import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import {
  Calendar, CheckCircle, Clock, AlertTriangle, Send, Paperclip,
  Check, Lock, AlertCircle, FileSpreadsheet, ShieldCheck, ArrowRight, History
} from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';
import { SchoolYearSelector, AcademicYearOption } from '../../shared/components/SchoolYearSelector';
import { ReadOnlyBanner } from '../../shared/components/ReadOnlyBanner';
import { studentApi } from '../../../api/student.api';
import { resolveBackendUrl } from '../../../api/client';

export function StudentAttendance({ setTab, currentUser }: any) {
  const effectiveStudentId = currentUser?.studentProfile?.id || currentUser?.id;

  // Multi-Year Attendance State
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [isLoadingYears, setIsLoadingYears] = useState(false);

  // Official DepEd SF2 Attendance State
  const [officialSf2Data, setOfficialSf2Data] = useState<any>(null);
  const [isLoadingSf2, setIsLoadingSf2] = useState(false);

  // Gate RFID Attendance State
  const [apiGateAttendance, setApiGateAttendance] = useState<any[]>([]);

  // Excuse Letter Form State
  const [apiExcuses, setApiExcuses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [excuseTeacher, setExcuseTeacher] = useState('');
  const [excuseStartDate, setExcuseStartDate] = useState('');
  const [excuseEndDate, setExcuseEndDate] = useState('');
  const [excuseText, setExcuseText] = useState('');
  const [excuseError, setExcuseError] = useState('');
  const [excuseFile, setExcuseFile] = useState<File | null>(null);
  const [isSubmittingExcuse, setIsSubmittingExcuse] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');

  const formatTimeDisplay = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${minutes} ${ampm}`;
  };

  // Load available academic years for the student
  useEffect(() => {
    if (!effectiveStudentId) return;
    setIsLoadingYears(true);
    studentApi.getStudentAcademicYears(effectiveStudentId)
      .then((years: any) => {
        if (Array.isArray(years) && years.length > 0) {
          setAcademicYears(years);
          const currentYear = years.find((y: any) => y.isCurrent) || years[0];
          setSelectedAcademicYearId(currentYear.academicYearId);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch student academic years:', err);
      })
      .finally(() => setIsLoadingYears(false));
  }, [effectiveStudentId]);

  // Fetch official SF2 attendance and gate records whenever student or year changes
  useEffect(() => {
    if (!effectiveStudentId) return;
    setIsLoadingSf2(true);
    studentApi.getStudentOfficialSf2Attendance(effectiveStudentId, selectedAcademicYearId || undefined)
      .then((res: any) => {
        setOfficialSf2Data(res);
      })
      .catch((err) => {
        console.warn('Could not fetch official SF2 attendance:', err);
      })
      .finally(() => setIsLoadingSf2(false));

    studentApi.getGateAttendance(effectiveStudentId)
      .then(setApiGateAttendance)
      .catch(console.error);

    fetchExcuses();
  }, [effectiveStudentId, selectedAcademicYearId]);

  // Load teachers for excuse form
  useEffect(() => {
    studentApi.getStaff()
      .then((staffArray: any) => {
        const uniqueTeachers = new Map();
        if (staffArray && Array.isArray(staffArray)) {
          staffArray.forEach((s: any) => {
            if (!uniqueTeachers.has(s.id)) uniqueTeachers.set(s.id, { ...s, type: 'support' });
          });
        }
        setTeachers(Array.from(uniqueTeachers.values()));
      })
      .catch(console.error);
  }, []);

  const fetchExcuses = async () => {
    if (effectiveStudentId) {
      try {
        const data = await studentApi.getExcuseLetters(effectiveStudentId);
        setApiExcuses(data as any[]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleExcuseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isHistoricalYear) {
      setExcuseError('Excuse letters cannot be submitted for archived historical school years.');
      return;
    }

    if (!excuseTeacher || !excuseStartDate || !excuseEndDate || !excuseText) {
      setExcuseError('Please fill out all required fields.');
      return;
    }
    setIsSubmittingExcuse(true);
    try {
      let attachmentUrl: any = null;
      if (excuseFile) {
        attachmentUrl = await studentApi.uploadDocument(excuseFile);
      }
      await studentApi.createExcuseLetter({
        teacherId: excuseTeacher,
        startDate: excuseStartDate,
        endDate: excuseEndDate,
        reason: excuseText,
        documentId: attachmentUrl?.id || attachmentUrl?.data?.id || undefined,
      });
      setUploadSuccess('Excuse letter submitted successfully.');
      setExcuseTeacher('');
      setExcuseStartDate('');
      setExcuseEndDate('');
      setExcuseText('');
      setExcuseFile(null);
      fetchExcuses();
      setTimeout(() => setUploadSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setExcuseError('Failed to submit excuse letter.');
    } finally {
      setIsSubmittingExcuse(false);
    }
  };

  const selectedYearOption = academicYears.find(y => y.academicYearId === selectedAcademicYearId);
  const currentYearOption = academicYears.find(y => y.isCurrent);
  const isHistoricalYear = selectedYearOption ? !selectedYearOption.isCurrent : Boolean(officialSf2Data?.isHistorical);

  const cumulative = officialSf2Data?.cumulative || {
    totalSchoolDays: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalTardy: 0,
    attendanceRate: null,
  };

  const monthlySummaries: any[] = officialSf2Data?.monthlySummaries || [];
  const dailyRecords: any[] = officialSf2Data?.dailyRecords || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Title & School Year Selector Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>
            Daily Attendance Record (SF2)
          </h1>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>
            Official DepEd School Form 2 daily attendance tracking and verification records for Calulut Integrated School.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #cbd5e1" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Current SY:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
              {currentYearOption?.academicYearName || officialSf2Data?.academicYearName || "SY 2026–2027"}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#ecfdf5", padding: "1px 6px", borderRadius: 4, border: "1px solid #a7f3d0" }}>Active</span>
          </div>

          {setTab && (
            <button
              onClick={() => setTab("academic-history")}
              id="btn-goto-academic-history"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                color: C.navy,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                padding: "7px 12px",
                cursor: "pointer",
                transition: "all 0.15s"
              }}
              title="View previous school years, past grades, and historical attendance"
            >
              <History size={13} color={C.navy} />
              <span>Academic History</span>
            </button>
          )}
        </div>
      </div>

      {/* Historical Year Read-Only Banner */}
      {isHistoricalYear && (
        <ReadOnlyBanner
          yearName={selectedYearOption?.academicYearName || officialSf2Data?.academicYearName}
          recordType="attendance"
          onReturnToCurrent={currentYearOption ? () => setSelectedAcademicYearId(currentYearOption.academicYearId) : undefined}
        />
      )}

      {/* DepEd SF2 Cumulative Summary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total School Days</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.navy, marginTop: 4 }}>{cumulative.totalSchoolDays}</div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Official calendar days</div>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Days Present</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 4 }}>{cumulative.totalPresent}</div>
          <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>In-person attendance</div>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Days Absent</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: cumulative.totalAbsent > 5 ? '#e11d48' : C.t1, marginTop: 4 }}>
            {cumulative.totalAbsent}
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Recorded absences</div>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Times Tardy</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: cumulative.totalTardy > 3 ? '#d97706' : C.t1, marginTop: 4 }}>
            {cumulative.totalTardy}
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Late arrival instances</div>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Attendance Rate</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: (cumulative.totalSchoolDays === 0 || cumulative.attendanceRate === null || cumulative.attendanceRate === undefined) ? C.t3 : (cumulative.attendanceRate >= 85 ? '#059669' : '#d97706'), marginTop: 4 }}>
            {(cumulative.totalSchoolDays > 0 && cumulative.attendanceRate !== null && cumulative.attendanceRate !== undefined) ? `${cumulative.attendanceRate}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: (cumulative.totalSchoolDays === 0 || cumulative.attendanceRate === null || cumulative.attendanceRate === undefined) ? C.t3 : (cumulative.attendanceRate >= 85 ? '#059669' : '#d97706'), marginTop: 2 }}>
            {(cumulative.totalSchoolDays > 0 && cumulative.attendanceRate !== null && cumulative.attendanceRate !== undefined)
              ? (cumulative.attendanceRate >= 85 ? 'Satisfactory Standing' : 'Needs Regular Attendance')
              : 'No instructional days'}
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (SF2 Monthly Table & Daily Records) / Right Column (Excuse Submission & Gate Log) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 w-full">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Section 1: Official DepEd SF2 Monthly Attendance Table */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderMed}`, background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.t1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileSpreadsheet size={15} color={C.navy} />
                  Official DepEd SF2 Monthly Attendance Summary
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                  Monthly aggregated learner attendance under DepEd Order No. 54, s. 2016
                </div>
              </div>
              {officialSf2Data?.sectionName && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: 4 }}>
                  Section: {officialSf2Data.sectionName} (Grade {officialSf2Data.gradeLevel})
                </span>
              )}
            </div>

            <div className="overflow-x-auto w-full">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: `1px solid ${C.borderMed}` }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Month</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>School Days</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Present</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Absent</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tardy</th>
                    <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Verification Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummaries.length > 0 ? (
                    monthlySummaries.map((m, idx) => {
                      const hasSchoolDays = (m.classDays ?? 0) > 0;
                      const isVerified = m.verificationState === 'VERIFIED';
                      return (
                        <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? '#fff' : '#fcfcfc' }}>
                          <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: C.t1 }}>
                            {m.monthName || `Month ${m.monthOfYear || m.calendarMonth}`}
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 14px', fontSize: 12, fontWeight: 600, color: C.t1 }}>
                            {m.classDays ?? 0}
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 14px', fontSize: 12, fontWeight: 700, color: hasSchoolDays ? '#059669' : C.t3 }}>
                            {hasSchoolDays ? (m.daysPresent ?? 0) : '—'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 14px', fontSize: 12, fontWeight: 700, color: !hasSchoolDays ? C.t3 : ((m.daysAbsent || 0) > 0 ? '#e11d48' : (isVerified ? '#059669' : '#b45309')) }}>
                            {hasSchoolDays ? (
                              <span>
                                {m.daysAbsent ?? 0}
                                {!isVerified && <span style={{ fontSize: 9.5, fontWeight: 600, marginLeft: 4, color: '#b45309' }}>(Pending)</span>}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 14px', fontSize: 12, fontWeight: 700, color: !hasSchoolDays ? C.t3 : ((m.daysTardy || 0) > 0 ? '#d97706' : C.t3) }}>
                            {hasSchoolDays ? (m.daysTardy ?? 0) : '—'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                            {!hasSchoolDays ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f1f5f9', color: C.t3, padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600 }}>
                                <Calendar size={11} /> No School Days
                              </span>
                            ) : isVerified ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                                <Check size={11} /> Verified SF2
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
                                <Clock size={11} /> Pending Adviser Review
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12 }}>
                        No monthly attendance summary recorded for this academic year.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Official Daily Attendance Log */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.borderMed}`, fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
              Authoritative Daily SF2 Attendance Records
            </div>
            <div className="overflow-x-auto w-full">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.borderMed}` }}>
                    {['Date', 'DepEd Status', 'Record Status', 'Adviser Verification', 'Remarks'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyRecords.length > 0 ? (
                    dailyRecords.map((row) => (
                      <tr key={row.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: C.t1 }}>{row.date}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {row.statusCode === 'P' || row.statusLabel === 'Present' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              <CheckCircle size={12} /> Present
                            </span>
                          ) : row.statusCode === 'A' || row.statusLabel === 'Absent' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff1f2', color: '#e11d48', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              <AlertTriangle size={12} /> Absent
                            </span>
                          ) : row.statusCode === 'L' || row.statusLabel === 'Tardy' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fffbeb', color: '#d97706', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              <Clock size={12} /> Tardy
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              <CheckCircle size={12} /> Excused
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: C.t2 }}>
                          <span style={{ textTransform: 'capitalize' }}>{row.recordStatus || 'Recorded'}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: C.t2 }}>
                          {row.verifiedBy ? (
                            <span style={{ color: '#059669', fontWeight: 600 }}>Verified by {row.verifiedBy}</span>
                          ) : (
                            <span style={{ color: C.t3 }}>Pending verification</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: C.t3 }}>
                          {row.remarks || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12 }}>
                        No daily SF2 records found for this academic year.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Absence Excuse Letter Submission */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", marginBottom: 12 }}>
              Submit Absence Excuse Letter
            </div>

            {isHistoricalYear ? (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: 14, fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                  <Lock size={14} color="#b45309" />
                  Submission Disabled (Archived Year)
                </div>
                Excuse letters can only be submitted for the active academic year. Past academic year records are permanently locked.
              </div>
            ) : (
              <form onSubmit={handleExcuseSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Select Teacher
                  </label>
                  <select
                    value={excuseTeacher}
                    onChange={(e) => setExcuseTeacher(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: 'none', fontSize: 12, background: '#fff' }}
                  >
                    <option value="">Select a teacher</option>
                    <optgroup label="Staff & Advisers">
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Start Date</label>
                    <input type="date" value={excuseStartDate} onChange={(e) => setExcuseStartDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: 'none', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>End Date</label>
                    <input type="date" value={excuseEndDate} onChange={(e) => setExcuseEndDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: 'none', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Absence Explanation</label>
                  <textarea
                    value={excuseText}
                    onChange={(e) => setExcuseText(e.target.value)}
                    placeholder="Reason for absence..."
                    style={{ width: '100%', height: 75, padding: 10, fontSize: 12, border: `1px solid ${C.borderMed}`, borderRadius: 6, background: '#f9fafb', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.t2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Medical Certificate or Parent Note (Optional)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          setExcuseError('File must be smaller than 10MB');
                          setExcuseFile(null);
                        } else {
                          setExcuseFile(file);
                          setExcuseError('');
                        }
                      }
                    }}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 11, border: `1px solid ${C.borderMed}`, borderRadius: 6, background: '#f9fafb', boxSizing: 'border-box' }}
                  />
                </div>

                {excuseError && <div style={{ fontSize: 11, color: C.red, marginBottom: 12, background: C.redBg, padding: '8px 12px', borderRadius: 6 }}>{excuseError}</div>}
                {uploadSuccess && <div style={{ fontSize: 11, color: C.green, marginBottom: 12, fontWeight: 600 }}>{uploadSuccess}</div>}

                <button
                  type="submit"
                  disabled={isSubmittingExcuse}
                  style={{
                    background: isSubmittingExcuse ? C.m600 : C.m700,
                    color: '#fff',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: 6,
                    cursor: isSubmittingExcuse ? 'default' : 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  <Send size={14} /> {isSubmittingExcuse ? 'Submitting...' : 'Submit Excuse Letter'}
                </button>
              </form>
            )}
          </div>

          {/* Submitted Excuse Letters Log */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.borderMed}`, fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
              Excuse Letter Log
            </div>
            {apiExcuses.map((log) => (
              <div key={log.id} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `0.5px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: C.t1 }}>{log.reason || 'Absence Excuse'}</div>
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>
                    For: {new Date(log.start_date).toLocaleDateString()} - {new Date(log.end_date).toLocaleDateString()}
                  </div>
                </div>
                <Stamp label={log.status} color={log.status === 'Approved' ? C.green : log.status === 'Rejected' ? C.red : C.amber} bg={log.status === 'Approved' ? C.greenBg : log.status === 'Rejected' ? C.redBg : C.amberBg} />
              </div>
            ))}
            {apiExcuses.length === 0 && (
              <div style={{ padding: 20, fontSize: 11, color: C.t3, textAlign: 'center' }}>No excuse letters submitted.</div>
            )}
          </div>

          {/* Gate RFID Scan History */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.borderMed}`, fontSize: 12.5, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
              Campus Gate Access History
            </div>
            <div className="overflow-x-auto w-full">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.borderMed}` }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase' }}>Entry Time</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase' }}>Exit Time</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {apiGateAttendance.slice(0, 10).map((row) => (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: C.t1 }}>{row.date}</td>
                      <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.t2 }}>
                        {formatTimeDisplay(row.time_in) || '--:--'}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.t2 }}>
                        {formatTimeDisplay(row.time_out) || '--:--'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: row.status === 'Present' ? '#059669' : '#d97706' }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {apiGateAttendance.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 16, textAlign: 'center', color: C.t3, fontSize: 11 }}>
                        No campus scan logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
