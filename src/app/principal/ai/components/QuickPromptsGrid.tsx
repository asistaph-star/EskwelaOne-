import React from 'react';
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
  const getIcon = (iconName: QuickPrompt['iconName']) => {
    switch (iconName) {
      case 'activity': return <Activity size={13} color={C.m700} />;
      case 'users': return <Users size={13} color={C.m700} />;
      case 'file-text': return <FileText size={13} color={C.m700} />;
      case 'calendar': return <Calendar size={13} color={C.m700} />;
      case 'shield': return <Shield size={13} color={C.m700} />;
      case 'bar-chart': return <BarChart2 size={13} color={C.m700} />;
      case 'briefcase': return <Briefcase size={13} color={C.m700} />;
      case 'clock': return <Clock size={13} color={C.m700} />;
      default: return <Sparkles size={13} color={C.m700} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Sparkles size={12} color={C.m700} />
        <span>Grounded Operational Prompts</span>
      </div>

      <div 
        data-testid="quick-prompts-container"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 6,
        }}
      >
        {PRINCIPAL_QUICK_PROMPTS.map(qp => (
          <button
            key={qp.id}
            type="button"
            data-testid={`quick-prompt-${qp.id}`}
            disabled={disabled}
            onClick={() => onSelectPrompt(qp.prompt)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 3,
              padding: '8px 10px',
              background: '#FFFFFF',
              border: `1px solid ${C.borderLight}`,
              borderRadius: 8,
              textAlign: 'left',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
            onMouseEnter={e => {
              if (!disabled) {
                e.currentTarget.style.borderColor = C.m700;
                e.currentTarget.style.background = C.m50;
              }
            }}
            onMouseLeave={e => {
              if (!disabled) {
                e.currentTarget.style.borderColor = C.borderLight;
                e.currentTarget.style.background = '#FFFFFF';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: C.m50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getIcon(qp.iconName)}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, lineHeight: 1.3 }}>
                {qp.label}
              </span>
            </div>
            <span style={{ fontSize: 9.5, color: C.t3, lineHeight: 1.3, paddingLeft: 28 }}>
              {qp.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
