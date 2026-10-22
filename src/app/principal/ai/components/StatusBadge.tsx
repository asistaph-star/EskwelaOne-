import React from 'react';
import { C } from '../../../shared/constants/tokens.js';

interface StatusBadgeProps {
  status: string;
  style?: React.CSSProperties;
}

export function getStatusStyle(status: string): { bg: string; color: string; border: string; label: string } {
  const norm = status.trim().toUpperCase().replace(/[\s_-]+/g, '_');

  if (norm.includes('PENDING') || norm === 'INVESTIGATING' || norm === 'UNDER_INVESTIGATION') {
    return {
      bg: C.amberBg,
      color: C.amber,
      border: 'rgba(146,64,14,0.2)',
      label: status.replace(/_/g, ' '),
    };
  }

  if (norm.includes('COMPLETED') || norm.includes('APPROVED') && !norm.includes('LEAVE') || norm === 'RESOLVED') {
    return {
      bg: C.greenBg,
      color: C.green,
      border: 'rgba(21,94,54,0.2)',
      label: status.replace(/_/g, ' '),
    };
  }

  if (norm.includes('ON_APPROVED_LEAVE') || norm.includes('PARENT_NOTIFIED')) {
    return {
      bg: C.blueBg,
      color: C.blue,
      border: 'rgba(30,58,138,0.2)',
      label: norm === 'ON_APPROVED_LEAVE' ? 'On Approved Leave' : status.replace(/_/g, ' '),
    };
  }

  if (norm.includes('NO_GATE_CHECK_IN')) {
    return {
      bg: '#F1F5F9',
      color: C.t2,
      border: '#CBD5E1',
      label: 'No gate check-in / No leave',
    };
  }

  if (norm.includes('REJECTED') || norm.includes('HIGH') || norm.includes('CRITICAL')) {
    return {
      bg: C.redBg,
      color: C.red,
      border: 'rgba(145,24,24,0.2)',
      label: status.replace(/_/g, ' '),
    };
  }

  return {
    bg: '#F1F5F9',
    color: C.t2,
    border: '#E2E8F0',
    label: status.replace(/_/g, ' '),
  };
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  if (!status) return null;
  const { bg, color, border, label } = getStatusStyle(status);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 4,
        background: bg,
        color,
        border: `1px solid ${border}`,
        lineHeight: 1.3,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        textTransform: 'capitalize',
        ...style,
      }}
    >
      {label}
    </span>
  );
}
