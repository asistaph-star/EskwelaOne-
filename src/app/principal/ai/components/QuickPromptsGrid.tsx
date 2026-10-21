import React, { useState } from 'react';
import { 
  Activity, Users, FileText, Calendar, Shield, 
  BarChart2, Briefcase, Clock, Sparkles 
} from 'lucide-react';
import { C } from '../../../shared/constants/tokens.js';
import { PRINCIPAL_QUICK_PROMPTS } from '../constants/quickPrompts.js';
import { QuickPrompt } from '../types.js';

interface QuickPromptsGridProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

export function QuickPromptsGrid({ onSelectPrompt, disabled }: QuickPromptsGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getIcon = (iconName: QuickPrompt['iconName']) => {
    const size = 13;
    const color = C.m700;
    switch (iconName) {
      case 'activity': return <Activity size={size} color={color} />;
      case 'users': return <Users size={size} color={color} />;
      case 'file-text': return <FileText size={size} color={color} />;
      case 'calendar': return <Calendar size={size} color={color} />;
      case 'shield': return <Shield size={size} color={color} />;
      case 'bar-chart': return <BarChart2 size={size} color={color} />;
      case 'briefcase': return <Briefcase size={size} color={color} />;
      case 'clock': return <Clock size={size} color={color} />;
      default: return <Sparkles size={size} color={color} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          paddingLeft: 2,
        }}
      >
        <Sparkles size={10} color={C.m700} />
        <span>Suggested Prompts</span>
      </div>

      <div 
        data-testid="quick-prompts-container"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
        }}
      >
        {PRINCIPAL_QUICK_PROMPTS.map(qp => {
          const isHovered = hoveredId === qp.id;
          return (
            <button
              key={qp.id}
              type="button"
              data-testid={`quick-prompt-${qp.id}`}
              disabled={disabled}
              onClick={() => onSelectPrompt(qp.prompt)}
              onMouseEnter={() => setHoveredId(qp.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 4,
                padding: '8px 10px',
                background: isHovered ? C.m50 : C.paper,
                border: `1px solid ${isHovered ? 'rgba(59,130,246,0.4)' : '#CBD5E1'}`,
                borderRadius: 10,
                textAlign: 'left',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.15s ease',
                boxShadow: isHovered
                  ? '0 2px 6px rgba(29,78,216,0.08)'
                  : '0 1px 2px rgba(0,0,0,0.03)',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: isHovered ? C.m200 : C.m100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.15s ease',
                  }}
                >
                  {getIcon(qp.iconName)}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isHovered ? C.m700 : C.t1,
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {qp.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 9,
                  color: C.t3,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  paddingLeft: 28,
                }}
              >
                {qp.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
