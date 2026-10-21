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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider px-0.5">
        <Sparkles size={11} className="text-blue-700" />
        <span>Grounded Operational Prompts</span>
      </div>

      <div 
        data-testid="quick-prompts-container"
        className="grid grid-cols-2 gap-1.5"
      >
        {PRINCIPAL_QUICK_PROMPTS.map(qp => (
          <button
            key={qp.id}
            type="button"
            data-testid={`quick-prompt-${qp.id}`}
            disabled={disabled}
            onClick={() => onSelectPrompt(qp.prompt)}
            className="flex flex-col items-start gap-1 p-2 bg-white border border-slate-200/80 rounded-xl text-left hover:border-blue-500 hover:bg-blue-50/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 w-full min-w-0">
              <div className="w-5 h-5 rounded-md bg-blue-50 group-hover:bg-blue-100/70 flex items-center justify-center shrink-0 transition-colors">
                {getIcon(qp.iconName)}
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight truncate group-hover:text-blue-700 transition-colors">
                {qp.label}
              </span>
            </div>
            <span className="text-[9px] text-slate-500 leading-tight line-clamp-1 pl-6">
              {qp.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
