import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  message: string;
  type?: 'success' | 'error' | 'info';
  durationMs?: number;
}

export interface ModernToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function ModernToast({ toast, onDismiss }: ModernToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.durationMs || 4500);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const type = toast.type || 'info';

  const styles = {
    success: {
      container: 'bg-emerald-900/95 text-white border-emerald-700 shadow-emerald-950/20',
      icon: <CheckCircle2 size={18} className="text-emerald-300 shrink-0 stroke-[2.2]" />,
      accent: 'bg-emerald-400',
    },
    error: {
      container: 'bg-red-900/95 text-white border-red-700 shadow-red-950/20',
      icon: <AlertCircle size={18} className="text-red-300 shrink-0 stroke-[2.2]" />,
      accent: 'bg-red-400',
    },
    info: {
      container: 'bg-slate-900/95 text-white border-slate-700 shadow-slate-950/20',
      icon: <Info size={18} className="text-blue-300 shrink-0 stroke-[2.2]" />,
      accent: 'bg-blue-400',
    },
  }[type];

  return (
    <div
      className="fixed bottom-6 right-6 z-[1000] max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-200 pointer-events-auto"
      role="alert"
      aria-live="polite"
    >
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md ${styles.container}`}
      >
        <div className="mt-0.5">{styles.icon}</div>
        <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
          {toast.message}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-white/70 hover:text-white rounded-lg p-1 hover:bg-white/10 transition-colors shrink-0"
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

