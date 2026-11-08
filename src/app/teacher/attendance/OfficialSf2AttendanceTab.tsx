import React, { useState, useEffect, useCallback } from 'react';
import { C } from '../../shared/constants/tokens';
import {
  ShieldCheck,
  CheckCircle2,
  Save,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Users,
  Check,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../../api/client';
import { ModernConfirmModal } from '../../shared/components/ModernConfirmModal';

export interface OfficialSf2RosterLearner {
  enrollmentId: string;
  studentId: string;
  lrn: string;
  lastName: string;
  firstName: string;
  gender: string;
  statusCode: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED' | 'NOT_RECORDED';
  recordStatus: 'DRAFT' | 'VERIFIED';
  minutesLate?: number | null;
  remarks?: string | null;
  excuseReason?: string | null;
  recordedBy?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

export function OfficialSf2AttendanceTab({ classId }: { classId: string }) {
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED' | 'NOT_RECORDED'>>({});
  const [localRemarks, setLocalRemarks] = useState<Record<string, string>>({});

  const [monthlySummary, setMonthlySummary] = useState<any[] | null>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [activeSubView, setActiveSubView] = useState<'daily' | 'monthly'>('daily');
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Fetch teacher's classes/sections on mount
  useEffect(() => {
    async function fetchClasses() {
      try {
        const classes = await apiClient.get<any[]>('/academic/my-classes');
        if (Array.isArray(classes) && classes.length > 0) {
          setSections(classes);
          // Prioritize sections where teacher is designated adviser
          const adviserClass = classes.find((c: any) => c.adviser && c.sectionId);
          const currentClass = classes.find((c: any) => c.id === classId && c.sectionId);
          const target = adviserClass || currentClass || classes[0];
          if (target?.sectionId) {
            setSelectedSectionId(target.sectionId);
          }
        }
      } catch (err: any) {
        console.error('Failed to load sections for SF2', err);
      }
    }
    fetchClasses();
  }, [classId]);

  // Fetch daily official attendance
  const fetchDailyData = useCallback(async () => {
    if (!selectedSectionId || !selectedDate) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const resp = await apiClient.get<any>(
        `/attendance/sf2/sections/${selectedSectionId}/daily?date=${selectedDate}`
      );
      setAttendanceData(resp);
      const initialMap: Record<string, any> = {};
      const initialRemarks: Record<string, string> = {};
      if (resp?.roster) {
        resp.roster.forEach((learner: OfficialSf2RosterLearner) => {
          initialMap[learner.enrollmentId] = learner.statusCode;
          if (learner.remarks) initialRemarks[learner.enrollmentId] = learner.remarks;
        });
      }
      setLocalStatuses(initialMap);
      setLocalRemarks(initialRemarks);
    } catch (err: any) {
      console.error('Failed to fetch official daily attendance', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load official attendance');
      setAttendanceData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSectionId, selectedDate]);

  // Fetch monthly summary
  const fetchMonthlyData = useCallback(async () => {
    if (!selectedSectionId || !selectedDate) return;
    setLoadingMonthly(true);
    try {
      const [yearStr, monthStr] = selectedDate.split('-');
      const resp = await apiClient.get<any>(
        `/attendance/sf2/sections/${selectedSectionId}/monthly-summary?year=${yearStr}&month=${parseInt(monthStr, 10)}`
      );
      setMonthlySummary(resp?.summaries || []);
    } catch (err: any) {
      console.error('Failed to fetch monthly summary', err);
    } finally {
      setLoadingMonthly(false);
    }
  }, [selectedSectionId, selectedDate]);

  useEffect(() => {
    if (activeSubView === 'daily') {
      fetchDailyData();
    } else {
      fetchMonthlyData();
    }
  }, [activeSubView, fetchDailyData, fetchMonthlyData]);

  // Quick mark student status
  const handleMark = (enrollmentId: string, status: 'PRESENT' | 'ABSENT' | 'TARDY' | 'EXCUSED') => {
    setLocalStatuses((prev) => ({
      ...prev,
      [enrollmentId]: status,
    }));
  };

  // Mark all unrecorded as Present
  const handleMarkAllUnrecordedPresent = () => {
    if (!attendanceData?.roster) return;
    setLocalStatuses((prev) => {
      const next = { ...prev };
      attendanceData.roster.forEach((l: OfficialSf2RosterLearner) => {
        if (!next[l.enrollmentId] || next[l.enrollmentId] === 'NOT_RECORDED') {
          next[l.enrollmentId] = 'PRESENT';
        }
      });
      return next;
    });
  };

  // Save Draft action
  const handleSaveDraft = async () => {
    if (!selectedSectionId || !attendanceData?.roster) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const entries = attendanceData.roster
        .filter((l: OfficialSf2RosterLearner) => localStatuses[l.enrollmentId] && localStatuses[l.enrollmentId] !== 'NOT_RECORDED')
        .map((l: OfficialSf2RosterLearner) => ({
          enrollmentId: l.enrollmentId,
          statusCode: localStatuses[l.enrollmentId],
          remarks: localRemarks[l.enrollmentId] || null,
        }));

      if (entries.length === 0) {
        setError('No recorded attendance entries to save. Please mark at least one student.');
        setSaving(false);
        return;
      }

      await apiClient.post(`/attendance/sf2/sections/${selectedSectionId}/daily`, {
        date: selectedDate,
        entries,
      });

      setSuccessMessage(`Draft attendance saved successfully for ${entries.length} learners.`);
      await fetchDailyData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save draft attendance');
    } finally {
      setSaving(false);
    }
  };

  // Verify Attendance action
  const handleVerify = () => {
    if (!selectedSectionId || !attendanceData?.roster) return;
    setShowVerifyModal(true);
  };

  const handleConfirmVerify = async () => {
    if (!selectedSectionId || !attendanceData?.roster) return;
    setVerifying(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.post(`/attendance/sf2/sections/${selectedSectionId}/verify`, {
        date: selectedDate,
      });

      setSuccessMessage(`Official daily attendance verified and sealed for ${selectedDate}.`);
      setShowVerifyModal(false);
      await fetchDailyData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to verify attendance');
    } finally {
      setVerifying(false);
    }
  };

  const dayKind = attendanceData?.effectiveDayKind || 'INSTRUCTIONAL';
  const isNonInstructional = dayKind === 'NON_INSTRUCTIONAL' || dayKind === 'HOLIDAY';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Top Control & Selector Bar ── */}
      <div
        style={{
          background: '#fff',
          border: `1px solid ${C.borderMed}`,
          borderRadius: 6,
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Section / Class
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.t1,
                border: `1px solid ${C.borderMed}`,
                borderRadius: 4,
                padding: '6px 10px',
                background: '#fff',
                minWidth: 180,
              }}
            >
              {sections.map((c) => (
                <option key={c.sectionId || c.id} value={c.sectionId || c.id}>
                  Grade {c.grade} - {c.section} {c.adviser ? '★ (Adviser)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Attendance Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.t1,
                border: `1px solid ${C.borderMed}`,
                borderRadius: 4,
                padding: '5px 10px',
                background: '#fff',
              }}
            />
          </div>

          {/* School Calendar Status Badge */}
          <div style={{ alignSelf: 'flex-end', paddingBottom: 2 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: isNonInstructional ? '#fef3c7' : '#dcfce7',
                color: isNonInstructional ? '#92400e' : '#15803d',
                border: `1px solid ${isNonInstructional ? '#fde68a' : '#bbf7d0'}`,
              }}
            >
              <Calendar size={12} />
              {dayKind === 'INSTRUCTIONAL'
                ? 'Instructional School Day'
                : dayKind === 'HOLIDAY'
                ? `Holiday (${attendanceData?.dayDescription || 'Official DepEd Holiday'})`
                : 'Non-Instructional / Suspended'}
            </span>
          </div>
        </div>

        {/* View toggle & Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', border: `1px solid ${C.borderMed}`, borderRadius: 4, overflow: 'hidden' }}>
            <button
              onClick={() => setActiveSubView('daily')}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: activeSubView === 'daily' ? C.m700 : '#fff',
                color: activeSubView === 'daily' ? '#fff' : C.t2,
              }}
            >
              Daily Roster
            </button>
            <button
              onClick={() => setActiveSubView('monthly')}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: activeSubView === 'monthly' ? C.m700 : '#fff',
                color: activeSubView === 'monthly' ? '#fff' : C.t2,
              }}
            >
              Monthly Summary (SF2)
            </button>
          </div>

          {activeSubView === 'daily' && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={saving || loading || isNonInstructional}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '7px 14px',
                  borderRadius: 4,
                  border: `1px solid ${C.borderMed}`,
                  background: '#fff',
                  color: C.t1,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: saving || isNonInstructional ? 'not-allowed' : 'pointer',
                  opacity: saving || isNonInstructional ? 0.6 : 1,
                }}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Draft
              </button>

              <button
                onClick={handleVerify}
                disabled={verifying || loading || isNonInstructional}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '7px 14px',
                  borderRadius: 4,
                  border: 'none',
                  background: C.m700,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: verifying || isNonInstructional ? 'not-allowed' : 'pointer',
                  opacity: verifying || isNonInstructional ? 0.6 : 1,
                }}
              >
                {verifying ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                Verify Attendance
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Status Banners ── */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '10px 14px', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 6, color: '#15803d', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ── Daily View ── */}
      {activeSubView === 'daily' && (
        <>
          {/* Summary counters strip */}
          {attendanceData?.summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Total Enrolled</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginTop: 2 }}>{attendanceData.summary.totalEnrolled}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: '#166534', textTransform: 'uppercase', fontWeight: 700 }}>Present (P)</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginTop: 2 }}>{attendanceData.summary.present}</div>
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: '#92400e', textTransform: 'uppercase', fontWeight: 700 }}>Tardy (L)</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309', marginTop: 2 }}>{attendanceData.summary.tardy}</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: '#991b1b', textTransform: 'uppercase', fontWeight: 700 }}>Absent (A)</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>{attendanceData.summary.absent}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>Not Recorded</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#64748b', marginTop: 2 }}>{attendanceData.summary.notRecorded}</div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>Verified (SF2)</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                  {attendanceData.summary.verifiedCount} / {attendanceData.summary.totalEnrolled}
                </div>
              </div>
            </div>
          )}

          {/* Main Roster Table */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.borderMed}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAFA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={15} color={C.m700} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>
                  Official Learner Attendance Roster
                </span>
                <span style={{ fontSize: 11, color: C.t3 }}>
                  ({attendanceData?.roster?.length || 0} Learners)
                </span>
              </div>

              <button
                onClick={handleMarkAllUnrecordedPresent}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.m700,
                  background: 'none',
                  border: `1px solid ${C.m700}30`,
                  borderRadius: 4,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sparkles size={11} /> Mark Unrecorded as Present
              </button>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: C.m700 }} />
                <span style={{ fontSize: 12, color: C.t3, display: 'block', marginTop: 8 }}>Loading official section attendance...</span>
              </div>
            ) : !attendanceData?.roster || attendanceData.roster.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: C.t3, fontSize: 12 }}>
                No enrolled learners found for this section.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8F9FA', borderBottom: `1px solid ${C.borderMed}` }}>
                      <th style={{ padding: '9px 12px', width: 40, textAlign: 'center', color: C.t3, fontSize: 10, fontWeight: 700 }}>#</th>
                      <th style={{ padding: '9px 12px', width: 120, color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>LRN</th>
                      <th style={{ padding: '9px 12px', color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Learner Name</th>
                      <th style={{ padding: '9px 12px', width: 60, color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Sex</th>
                      <th style={{ padding: '9px 12px', width: 130, color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Official Status</th>
                      <th style={{ padding: '9px 12px', width: 180, textAlign: 'center', color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Quick Marking</th>
                      <th style={{ padding: '9px 12px', width: 100, textAlign: 'center', color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Sealed State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.roster.map((learner: OfficialSf2RosterLearner, idx: number) => {
                      const curStatus = localStatuses[learner.enrollmentId] || learner.statusCode;
                      const isVerified = learner.recordStatus === 'VERIFIED';

                      return (
                        <tr
                          key={learner.enrollmentId}
                          style={{
                            borderBottom: `1px solid ${C.border}`,
                            background: idx % 2 === 0 ? '#fff' : '#FCFCFC',
                          }}
                        >
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: C.t3, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.t2 }}>
                            {learner.lrn}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: C.t1 }}>
                            {learner.lastName}, {learner.firstName}
                          </td>
                          <td style={{ padding: '10px 12px', color: C.t3, fontSize: 11 }}>
                            {learner.gender === 'Female' ? 'F' : 'M'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 800,
                                fontFamily: "'JetBrains Mono',monospace",
                                background:
                                  curStatus === 'PRESENT'
                                    ? '#dcfce7'
                                    : curStatus === 'TARDY'
                                    ? '#fef3c7'
                                    : curStatus === 'ABSENT'
                                    ? '#fee2e2'
                                    : curStatus === 'EXCUSED'
                                    ? '#e0e7ff'
                                    : '#f1f5f9',
                                color:
                                  curStatus === 'PRESENT'
                                    ? '#15803d'
                                    : curStatus === 'TARDY'
                                    ? '#b45309'
                                    : curStatus === 'ABSENT'
                                    ? '#b91c1c'
                                    : curStatus === 'EXCUSED'
                                    ? '#4338ca'
                                    : '#64748b',
                                border: `1px solid ${
                                  curStatus === 'PRESENT'
                                    ? '#bbf7d0'
                                    : curStatus === 'TARDY'
                                    ? '#fde68a'
                                    : curStatus === 'ABSENT'
                                    ? '#fecaca'
                                    : curStatus === 'EXCUSED'
                                    ? '#c7d2fe'
                                    : '#cbd5e1'
                                }`,
                              }}
                            >
                              {curStatus === 'NOT_RECORDED' ? 'Not Recorded' : curStatus}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button
                                onClick={() => handleMark(learner.enrollmentId, 'PRESENT')}
                                style={{
                                  width: 28,
                                  height: 26,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  border: curStatus === 'PRESENT' ? '2px solid #15803d' : '1px solid #bbf7d0',
                                  background: curStatus === 'PRESENT' ? '#15803d' : '#f0fdf4',
                                  color: curStatus === 'PRESENT' ? '#fff' : '#15803d',
                                }}
                                title="Mark Present (P)"
                              >
                                P
                              </button>
                              <button
                                onClick={() => handleMark(learner.enrollmentId, 'TARDY')}
                                style={{
                                  width: 28,
                                  height: 26,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  border: curStatus === 'TARDY' ? '2px solid #b45309' : '1px solid #fde68a',
                                  background: curStatus === 'TARDY' ? '#b45309' : '#fffbeb',
                                  color: curStatus === 'TARDY' ? '#fff' : '#b45309',
                                }}
                                title="Mark Late / Tardy (L)"
                              >
                                L
                              </button>
                              <button
                                onClick={() => handleMark(learner.enrollmentId, 'ABSENT')}
                                style={{
                                  width: 28,
                                  height: 26,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  border: curStatus === 'ABSENT' ? '2px solid #b91c1c' : '1px solid #fecaca',
                                  background: curStatus === 'ABSENT' ? '#b91c1c' : '#fef2f2',
                                  color: curStatus === 'ABSENT' ? '#fff' : '#b91c1c',
                                }}
                                title="Mark Absent (A)"
                              >
                                A
                              </button>
                              <button
                                onClick={() => handleMark(learner.enrollmentId, 'EXCUSED')}
                                style={{
                                  width: 28,
                                  height: 26,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  border: curStatus === 'EXCUSED' ? '2px solid #4338ca' : '1px solid #c7d2fe',
                                  background: curStatus === 'EXCUSED' ? '#4338ca' : '#eef2ff',
                                  color: curStatus === 'EXCUSED' ? '#fff' : '#4338ca',
                                }}
                                title="Mark Excused Absence (E)"
                              >
                                E
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {isVerified ? (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: '#15803d',
                                  background: '#dcfce7',
                                  padding: '2px 6px',
                                  borderRadius: 3,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                                title={`Verified on ${learner.verifiedAt ? new Date(learner.verifiedAt).toLocaleDateString() : 'Official'}`}
                              >
                                <Check size={10} /> Verified
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: C.t3, background: '#f1f5f9', padding: '2px 6px', borderRadius: 3 }}>
                                Draft
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Monthly Summary View (DepEd SF2 Monthly Totals) ── */}
      {activeSubView === 'monthly' && (
        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.borderMed}`, background: '#FAFAFA' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.t1, margin: 0 }}>
              DepEd SF2 Official Monthly Summary Totals
            </h3>
            <p style={{ fontSize: 11, color: C.t2, margin: '4px 0 0 0' }}>
              These verified monthly aggregates populate Section 5 of the authentic DepEd Form 138 (SF9-JHS) report card.
            </p>
          </div>

          {loadingMonthly ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: C.m700 }} />
              <span style={{ fontSize: 12, color: C.t3, display: 'block', marginTop: 8 }}>Aggregating monthly verified attendance...</span>
            </div>
          ) : !monthlySummary || monthlySummary.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: C.t3, fontSize: 12 }}>
              No monthly attendance summaries available for this month.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8F9FA', borderBottom: `1px solid ${C.borderMed}` }}>
                    <th style={{ padding: '9px 12px', width: 40, textAlign: 'center', color: C.t3, fontSize: 10, fontWeight: 700 }}>#</th>
                    <th style={{ padding: '9px 12px', width: 120, color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>LRN</th>
                    <th style={{ padding: '9px 12px', color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Learner Name</th>
                    <th style={{ padding: '9px 12px', width: 60, color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Sex</th>
                    <th style={{ padding: '9px 12px', width: 90, textAlign: 'center', color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>School Days</th>
                    <th style={{ padding: '9px 12px', width: 90, textAlign: 'center', color: '#15803d', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Days Present</th>
                    <th style={{ padding: '9px 12px', width: 90, textAlign: 'center', color: '#b91c1c', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Days Absent</th>
                    <th style={{ padding: '9px 12px', width: 90, textAlign: 'center', color: '#b45309', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Times Tardy</th>
                    <th style={{ padding: '9px 12px', width: 110, textAlign: 'center', color: C.t3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>SF2 Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.map((sum: any, idx: number) => (
                    <tr
                      key={sum.enrollmentId}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        background: idx % 2 === 0 ? '#fff' : '#FCFCFC',
                      }}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: C.t3, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.t2 }}>
                        {sum.lrn}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: C.t1 }}>
                        {sum.lastName}, {sum.firstName}
                      </td>
                      <td style={{ padding: '10px 12px', color: C.t3, fontSize: 11 }}>
                        {sum.gender === 'Female' ? 'F' : 'M'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                        {sum.classDays}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: '#15803d' }}>
                        {sum.daysPresent}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: sum.daysAbsent > 0 ? '#b91c1c' : C.t3 }}>
                        {sum.daysAbsent}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: sum.timesTardy > 0 ? '#b45309' : C.t3 }}>
                        {sum.timesTardy}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: sum.verificationStatus === 'VERIFIED' ? '#15803d' : '#64748b',
                            background: sum.verificationStatus === 'VERIFIED' ? '#dcfce7' : '#f1f5f9',
                            padding: '2px 8px',
                            borderRadius: 3,
                          }}
                        >
                          {sum.verificationStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modern Modal for Officially Verifying SF2 Daily Attendance ── */}
      <ModernConfirmModal
        isOpen={showVerifyModal}
        onClose={() => !verifying && setShowVerifyModal(false)}
        onConfirm={handleConfirmVerify}
        title="Officially Verify & Seal Attendance"
        subtitle={`${selectedDate} · ${sections.find((s: any) => s.sectionId === selectedSectionId)?.section || 'Class Section'} · Calulut Integrated School`}
        badge={{ text: 'SF2 & SF9 Sealed', variant: 'warning' }}
        confirmVariant="warning"
        confirmLabel="Verify & Seal Daily Register"
        confirmIcon={<ShieldCheck size={16} />}
        isLoading={verifying}
        loadingLabel="Verifying & Sealing..."
        checklist={[
          {
            title: 'Roster Daily Aggregation',
            description: 'Aggregates present, absent, tardy, and excused counts for all learners in the section.',
          },
          {
            title: 'Seal Daily Register',
            description: 'Locks attendance records for this instructional date against unapproved modification.',
          },
          {
            title: 'DepEd SF2 & SF9 Synchronization',
            description: 'Directly computes monthly school days, present days, and absent days on official Form 138 report cards.',
          },
        ]}
        note="Ensure all enrolled learners have been accurately accounted for before sealing official daily attendance."
      />
    </div>
  );
}

