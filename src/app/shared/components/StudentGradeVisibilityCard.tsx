import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, ShieldCheck, Loader2, AlertCircle, CheckCircle2, Lock, Sparkles, RefreshCw } from 'lucide-react';
import { academicApi, Term } from '../../../api/academic.api';

interface StudentGradeVisibilityCardProps {
  academicYearId?: string;
  academicYearName?: string;
  onVisibilityChange?: (termKey: string, isVisible: boolean) => void;
  className?: string;
}

export function StudentGradeVisibilityCard({
  academicYearId,
  academicYearName = 'SY 2026–2027',
  onVisibilityChange,
  className = '',
}: StudentGradeVisibilityCardProps) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTermId, setUpdatingTermId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const resolvedYearId = academicYearId;

  const loadTerms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let targetYearId = resolvedYearId;
      if (!targetYearId) {
        const years = await academicApi.getYears();
        const activeYear = (Array.isArray(years) ? years : []).find((y: any) => y.is_active || y.status === 'Active') || years[0];
        targetYearId = activeYear?.id;
      }

      if (!targetYearId) {
        setError('No active academic year found.');
        setLoading(false);
        return;
      }

      const res = await academicApi.getTerms(targetYearId);
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      // Sort terms by key (T1, T2, T3)
      list.sort((a: Term, b: Term) => a.key.localeCompare(b.key));
      setTerms(list);
    } catch (err: any) {
      console.error('Failed to load terms for visibility control:', err);
      setError(err?.message || 'Unable to load term visibility settings.');
    } finally {
      setLoading(false);
    }
  }, [resolvedYearId]);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  const handleToggle = async (term: Term, currentVisible: boolean) => {
    const newVisible = !currentVisible;
    setUpdatingTermId(term.id);
    setFeedback(null);

    try {
      const res = await academicApi.updateTermVisibility(term.id, newVisible);
      const updatedVisible = (res as any)?.data?.isGradesVisible ?? newVisible;

      // Update state locally
      setTerms((prev) =>
        prev.map((t) =>
          t.id === term.id
            ? { ...t, is_grades_visible_to_students: updatedVisible, isGradesVisible: updatedVisible }
            : t
        )
      );

      const termName = term.name || `Term ${term.key.replace('T', '')}`;
      setFeedback({
        message: `${termName} grades are now ${updatedVisible ? 'VISIBLE' : 'CONCEALED'} in the Student Portal.`,
        type: 'success',
      });

      if (onVisibilityChange) {
        onVisibilityChange(term.key, updatedVisible);
      }
    } catch (err: any) {
      console.error(`Failed to update visibility for term ${term.id}:`, err);
      setFeedback({
        message: err?.response?.data?.message || err?.message || 'Failed to update term visibility.',
        type: 'error',
      });
    } finally {
      setUpdatingTermId(null);
    }
  };

  // Ensure standard three terms are represented
  const displayTerms = terms.length > 0 ? terms : [
    { id: 't1_fallback', key: 'T1', name: 'Term 1', academic_year_id: '', start_date: '', end_date: '', is_grades_visible_to_students: false },
    { id: 't2_fallback', key: 'T2', name: 'Term 2', academic_year_id: '', start_date: '', end_date: '', is_grades_visible_to_students: false },
    { id: 't3_fallback', key: 'T3', name: 'Term 3', academic_year_id: '', start_date: '', end_date: '', is_grades_visible_to_students: false },
  ];

  return (
    <div
      id="student-grade-visibility-control-card"
      className={`bg-white border border-slate-200 rounded-lg p-5 md:p-6 shadow-xs ${className}`}
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
            <Eye className="text-indigo-600" size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: "'Fraunces', serif" }}>
                Student Grade Visibility Control
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-wider">
                Student Portal
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Manage learner access to published grades in the Student Portal for <strong>{academicYearName}</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadTerms}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
          title="Refresh term visibility settings"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          role="status"
          className={`mb-4 px-4 py-2.5 rounded-md text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Terms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayTerms.map((term, idx) => {
          const isVisible = Boolean(term.is_grades_visible_to_students ?? term.isGradesVisible);
          const isUpdating = updatingTermId === term.id;
          const termLabel = term.name || `Term ${idx + 1}`;
          const termKey = term.key || `T${idx + 1}`;

          return (
            <div
              key={term.id || termKey}
              id={`term-visibility-panel-${termKey.toLowerCase()}`}
              className={`p-4 rounded-lg border transition-all ${
                isVisible
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-slate-900 text-white font-mono tracking-wider">
                    {termKey}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{termLabel}</span>
                </div>

                {/* Status Badge */}
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border tracking-wider flex items-center gap-1 ${
                    isVisible
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-slate-200/80 text-slate-700 border-slate-300'
                  }`}
                >
                  {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                  <span>{isVisible ? 'Visible' : 'Hidden'}</span>
                </span>
              </div>

              <div className="text-xs text-slate-600 min-h-[40px] leading-relaxed mb-4">
                {isVisible ? (
                  <span className="text-emerald-900 font-medium">
                    Published ratings for {termLabel} are <strong>visible</strong> to learners and parents in the Student Portal.
                  </span>
                ) : (
                  <span className="text-slate-600 font-medium">
                    {termLabel} ratings are <strong>concealed</strong>. Learners see a protected blank state.
                  </span>
                )}
              </div>

              {/* Toggle Switch */}
              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {isVisible ? 'Hide from students' : 'Show to students'}
                </span>

                <button
                  type="button"
                  id={`btn-toggle-visibility-${termKey.toLowerCase()}`}
                  role="switch"
                  aria-checked={isVisible}
                  aria-label={`Toggle grade visibility for ${termLabel}`}
                  disabled={loading || isUpdating}
                  onClick={() => handleToggle(term, isVisible)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                    isUpdating
                      ? 'opacity-60 cursor-wait'
                      : isVisible
                      ? 'bg-emerald-600'
                      : 'bg-slate-300'
                  }`}
                >
                  <span className="sr-only">Toggle grade visibility</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                      isVisible ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  >
                    {isUpdating ? (
                      <Loader2 size={11} className="animate-spin text-slate-600" />
                    ) : isVisible ? (
                      <Eye size={11} className="text-emerald-700" />
                    ) : (
                      <EyeOff size={11} className="text-slate-400" />
                    )}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* DepEd Order Policy Notice */}
      <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-md flex items-start gap-3">
        <ShieldCheck size={18} className="text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 leading-relaxed font-medium">
          <strong>DepEd Rating Integrity Rule:</strong> Turning a term visibility ON only exposes <em>authoritative, published subject ratings</em> to students. Draft or incomplete teacher gradebooks remain strictly concealed on the server. Previously issued official SF9 PDFs remain permanently accessible under official issuance permissions.
        </div>
      </div>
    </div>
  );
}
