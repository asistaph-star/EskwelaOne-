import React from 'react';
import { Calendar, ChevronDown, Clock, ShieldCheck, History } from 'lucide-react';
import { C } from '../constants/tokens';

export interface AcademicYearOption {
  academicYearId: string;
  academicYearName: string;
  isCurrent: boolean;
  gradeLevel?: number;
  sectionName?: string;
  enrollmentStatus?: string;
}

interface SchoolYearSelectorProps {
  academicYears: AcademicYearOption[];
  selectedYearId: string;
  onChange: (academicYearId: string) => void;
  isLoading?: boolean;
  compact?: boolean;
  label?: string;
}

export function SchoolYearSelector({
  academicYears,
  selectedYearId,
  onChange,
  isLoading = false,
  compact = false,
  label = 'School Year',
}: SchoolYearSelectorProps) {
  const selectedYear = academicYears.find(y => y.academicYearId === selectedYearId) || academicYears[0];
  const isHistorical = selectedYear ? !selectedYear.isCurrent : false;

  if (academicYears.length === 0) {
    return null;
  }

  // If there's only 1 year available, render an informative static badge
  if (academicYears.length === 1) {
    const singleYear = academicYears[0];
    return (
      <div
        data-testid="school-year-selector"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: compact ? '4px 10px' : '6px 12px',
          background: C.paper,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          fontSize: compact ? 12 : 13,
          fontWeight: 600,
          color: C.t1,
        }}
      >
        <Calendar size={compact ? 13 : 15} color={C.t3} />
        <span>{singleYear.academicYearName}</span>
        {singleYear.isCurrent && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: '#ecfdf5',
              color: '#059669',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid #a7f3d0',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Current
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="school-year-selector"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          position: 'relative',
          background: isHistorical ? '#fffbeb' : C.paper,
          border: `1px solid ${isHistorical ? '#fde68a' : C.borderMed}`,
          borderRadius: 8,
          padding: compact ? '4px 10px' : '6px 12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease',
        }}
      >
        {isHistorical ? (
          <History size={compact ? 13 : 15} color="#d97706" />
        ) : (
          <Calendar size={compact ? 13 : 15} color={C.navy} />
        )}

        <label
          htmlFor="school-year-select"
          style={{
            fontSize: compact ? 11 : 12,
            fontWeight: 700,
            color: isHistorical ? '#92400e' : C.t2,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            marginRight: 2,
          }}
        >
          {label}:
        </label>

        <select
          id="school-year-select"
          data-testid="school-year-select"
          value={selectedYearId}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          style={{
            appearance: 'none',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: compact ? 12 : 13,
            fontWeight: 700,
            color: isHistorical ? '#b45309' : C.t1,
            cursor: isLoading ? 'wait' : 'pointer',
            paddingRight: 18,
          }}
        >
          {academicYears.map((ay) => (
            <option key={ay.academicYearId} value={ay.academicYearId}>
              {ay.academicYearName}
              {ay.isCurrent ? ' (Current)' : ' (Archived)'}
              {ay.gradeLevel ? `, Grade ${ay.gradeLevel}` : ''}
              {ay.sectionName ? `, Section ${ay.sectionName}` : ''}
            </option>
          ))}
        </select>

        <ChevronDown
          size={13}
          color={isHistorical ? '#d97706' : C.t3}
          style={{
            position: 'absolute',
            right: 8,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Visual Indicator Pill */}
      {isHistorical ? (
        <span
          data-testid="historical-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 700,
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fde68a',
            padding: '4px 8px',
            borderRadius: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          <Clock size={12} color="#d97706" />
          Archived (Read-Only)
        </span>
      ) : (
        <span
          data-testid="current-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 700,
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            padding: '4px 8px',
            borderRadius: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          <ShieldCheck size={12} color="#059669" />
          Active School Year
        </span>
      )}
    </div>
  );
}

