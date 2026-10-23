import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { C } from '../../../shared/constants/tokens.js';
import { PRINCIPAL_QUICK_PROMPTS } from '../constants/quickPrompts.js';
import { QuickPrompt } from '../types.js';

interface QuickPromptsGridProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
  prompts?: QuickPrompt[];
}

export function QuickPromptsGrid({ onSelectPrompt, disabled, prompts = PRINCIPAL_QUICK_PROMPTS }: QuickPromptsGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelectPrompt = (qp: QuickPrompt) => {
    if (disabled) return;
    setSelectedId(qp.id);
    // Smooth visual feedback before triggering prompt
    setTimeout(() => {
      onSelectPrompt(qp.prompt);
    }, 200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          fontSize: 9.5,
          fontWeight: 700,
          color: '#64748B',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          paddingRight: 2,
        }}
      >
        <MessageSquare size={10} color={C.m700} aria-hidden="true" focusable="false" />
        <span>Suggested Prompts</span>
      </div>

      {/* Modern Capsule Pill Actions — Grouped toward right/center-right with flex-wrap */}
      <div 
        data-testid="quick-prompts-container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        {prompts.map(qp => {
          const isSelected = selectedId === qp.id;
          const isHovered = hoveredId === qp.id;

          return (
            <button
              key={qp.id}
              type="button"
              data-testid={`quick-prompt-${qp.id}`}
              disabled={disabled}
              onClick={() => handleSelectPrompt(qp)}
              onMouseEnter={() => setHoveredId(qp.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 13px',
                borderRadius: 9999, // Pill capsule shape
                background: isSelected
                  ? C.m700
                  : isHovered
                    ? '#EFF6FF'
                    : '#FFFFFF',
                border: isSelected
                  ? `1px solid ${C.m700}`
                  : isHovered
                    ? '1px solid rgba(29, 78, 216, 0.45)'
                    : '1px solid rgba(29, 78, 216, 0.22)',
                color: isSelected ? '#FFFFFF' : C.m700,
                fontSize: 11.5,
                fontWeight: isSelected ? 700 : 600,
                lineHeight: 1.35,
                textAlign: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.16s ease',
                boxShadow: isSelected
                  ? '0 2px 8px rgba(29, 78, 216, 0.35)'
                  : isHovered
                    ? '0 2px 6px rgba(29, 78, 216, 0.12)'
                    : '0 1px 3px rgba(0, 0, 0, 0.04)',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                letterSpacing: '0.01em',
                transform: isSelected
                  ? 'scale(0.97)'
                  : isHovered
                    ? 'translateY(-1px)'
                    : 'none',
              }}
            >
              <span>{qp.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
