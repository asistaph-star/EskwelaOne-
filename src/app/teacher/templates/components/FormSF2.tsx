import React from 'react';
import { AlertTriangle, ShieldAlert, Calendar, UserCheck } from 'lucide-react';
import { C } from '../../../shared/constants/tokens';
import { useSchoolSettings } from '../../../shared/context/SchoolSettingsContext';

export interface FormSF2Props {
  section: string;
  month: string;
  sy: string;
}

export const FORM_SF2_QUARANTINE_STATUS = {
  isOfficialSf2Available: false,
  status: 'QUARANTINED_PENDING_AUTHORITATIVE_MODELS' as const,
  allowFabricatedAttendance: false,
  allowSeedRosterFallback: false,
  requiredModels: [
    'SchoolCalendarDay',
    'OfficialDailyAttendance',
    'Section.adviser_teacher_id',
    'SchoolSettings.school_id',
    'SchoolSettings.school_head_name',
  ],
  reason:
    'Official DepEd School Form 2 (Daily Attendance Report of Learners) cannot be generated from mock seed rosters, hash-based statuses, or single-subject ClassAttendance records.',
};

/**
 * Legacy FormSF2 component — Quarantined in Phase E.
 *
 * Until the approved SchoolCalendarDay and OfficialDailyAttendance models are migrated
 * and populated by the designated Class Adviser, this component renders an explicit
 * unavailable state and refuses to output fabricated school documents.
 */
export function FormSF2({ section, month, sy }: FormSF2Props) {
  const { settings } = useSchoolSettings();

  return (
    <div
      data-testid="form-sf2-quarantined"
      style={{
        background: '#fff',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        width: '100%',
        maxWidth: 840,
        margin: '0 auto',
        padding: 28,
        boxSizing: 'border-box',
        color: C.t1,
        border: '1px solid #fde68a',
        borderTop: '4px solid #d97706',
        borderRadius: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ShieldAlert size={22} color="#b45309" />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: '#92400e',
              background: '#fef3c7',
              padding: '3px 8px',
              borderRadius: 4,
              marginBottom: 8,
            }}
          >
            <AlertTriangle size={12} /> Official DepEd SF2 Issuance Blocked
          </div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: C.t1 }}>
            School Form 2 (SF2) Daily Attendance Report of Learners — Not Yet Available
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: C.t2, lineHeight: 1.6 }}>
            {settings.schoolName || 'Calulut Integrated School'} does not permit generating official
            DepEd SF2 reports from synthetic rosters, default/fabricated attendance values, or
            single-subject period attendance (<code>ClassAttendance</code>).
          </p>

          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              background: '#f8fafc',
              border: `1px solid ${C.borderMed}`,
              borderRadius: 6,
              fontSize: 11,
              color: C.t2,
            }}
          >
            <div style={{ fontWeight: 700, color: C.t1, marginBottom: 6 }}>
              Requested Context: {section || 'Unassigned Section'} · {month || 'Unspecified Month'} ·{' '}
              SY {sy || 'Unspecified'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={13} color={C.t3} />
                <span>
                  <strong>Authoritative School Calendar Required:</strong> Official instructional
                  days, regular holidays, suspensions, and makeup classes must be approved for the
                  academic year before monthly SF2/SF9 school-day totals can be computed.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={13} color={C.t3} />
                <span>
                  <strong>Class Adviser Daily Attendance Required:</strong> Whole-day learner
                  attendance must be recorded and verified by the designated section Class Adviser
                  with verified school signatories.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
