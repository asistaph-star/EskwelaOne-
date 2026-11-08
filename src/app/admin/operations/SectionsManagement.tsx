import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  GraduationCap, Search, UserCheck, AlertCircle, CheckCircle2,
  RefreshCw, Filter, ShieldCheck, ChevronRight, X, UserX, Calendar,
  Building2, ArrowRightLeft, Plus, Trash2, Layers, AlertTriangle
} from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { apiClient } from "../../../api/client";
import { academicApi, Section, AcademicYear, Term } from "../../../api/academic.api";
import { useAppContext } from "../../shared/AppContext";
import { SchoolYearReadinessConsole } from "../../shared/components/SchoolYearReadinessConsole";

interface EligibleTeacher {
  userId: string;
  teacherId: string;
  schoolId: string;
  fullName: string;
  department: string;
  position: string;
  email?: string | null;
}

export interface SectionsManagementProps {
  readOnly?: boolean;
}

export function SectionsManagement({ readOnly = false }: SectionsManagementProps = {}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [assignModalSection, setAssignModalSection] = useState<Section | null>(null);
  const [eligibleTeachers, setEligibleTeachers] = useState<EligibleTeacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState<boolean>(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showReadinessModal, setShowReadinessModal] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // User and Term Management State
  const { currentUser } = useAppContext();
  const canManageTerms = currentUser?.rawRoles?.some((r: string) => r === 'Admin' || r === 'ITAdmin') ||
    currentUser?.role === 'Admin' || currentUser?.role === 'ITAdmin';

  const activeAY = useMemo(() => {
    if (selectedYearId !== "all") {
      return academicYears.find(ay => ay.id === selectedYearId) || null;
    }
    return academicYears.find((ay: any) => ay.is_current) || academicYears[0] || null;
  }, [academicYears, selectedYearId]);

  const [yearTerms, setYearTerms] = useState<Term[]>([]);
  const [loadingTerms, setLoadingTerms] = useState<boolean>(false);
  const [termActionLoading, setTermActionLoading] = useState<boolean>(false);
  const [termError, setTermError] = useState<string | null>(null);

  // Term Modal Confirmation State
  const [termConfirmModal, setTermConfirmModal] = useState<{
    action: 'ADD' | 'REMOVE';
    yearId: string;
    yearName: string;
    termKey: string;
    termId?: string;
    needsPublishedOverride?: boolean;
    confirmPublishedOverride?: boolean;
  } | null>(null);

  const fetchTerms = useCallback(async (yearId: string) => {
    setLoadingTerms(true);
    setTermError(null);
    try {
      const res: any = await academicApi.getTerms(yearId);
      const data = res?.data || res || [];
      setYearTerms(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load terms:", err);
      setTermError(err?.response?.data?.message || err.message || "Failed to load terms.");
    } finally {
      setLoadingTerms(false);
    }
  }, []);

  useEffect(() => {
    if (activeAY?.id) {
      fetchTerms(activeAY.id);
    }
  }, [activeAY, fetchTerms]);

  const handleAddTermClick = () => {
    if (!activeAY) return;
    const nextKeys: Record<number, string> = {
      0: 'T1',
      1: 'T2',
      2: 'T3',
      3: 'T4'
    };
    const nextKey = nextKeys[yearTerms.length];
    if (!nextKey) return;
    setTermError(null);
    setTermConfirmModal({
      action: 'ADD',
      yearId: activeAY.id,
      yearName: activeAY.name,
      termKey: nextKey,
    });
  };

  const handleRemoveTermClick = () => {
    if (!activeAY || yearTerms.length <= 3) return;
    const highestTerm = yearTerms[yearTerms.length - 1];
    setTermError(null);
    setTermConfirmModal({
      action: 'REMOVE',
      yearId: activeAY.id,
      yearName: activeAY.name,
      termKey: highestTerm.key,
      termId: highestTerm.id,
    });
  };

  const handleConfirmTermAction = async () => {
    if (!termConfirmModal) return;
    setTermActionLoading(true);
    setTermError(null);
    try {
      if (termConfirmModal.action === 'ADD') {
        await academicApi.addTerm(termConfirmModal.yearId, {
          key: termConfirmModal.termKey,
          confirm: true,
          confirmPublishedOverride: termConfirmModal.confirmPublishedOverride || false,
          confirmedAcademicYearId: termConfirmModal.confirmPublishedOverride ? termConfirmModal.yearId : undefined,
        });
        showToast(`Term ${termConfirmModal.termKey} successfully added to ${termConfirmModal.yearName}.`);
      } else if (termConfirmModal.action === 'REMOVE' && termConfirmModal.termId) {
        await academicApi.removeTerm(termConfirmModal.yearId, termConfirmModal.termId);
        showToast(`Term ${termConfirmModal.termKey} successfully removed from ${termConfirmModal.yearName}.`);
      }
      setTermConfirmModal(null);
      await fetchTerms(termConfirmModal.yearId);
    } catch (err: any) {
      console.error("Term action failed:", err);
      const errCode = err?.response?.data?.code;
      const errMsg = err?.response?.data?.message || err.message || "Operation failed.";
      if (errCode === 'PUBLISHED_RESULTS_EXIST') {
        setTermConfirmModal(prev => prev ? ({ ...prev, needsPublishedOverride: true }) : null);
      }
      setTermError(errMsg);
    } finally {
      setTermActionLoading(false);
    }
  };

  // 1. Fetch Academic Years
  useEffect(() => {
    academicApi.getYears()
      .then((res: any) => {
        const years = res?.data || res || [];
        setAcademicYears(Array.isArray(years) ? years : []);
      })
      .catch((err) => console.error("Failed to load academic years:", err));
  }, []);

  // 2. Fetch Sections
  const fetchSections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedYearId !== "all") params.yearId = selectedYearId;
      if (selectedGrade !== "all") params.gradeLevel = parseInt(selectedGrade, 10);

      const res: any = await academicApi.getAllSections(params);
      const data = res?.data || res || [];
      setSections(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to fetch sections:", err);
      setError(err?.response?.data?.message || err.message || "Failed to load sections.");
    } finally {
      setLoading(false);
    }
  }, [selectedYearId, selectedGrade]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  // 3. Fetch Eligible Teachers when Modal Opens
  const openAssignModal = async (section: Section) => {
    setAssignModalSection(section);
    setSelectedTeacherId(section.adviser_teacher_id || "");
    setModalError(null);
    setLoadingTeachers(true);

    try {
      const res: any = await apiClient.get<any>("/users?role=Teacher&status=active");
      const userList = res?.data || res || [];

      // Filter strictly active teachers who possess a valid teacher profile
      const teachers: EligibleTeacher[] = (Array.isArray(userList) ? userList : [])
        .filter((u: any) => u.status === "active" && u.teacher && u.teacher.id)
        .map((u: any) => {
          const middle = u.middle_name ? `${u.middle_name[0]}. ` : "";
          return {
            userId: u.id,
            teacherId: u.teacher.id, // CRITICAL: Teacher table ID for adviser assignment
            schoolId: u.school_id || u.teacher.employee_id,
            fullName: `${u.last_name}, ${u.first_name} ${middle}`.trim(),
            department: u.teacher.department || "General Faculty",
            position: u.teacher.position || "Teacher",
            email: u.email,
          };
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      setEligibleTeachers(teachers);
    } catch (err: any) {
      console.error("Failed to load eligible teachers:", err);
      setModalError("Unable to load eligible teachers. Please retry.");
    } finally {
      setLoadingTeachers(false);
    }
  };

  const closeAssignModal = () => {
    setAssignModalSection(null);
    setSelectedTeacherId("");
    setModalError(null);
  };

  // 4. Handle Save Adviser Assignment
  const handleSaveAdviser = async () => {
    if (!assignModalSection) return;
    if (!selectedTeacherId) {
      setModalError("Please select a Teacher to designate as Class Adviser.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      // Execute PATCH /api/academic/sections/:sectionId/adviser with Teacher.id
      const res: any = await academicApi.assignAdviser(assignModalSection.id, selectedTeacherId);

      const chosenTeacher = eligibleTeachers.find(t => t.teacherId === selectedTeacherId);
      const teacherName = chosenTeacher ? chosenTeacher.fullName : "Teacher";

      showToast(`Class Adviser successfully assigned to Grade ${assignModalSection.grade_level} - ${assignModalSection.name}: ${teacherName}`);
      closeAssignModal();
      fetchSections();
    } catch (err: any) {
      console.error("Adviser assignment failed:", err);
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || err.message || "Failed to assign Class Adviser.";
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter sections in memory by search query
  const filteredSections = sections.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = s.name.toLowerCase().includes(q);
    const gradeMatch = `grade ${s.grade_level}`.includes(q) || String(s.grade_level) === q;
    const adviserMatch = s.adviser_name_snapshot?.toLowerCase().includes(q) ||
      (s.adviser_teacher?.user && `${s.adviser_teacher.user.first_name} ${s.adviser_teacher.user.last_name}`.toLowerCase().includes(q));
    const yearMatch = s.academic_year?.name?.toLowerCase().includes(q);
    return nameMatch || gradeMatch || adviserMatch || yearMatch;
  });

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24, minHeight: "100%" }}>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed", top: 24, right: 32, zIndex: 1000,
          background: C.green, color: "#fff", padding: "12px 20px", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 600, animation: "fadeIn 0.2s ease-out"
        }}>
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      {/* Screen Title & Description */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.m700, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            <GraduationCap size={16} /> Academic Administration
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>
            Class Sections and Advisers
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.t3, maxWidth: 680, lineHeight: 1.5 }}>
            Designate authorized Class Advisers to academic sections. Class Advisers hold official governance for SF2 attendance, SF9 report card ratings, and SF8 nutritional health monitoring.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {readOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, color: '#1e40af', fontSize: 12, fontWeight: 700 }}>
              <ShieldCheck size={14} color="#1d4ed8" />
              <span>Registrar View (Read-Only)</span>
            </div>
          )}
          <button
            id="admin-readiness-btn"
            onClick={() => setShowReadinessModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
              background: "#0f172a", border: "none", borderRadius: 8,
              color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer"
            }}
          >
            <AlertCircle size={14} />
            Completion Review
          </button>

          <button
            onClick={fetchSections}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
              background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8,
              color: C.t2, fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", background: "#fff", padding: "16px 20px", borderRadius: 12, border: `1px solid ${C.borderLight}`, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={16} color={C.t3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search by section, grade, adviser..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px 8px 36px", fontSize: 13,
              borderRadius: 6, border: `1px solid ${C.borderMed}`, background: C.paper,
              color: C.t1, outline: "none"
            }}
          />
        </div>

        {/* Academic Year Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={15} color={C.t3} />
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            style={{
              padding: "8px 12px", fontSize: 13, borderRadius: 6,
              border: `1px solid ${C.borderMed}`, background: C.paper, color: C.t1, outline: "none"
            }}
          >
            <option value="all">All Academic Years</option>
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.status ? `(${ay.status})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Grade Level Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={15} color={C.t3} />
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            style={{
              padding: "8px 12px", fontSize: 13, borderRadius: 6,
              border: `1px solid ${C.borderMed}`, background: C.paper, color: C.t1, outline: "none"
            }}
          >
            <option value="all">All Grades</option>
            <option value="7">Grade 7</option>
            <option value="8">Grade 8</option>
            <option value="9">Grade 9</option>
            <option value="10">Grade 10</option>
            <option value="11">Grade 11</option>
            <option value="12">Grade 12</option>
          </select>
        </div>
      </div>

      {/* Academic Term Configuration & Governance Card */}
      {activeAY && (
        <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: "18px 24px", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: "rgba(139, 30, 30, 0.08)",
                display: "flex", alignItems: "center", justifyContent: "center", color: C.m700
              }}>
                <Layers size={20} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.t1, margin: 0, fontFamily: "'Fraunces', serif" }}>
                    Academic Terms ({activeAY.name})
                  </h3>
                  <span style={{ fontSize: 11, background: "#ecfdf5", color: "#065f46", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                    {yearTerms.length} {yearTerms.length === 1 ? 'Term' : 'Terms'} Configured
                  </span>
                  {!canManageTerms && (
                    <span style={{ fontSize: 10.5, background: "#f1f5f9", color: "#475569", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                      Read-Only (Principal Oversight)
                    </span>
                  )}
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 11.5, color: C.t3 }}>
                  Active evaluation periods for gradebooks, trimester assessments, and DepEd Form 138 (SF9) scholastic summaries.
                </p>
              </div>
            </div>

            {/* Admin Controls */}
            {canManageTerms && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {yearTerms.length < 4 && (
                  <button
                    onClick={handleAddTermClick}
                    disabled={loadingTerms || termActionLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                      background: C.m700, color: "#fff", border: "none", borderRadius: 7,
                      fontSize: 12, fontWeight: 700, cursor: (loadingTerms || termActionLoading) ? "not-allowed" : "pointer",
                      boxShadow: "0 2px 5px rgba(139, 30, 30, 0.2)",
                    }}
                  >
                    <Plus size={14} />
                    Add Term T{yearTerms.length + 1}
                  </button>
                )}

                {yearTerms.length > 3 && (
                  <button
                    onClick={handleRemoveTermClick}
                    disabled={loadingTerms || termActionLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                      background: "#fff", color: C.red, border: `1px solid ${C.red}`, borderRadius: 7,
                      fontSize: 12, fontWeight: 700, cursor: (loadingTerms || termActionLoading) ? "not-allowed" : "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                    Remove Term {yearTerms[yearTerms.length - 1]?.key}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Error Message if term action failed */}
          {termError && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{termError}</span>
            </div>
          )}

          {/* Term Badges */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {loadingTerms ? (
              <div style={{ fontSize: 12, color: C.t3, display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={13} className="animate-spin" /> Loading term configuration...
              </div>
            ) : yearTerms.length > 0 ? (
              yearTerms.map((t, idx) => (
                <div key={t.id || idx} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                  background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 8,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 5, background: C.m700, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800
                  }}>
                    {t.key}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>
                    {t.name || `Term ${t.key.replace('T', '')}`}
                  </span>
                  <span style={{ fontSize: 10.5, color: C.t3 }}>
                    {idx === yearTerms.length - 1 ? '(Highest Active Term)' : '(Sequence Term)'}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: C.t3 }}>No terms configured for this academic year.</div>
            )}
          </div>
        </div>
      )}

      {/* Sections Table Card */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
        {error && (
          <div style={{ padding: "16px 20px", background: C.redBg, color: C.red, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: C.t3, fontSize: 14 }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px", color: C.m700 }} />
            Loading academic sections and adviser designations...
          </div>
        ) : filteredSections.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: C.t3 }}>
            <GraduationCap size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t2, marginBottom: 4 }}>No Sections Found</div>
            <div style={{ fontSize: 13 }}>No academic sections match the selected criteria or search term.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: C.paper, borderBottom: `1px solid ${C.borderMed}`, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.t3 }}>
                <th style={{ padding: "14px 20px" }}>Grade Level</th>
                <th style={{ padding: "14px 20px" }}>Section</th>
                <th style={{ padding: "14px 20px" }}>School Year</th>
                <th style={{ padding: "14px 20px" }}>Class Adviser</th>
                <th style={{ padding: "14px 20px" }}>Employee ID and Department</th>
                <th style={{ padding: "14px 20px", textAlign: "right" }}>Adviser Assignment Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSections.map((sec, idx) => {
                const hasAdviser = !!sec.adviser_teacher_id;
                const adviserName = sec.adviser_name_snapshot ||
                  (sec.adviser_teacher?.user ? `${sec.adviser_teacher.user.first_name} ${sec.adviser_teacher.user.last_name}` : null);
                const employeeId = sec.adviser_teacher?.employee_id || sec.adviser_teacher?.user?.school_id || "—";
                const department = sec.adviser_teacher?.department || "Faculty";

                return (
                  <tr
                    key={sec.id}
                    style={{
                      borderBottom: `1px solid ${C.borderLight}`,
                      background: idx % 2 === 0 ? "#fff" : "rgba(248, 250, 252, 0.5)",
                      transition: "background 0.15s"
                    }}
                  >
                    {/* Grade Level */}
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: sec.grade_level === 10 ? C.purpleBg : sec.grade_level === 9 ? C.blueBg : C.m50,
                        color: sec.grade_level === 10 ? C.purple : sec.grade_level === 9 ? C.blue : C.m700,
                        border: `1px solid ${sec.grade_level === 10 ? C.purple : sec.grade_level === 9 ? C.blue : C.m700}30`
                      }}>
                        Grade {sec.grade_level}
                      </span>
                    </td>

                    {/* Section */}
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>
                        {sec.name}
                      </span>
                    </td>

                    {/* Academic Year */}
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ fontSize: 13, color: C.t2, fontWeight: 500 }}>
                        {sec.academic_year?.name || "AY 2026-2027"}
                      </span>
                    </td>

                    {/* Class Adviser */}
                    <td style={{ padding: "16px 20px" }}>
                      {hasAdviser ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.greenBg, color: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
                            <UserCheck size={16} />
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>
                              {adviserName}
                            </div>
                            <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>
                              Adviser Assigned
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: C.amberBg, color: C.amber, border: `1px solid ${C.amber}40`,
                            display: "inline-flex", alignItems: "center", gap: 5
                          }}>
                            <AlertCircle size={13} /> Class Adviser Not Assigned
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Faculty ID / Department */}
                    <td style={{ padding: "16px 20px" }}>
                      {hasAdviser ? (
                        <div>
                          <div style={{ fontSize: 13, color: C.t1, fontFamily: "monospace", fontWeight: 600 }}>
                            {employeeId}
                          </div>
                          <div style={{ fontSize: 11, color: C.t3 }}>
                            {department}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: C.t3, fontStyle: "italic" }}>No adviser linked</span>
                      )}
                    </td>

                    {/* Action */}
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      {readOnly ? (
                        <span style={{ fontSize: 11, color: C.t3, fontStyle: "italic", background: C.paper, padding: "5px 12px", borderRadius: 4, border: `1px solid ${C.borderMed}`, fontWeight: 600 }}>
                          Read-Only Roster
                        </span>
                      ) : (
                        <button
                          onClick={() => openAssignModal(sec)}
                          style={{
                            padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                            background: hasAdviser ? "#fff" : C.green,
                            color: hasAdviser ? C.m700 : "#fff",
                            border: hasAdviser ? `1px solid ${C.borderMed}` : "none",
                            boxShadow: hasAdviser ? "none" : "0 2px 6px rgba(21, 94, 54, 0.2)",
                            transition: "all 0.15s"
                          }}
                        >
                          {hasAdviser ? (
                            <>
                              <ArrowRightLeft size={13} /> Change Adviser
                            </>
                          ) : (
                            <>
                              <UserCheck size={13} /> Assign Class Adviser
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ASSIGN / REASSIGN ADVISER MODAL */}
      {assignModalSection && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: "#fff", width: "100%", maxWidth: 540, borderRadius: 16,
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden", display: "flex", flexDirection: "column"
          }}>
            {/* Modal Header */}
            <div style={{
              background: C.m800, padding: "20px 24px", color: "#fff",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8, marginBottom: 2 }}>
                  Academic Section Advisory Designation
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Fraunces',serif" }}>
                  {assignModalSection.adviser_teacher_id ? "Change Class Adviser" : "Assign Class Adviser"}
                </div>
              </div>
              <button
                onClick={closeAssignModal}
                style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", opacity: 0.8 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Target Section Info Card */}
              <div style={{ background: C.paper, border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Target Section</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>
                    Grade {assignModalSection.grade_level} - {assignModalSection.name}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Academic Year</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.m700 }}>
                    {assignModalSection.academic_year?.name || "SY 2026-2027"}
                  </div>
                </div>
              </div>

              {/* Current Adviser Banner */}
              {assignModalSection.adviser_teacher_id && (
                <div style={{ background: C.amberBg, border: `1px solid ${C.amber}40`, borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AlertCircle size={16} color={C.amber} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: C.amber, lineHeight: 1.4 }}>
                    <strong>Reassignment Notice:</strong> Currently advised by <strong>{assignModalSection.adviser_name_snapshot}</strong>. Selecting another teacher will transfer section governance immediately. The previous adviser will retain standard subject-teaching permissions.
                  </div>
                </div>
              )}

              {/* Error in modal */}
              {modalError && (
                <div style={{ background: C.redBg, border: `1px solid ${C.red}40`, borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                  <AlertCircle size={16} color={C.red} />
                  <div style={{ fontSize: 12, color: C.red }}>{modalError}</div>
                </div>
              )}

              {/* Teacher Selection Dropdown */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 8 }}>
                  Select Existing Eligible Teacher <span style={{ color: C.red }}>*</span>
                </label>

                {loadingTeachers ? (
                  <div style={{ padding: "12px", border: `1px solid ${C.borderMed}`, borderRadius: 8, textAlign: "center", color: C.t3, fontSize: 13 }}>
                    <RefreshCw size={16} className="animate-spin" style={{ display: "inline-block", marginRight: 8 }} />
                    Loading eligible active teachers...
                  </div>
                ) : (
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 14px", fontSize: 13,
                      borderRadius: 8, border: `1px solid ${C.borderMed}`, background: "#fff",
                      color: C.t1, outline: "none", cursor: "pointer"
                    }}
                  >
                    <option value="">-- Choose an eligible teacher --</option>
                    {eligibleTeachers.map((t) => (
                      <option key={t.teacherId} value={t.teacherId}>
                        {t.fullName} ({t.schoolId}, {t.department})
                      </option>
                    ))}
                  </select>
                )}

                <p style={{ margin: "6px 0 0", fontSize: 11, color: C.t3 }}>
                  Only active teachers with linked faculty records are listed. Passwords or user IDs are not modified.
                </p>
              </div>

              {/* Governance & DepEd Responsibility Box */}
              <div style={{ background: C.m50, border: `1px solid ${C.m100}`, borderRadius: 8, padding: "12px 14px", fontSize: 12, color: C.m800, lineHeight: 1.45 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 4 }}>
                  <ShieldCheck size={14} color={C.m700} /> Class Adviser Governance Authority
                </div>
                The designated adviser gains authority over the classroom roster, daily attendance (SF2), report card signing (SF9), and nutritional metrics entry (SF8).
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              background: C.paper, padding: "16px 24px", borderTop: `1px solid ${C.borderLight}`,
              display: "flex", justifyContent: "flex-end", gap: 12
            }}>
              <button
                type="button"
                onClick={closeAssignModal}
                disabled={isSubmitting}
                style={{
                  padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: "#fff", border: `1px solid ${C.borderMed}`, color: C.t2, cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdviser}
                disabled={isSubmitting || !selectedTeacherId || loadingTeachers}
                style={{
                  padding: "8px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: isSubmitting || !selectedTeacherId ? "#cbd5e1" : C.m700,
                  color: "#fff", border: "none", cursor: isSubmitting || !selectedTeacherId ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  boxShadow: isSubmitting || !selectedTeacherId ? "none" : "0 2px 8px rgba(29, 78, 216, 0.25)"
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <UserCheck size={14} /> Confirm Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Term Management Confirmation Modal */}
      {termConfirmModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.65)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#fff", width: "100%", maxWidth: 460, borderRadius: 16,
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden", border: `1px solid ${C.borderMed}`,
            animation: "fadeIn 0.15s ease-out"
          }}>
            <div style={{
              background: termConfirmModal.action === 'ADD' ? C.m700 : "#991b1b",
              color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {termConfirmModal.action === 'ADD' ? <Plus size={18} /> : <Trash2 size={18} />}
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>
                  {termConfirmModal.action === 'ADD' ? 'Add Academic Term' : 'Remove Academic Term'}
                </span>
              </div>
              <button
                onClick={() => setTermConfirmModal(null)}
                disabled={termActionLoading}
                style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.5 }}>
                {termConfirmModal.action === 'ADD' ? (
                  <>
                    Are you sure you want to add <strong>Term {termConfirmModal.termKey}</strong> to <strong>{termConfirmModal.yearName}</strong>?
                    <div style={{ marginTop: 12, padding: "10px 14px", background: C.paper, borderRadius: 8, fontSize: 12, color: C.t2 }}>
                      This will expand the configured evaluation cycle to {yearTerms.length + 1} terms. Gradebook calculations and reporting will adapt to the expanded term count.
                    </div>
                  </>
                ) : (
                  <>
                    Are you sure you want to remove <strong>Term {termConfirmModal.termKey}</strong> from <strong>{termConfirmModal.yearName}</strong>?
                    <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#991b1b" }}>
                      <strong>Strict Integrity Safeguard:</strong> This action will only proceed if the term has zero dependent gradebooks, grades, assessments, or official SF9 issuances. Active academic records will never be deleted.
                    </div>
                  </>
                )}
              </div>

              {termConfirmModal.needsPublishedOverride && (
                <div style={{ marginTop: 14, padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={!!termConfirmModal.confirmPublishedOverride}
                      onChange={(e) => setTermConfirmModal(prev => prev ? ({ ...prev, confirmPublishedOverride: e.target.checked }) : null)}
                      style={{ marginTop: 2 }}
                    />
                    <span>I deliberately confirm expanding this academic year to 4 terms. I understand that previously finalized subject ratings and General Average will revert to PENDING until Term {termConfirmModal.termKey} results are published.</span>
                  </label>
                </div>
              )}

              {termError && (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{termError}</span>
                </div>
              )}
            </div>

            <div style={{
              background: C.paper, padding: "14px 20px", borderTop: `1px solid ${C.borderLight}`,
              display: "flex", justifyContent: "flex-end", gap: 10
            }}>
              <button
                type="button"
                onClick={() => setTermConfirmModal(null)}
                disabled={termActionLoading}
                style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: "#fff", border: `1px solid ${C.borderMed}`, color: C.t2, cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTermAction}
                disabled={termActionLoading}
                style={{
                  padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: termConfirmModal.action === 'ADD' ? C.m700 : "#991b1b",
                  color: "#fff", border: "none", cursor: termActionLoading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {termActionLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Processing...
                  </>
                ) : (
                  termConfirmModal.action === 'ADD' ? 'Confirm Addition' : 'Confirm Removal'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* School-Year Completion Review Modal */}
      {showReadinessModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1100,
          background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#fff", width: "95vw", maxWidth: 1180, maxHeight: "92vh",
            borderRadius: 14, boxShadow: "0 24px 48px rgba(0,0,0,0.25)",
            display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #cbd5e1"
          }}>
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              <SchoolYearReadinessConsole
                academicYearId={activeAY?.id}
                onClose={() => setShowReadinessModal(false)}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
