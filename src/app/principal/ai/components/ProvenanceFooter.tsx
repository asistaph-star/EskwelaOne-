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
        marginTop: 12,
        paddingTop: 10,
        borderTop: `1px solid ${C.borderLight}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: C.t3, fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Database size={11} color={C.m700} />
          <span>Verified Sources</span>
        </div>
        {formattedTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} color={C.t3} />
            <span>Updated {formattedTime}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {provenance.sourceDomains.map((src, i) => (
          <span
            key={i}
            data-testid={`source-domain-${i}`}
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 12,
              background: C.m50,
              color: C.m700,
              border: `1px solid ${C.border}`,
              fontWeight: 600,
            }}
          >
            • {src}
          </span>
        ))}
      </div>
    </div>
  );
}
