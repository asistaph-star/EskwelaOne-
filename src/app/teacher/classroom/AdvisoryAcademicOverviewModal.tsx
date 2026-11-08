import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { Award, AlertCircle, X, Download } from 'lucide-react';
import { ReportCardReleaseConsole } from '../../shared/components/ReportCardReleaseConsole';
import { apiClient } from '../../../api/client';

interface AdvisoryAcademicOverviewModalProps {
  sectionId: string;
  sectionName?: string;
  gradeLevel?: number;
  onClose: () => void;
}

export function AdvisoryAcademicOverviewModal({
  sectionId,
  sectionName,
  gradeLevel,
  onClose,
}: AdvisoryAcademicOverviewModalProps) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewTerm, setOverviewTerm] = useState<'ALL' | 'T1' | 'T2' | 'T3'>('ALL');
  const [showSf9Console, setShowSf9Console] = useState(false);

  const cleanSectionId = String(sectionId || '').replace(/^adv-/, '');

  useEffect(() => {
    if (!cleanSectionId) return;
    setIsLoading(true);
    setError(null);
    apiClient.get(`/academic/sections/${cleanSectionId}/academic-overview`)
      .then((res: any) => {
        const payload = res?.data || res;
        if (payload && (payload.students || payload.section)) {
          setData(payload);
        } else {
          setData(null);
        }
      })
      .catch((err: any) => {
        const msg = err.response?.data?.message || err.message || 'Failed to load academic overview';
        setError(msg);
      })
      .finally(() => setIsLoading(false));
  }, [cleanSectionId]);

  if (showSf9Console) {
    return (
      <ReportCardReleaseConsole
        portal="Teacher"
        initialSectionId={cleanSectionId}
        onBack={() => setShowSf9Console(false)}
      />
    );
  }

  const sectionDisplay = data?.section
    ? `Grade ${data.section.gradeLevel} – ${data.section.name}`
    : gradeLevel && sectionName
    ? `Grade ${gradeLevel} – ${sectionName}`
    : 'Advisory Section';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1200,
          maxHeight: '92vh',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${C.borderMed}`,
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            background: C.m900,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `2px solid ${C.m700}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Award size={18} color="#fde047" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'Fraunces', serif" }}>
                {sectionDisplay} · Class Adviser Academic Monitoring
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                Class Adviser: <strong>{data?.section?.adviserName || 'Designated Adviser'}</strong> • {data?.section?.academicYear || 'SY 2026-2027'} • Read-Only
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setShowSf9Console(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                background: '#0284c7',
                color: '#fff',
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
              }}
              title="Open official Calulut SF9 report cards and release console for this section"
            >
              <Award size={13} /> Official SF9 Console
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Sub-bar / Filters */}
        <div
          style={{
            background: '#f8fafc',
            borderBottom: `1px solid ${C.borderMed}`,
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#475569' }}>
            <AlertCircle size={13} color="#0284c7" />
            <span>
              <strong>DepEd Policy Notice:</strong> This overview displays <strong>officially published subject ratings</strong> only. Unsealed drafts remain private to assigned subject teachers.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', borderRadius: 5, padding: 2, border: `1px solid ${C.borderMed}` }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: C.t3, padding: '0 6px', textTransform: 'uppercase' }}>Filter:</span>
              {(['ALL', 'T1', 'T2', 'T3'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOverviewTerm(t)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 3,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: overviewTerm === t ? 700 : 500,
                    background: overviewTerm === t ? C.m700 : 'transparent',
                    color: overviewTerm === t ? '#fff' : C.t2,
                    transition: 'all 0.12s',
                  }}
                >
                  {t === 'ALL' ? 'All Terms' : t}
                </button>
              ))}
            </div>

            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
              {data?.students?.length || 0} Learners Enrolled • {data?.subjects?.length || 0} Subjects
            </span>
          </div>
        </div>

        {/* Body content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff', padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: 60, textAlign: 'center', color: C.t3, fontSize: 13 }}>
              Loading consolidated cross-subject grades...
            </div>
          ) : error ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#b91c1c', fontSize: 13 }}>
              {error}
            </div>
          ) : !data || !data.students || data.students.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: C.t3, fontSize: 13 }}>
              No students enrolled or no academic overview records found for this section.
            </div>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  <th
                    rowSpan={overviewTerm === 'ALL' ? 2 : 1}
                    style={{
                      border: `1px solid rgba(255,255,255,0.15)`,
                      background: C.m900,
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '8px 6px',
                      textAlign: 'center',
                      width: 40,
                      position: 'sticky',
                      top: 0,
                      zIndex: 6,
                    }}
                  >
                    #
                  </th>
                  <th
                    rowSpan={overviewTerm === 'ALL' ? 2 : 1}
                    style={{
                      border: `1px solid rgba(255,255,255,0.15)`,
                      background: C.m900,
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '8px 8px',
                      textAlign: 'center',
                      width: 110,
                      position: 'sticky',
                      top: 0,
                      zIndex: 6,
                    }}
                  >
                    LRN
                  </th>
                  <th
                    rowSpan={overviewTerm === 'ALL' ? 2 : 1}
                    style={{
                      border: `1px solid rgba(255,255,255,0.15)`,
                      background: C.m800,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '8px 12px',
                      textAlign: 'left',
                      minWidth: 180,
                      position: 'sticky',
                      top: 0,
                      zIndex: 6,
                      fontFamily: "'Fraunces', serif",
                    }}
                  >
                    STUDENT NAME
                  </th>

                  {(data.subjects || []).map((subj: any) => (
                    <th
                      key={subj.id}
                      colSpan={overviewTerm === 'ALL' ? 4 : 1}
                      style={{
                        border: `1px solid rgba(255,255,255,0.15)`,
                        background: C.m700,
                        color: '#fff',
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '7px 8px',
                        textAlign: 'center',
                        position: 'sticky',
                        top: 0,
                        zIndex: 5,
                        letterSpacing: '0.03em',
                      }}
                    >
                      <div>{subj.name}</div>
                      <div style={{ fontSize: 8.5, fontWeight: 400, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                        {subj.teacherName}
                      </div>
                    </th>
                  ))}

                  <th
                    rowSpan={overviewTerm === 'ALL' ? 2 : 1}
                    style={{
                      border: `1px solid rgba(255,255,255,0.15)`,
                      background: C.gold,
                      color: C.m900,
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '8px 6px',
                      textAlign: 'center',
                      width: 90,
                      position: 'sticky',
                      top: 0,
                      zIndex: 6,
                    }}
                  >
                    GEN. AVG
                  </th>
                  <th
                    rowSpan={overviewTerm === 'ALL' ? 2 : 1}
                    style={{
                      border: `1px solid rgba(255,255,255,0.15)`,
                      background: C.m800,
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '8px 6px',
                      textAlign: 'center',
                      width: 90,
                      position: 'sticky',
                      top: 0,
                      zIndex: 6,
                    }}
                  >
                    REMARKS
                  </th>
                </tr>

                {overviewTerm === 'ALL' && (
                  <tr>
                    {(data.subjects || []).map((subj: any) => (
                      <React.Fragment key={`${subj.id}-sub`}>
                        <th style={{ border: `1px solid rgba(255,255,255,0.15)`, background: C.m800, color: '#fff', fontSize: 9, padding: '4px', textAlign: 'center', width: 45, position: 'sticky', top: 38, zIndex: 4 }}>T1</th>
                        <th style={{ border: `1px solid rgba(255,255,255,0.15)`, background: C.m800, color: '#fff', fontSize: 9, padding: '4px', textAlign: 'center', width: 45, position: 'sticky', top: 38, zIndex: 4 }}>T2</th>
                        <th style={{ border: `1px solid rgba(255,255,255,0.15)`, background: C.m800, color: '#fff', fontSize: 9, padding: '4px', textAlign: 'center', width: 45, position: 'sticky', top: 38, zIndex: 4 }}>T3</th>
                        <th style={{ border: `1px solid rgba(255,255,255,0.15)`, background: '#b45309', color: '#fff', fontSize: 9, fontWeight: 800, padding: '4px', textAlign: 'center', width: 48, position: 'sticky', top: 38, zIndex: 4 }}>FINAL</th>
                      </React.Fragment>
                    ))}
                  </tr>
                )}
              </thead>

              <tbody>
                {(data.students || []).map((st: any, idx: number) => {
                  const bg = idx % 2 === 0 ? '#fff' : C.paper;
                  return (
                    <tr
                      key={st.studentId}
                      style={{ background: bg, borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.m50)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = bg)}
                    >
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11, color: C.t3, fontFamily: "'JetBrains Mono', monospace" }}>{idx + 1}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'center', fontSize: 11, color: C.t2, fontFamily: "'JetBrains Mono', monospace" }}>{st.lrn || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: C.t1 }}>
                        {st.name}
                      </td>

                      {(data.subjects || []).map((subj: any) => {
                        const sg = st.grades?.[subj.id];
                        if (overviewTerm === 'ALL') {
                          return (
                            <React.Fragment key={`${subj.id}-scores`}>
                              <td style={{ padding: '7px 4px', textAlign: 'center', fontSize: 11, borderLeft: `1px solid ${C.borderMed}` }}>
                                {sg?.terms?.T1 !== null && sg?.terms?.T1 !== undefined ? (
                                  <span style={{ fontWeight: 700, color: sg.terms.T1 >= 75 ? '#15803d' : '#b91c1c' }}>{sg.terms.T1}</span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: 10 }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '7px 4px', textAlign: 'center', fontSize: 11, borderLeft: `1px solid ${C.border}` }}>
                                {sg?.terms?.T2 !== null && sg?.terms?.T2 !== undefined ? (
                                  <span style={{ fontWeight: 700, color: sg.terms.T2 >= 75 ? '#15803d' : '#b91c1c' }}>{sg.terms.T2}</span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: 10 }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '7px 4px', textAlign: 'center', fontSize: 11, borderLeft: `1px solid ${C.border}` }}>
                                {sg?.terms?.T3 !== null && sg?.terms?.T3 !== undefined ? (
                                  <span style={{ fontWeight: 700, color: sg.terms.T3 >= 75 ? '#15803d' : '#b91c1c' }}>{sg.terms.T3}</span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: 10 }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '7px 4px', textAlign: 'center', fontSize: 11, fontWeight: 800, background: 'rgba(180,83,9,0.05)', borderLeft: `1px solid ${C.border}` }}>
                                {sg?.finalRating !== null && sg?.finalRating !== undefined ? (
                                  <span style={{ color: sg.finalRating >= 75 ? '#15803d' : '#b91c1c' }}>{sg.finalRating}</span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: 10 }}>—</span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        } else {
                          const score = sg?.terms?.[overviewTerm];
                          return (
                            <td key={`${subj.id}-term`} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, borderLeft: `1px solid ${C.borderMed}` }}>
                              {score !== null && score !== undefined ? (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: score >= 90 ? '#dcfce7' : score >= 80 ? '#e0f2fe' : score >= 75 ? '#fef3c7' : '#fee2e2',
                                    color: score >= 90 ? '#166534' : score >= 80 ? '#075985' : score >= 75 ? '#92400e' : '#991b1b',
                                    fontWeight: 700,
                                    fontFamily: "'JetBrains Mono', monospace",
                                  }}
                                >
                                  {score}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic' }} title="Pending submission or publication by subject teacher">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        }
                      })}

                      <td style={{ padding: '8px 6px', textAlign: 'center', borderLeft: `1px solid ${C.borderMed}` }}>
                        {st.generalAverage !== null ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: st.generalAverage >= 75 ? '#dcfce7' : '#fee2e2',
                              color: st.generalAverage >= 75 ? '#166534' : '#991b1b',
                              fontWeight: 800,
                              fontSize: 12,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {st.generalAverage}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '8px 6px', textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>
                        {st.generalAverage !== null ? (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: st.generalAverage >= 75 ? '#dcfce7' : '#fee2e2',
                              color: st.generalAverage >= 75 ? '#166534' : '#991b1b',
                            }}
                          >
                            {st.generalAverage >= 75 ? 'PASSED' : 'FAILED'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 9.5, color: '#94a3b8' }}>IN PROGRESS</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
