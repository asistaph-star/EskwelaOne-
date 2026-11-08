import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';
import { Award, AlertCircle, CheckCircle2, Clock, X, ShieldAlert, Sparkles, Send } from 'lucide-react';

interface StudentRosterItem {
  id: string; // studentId or enrollmentId
  studentId: string;
  name: string;
  lrn: string;
}

interface RequestGradeConsiderationModalProps {
  sectionId: string;
  sectionName: string;
  gradeLevel: number;
  subjectId: string;
  subjectName: string;
  schoolYear?: string;
  term: 'T1' | 'T2' | 'T3' | 'T4';
  students?: StudentRosterItem[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestGradeConsiderationModal({
  sectionId,
  sectionName,
  gradeLevel,
  subjectId,
  subjectName,
  schoolYear = 'SY 2026-2027',
  term,
  students = [],
  onClose,
  onSuccess
}: RequestGradeConsiderationModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.studentId || '');
  const [proposedGrade, setProposedGrade] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [evidenceRef, setEvidenceRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // Existing grade state
  const [studentGrade, setStudentGrade] = useState<{ computed: number | null; published: number | null } | null>(null);

  useEffect(() => {
    if (!selectedStudentId) return;
    // Fetch student grade
    apiClient.get<any>(`/gradebooks/grades?sectionId=${sectionId}&subjectId=${subjectId}&term=${term}&schoolYear=${encodeURIComponent(schoolYear)}`)
      .then((res: any) => {
        const payload = res?.data || res;
        const studentRow = payload?.grades?.find((g: any) => g.student_id === selectedStudentId);
        if (studentRow) {
          setStudentGrade({
            computed: studentRow.term_grade !== null ? Math.round(studentRow.term_grade) : null,
            published: studentRow.published_term_grade ?? null
          });
          if (studentRow.term_grade !== null && !proposedGrade) {
            setProposedGrade(String(Math.round(studentRow.term_grade)));
          }
        } else {
          setStudentGrade(null);
        }
      })
      .catch(() => {
        setStudentGrade(null);
      });
  }, [selectedStudentId, sectionId, subjectId, term, schoolYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const gradeNum = parseInt(proposedGrade, 10);
    if (isNaN(gradeNum) || gradeNum < 60 || gradeNum > 100) {
      setError('Proposed grade must be an integer between 60 and 100.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 10) {
      setError('Academic justification is mandatory and must be at least 10 characters.');
      return;
    }

    if (!evidenceRef.trim() || evidenceRef.trim().length < 5) {
      setError('Assessment evidence reference is mandatory (e.g., Remedial Task #2, Special Assessment Paper).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<any>('/gradebooks/considerations', {
        studentId: selectedStudentId,
        subjectId,
        term,
        schoolYear,
        proposedGrade: gradeNum,
        reason: reason.trim(),
        evidenceRef: evidenceRef.trim()
      });

      const payload = res?.data || res;
      setSuccessResult(payload);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to submit grade consideration request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          width: '100%',
          maxWidth: 580,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #cbd5e1'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: '#8b1e1e', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="#fca5a5" />
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#fff' }}>
                Request Grade Consideration / Adjustment
              </h2>
              <div style={{ fontSize: 11, color: '#fee2e2', marginTop: 2 }}>
                Grade {gradeLevel} – {sectionName} • {subjectName} ({term})
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {successResult ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div style={{ width: 48, height: 48, background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <CheckCircle2 size={28} color="#059669" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#065f46', margin: '0 0 8px 0' }}>
                Grade Consideration Request Submitted
              </h3>
              <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                Your request for <strong>{successResult.studentName}</strong> with proposed grade of{' '}
                <strong style={{ color: '#8b1e1e' }}>{successResult.proposedGrade}</strong> has been forwarded to the
                School Principal for policy authorization.
              </p>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, textAlign: 'left', fontSize: 11.5, color: '#334155' }}>
                <div><strong>Original Computed Grade:</strong> {successResult.originalComputedGrade ?? 'N/A'} (Preserved)</div>
                <div><strong>Proposed Adjusted Grade:</strong> {successResult.proposedGrade}</div>
                <div><strong>Evidence Reference:</strong> {successResult.evidenceRef}</div>
                <div><strong>Status:</strong> <span style={{ color: '#d97706', fontWeight: 700 }}>PENDING PRINCIPAL APPROVAL</span></div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  marginTop: 20,
                  padding: '8px 20px',
                  background: '#8b1e1e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* DepEd Compliance Notice */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10 }}>
                <ShieldAlert size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.4 }}>
                  <strong>DepEd Order No. 015, s. 2026 Compliance:</strong> Discretionary grade bumping without supporting assessment evidence is strictly prohibited. Original WW/PT/ST/TE calculations are preserved. Adjustments require School Principal authorization.
                </div>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', color: '#991b1b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} color="#dc2626" />
                  <span>{error}</span>
                </div>
              )}

              {/* Student Selector */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Select Enrolled Student *
                </label>
                <select
                  id="select-consideration-student"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    fontSize: 12.5,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    outline: 'none',
                    fontWeight: 600
                  }}
                >
                  {students.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.name} (LRN: {s.lrn})
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Grades Display */}
              <div style={{ display: 'flex', gap: 12, background: '#f1f5f9', padding: '10px 14px', borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Automatically Computed Grade
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                    {studentGrade?.computed !== null ? studentGrade?.computed : 'Not encoded yet'}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Derived from authentic WW/PT/ST/TE scores</div>
                </div>
                <div style={{ width: 1, background: '#cbd5e1' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Current Published Grade
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#059669', marginTop: 2 }}>
                    {studentGrade?.published !== null ? studentGrade?.published : 'Draft / Unpublished'}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Authoritative SF9 released rating</div>
                </div>
              </div>

              {/* Proposed Adjusted Grade */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Proposed Adjusted Grade (60 – 100) *
                </label>
                <input
                  id="input-proposed-grade"
                  type="number"
                  min="60"
                  max="100"
                  placeholder="e.g. 85"
                  value={proposedGrade}
                  onChange={(e) => setProposedGrade(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#0f172a',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                  required
                />
              </div>

              {/* Mandatory Supporting Assessment Evidence Reference */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Supporting Assessment Evidence Reference *
                </label>
                <input
                  id="input-evidence-ref"
                  type="text"
                  placeholder="e.g., Remedial Task Portfolio #2026-ENG7-01 or Verified Reassessment Paper"
                  value={evidenceRef}
                  onChange={(e) => setEvidenceRef(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    fontSize: 12.5,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                  required
                />
                <span style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, display: 'block' }}>
                  Cite the specific assessment paper, portfolio, or remedial record supporting this adjustment.
                </span>
              </div>

              {/* Mandatory Academic Justification */}
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Documented Academic Justification *
                </label>
                <textarea
                  id="textarea-consideration-reason"
                  rows={3}
                  placeholder="Provide detailed academic rationale for the proposed consideration (minimum 10 characters)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#0f172a',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '7px 14px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    color: '#475569',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  id="btn-submit-grade-consideration"
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 18px',
                    background: '#8b1e1e',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  <Send size={13} />
                  {isSubmitting ? 'Submitting Request...' : 'Submit to Principal'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
