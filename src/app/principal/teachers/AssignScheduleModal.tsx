import React, { useState, useEffect } from 'react';
import { C } from '../../../app/shared/constants/tokens';
import { apiClient } from '../../../api/client';
import { UserPlus, Calendar, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function AssignScheduleModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    academicYearId: "",
    teacherId: "",
    sectionId: "",
    subjectId: "",
    days: "",
    startTime: "",
    endTime: "",
    room: ""
  });

  useEffect(() => {
    Promise.all([
      apiClient.get('/users'), // Principals can get users now via specific endpoint, wait, do they have user:read? Yes.
      apiClient.get('/academic/subjects'),
      apiClient.get('/academic/years')
    ]).then(([usersData, subjectsData, yearsData]: any) => {
      const teacherUsers = (usersData || []).filter((u: any) => u.roles?.includes('Teacher') && u.teacher?.id);
      setTeachers(teacherUsers);
      setSubjects(subjectsData || []);
      setAcademicYears(yearsData || []);
      
      const currentYear = yearsData?.find((y: any) => y.is_current);
      if (currentYear) {
        setForm(f => ({ ...f, academicYearId: currentYear.id }));
        apiClient.get(`/academic/years/${currentYear.id}/sections`).then(secData => {
          setSections(secData || []);
        });
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      toast.error('Failed to load form data');
      setLoading(false);
    });
  }, []);

  const handleYearChange = async (yearId: string) => {
    setForm(f => ({ ...f, academicYearId: yearId, sectionId: "" }));
    try {
      const secData = await apiClient.get(`/academic/years/${yearId}/sections`);
      setSections(secData as any || []);
    } catch (err) {
      setSections([]);
    }
  };

  const handleSubmit = async () => {
    if (!form.academicYearId || !form.teacherId || !form.sectionId || !form.subjectId) {
      toast.error('Please fill in all required fields (Year, Teacher, Section, Subject)');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/academic/assignments', {
        academicYearId: form.academicYearId,
        teacherId: form.teacherId,
        sectionId: form.sectionId,
        subjectId: form.subjectId,
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room
      });
      toast.success('Schedule assigned successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,8,8,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 6, width: "100%", maxWidth: 500, overflow: "hidden" }}>
        <div style={{ background: C.m800, padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <Calendar size={18} color="#fff" />
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Fraunces',serif" }}>Assign Schedule</div>
        </div>
        
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Loader2 className="animate-spin mx-auto" color={C.m700} /></div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Academic Year *</label>
                <select value={form.academicYearId} onChange={e => handleYearChange(e.target.value)} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12 }}>
                  <option value="">Select Year</option>
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Teacher *</label>
                <select value={form.teacherId} onChange={e => setForm({...form, teacherId: e.target.value})} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12 }}>
                  <option value="">Select Teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.teacher.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Section *</label>
                <select value={form.sectionId} onChange={e => setForm({...form, sectionId: e.target.value})} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12 }}>
                  <option value="">Select Section</option>
                  {sections.map(s => <option key={s.id} value={s.id}>Grade {s.grade_level} - {s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Subject *</label>
                <select value={form.subjectId} onChange={e => setForm({...form, subjectId: e.target.value})} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12 }}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "10px 0" }} />
            
            <div style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces',serif" }}>Schedule Details (Optional)</div>
            
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Days</label>
              <input type="text" value={form.days} onChange={e => setForm({...form, days: e.target.value})} placeholder="e.g. M,W,F" style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Start Time</label>
                <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>End Time</label>
                <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Room</label>
              <input type="text" value={form.room} onChange={e => setForm({...form, room: e.target.value})} placeholder="e.g. Room 101" style={{ width: "100%", border: `1px solid ${C.borderMed}`, borderRadius: 4, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button onClick={onClose} style={{ padding: "8px 16px", background: C.m50, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: C.t2, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving} style={{ padding: "8px 16px", background: C.m700, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : 'Assign Schedule'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
