import React, { useState, useEffect, useMemo } from 'react';
import { C } from '../../../app/shared/constants/tokens';
import { apiClient } from '../../../api/client';
import { Calendar, Clock, Plus, Loader2, X, BookOpen, User, CheckCircle2, AlertTriangle, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '../../shared/AppContext';

export interface AssignScheduleModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialTeacher?: any | null;
}

/**
 * Resolves the designated curriculum grade level (e.g. 7, 8, 9, 10) for a subject.
 * Returns null if the subject is not grade-specific or cannot be deterministically classified.
 */
export function resolveSubjectGradeLevel(subject: { code?: string | null; name?: string | null }): number | null {
  const code = (subject.code || '').trim().toUpperCase();
  const name = (subject.name || '').trim();

  // 1. Primary check: Verified DepEd catalog application codes (e.g. FIL7, MATH10, PEH8)
  const codeMatch = code.match(/^(?:FIL|ENG|MATH|SCI|AP|VE|MA|PEH|TLE)(1[0-2]|[1-9])$/);
  if (codeMatch) {
    return parseInt(codeMatch[1], 10);
  }

  // 2. Secondary check: Code ending in numeric grade level (e.g. G7, -7, _7, 7)
  const codeSuffixMatch = code.match(/(?:^|[_\-\s]|G)(1[0-2]|[1-9])$/);
  if (codeSuffixMatch) {
    return parseInt(codeSuffixMatch[1], 10);
  }

  // 3. Fallback check: Subject name ending in numeric grade level (e.g. "Mathematics 10", "Science 8")
  const nameMatch = name.match(/(?:^|\s|Grade\s*)(1[0-2]|[1-9])$/i);
  if (nameMatch) {
    return parseInt(nameMatch[1], 10);
  }

  return null;
}

