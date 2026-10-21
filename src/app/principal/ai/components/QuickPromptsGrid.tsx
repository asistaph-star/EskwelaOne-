import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { C } from '../../../shared/constants/tokens.js';
import { PRINCIPAL_QUICK_PROMPTS } from '../constants/quickPrompts.js';
import { QuickPrompt } from '../types.js';

interface QuickPromptsGridProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

export function QuickPromptsGrid({ onSelectPrompt, disabled }: QuickPromptsGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelectPrompt = (qp: QuickPrompt) => {
    if (disabled) return;
    setSelectedId(qp.id);
    // Visual confirmation delay so the solid brand selection fill is perceived
    setTimeout(() => {
      onSelectPrompt(qp.prompt);
    }, 350);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          fontWeight: 700,
          color: C.t3,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          paddingLeft: 4,
        }}
      >
        <Sparkles size={11} color={C.m700} />
        <span>Suggested Prompts</span>
      </div>

      {/* Modern Capsule Pill Chips — Flex-wrap staggered layout, no emojis */}
      <div 
        data-testid="quick-prompts-container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7,
          alignItems: 'center',
        }}
      >
        {PRINCIPAL_QUICK_PROMPTS.map(qp => {
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
                padding: '7px 15px',
                borderRadius: 9999, // Pill capsule shape
                background: isSelected
                  ? C.m700
                  : isHovered
                    ? C.m50
                    : '#FFFFFF',
                border: isSelected
                  ? `1.5px solid ${C.m700}`
                  : isHovered
                    ? '1.5px solid rgba(29,78,216,0.38)'
                    : '1.5px solid rgba(29,78,216,0.18)',
                color: isSelected ? '#FFFFFF' : C.m700,
                fontSize: 11.5,
                fontWeight: isSelected ? 700 : 600,
                lineHeight: 1.35,
                textAlign: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.16s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isSelected
                  ? '0 4px 14px rgba(29,78,216,0.38)'
                  : isHovered
                    ? '0 3px 8px rgba(29,78,216,0.12)'
                    : '0 2px 6px rgba(0,0,0,0.04)',
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

