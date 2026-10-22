import React from 'react';
import { Database, Clock } from 'lucide-react';
import { C } from '../../../shared/constants/tokens.js';

interface ProvenanceFooterProps {
  provenance?: {
    sourceDomains: string[];
    asOf?: string;
  };
}

export function ProvenanceFooter({ provenance }: ProvenanceFooterProps) {
  if (!provenance || !provenance.sourceDomains || provenance.sourceDomains.length === 0) {
    return null;
  }

  // Format asOf timestamp if present
  let formattedTime = '';
  if (provenance.asOf) {
    try {
      const d = new Date(provenance.asOf);
      formattedTime = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      formattedTime = provenance.asOf;
    }
  }

  return (
    <div 
      data-testid="provenance-footer"
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: '1px solid rgba(203,213,225,0.6)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 5,
        fontSize: 10,
        color: C.t3,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          fontWeight: 600,
          color: C.t3,
          flexShrink: 0,
        }}
      >
        <Database size={10} color={C.m700} aria-hidden="true" focusable="false" />
        <span>Sources:</span>
      </div>
      {provenance.sourceDomains.map((src, i) => (
        <span
          key={i}
          data-testid={`source-domain-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 20,
            background: C.m50,
            color: C.m700,
            fontWeight: 600,
            fontSize: 9.5,
            border: `1px solid rgba(29,78,216,0.18)`,
          }}
        >
          {src}
        </span>
      ))}
      {formattedTime && (
        <span style={{ fontSize: 9, color: C.t3, marginLeft: 'auto', flexShrink: 0 }}>
          • {formattedTime}
        </span>
      )}
    </div>
  );
}
