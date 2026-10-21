import React from 'react';
import { 
  Users, Calendar, FileText, ShieldAlert, BarChart2, 
  CheckCircle2, Clock, AlertTriangle, ArrowRight, Activity, Briefcase
} from 'lucide-react';
import { C } from '../../../shared/constants/tokens.js';
import { PrincipalAIMessage, SafeNavAction } from '../types.js';
import { PScreen } from '../../../shared/types';

interface StructuredDataRendererProps {
  data: NonNullable<PrincipalAIMessage['structuredData']>;
  onNavigate?: (screen: PScreen) => void;
}

export function StructuredDataRenderer({ data, onNavigate }: StructuredDataRendererProps) {
  const { type, raw } = data;

  const renderNavButton = (action: SafeNavAction) => {
    if (!onNavigate) return null;
    return (
      <button
        type="button"
        data-testid={`safe-nav-${action.screen}`}
        onClick={() => onNavigate(action.screen)}
        style={{
          marginTop: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          background: C.m700,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = C.m800}
        onMouseLeave={e => e.currentTarget.style.background = C.m700}
      >
        <span>{action.label}</span>
        <ArrowRight size={12} />
      </button>
    );
  };

  // 1. Faculty Attendance Audit
  if (type === 'attendance') {
    const s = raw.summary || {};
    const records = raw.records || [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
            Faculty Gate Attendance Audit
          </div>
          <span style={{ fontSize: 10, color: C.t3 }}>Date: {raw.asOfDate}</span>
        </div>

        {/* Attendance Summary Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 600 }}>Active Faculty</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{s.totalActiveFaculty ?? 0}</div>
          </div>
          <div style={{ padding: '8px 10px', background: C.greenBg, borderRadius: 6, border: '1px solid rgba(21,94,54,0.2)' }}>
            <div style={{ fontSize: 9, color: C.green, textTransform: 'uppercase', fontWeight: 600 }}>Completed</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{s.completedCount ?? 0}</div>
          </div>
          <div style={{ padding: '8px 10px', background: C.amberBg, borderRadius: 6, border: '1px solid rgba(146,64,14,0.2)' }}>
            <div style={{ fontSize: 9, color: C.amber, textTransform: 'uppercase', fontWeight: 600 }}>Time-Out Pending</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.amber }}>{s.timeOutPendingCount ?? 0}</div>
          </div>
          <div style={{ padding: '8px 10px', background: C.blueBg, borderRadius: 6, border: '1px solid rgba(30,58,138,0.2)' }}>
            <div style={{ fontSize: 9, color: C.blue, textTransform: 'uppercase', fontWeight: 600 }}>On Approved Leave</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{s.onApprovedLeaveCount ?? 0}</div>
          </div>
        </div>

        {/* Neutral Attendance Presence Note */}
        {s.noGateCheckInNoApprovedLeaveFoundCount > 0 && (
          <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 6, border: `1px solid ${C.borderMed}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.t2, fontSize: 11, fontWeight: 600 }}>
              <Clock size={13} color={C.m700} />
              <span>{s.noGateCheckInNoApprovedLeaveFoundCount} faculty members:</span>
            </div>
            <div style={{ fontSize: 11, color: C.t2, marginTop: 4 }}>
              No gate check-in was recorded today and no approved leave record was found.
            </div>
          </div>
        )}

        {/* Detailed Records Preview if present */}
        {records.length > 0 && (
          <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${C.borderLight}`, borderRadius: 6 }}>
            {records.map((r: any, idx: number) => {
              const statusDisplay = r.attendanceStatus === 'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND'
                ? 'No gate check-in was recorded today and no approved leave record was found'
                : r.attendanceStatus;
              return (
                <div key={idx} style={{ padding: '6px 8px', borderBottom: `1px solid ${C.borderLight}`, fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: C.t1 }}>{r.teacherName}</span>
                    <span style={{ fontSize: 10, color: C.t3, marginLeft: 6 }}>({r.department || 'General'})</span>
                  </div>
                  <span style={{ 
                    fontSize: 10, 
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: r.attendanceStatus === 'COMPLETED' ? C.greenBg : (r.attendanceStatus === 'ON_APPROVED_LEAVE' ? C.blueBg : C.paper),
                    color: r.attendanceStatus === 'COMPLETED' ? C.green : (r.attendanceStatus === 'ON_APPROVED_LEAVE' ? C.blue : C.t2)
                  }}>
                    {statusDisplay}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontSize: 10, color: C.t3, fontStyle: 'italic', lineHeight: 1.4 }}>
          Neutral attendance policy: gate check-ins reflect physical gate scan events. Absence, undertime, or unexcused status is not inferred.
        </div>

        {renderNavButton({ label: 'Open Gate Attendance Monitoring', screen: 'p-monitoring' })}
      </div>
    );
  }

  // 2. School Operational Fact Sheet
  if (type === 'fact_sheet') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
          School Operational Pulse Fact Sheet
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 600 }}>Enrolled Students</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{raw.students?.enrolled ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 600 }}>Students On Campus</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{raw.students?.onCampusNow ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 600 }}>Active Faculty</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{raw.faculty?.totalActive ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 600 }}>Pending Leaves</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.m700 }}>{raw.operations?.pendingLeaves ?? 0}</div>
          </div>
        </div>

        {raw.academics && (
          <div style={{ padding: '8px 10px', background: C.m50, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.m700 }}>Academic Grading Completeness</div>
            <div style={{ fontSize: 11, color: C.t2, marginTop: 2 }}>
              Status: <span style={{ fontWeight: 600 }}>{raw.academics.completenessStatus}</span>
            </div>
            {raw.academics.annualPassRate === null && (
              <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                Annual promotion pass rate is not available because complete T1–T4 data has not yet been submitted. Current records reflect partial-term averages only.
              </div>
            )}
          </div>
        )}

        {renderNavButton({ label: 'Open Dashboard Overview', screen: 'p-dashboard' })}
      </div>
    );
  }

  // 3. Pending Leaves
  if (type === 'leaves') {
    const leaves = raw.leaves || [];
    const count = raw.totalPending ?? leaves.length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
            Pending Faculty Leave Applications
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.m700 }}>{count} Pending</span>
        </div>

        {count === 0 ? (
          <div style={{ padding: 12, background: C.paper, borderRadius: 6, fontSize: 11, color: C.t2, textAlign: 'center' }}>
            No pending leave requests found. All faculty leave applications have been reviewed.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {leaves.map((l: any, i: number) => (
              <div key={i} style={{ padding: '8px 10px', background: '#fff', border: `1px solid ${C.borderLight}`, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 11, color: C.t1 }}>{l.teacherName}</span>
                  <span style={{ fontSize: 10, color: C.m700, background: C.m50, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                    {l.leaveType}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: C.t3, marginTop: 3 }}>
                  {l.department ? `${l.department} · ` : ''}{l.startDate} to {l.endDate} ({l.daysCount} day{l.daysCount !== 1 ? 's' : ''})
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, color: C.t3, fontStyle: 'italic' }}>
          Read-only audit. Confidential medical notes and sensitive details are withheld for privacy.
        </div>

        {renderNavButton({ label: 'Review Leave Requests', screen: 'p-leaves' })}
      </div>
    );
  }

  // 4. Upcoming Events
  if (type === 'events') {
    const events = raw.events || [];
    const count = raw.totalEvents ?? events.length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
            Scheduled School Events
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.m700 }}>{count} Scheduled</span>
        </div>

        {count === 0 ? (
          <div style={{ padding: 12, background: C.paper, borderRadius: 6, fontSize: 11, color: C.t2, textAlign: 'center' }}>
            No upcoming events were found for the selected period.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {events.map((e: any, i: number) => (
              <div key={i} style={{ padding: '8px 10px', background: '#fff', border: `1px solid ${C.borderLight}`, borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 11, color: C.t1 }}>{e.title}</span>
                  <span style={{ fontSize: 10, color: C.t3 }}>{e.startDate}</span>
                </div>
                <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>
                  Audience: {e.audience || 'All'} {e.location ? `· Location: ${e.location}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {renderNavButton({ label: 'View School Events', screen: 'p-events' })}
      </div>
    );
  }

  // 5. Behavior Summary
  if (type === 'behavior') {
    const sb = raw.statusBreakdown || {};
    const count = raw.totalCases ?? 0;
    const cases = raw.cases || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
            Administrative Behavior Summary
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.m700 }}>{count} Total Cases</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          <div style={{ padding: '6px 4px', background: C.paper, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: C.t3, textTransform: 'uppercase' }}>Reported</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>{sb.reported ?? 0}</div>
          </div>
          <div style={{ padding: '6px 4px', background: C.amberBg, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: C.amber, textTransform: 'uppercase' }}>Investigating</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.amber }}>{sb.underInvestigation ?? 0}</div>
          </div>
          <div style={{ padding: '6px 4px', background: C.blueBg, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: C.blue, textTransform: 'uppercase' }}>Parent Notified</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.blue }}>{sb.parentNotified ?? 0}</div>
          </div>
          <div style={{ padding: '6px 4px', background: C.greenBg, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: C.green, textTransform: 'uppercase' }}>Resolved</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{sb.resolved ?? 0}</div>
          </div>
        </div>

        {cases.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
            {cases.map((c: any, i: number) => (
              <div key={i} style={{ padding: '6px 8px', background: '#fff', border: `1px solid ${C.borderLight}`, borderRadius: 4, fontSize: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: C.t1 }}>{c.studentName} (Gr. {c.gradeLevel})</span>
                  <span style={{ fontWeight: 600, color: C.m700 }}>{c.category}</span>
                </div>
                <div style={{ color: C.t3, marginTop: 1 }}>Status: {c.status} · Date: {c.incidentDate}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, color: C.t3, fontStyle: 'italic', lineHeight: 1.4 }}>
          Administrative logs only. Confidential counseling records and disclosures remain strictly segregated.
        </div>

        {renderNavButton({ label: 'Review Behavior Cases', screen: 'p-behavior' })}
      </div>
    );
  }

  // 6. Academic Completeness
  if (type === 'academics') {
    const isComplete = raw.completenessStatus === 'complete_annual_evaluation';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
          School-Wide Academic Completeness & Evaluation
        </div>

        <div style={{ padding: 10, background: isComplete ? C.greenBg : C.m50, borderRadius: 6, border: `1px solid ${isComplete ? 'rgba(21,94,54,0.2)' : C.borderMed}` }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: isComplete ? C.green : C.m700 }}>
            Completeness Status: {raw.completenessStatus}
          </div>
          <div style={{ fontSize: 11, color: C.t1, marginTop: 4, lineHeight: 1.4 }}>
            {raw.annualPassRate !== null ? (
              <span style={{ fontWeight: 700 }}>Annual Promotion Pass Rate: {raw.annualPassRate}%</span>
            ) : (
              <span>Annual promotion pass rate is not available because complete T1–T4 data has not yet been submitted. Current records reflect partial-term averages only.</span>
            )}
          </div>
        </div>

        {raw.interpretationNote && (
          <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.4 }}>
            {raw.interpretationNote}
          </div>
        )}

        {renderNavButton({ label: 'Open Academic Analytics', screen: 'p-analytics' })}
      </div>
    );
  }

  // 7. Meeting Brief
  if (type === 'meeting_brief') {
    const highlights = raw.operationalHighlights || [];
    const discussion = raw.discussionItems || [];
    const pending = raw.pendingAdministrativeItems || [];
    const dates = raw.upcomingDates || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif" }}>
            {raw.briefTitle || 'Executive Meeting Brief'}
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
            Period: {raw.reportingPeriod} · Type: {raw.meetingType}
          </div>
        </div>

        {/* Operational Highlights */}
        {highlights.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.m700, marginBottom: 4 }}>
              Operational Highlights
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {highlights.map((h: any, i: number) => (
                <div key={i} style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
                  <div style={{ fontSize: 9, color: C.t3 }}>{h.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{h.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discussion Items */}
        {discussion.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.m700, marginBottom: 4 }}>
              Suggested Discussion Items
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: C.t2, lineHeight: 1.5 }}>
              {discussion.map((d: string, i: number) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Pending Administrative Items */}
        {pending.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.m700, marginBottom: 4 }}>
              Pending Administrative Items
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pending.map((p: any, i: number) => (
                <div key={i} style={{ fontSize: 11, color: C.t2, padding: '4px 6px', background: '#fff', borderRadius: 4, border: `1px solid ${C.borderLight}` }}>
                  <span style={{ fontWeight: 600, color: C.t1 }}>[{p.category}]</span> {p.summary}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Dates */}
        {dates.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.m700, marginBottom: 4 }}>
              Upcoming Scheduled Dates
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {dates.map((dt: any, i: number) => (
                <div key={i} style={{ fontSize: 10, color: C.t2 }}>
                  • <span style={{ fontWeight: 600 }}>{dt.date}:</span> {dt.title} {dt.audience ? `(${dt.audience})` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 8. Weekly Operations Report
  if (type === 'weekly_report') {
    const period = raw.reportPeriod || {};
    const exec = raw.executiveSummaryFacts || {};
    const fac = raw.facultyAttendanceFacts || {};
    const leaves = raw.leaveFacts || {};
    const behav = raw.administrativeBehaviorFacts || {};
    const acad = raw.academicCompletenessFacts || {};

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif" }}>
            Weekly Operations Review
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
            Reporting Period: {period.label || `${period.startDate} to ${period.endDate}`}
          </div>
        </div>

        {/* Key Indicators */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <div style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 9, color: C.t3 }}>Enrolled Students</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{exec.enrolledStudents ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 9, color: C.t3 }}>Students On Campus</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{exec.studentsOnCampusToday ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 9, color: C.t3 }}>Faculty Checked In</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{fac.checkedInToday ?? 0} / {fac.totalActiveFaculty ?? 0}</div>
          </div>
          <div style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
            <div style={{ fontSize: 9, color: C.t3 }}>Pending Leave Approvals</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.m700 }}>{leaves.pendingApprovalsCount ?? 0}</div>
          </div>
        </div>

        {/* Administrative Behavior */}
        {behav.openCasesCount !== undefined && (
          <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, border: `1px solid ${C.borderLight}`, fontSize: 11 }}>
            <span style={{ fontWeight: 600, color: C.t1 }}>Administrative Disciplinary Cases:</span> {behav.openCasesCount} open case(s) requiring executive attention.
          </div>
        )}

        {/* Academic Completeness */}
        {acad.completenessStatus && (
          <div style={{ padding: '6px 8px', background: C.m50, borderRadius: 6, border: `1px solid ${C.borderLight}`, fontSize: 11 }}>
            <div style={{ fontWeight: 700, color: C.m700 }}>Academic Completeness: {acad.completenessStatus}</div>
            <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>{acad.note}</div>
          </div>
        )}
      </div>
    );
  }

  // Fallback for generic JSON
  return (
    <pre style={{ margin: 0, padding: 8, background: C.paper, borderRadius: 6, fontSize: 10, overflowX: 'auto' }}>
      {JSON.stringify(raw, null, 2)}
    </pre>
  );
}
