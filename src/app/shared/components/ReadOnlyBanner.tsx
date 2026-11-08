import React from 'react';
import { History, Lock, ArrowRight } from 'lucide-react';
import { C } from '../constants/tokens';

interface ReadOnlyBannerProps {
  yearName?: string;
  recordType?: 'grades' | 'attendance' | 'general';
  onReturnToCurrent?: () => void;
}

export function ReadOnlyBanner({
  yearName,
  recordType = 'general',
  onReturnToCurrent,
}: ReadOnlyBannerProps) {
  const typeLabel =
    recordType === 'grades'
      ? 'academic grades and scholastic ratings'
      : recordType === 'attendance'
      ? 'official DepEd SF2 daily attendance records'
      : 'academic records';

  return (
    <div
      data-testid="read-only-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 16px',
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 8,
        marginBottom: 16,
        boxShadow: '0 1px 3px rgba(217, 119, 6, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#fef3c7',
            border: '1px solid #fde68a',
            flexShrink: 0,
          }}
        >
          <Lock size={18} color="#b45309" />
        </div>

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>Archived Academic Record (Read-Only)</span>
            {yearName && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: '#fde68a',
                  color: '#78350f',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {yearName}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#78350f', marginTop: 2, lineHeight: 1.4 }}>
            You are viewing archived {typeLabel}. All entries, calculations, and official documents are permanently locked under DepEd school governance policy.
          </div>
        </div>
      </div>

      {onReturnToCurrent && (
        <button
          onClick={onReturnToCurrent}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            background: '#b45309',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Return to Active Year</span>
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
