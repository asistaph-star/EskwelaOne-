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
      className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500"
    >
      <div className="flex items-center gap-1 font-semibold text-slate-600 shrink-0">
        <Database size={10} className="text-blue-700" />
        <span>Sources:</span>
      </div>
      {provenance.sourceDomains.map((src, i) => (
        <span
          key={i}
          data-testid={`source-domain-${i}`}
          className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium text-[9.5px] border border-blue-200/60"
        >
          {src}
        </span>
      ))}
      {formattedTime && (
        <span className="text-slate-400 text-[9px] ml-auto shrink-0">
          • {formattedTime}
        </span>
      )}
    </div>
  );
}
