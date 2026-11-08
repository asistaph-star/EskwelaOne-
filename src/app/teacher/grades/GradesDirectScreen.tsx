import React, { useState } from 'react';
import { GradebookFullScreen } from './GradebookFullScreen';
import { CalulutSectionTermSummaryScreen } from './CalulutSectionTermSummaryScreen';
import { RequestGradeConsiderationModal } from './RequestGradeConsiderationModal';
import { useMyClasses } from '../shared/useMyClasses';
import { EmptyState } from '../../shared/components/EmptyState';
import { BookOpen, Award, Users, Sparkles } from 'lucide-react';
import { AdvisoryAcademicOverviewModal } from '../classroom/AdvisoryAcademicOverviewModal';

export function GradesDirectScreen() {
  const { myClasses, isLoading } = useMyClasses();
  const [activeTab, setActiveTab] = useState<'my-gradebooks' | 'section-term-summary'>('my-gradebooks');
  const [activeClassId, setActiveClassId] = useState<string>(() => {
    try {
      return localStorage.getItem('digiskwela_teacher_active_class_id') || "";
    } catch {
      return "";
    }
  });
  const [isAdvisoryModalOpen, setIsAdvisoryModalOpen] = useState(false);
  const [isConsiderationModalOpen, setIsConsiderationModalOpen] = useState(false);

  const advisoryClasses = React.useMemo(() => {
    return (myClasses || []).filter(c => c.adviser);
  }, [myClasses]);

  React.useEffect(() => {
    if (myClasses && myClasses.length > 0) {
      const exists = myClasses.some(c => c.id === activeClassId);
      if (!exists) {
        // Auto-select Mabini if present, or any class with students
        const preferred =
          myClasses.find(c => c.section?.toLowerCase().includes('mabini')) ||
          myClasses.find(c => c.students > 0) ||
          myClasses[0];
        if (preferred) {
          setActiveClassId(preferred.id);
        }
      }
    }
  }, [myClasses, activeClassId]);

  if (isLoading) {
    return <div style={{ padding: 24, color: '#64748b' }}>Loading gradebooks...</div>;
  }

  const activeClass = (myClasses || []).find(c => c.id === activeClassId) || myClasses?.[0];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Primary Module Navigation Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            id="tab-my-subject-gradebooks"
            type="button"
            onClick={() => setActiveTab('my-gradebooks')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 18px',
              fontSize: 12.5,
              fontWeight: 700,
              color: activeTab === 'my-gradebooks' ? '#8b1e1e' : '#64748b',
              borderBottom: activeTab === 'my-gradebooks' ? '2.5px solid #8b1e1e' : '2.5px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <BookOpen size={15} color={activeTab === 'my-gradebooks' ? '#8b1e1e' : '#94a3b8'} />
            My Subject Gradebooks
          </button>

          <button
            id="tab-section-term-summary"
            type="button"
            onClick={() => setActiveTab('section-term-summary')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 18px',
              fontSize: 12.5,
              fontWeight: 700,
              color: activeTab === 'section-term-summary' ? '#8b1e1e' : '#64748b',
              borderBottom: activeTab === 'section-term-summary' ? '2.5px solid #8b1e1e' : '2.5px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={15} color={activeTab === 'section-term-summary' ? '#8b1e1e' : '#94a3b8'} />
            Consolidated Section Term Summary (Calulut SF9)
          </button>
        </div>

        {/* Global Context Indicator */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8b1e1e', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Calulut Integrated School • Grading System
        </div>
      </div>

      {/* Tab 1: My Subject Gradebooks */}
      {activeTab === 'my-gradebooks' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {!myClasses || myClasses.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16, padding: 24 }}>
              <EmptyState
                icon={BookOpen}
                title="No Classes Assigned"
                description="You do not have any assigned classes or sections for this academic year yet."
                guidance="Once an administrator assigns you to a class section, your gradebook will appear here."
              />
            </div>
          ) : (
            <>
              {/* Active Section Selector & Toolbar */}
              <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8b1e1e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Active Section:
                  </span>
                  <select
                    id="select-gradebook-section"
                    value={activeClass?.id}
                    onChange={(e) => {
                      setActiveClassId(e.target.value);
                      try { localStorage.setItem('digiskwela_teacher_active_class_id', e.target.value); } catch {}
                    }}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0f172a',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {myClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        Grade {c.grade} - {c.section} ({c.subject}) • {c.students} students{c.adviser ? ' ★ Adviser' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Grade Consideration / Adjustment Action Button */}
                  <button
                    id="btn-trigger-grade-consideration"
                    type="button"
                    onClick={() => setIsConsiderationModalOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      background: "#faf5ff",
                      color: "#6b21a8",
                      border: "1px solid #d8b4fe",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                    title="Submit a justified grade consideration for an enrolled learner under DepEd policy"
                  >
                    <Sparkles size={13} color="#9333ea" /> Request Grade Consideration
                  </button>

                  {/* Advisory Overview Button */}
                  {advisoryClasses.length > 0 && (
                    <button
                      id="btn-grading-view-advisory-grades"
                      type="button"
                      onClick={() => setIsAdvisoryModalOpen(true)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        background: "#ecfdf5",
                        color: "#065f46",
                        border: "1px solid #a7f3d0",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                      title="Open read-only academic monitoring overview for your advisory section"
                    >
                      <Award size={13} color="#059669" /> View Advisory Grades (Grade {advisoryClasses[0].grade} – {advisoryClasses[0].section})
                    </button>
                  )}
                </div>
              </div>

              {/* Fullscreen Authentic Gradebook */}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <GradebookFullScreen key={activeClass?.id} classId={activeClass?.id} onBack={() => {}} hideBack />
              </div>

              {/* Advisory Modal */}
              {isAdvisoryModalOpen && advisoryClasses.length > 0 && (
                <AdvisoryAcademicOverviewModal
                  sectionId={advisoryClasses[0].sectionId || advisoryClasses[0].id}
                  gradeLevel={advisoryClasses[0].grade}
                  sectionName={advisoryClasses[0].section}
                  onClose={() => setIsAdvisoryModalOpen(false)}
                />
              )}

              {/* Grade Consideration Modal */}
              {isConsiderationModalOpen && activeClass && (
                <RequestGradeConsiderationModal
                  sectionId={activeClass.sectionId || activeClass.id}
                  sectionName={activeClass.section}
                  gradeLevel={activeClass.grade}
                  subjectId={activeClass.subjectId || ''}
                  subjectName={activeClass.subject}
                  term="T1"
                  students={[]}
                  onClose={() => setIsConsiderationModalOpen(false)}
                  onSuccess={() => {}}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 2: Consolidated Section Term Summary (Calulut Official Layout) */}
      {activeTab === 'section-term-summary' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CalulutSectionTermSummaryScreen 
            onNavigateToMyGradebook={(sectionId) => {
              if (sectionId) {
                const targetClass = myClasses?.find(c => c.section?.id === sectionId);
                if (targetClass) {
                  setActiveClassId(targetClass.id);
                }
              }
              setActiveTab('my-gradebooks');
            }} 
          />
        </div>
      )}
    </div>
  );
}