import React, { useState } from 'react';
import { 
  Users, Calendar, FileText, ShieldAlert, BarChart2, 
  CheckCircle2, Clock, AlertTriangle, ArrowRight, Activity, Briefcase,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { C } from '../../../shared/constants/tokens.js';
import { PrincipalAIMessage, SafeNavAction } from '../types.js';
import { PScreen } from '../../../shared/types';
import { StatusBadge } from './StatusBadge.js';
import { formatAiDate, formatDateRange } from '../utils/formatAiDate.js';
import { humanizeValue } from '../utils/humanizeValue.js';

interface StructuredDataRendererProps {
  data: NonNullable<PrincipalAIMessage['structuredData']>;
  onNavigate?: (screen: PScreen) => void;
}

/**
 * Single Stacked Leave Record Card with Progressive Disclosure
 */
function LeaveRecordCard({ leave, index }: { leave: any; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const applicant = leave.applicantDisplayName || leave.teacherName || leave.applicant || 'Faculty Member';
  const dates = formatDateRange(leave.startDate, leave.endDate, leave.daysCount);
  const status = leave.status || 'Pending';
  const submittedOn = leave.submittedOn ? formatAiDate(leave.submittedOn) : null;
  const requestId = leave.requestId;
  const department = leave.department;

  return (
    <div
      data-testid={`leave-card-${index}`}
      style={{
        padding: '10px 12px',
        background: '#FFFFFF',
        border: '1px solid #CBD5E1',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Header: Title + Status Pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: C.m700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Leave Request
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginTop: 1 }}>
            {applicant}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Primary Key-Values */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 10px', marginTop: 2 }}>
        {department && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Department
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: C.t1 }}>
              {department}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Leave Type
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: C.t1 }}>
            {leave.leaveType || 'General Leave'}
          </span>
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Dates
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: C.t1 }}>
            {dates}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Days
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: C.t1 }}>
            {leave.daysCount ?? 1} day{leave.daysCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Status
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: C.t1 }}>
            {status}
          </span>
        </div>
      </div>

      {/* Progressive Disclosure (View details / Hide details) */}
      {(requestId || submittedOn) && (
        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 6, marginTop: 2 }}>
          <button
            type="button"
            data-testid={`toggle-leave-details-${index}`}
            onClick={() => setIsExpanded(prev => !prev)}
            aria-expanded={isExpanded}
            style={{
              background: 'none',
              border: 'none',
              color: C.m700,
              fontSize: 10.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: 0,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {isExpanded ? (
              <ChevronUp size={12} aria-hidden="true" focusable="false" />
            ) : (
              <ChevronDown size={12} aria-hidden="true" focusable="false" />
            )}
            <span>{isExpanded ? 'Hide details' : 'View details'}</span>
          </button>

          {isExpanded && (
            <div
              data-testid={`leave-details-expanded-${index}`}
              style={{
                marginTop: 6,
                padding: '8px 10px',
                background: '#F8FAFC',
                borderRadius: 6,
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              {requestId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase' }}>Request ID</span>
                  <span style={{ fontSize: 10.5, color: C.t2, fontFamily: 'monospace' }}>{requestId}</span>
                </div>
              )}
              {submittedOn && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase' }}>Submitted</span>
                  <span style={{ fontSize: 11, color: C.t2 }}>{submittedOn}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StructuredDataRenderer({ data, onNavigate }: StructuredDataRendererProps) {
  const { type, raw } = data;

  // Single source of truth: Navigation action is rendered authoritatively by AssistantMessageItem
  const renderNavButton = (_action: SafeNavAction) => null;

  // 1. Faculty Attendance Audit
  if (type === 'attendance') {
    const s = raw.summary || {};
    const records = raw.records || [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.m900, fontFamily: "'Fraunces', serif" }}>
            Faculty Gate Attendance Audit
          </div>
          <span style={{ fontSize: 10, color: C.t3 }}>Date: {raw.asOfDate ? formatAiDate(raw.asOfDate) : 'Today'}</span>
        </div>

        {/* Attendance Summary Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
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
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.t2, fontSize: 11, fontWeight: 600 }}>
              <Clock size={13} color={C.m700} aria-hidden="true" focusable="false" />
              <span>{s.noGateCheckInNoApprovedLeaveFoundCount} faculty members:</span>
            </div>
            <div style={{ fontSize: 11, color: C.t2, marginTop: 4 }}>
              No gate check-in was recorded today and no approved leave record was found.
            </div>
          </div>
        )}

        {/* Detailed Records Preview as stacked cards */}
        {records.length > 0 && (
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #CBD5E1', borderRadius: 6, background: C.paper, display: 'flex', flexDirection: 'column' }}>
            {records.map((r: any, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: '8px 10px',
                  borderBottom: idx < records.length - 1 ? '1px solid #E2E8F0' : 'none',
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: C.t1 }}>{r.teacherName}</span>
                  <span style={{ fontSize: 10, color: C.t3 }}>{r.department || 'General'}</span>
                </div>
                <div style={{ alignSelf: 'flex-start' }}>
                  <StatusBadge status={r.attendanceStatus} />
                </div>
              </div>
            ))}
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
        <div style={{ fontSize: 13, fontWeight: 700, color: C.m900, fontFamily: "'Fraunces', serif" }}>
          School Operational Pulse Fact Sheet
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 600 }}>Enrolled Students</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{raw.students?.enrolled ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 600 }}>Gate Time-In (No Time-Out)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{raw.students?.timeInNoTimeoutCount ?? raw.students?.onCampusNow ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 600 }}>Active Faculty</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{raw.faculty?.totalActive ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '8px 10px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 600 }}>Pending Leaves</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.m700 }}>{raw.operations?.pendingLeaves ?? 0}</div>
          </div>
        </div>

        {raw.academics && (
          <div style={{ padding: '8px 10px', background: C.m50, borderRadius: 6, border: '1px solid rgba(29,78,216,0.18)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.m700 }}>Academic Grading Completeness</div>
            <div style={{ fontSize: 11, color: C.t2, marginTop: 2 }}>
              Status: <span style={{ fontWeight: 600 }}>{humanizeValue(raw.academics.completenessStatus)}</span>
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

  // 3. Pending Leaves (Rule A: Stacked Record Cards)
  if (type === 'leaves') {
    const leaves = raw.leaves || raw.requests || [];
    const count = raw.totalPending ?? leaves.length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.m900, fontFamily: "'Fraunces', serif" }}>
            Pending Faculty Leave Applications
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.m700 }}>{count} Pending</span>
        </div>

        {count === 0 ? (
          <div style={{ padding: 12, background: C.paper, borderRadius: 6, fontSize: 11, color: C.t2, textAlign: 'center', border: '1px solid #CBD5E1' }}>
            No pending leave requests found. All faculty leave applications have been reviewed.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {leaves.map((l: any, i: number) => (
              <LeaveRecordCard key={l.requestId || i} leave={l} index={i} />
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
          <div style={{ fontSize: 13, fontWeight: 700, color: C.m900, fontFamily: "'Fraunces', serif" }}>
            Scheduled School Events
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.m700 }}>{count} Scheduled</span>
        </div>

        {count === 0 ? (
          <div style={{ padding: 12, background: C.paper, borderRadius: 6, fontSize: 11, color: C.t2, textAlign: 'center', border: '1px solid #CBD5E1' }}>
            No upcoming events were found for the selected period.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {events.map((e: any, i: number) => {
              const dateDisplay = formatDateRange(e.startDate, e.endDate);
              return (
                <div key={i} style={{ padding: '9px 11px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: C.t1 }}>{e.title}</span>
                    <span style={{ fontSize: 10, color: C.m700, background: C.m50, padding: '2px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                      {dateDisplay}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.t2, marginTop: 4 }}>
                    Audience: {e.audience || 'All'} {e.location ? `· Location: ${e.location}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {renderNavButton({ label: 'View School Events', screen: 'p-events' })}
      </div>
    );
  }

  // 5. Behavior Summary
  if (type === 'behavior') {
    const summary = raw.summary || {};
    const sb = raw.statusBreakdown || summary;
    const count = raw.totalCases ?? summary.totalCases ?? raw.totalMatched ?? raw.cases?.length ?? 0;
    const cases = raw.cases || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.m900, fontFamily: "'Fraunces', serif" }}>
            Administrative Behavior Summary
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.m700 }}>{count} Total Cases</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          <div style={{ padding: '6px 4px', background: C.paper, borderRadius: 4, textAlign: 'center', border: '1px solid #CBD5E1' }}>
            <div style={{ fontSize: 8, color: C.t3, textTransform: 'uppercase' }}>Reported</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>{sb.reported ?? 0}</div>
          </div>
          <div style={{ padding: '6px 4px', background: C.amberBg, borderRadius: 4, textAlign: 'center', border: '1px solid rgba(146,64,14,0.2)' }}>
            <div style={{ fontSize: 8, color: C.amber, textTransform: 'uppercase' }}>Investigating</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.amber }}>{sb.underInvestigation ?? 0}</div>
          </div>
          <div style={{ padding: '6px 4px', background: C.blueBg, borderRadius: 4, textAlign: 'center', border: '1px solid rgba(30,58,138,0.2)' }}>
            <div style={{ fontSize: 8, color: C.blue, textTransform: 'uppercase' }}>Parent Notified</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.blue }}>{sb.parentNotified ?? 0}</div>
          </div>
          <div style={{ padding: '6px 4px', background: C.greenBg, borderRadius: 4, textAlign: 'center', border: '1px solid rgba(21,94,54,0.2)' }}>
            <div style={{ fontSize: 8, color: C.green, textTransform: 'uppercase' }}>Resolved</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{sb.resolved ?? 0}</div>
          </div>
        </div>

        {cases.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {cases.map((c: any, i: number) => (
              <div key={i} style={{ padding: '8px 10px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: C.t1 }}>{c.studentName} (Gr. {c.gradeLevel})</span>
                  <StatusBadge status={c.status} />
                </div>
                <div style={{ color: C.t3, fontSize: 10, marginTop: 3 }}>
                  Category: <span style={{ color: C.t2, fontWeight: 500 }}>{c.category}</span> {c.incidentDate ? `· Date: ${formatAiDate(c.incidentDate)}` : ''}
                </div>
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
        <div style={{ fontSize: 13, fontWeight: 700, color: C.m900, fontFamily: "'Fraunces', serif" }}>
          School-Wide Academic Completeness & Evaluation
        </div>

        <div style={{ padding: 10, background: isComplete ? C.greenBg : C.m50, borderRadius: 6, border: `1px solid ${isComplete ? 'rgba(21,94,54,0.2)' : C.borderMed}` }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: isComplete ? C.green : C.m700 }}>
            Completeness Status: {humanizeValue(raw.completenessStatus)}
          </div>
          <div style={{ fontSize: 11, color: C.t1, marginTop: 4, lineHeight: 1.4 }}>
            {raw.annualPassRate !== null && raw.annualPassRate !== undefined ? (
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
          <div style={{ fontSize: 14, fontWeight: 800, color: C.m900, fontFamily: "'Fraunces', serif" }}>
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
                <div key={i} style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
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
                <div key={i} style={{ fontSize: 11, color: C.t2, padding: '4px 6px', background: C.paper, borderRadius: 4, border: '1px solid #CBD5E1' }}>
                  <span style={{ fontWeight: 600, color: C.t1 }}>[{humanizeValue(p.category)}]</span> {p.summary}
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
                  • <span style={{ fontWeight: 600 }}>{dt.date ? formatAiDate(dt.date) : ''}:</span> {dt.title} {dt.audience ? `(${dt.audience})` : ''}
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
          <div style={{ fontSize: 14, fontWeight: 800, color: C.m900, fontFamily: "'Fraunces', serif" }}>
            Weekly Operations Review
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
            Reporting Period: {period.label || `${formatAiDate(period.startDate)} to ${formatAiDate(period.endDate)}`}
          </div>
        </div>

        {/* Key Indicators */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <div style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
            <div style={{ fontSize: 9, color: C.t3 }}>Enrolled Students</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{exec.enrolledStudents ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
            <div style={{ fontSize: 9, color: C.t3 }}>Gate Time-In (No Time-Out)</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{exec.studentsTimeInNoTimeoutToday ?? 'N/A'}</div>
          </div>
          <div style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
            <div style={{ fontSize: 9, color: C.t3 }}>Faculty Checked In</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{fac.checkedInToday ?? 0} / {fac.totalActiveFaculty ?? 0}</div>
          </div>
          <div style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1' }}>
            <div style={{ fontSize: 9, color: C.t3 }}>Pending Leave Approvals</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.m700 }}>{leaves.pendingApprovalsCount ?? 0}</div>
          </div>
        </div>

        {/* Administrative Behavior */}
        {behav.openCasesCount !== undefined && (
          <div style={{ padding: '6px 8px', background: C.paper, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 11 }}>
            <span style={{ fontWeight: 600, color: C.t1 }}>Administrative Disciplinary Cases:</span> {behav.openCasesCount} open case(s) requiring executive attention.
          </div>
        )}

        {/* Academic Completeness */}
        {acad.completenessStatus && (
          <div style={{ padding: '6px 8px', background: C.m50, borderRadius: 6, border: '1px solid rgba(29,78,216,0.18)', fontSize: 11 }}>
            <div style={{ fontWeight: 700, color: C.m700 }}>Academic Completeness: {humanizeValue(acad.completenessStatus)}</div>
            <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>{acad.note}</div>
          </div>
        )}
      </div>
    );
  }

  // Tools without dedicated visual card components should never dump raw JSON into the chat bubble
  return null;
}
