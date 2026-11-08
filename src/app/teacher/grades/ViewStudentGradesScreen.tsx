import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  BookOpen, 
  Award, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Eye, 
  FileText,
  UserCheck,
  ChevronRight,
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { apiClient } from '../../../api/client';

interface StudentSubjectTerm {
  score: number | null;
  status: 'PUBLISHED' | 'UNPUBLISHED' | 'NOT_ENCODED' | 'ADJUSTED';
  isAdjusted: boolean;
  adjustmentReason?: string;
}

interface StudentSubject {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  teacherEmployeeId: string | null;
  terms: Record<string, StudentSubjectTerm>;
  finalRating: number | null;
  remarks: 'PASSED' | 'FAILED' | null;
}

interface StudentRecord {
  studentId: string;
  enrollmentId: string;
  lrn: string;
  name: string;
  gender: string;
  gradeLevel: number;
  sectionId: string;
  sectionName: string;
  adviserName: string;
  generalAverage: number | null;
  generalAverageRemarks: 'PASSED' | 'FAILED' | null;
  subjects: StudentSubject[];
}

export function ViewStudentGradesScreen() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [terms, setTerms] = useState<string[]>(['T1', 'T2', 'T3']);
  const [academicYearName, setAcademicYearName] = useState('SY 2026-2027');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // Selected Student for Detail Modal
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  useEffect(() => {
    fetchSchoolGrades();
  }, []);

  const fetchSchoolGrades = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<any>('/academic/school/students-grades');
      const data = res?.data || res;
      if (data?.students) {
        setStudents(data.students);
        if (data.terms) setTerms(data.terms);
        if (data.academicYear?.name) setAcademicYearName(data.academicYear.name);
      }
    } catch (err: any) {
      console.error('Failed to fetch school student grades:', err);
      setError(err.response?.data?.message || err.message || 'Unable to load school-wide student grades directory.');
    } finally {
      setIsLoading(false);
    }
  };

  // Distinct section names for filter
  const availableSections = useMemo(() => {
    const sectionSet = new Set<string>();
    students.forEach(s => {
      if (selectedGrade === 'ALL' || String(s.gradeLevel) === selectedGrade) {
        sectionSet.add(s.sectionName);
      }
    });
    return Array.from(sectionSet).sort();
  }, [students, selectedGrade]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Grade Level filter
      if (selectedGrade !== 'ALL' && String(s.gradeLevel) !== selectedGrade) {
        return false;
      }
      // Section filter
      if (selectedSection !== 'ALL' && s.sectionName !== selectedSection) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesLrn = s.lrn.toLowerCase().includes(query);
        const matchesAdviser = s.adviserName.toLowerCase().includes(query);
        if (!matchesName && !matchesLrn && !matchesAdviser) {
          return false;
        }
      }
      return true;
    });
  }, [students, selectedGrade, selectedSection, searchTerm]);

  // Statistics
  const totalStudents = students.length;
  const publishedCount = useMemo(() => {
    return students.filter(s => s.subjects.some(subj => subj.terms?.T1?.status === 'PUBLISHED' || subj.terms?.T1?.status === 'ADJUSTED')).length;
  }, [students]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc', overflow: 'hidden' }}>
      {/* Top Banner / Filter Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: '#8b1e1e', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
                CALULUT INTEGRATED SCHOOL
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: 4 }}>
                {academicYearName}
              </span>
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              School-Wide Student Academic Directory
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0' }}>
              Authorized read-only cross-subject viewing for legitimate academic coordination under DepEd Order No. 015, s. 2026.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Active School Enrollees</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#8b1e1e' }}>{totalStudents} Learners</div>
            </div>
            <div style={{ height: 28, width: 1, background: '#cbd5e1' }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>With Published Ratings</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>{publishedCount} Learners</div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              id="input-school-grades-search"
              type="text"
              placeholder="Search by learner name, LRN, or class adviser..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                fontSize: 12.5,
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Grade Level Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Grade:</span>
            <select
              id="select-filter-grade-level"
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedSection('ALL');
              }}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 7,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Grade Levels</option>
              <option value="7">Grade 7</option>
              <option value="8">Grade 8</option>
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
            </select>
          </div>

          {/* Section Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Section:</span>
            <select
              id="select-filter-section"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 7,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Sections</option>
              {availableSections.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, marginLeft: 'auto' }}>
            Showing {filteredStudents.length} of {totalStudents} learners
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, gap: 12, color: '#64748b' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#8b1e1e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Loading school-wide student academic directory...</span>
          </div>
        ) : error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 20, color: '#991b1b', maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
            <AlertCircle size={28} style={{ margin: '0 auto 8px auto', color: '#dc2626' }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px 0' }}>Unable to Access Academic Overview</h3>
            <p style={{ fontSize: 12.5, margin: 0 }}>{error}</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12, padding: '48px 24px', textAlign: 'center', maxWidth: 500, margin: '40px auto' }}>
            <GraduationCap size={40} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>No Enrolled Learners Found</h3>
            <p style={{ fontSize: 12.5, color: '#64748b', margin: 0 }}>
              No students match the current filter or search criteria. Try selecting "All Grade Levels" or clearing your search.
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 16px' }}>Learner Name</th>
                  <th style={{ padding: '12px 16px' }}>LRN</th>
                  <th style={{ padding: '12px 16px' }}>Section & Adviser</th>
                  <th style={{ padding: '12px 16px' }}>Subjects Enrolled</th>
                  <th style={{ padding: '12px 16px' }}>T1 Published Status</th>
                  <th style={{ padding: '12px 16px' }}>General Average</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, idx) => {
                  const publishedT1Count = s.subjects.filter(subj => subj.terms?.T1?.status === 'PUBLISHED' || subj.terms?.T1?.status === 'ADJUSTED').length;
                  const totalSubjs = s.subjects.length;
                  const hasAdjustment = s.subjects.some(subj => subj.terms?.T1?.isAdjusted);

                  return (
                    <tr
                      key={s.studentId}
                      style={{
                        borderBottom: idx === filteredStudents.length - 1 ? 'none' : '1px solid #f1f5f9',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{s.name}</span>
                          {hasAdjustment && (
                            <span 
                              title="Student has an approved grade consideration under DepEd policy"
                              style={{ display: 'inline-flex', alignItems: 'center', background: '#ede9fe', color: '#6d28d9', fontSize: 9.5, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}
                            >
                              <Sparkles size={10} style={{ marginRight: 2 }} /> Adjusted
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{s.gender}</div>
                      </td>

                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11.5, color: '#334155', fontWeight: 600 }}>
                        {s.lrn}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                          Grade {s.gradeLevel} – {s.sectionName}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <UserCheck size={11} color="#059669" /> Adviser: {s.adviserName}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>
                        {totalSubjs} Subjects
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {publishedT1Count === totalSubjs && totalSubjs > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                            <CheckCircle2 size={12} color="#059669" /> All {totalSubjs} Published
                          </span>
                        ) : publishedT1Count > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fffbeb', color: '#b45309', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                            <Clock size={12} color="#d97706" /> {publishedT1Count} of {totalSubjs} Published
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                            Not Published
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {s.generalAverage !== null ? (
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 800, color: s.generalAverage >= 75 ? '#047857' : '#b91c1c' }}>
                              {s.generalAverage}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 4, color: s.generalAverage >= 75 ? '#059669' : '#dc2626' }}>
                              ({s.generalAverageRemarks})
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Pending Publication</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          id={`btn-view-student-${s.lrn}`}
                          type="button"
                          onClick={() => setSelectedStudent(s)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 12px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            color: '#1e293b',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#8b1e1e';
                            e.currentTarget.style.color = '#fff';
                            e.currentTarget.style.borderColor = '#8b1e1e';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.color = '#1e293b';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                          }}
                        >
                          <Eye size={12} /> View Grades
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Student Detail Modal */}
      {selectedStudent && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: 820,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #cbd5e1'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ background: '#8b1e1e', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Student Academic Performance Record • Read-Only
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: '2px 0 0 0', color: '#fff' }}>
                  {selectedStudent.name}
                </h2>
                <div style={{ fontSize: 11.5, color: '#fee2e2', marginTop: 2 }}>
                  LRN: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedStudent.lrn}</span> • Grade {selectedStudent.gradeLevel} – {selectedStudent.sectionName} • Class Adviser: {selectedStudent.adviserName}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {/* Notice Banner */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <BookOpen size={16} color="#8b1e1e" />
                <div style={{ fontSize: 11.5, color: '#475569' }}>
                  <strong>Calulut Academic Coordination:</strong> Only officially assigned subject teachers may encode or update assessment scores. Raw unpublished drafts and confidential clinic records are strictly protected.
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: 11, fontWeight: 700 }}>
                      <th style={{ padding: '10px 14px' }}>Subject</th>
                      <th style={{ padding: '10px 14px' }}>Assigned Teacher</th>
                      {terms.map(t => (
                        <th key={t} style={{ padding: '10px 14px', textAlign: 'center' }}>{t} Rating</th>
                      ))}
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Final</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudent.subjects.map((subj, idx) => {
                      return (
                        <tr 
                          key={subj.subjectId}
                          style={{ borderBottom: idx === selectedStudent.subjects.length - 1 ? 'none' : '1px solid #f1f5f9' }}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                            {subj.subjectName}
                            <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
                              {subj.subjectCode}
                            </span>
                          </td>

                          <td style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>
                            {subj.teacherName}
                          </td>

                          {terms.map(t => {
                            const termData = subj.terms?.[t];
                            const isPublished = termData?.status === 'PUBLISHED' || termData?.status === 'ADJUSTED';
                            const isAdjusted = termData?.isAdjusted;

                            return (
                              <td key={t} style={{ padding: '10px 14px', textAlign: 'center' }}>
                                {isPublished && termData?.score !== null ? (
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 800,
                                      background: isAdjusted ? '#ede9fe' : termData.score >= 75 ? '#ecfdf5' : '#fef2f2',
                                      color: isAdjusted ? '#6d28d9' : termData.score >= 75 ? '#047857' : '#b91c1c',
                                      border: `1px solid ${isAdjusted ? '#c4b5fd' : termData.score >= 75 ? '#a7f3d0' : '#fecaca'}`
                                    }}>
                                      {termData.score}
                                    </span>
                                    {isAdjusted && (
                                      <span style={{ fontSize: 9, color: '#6d28d9', fontWeight: 700, marginTop: 2 }}>
                                        Adjusted ★
                                      </span>
                                    )}
                                  </div>
                                ) : termData?.status === 'UNPUBLISHED' ? (
                                  <span style={{ fontSize: 10.5, fontWeight: 600, color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>
                                    Unpublished
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 10.5, fontWeight: 500, color: '#94a3b8' }}>
                                    Not Encoded
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>
                            {subj.finalRating !== null ? (
                              <span style={{ color: subj.finalRating >= 75 ? '#047857' : '#b91c1c' }}>
                                {subj.finalRating}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                            )}
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {subj.remarks ? (
                              <span style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: subj.remarks === 'PASSED' ? '#ecfdf5' : '#fef2f2',
                                color: subj.remarks === 'PASSED' ? '#047857' : '#b91c1c'
                              }}>
                                {subj.remarks}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Adjustment Audit Footnote if any */}
              {selectedStudent.subjects.some(subj => Object.values(subj.terms).some(t => t.isAdjusted)) && (
                <div style={{ marginTop: 16, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} color="#9333ea" /> Documented Grade Consideration History:
                  </div>
                  {selectedStudent.subjects.map(subj => {
                    return Object.entries(subj.terms).map(([termKey, termData]) => {
                      if (!termData.isAdjusted || !termData.adjustmentReason) return null;
                      return (
                        <div key={`${subj.subjectId}-${termKey}`} style={{ fontSize: 11, color: '#581c87', marginTop: 4 }}>
                          • <strong>{subj.subjectName} ({termKey}):</strong> {termData.adjustmentReason}
                        </div>
                      );
                    });
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                General Average:{' '}
                {selectedStudent.generalAverage !== null ? (
                  <strong style={{ color: selectedStudent.generalAverage >= 75 ? '#047857' : '#b91c1c', fontSize: 13 }}>
                    {selectedStudent.generalAverage} ({selectedStudent.generalAverageRemarks})
                  </strong>
                ) : (
                  <span style={{ fontStyle: 'italic' }}>Pending completion of all subject term grades</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                style={{
                  padding: '6px 16px',
                  background: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