export function AssignScheduleModal({ onClose, onSuccess, initialTeacher }: AssignScheduleModalProps) {
  const { refreshTeachers } = useAppContext();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    initialTeacher?.teacher?.id || initialTeacher?.id || ""
  );

  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);

  const [form, setForm] = useState({
    academicYearId: "",
    sectionId: "",
    subjectId: "",
    days: "",
    startTime: "",
    endTime: "",
    room: ""
  });

  useEffect(() => {
    Promise.all([
      apiClient.get('/users'),
      apiClient.get('/academic/subjects'),
      apiClient.get('/academic/years')
    ]).then(([usersData, subjectsData, yearsData]: any) => {
      // Find all valid teacher users
      const teacherUsers = (usersData || []).filter((u: any) =>
        (u.user_roles?.some((ur: any) => ur.role?.name === 'Teacher') || u.roles?.includes('Teacher')) &&
        u.teacher?.id
      );
      setTeachers(teacherUsers);
      setSubjects(subjectsData || []);
      setAcademicYears(yearsData || []);

      const currentYear = yearsData?.find((y: any) => y.is_current) || yearsData?.[0];
      if (currentYear) {
        setForm(f => ({ ...f, academicYearId: currentYear.id }));
        apiClient.get(`/academic/years/${currentYear.id}/sections`).then((secData: any) => {
          setSections(secData || []);
        });
      }

      // If initial teacher provided, populate current assignments
      const targetTeacherId = initialTeacher?.teacher?.id || initialTeacher?.id;
      if (targetTeacherId) {
        setSelectedTeacherId(targetTeacherId);
        const match = teacherUsers.find((t: any) => t.teacher?.id === targetTeacherId);
        if (match?.teacher?.assignments) {
          setTeacherAssignments(match.teacher.assignments);
        } else if (initialTeacher?.teacher?.assignments) {
          setTeacherAssignments(initialTeacher.teacher.assignments);
        }
      }

      setLoading(false);
    }).catch(err => {
      console.error(err);
      toast.error('Failed to load scheduling metadata');
      setLoading(false);
    });
  }, [initialTeacher]);

  // Update active teacher assignments when teacher selection changes
  const handleTeacherChange = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    const found = teachers.find(t => t.teacher?.id === teacherId);
    if (found?.teacher?.assignments) {
      setTeacherAssignments(found.teacher.assignments);
    } else {
      setTeacherAssignments([]);
    }
  };

  const handleYearChange = async (yearId: string) => {
    setForm(f => ({ ...f, academicYearId: yearId, sectionId: "" }));
    try {
      const secData = await apiClient.get(`/academic/years/${yearId}/sections`);
      setSections(secData as any || []);
    } catch (err) {
      setSections([]);
    }
  };

  const activeTeacher = useMemo(() => {
    return teachers.find(t => t.teacher?.id === selectedTeacherId) || (initialTeacher?.teacher?.id === selectedTeacherId ? initialTeacher : null);
  }, [teachers, selectedTeacherId, initialTeacher]);

  const teacherDisplayName = activeTeacher
    ? `${activeTeacher.first_name || activeTeacher.name || ''} ${activeTeacher.last_name || ''}`.trim()
    : 'Select Faculty';

  const teacherPosition = activeTeacher?.teacher?.position || 'Faculty';

  // Selected section and its resolved grade level
  const selectedSection = useMemo(() => {
    return sections.find(s => s.id === form.sectionId) || null;
  }, [sections, form.sectionId]);

  const sectionGradeLevel = selectedSection?.grade_level ?? null;

  // Grade-filtered available subjects for the selected section
  const availableSubjects = useMemo(() => {
    if (sectionGradeLevel === null) {
      return [];
    }
    return subjects.filter(s => {
      const sGrade = resolveSubjectGradeLevel(s);
      return sGrade === null || sGrade === sectionGradeLevel;
    });
  }, [subjects, sectionGradeLevel]);

  // Handle section selection change with automatic incompatible subject clearing
  const handleSectionChange = (newSectionId: string) => {
    const newSec = sections.find(s => s.id === newSectionId);
    const newGrade = newSec?.grade_level ?? null;

    setForm(prev => {
      let nextSubjectId = prev.subjectId;
      if (nextSubjectId) {
        const currentSub = subjects.find(s => s.id === nextSubjectId);
        const subGrade = currentSub ? resolveSubjectGradeLevel(currentSub) : null;
        if (subGrade !== null && subGrade !== newGrade) {
          nextSubjectId = ""; // Clear subject that does not match the new section's grade level
        }
      }
      return {
        ...prev,
        sectionId: newSectionId,
        subjectId: nextSubjectId,
      };
    });
  };

  // Check across all teachers in the school to see if this subject-section-year is already assigned
  const existingAssignmentInSchool = useMemo(() => {
    if (!form.sectionId || !form.subjectId) return null;
    for (const t of teachers) {
      const assignments = t.teacher?.assignments || [];
      const match = assignments.find((a: any) =>
        a.section_id === form.sectionId &&
        a.subject_id === form.subjectId &&
        (!form.academicYearId || !a.academic_year_id || a.academic_year_id === form.academicYearId)
      );
      if (match) {
        const teacherName = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Another Teacher';
        return {
          assignment: match,
          teacherId: t.teacher?.id,
          teacherName,
          isCurrentTeacher: t.teacher?.id === selectedTeacherId,
        };
      }
    }
    return null;
  }, [teachers, form.sectionId, form.subjectId, form.academicYearId, selectedTeacherId]);

  // Legitimate teacher reassignment handler: transfers primary ownership while preserving grades and enrollments
  const handleReassignTeacher = async () => {
    if (!existingAssignmentInSchool?.assignment?.id || !selectedTeacherId) return;

    const selectedSubject = subjects.find(s => s.id === form.subjectId);
    const subName = selectedSubject?.name || 'Subject';
    const secLabel = selectedSection ? `Grade ${selectedSection.grade_level}, Section ${selectedSection.name}` : 'Section';

    const confirmMsg = `Are you sure you want to reassign ${subName} in ${secLabel} from ${existingAssignmentInSchool.teacherName} to ${teacherDisplayName}? This will safely transfer primary gradebook ownership while keeping all student grades and enrollments intact.`;
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const res: any = await apiClient.put(`/academic/assignments/${existingAssignmentInSchool.assignment.id}`, {
        teacherId: selectedTeacherId,
        days: form.days.trim() || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        room: form.room.trim() || undefined,
      });

      const updated = res?.data || res;
      toast.success(`Successfully reassigned ${subName} to ${teacherDisplayName}.`);

      // Update active teacher assignments
      const displayAssignment = {
        ...existingAssignmentInSchool.assignment,
        ...updated,
        teacher_id: selectedTeacherId,
        subject: selectedSubject || existingAssignmentInSchool.assignment.subject,
        section: selectedSection || existingAssignmentInSchool.assignment.section,
      };

      setTeacherAssignments(prev => [...prev.filter(a => a.id !== displayAssignment.id), displayAssignment]);

      // Update local teachers array so conflict state updates immediately
      setTeachers(prev => prev.map(t => {
        if (t.teacher?.id === existingAssignmentInSchool.teacherId) {
          return {
            ...t,
            teacher: {
              ...t.teacher,
              assignments: (t.teacher.assignments || []).filter((a: any) => a.id !== existingAssignmentInSchool.assignment.id)
            }
          };
        }
        if (t.teacher?.id === selectedTeacherId) {
          return {
            ...t,
            teacher: {
              ...t.teacher,
              assignments: [...(t.teacher.assignments || []), displayAssignment]
            }
          };
        }
        return t;
      }));

      try {
        await refreshTeachers();
      } catch (e) {
        console.warn('Background refresh skipped:', e);
      }

      setForm(f => ({
        ...f,
        subjectId: "",
        days: "",
        startTime: "",
        endTime: "",
        room: ""
      }));
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to reassign teacher';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const validateAndSubmit = async (addAnother: boolean = false) => {
    if (!selectedTeacherId) {
      toast.error('Please select a teacher.');
      return;
    }
    if (!form.academicYearId) {
      toast.error('Please select an academic year.');
      return;
    }
    if (!form.sectionId) {
      toast.error('Please select a section.');
      return;
    }
    if (!form.subjectId) {
      toast.error('Please select a subject.');
      return;
    }

    const selectedSubject = subjects.find(s => s.id === form.subjectId);

    // Front-end grade-level compatibility check
    if (selectedSubject && selectedSection) {
      const subGrade = resolveSubjectGradeLevel(selectedSubject);
      if (subGrade !== null && subGrade !== selectedSection.grade_level) {
        toast.error(`${selectedSubject.name} cannot be assigned to a Grade ${selectedSection.grade_level} section. Please select a Grade ${selectedSection.grade_level} subject.`);
        return;
      }
    }

    // Front-end duplicate check against existing assignments for this teacher
    const isDuplicate = teacherAssignments.some(
      a => a.subject_id === form.subjectId && a.section_id === form.sectionId
    );

    if (isDuplicate) {
      const subName = selectedSubject?.name || 'Subject';
      const secLabel = selectedSection ? `Grade ${selectedSection.grade_level}, Section ${selectedSection.name}` : 'Section';
      toast.error(`This teacher is already assigned to ${subName} in ${secLabel}.`);
      return;
    }

    // Front-end primary teacher exclusivity check against other teachers
    if (existingAssignmentInSchool && !existingAssignmentInSchool.isCurrentTeacher) {
      const subName = selectedSubject?.name || 'This subject';
      const secLabel = selectedSection ? `Grade ${selectedSection.grade_level}, Section ${selectedSection.name}` : 'this section';
      toast.error(`${subName} in ${secLabel} is already assigned to ${existingAssignmentInSchool.teacherName}. Use the Reassign button to transfer primary ownership.`);
      return;
    }

    setSaving(true);
    try {
      const res: any = await apiClient.post('/academic/assignments', {
        academicYearId: form.academicYearId,
        teacherId: selectedTeacherId,
        sectionId: form.sectionId,
        subjectId: form.subjectId,
        days: form.days.trim() || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        room: form.room.trim() || undefined
      });

      const newAssignment = res?.data || res;

      // Construct immediate display assignment
      const displayAssignment = {
        id: newAssignment.id || `assign-${Date.now()}`,
        academic_year_id: form.academicYearId,
        teacher_id: selectedTeacherId,
        section_id: form.sectionId,
        subject_id: form.subjectId,
        days: form.days.trim() || null,
        start_time: form.startTime || null,
        end_time: form.endTime || null,
        room: form.room.trim() || null,
        subject: selectedSubject || { id: form.subjectId, name: 'Subject', code: 'SUB' },
        section: selectedSection || { id: form.sectionId, name: 'Section', grade_level: 10 }
      };

      setTeacherAssignments(prev => [...prev, displayAssignment]);

      // Refresh teachers context in the background for real-time reactivity
      try {
        await refreshTeachers();
      } catch (err) {
        console.warn('Background refresh skipped:', err);
      }

      toast.success('Teaching assignment added successfully.');

      if (addAnother) {
        // Reset only subject and schedule details so the user can quickly assign another subject
        setForm(f => ({
          ...f,
          subjectId: "",
          days: "",
          startTime: "",
          endTime: "",
          room: ""
        }));
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to assign schedule';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,8,8,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        
        {/* Modal Header */}
        <div style={{ background: C.m800, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Calendar size={18} color="#fff" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Fraunces',serif" }}>
                Teaching Assignments
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
                {activeTeacher ? `${teacherDisplayName}, ${teacherPosition}` : 'Assign subjects, sections, and class schedules'}
              </div>
            </div>
          </div>
          <button id="btn-close-assign-modal" onClick={onClose} disabled={saving} style={{ background: "none", border: "none", color: "#fff", cursor: saving ? "not-allowed" : "pointer", padding: 4, opacity: 0.8 }}>
            <X size={18} />
          </button>
        </div>
        
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Loader2 className="animate-spin mx-auto" size={28} color={C.m700} />
            <div style={{ fontSize: 12, color: C.t3, marginTop: 12 }}>Loading teaching records...</div>
          </div>
        ) : (
          <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
            
            {/* Top Row: Academic Year and Teacher Selector */}
            <div style={{ display: "grid", gridTemplateColumns: initialTeacher ? "1fr" : "1fr 1fr", gap: 12 }}>
              {!initialTeacher && (
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 5 }}>Teacher *</label>
                  <select
                    value={selectedTeacherId}
                    onChange={e => handleTeacherChange(e.target.value)}
                    style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "7px 10px", fontSize: 12, background: "#fff", color: C.t1 }}
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.teacher.id}>{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Current Teaching Load Table */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <BookOpen size={13} color={C.m700} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Current Teaching Load
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.m700, background: C.m50, padding: "2px 8px", borderRadius: 4 }}>
                  {teacherAssignments.length} Subject{teacherAssignments.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ border: `1px solid ${C.borderMed}`, borderRadius: 6, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: `1px solid ${C.borderMed}`, textAlign: "left" }}>
                      <th style={{ padding: "7px 12px", fontWeight: 700, color: C.t3, textTransform: "uppercase", fontSize: 9 }}>Subject</th>
                      <th style={{ padding: "7px 12px", fontWeight: 700, color: C.t3, textTransform: "uppercase", fontSize: 9 }}>Grade Level</th>
                      <th style={{ padding: "7px 12px", fontWeight: 700, color: C.t3, textTransform: "uppercase", fontSize: 9 }}>Section</th>
                      <th style={{ padding: "7px 12px", fontWeight: 700, color: C.t3, textTransform: "uppercase", fontSize: 9 }}>Schedule</th>
                      <th style={{ padding: "7px 12px", fontWeight: 700, color: C.t3, textTransform: "uppercase", fontSize: 9 }}>Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "20px 12px", textAlign: "center", color: C.t3, fontStyle: "italic", fontSize: 11 }}>
                          No subjects assigned to this teacher for the active school year yet. Add an assignment below.
                        </td>
                      </tr>
                    ) : (
                      teacherAssignments.map((a, idx) => {
                        const sched = a.days
                          ? `${a.days}${a.start_time && a.end_time ? `, ${a.start_time}-${a.end_time}` : ''}`
                          : '—';
                        return (
                          <tr key={a.id || idx} style={{ borderBottom: idx < teacherAssignments.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: C.t1 }}>
                              <div>{a.subject?.name || 'Subject'}</div>
                              {a.subject?.code && <div style={{ fontSize: 9, color: C.t3 }}>{a.subject.code}</div>}
                            </td>
                            <td style={{ padding: "8px 12px", color: C.t2 }}>
                              Grade {a.section?.grade_level || 10}
                            </td>
                            <td style={{ padding: "8px 12px", color: C.t2, fontWeight: 600 }}>
                              {a.section?.name || 'Section'}
                            </td>
                            <td style={{ padding: "8px 12px", color: sched === '—' ? C.t3 : C.t1 }}>
                              {sched}
                            </td>
                            <td style={{ padding: "8px 12px", color: a.room ? C.t1 : C.t3 }}>
                              {a.room || '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add Assignment Form Section */}
            <div style={{ background: "#fafafa", border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Plus size={14} color={C.m700} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>
                  Add Assignment
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 5 }}>
                      Section *
                    </label>
                    <select
                      id="select-assignment-section"
                      value={form.sectionId}
                      onChange={e => handleSectionChange(e.target.value)}
                      style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "7px 10px", fontSize: 12, background: "#fff", color: C.t1 }}
                    >
                      <option value="">Select Section</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>Grade {s.grade_level}, Section {s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 5 }}>
                      Subject *
                    </label>
                    <select
                      id="select-assignment-subject"
                      value={form.subjectId}
                      onChange={e => setForm({ ...form, subjectId: e.target.value })}
                      disabled={!form.sectionId}
                      style={{
                        width: "100%",
                        border: `1px solid ${C.borderMed}`,
                        borderRadius: 4,
                        padding: "7px 10px",
                        fontSize: 12,
                        background: form.sectionId ? "#fff" : "#f8fafc",
                        color: form.sectionId ? C.t1 : C.t3,
                        cursor: form.sectionId ? "default" : "not-allowed"
                      }}
                    >
                      <option value="">
                        {form.sectionId ? `Select Grade ${sectionGradeLevel} Subject` : 'Select Section first'}
                      </option>
                      {availableSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Primary Teacher Exclusivity Conflict & Reassignment Action */}
                {existingAssignmentInSchool && !existingAssignmentInSchool.isCurrentTeacher && (
                  <div
                    id="alert-primary-teacher-conflict"
                    className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-semibold text-rose-950">Primary Teacher Conflict:</span>{' '}
                        <span>
                          <strong>{subjects.find(s => s.id === form.subjectId)?.name || 'This subject'}</strong> in{' '}
                          <strong>Grade {selectedSection?.grade_level} — {selectedSection?.name}</strong> is already assigned to{' '}
                          <strong className="underline decoration-rose-400">{existingAssignmentInSchool.teacherName}</strong>.
                        </span>
                        <div className="mt-1 text-[11px] text-rose-700">
                          Two teachers cannot share primary gradebook ownership for the same subject and section. You may reassign this subject to transfer ownership while keeping all student enrollments and existing grades intact.
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        id="btn-reassign-teacher"
                        type="button"
                        disabled={saving}
                        onClick={handleReassignTeacher}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-medium text-xs transition-colors shadow-sm disabled:opacity-50"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        {saving ? 'Reassigning...' : `Reassign Subject to ${teacherDisplayName}`}
                      </button>
                    </div>
                  </div>
                )}

                {/* Schedule Details (Optional) */}
                <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Schedule Details (Optional)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, color: C.t3, marginBottom: 4 }}>Days</label>
                      <input
                        id="input-assignment-days"
                        type="text"
                        value={form.days}
                        onChange={e => setForm({ ...form, days: e.target.value })}
                        placeholder="e.g. M,W,F"
                        style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "6px 8px", fontSize: 11, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, color: C.t3, marginBottom: 4 }}>Start Time</label>
                      <input
                        id="input-assignment-start-time"
                        type="time"
                        value={form.startTime}
                        onChange={e => setForm({ ...form, startTime: e.target.value })}
                        style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "5px 8px", fontSize: 11, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, color: C.t3, marginBottom: 4 }}>End Time</label>
                      <input
                        id="input-assignment-end-time"
                        type="time"
                        value={form.endTime}
                        onChange={e => setForm({ ...form, endTime: e.target.value })}
                        style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "5px 8px", fontSize: 11, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9.5, fontWeight: 600, color: C.t3, marginBottom: 4 }}>Room</label>
                      <input
                        id="input-assignment-room"
                        type="text"
                        value={form.room}
                        onChange={e => setForm({ ...form, room: e.target.value })}
                        placeholder="e.g. Room 201"
                        style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "6px 8px", fontSize: 11, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    style={{ padding: "7px 14px", background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 11, fontWeight: 600, color: C.t2, cursor: saving ? "not-allowed" : "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-save-and-add-another"
                    type="button"
                    onClick={() => validateAndSubmit(true)}
                    disabled={saving}
                    style={{
                      padding: "7px 14px",
                      background: "#fff",
                      border: `1px solid ${C.m700}`,
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.m700,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    {saving ? 'Saving...' : 'Save & Add Another'}
                  </button>
                  <button
                    id="btn-save-assignment"
                    type="button"
                    onClick={() => validateAndSubmit(false)}
                    disabled={saving}
                    style={{
                      padding: "7px 16px",
                      background: C.m700,
                      border: "none",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>

              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
