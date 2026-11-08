import React, { useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, AlertTriangle, Info, Loader2 } from 'lucide-react';

export interface ModalChecklistItem {
  title: string;
  description: string;
  icon?: React.ReactNode;
  status?: 'success' | 'warning' | 'error' | 'neutral';
}

export interface ModernConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  subtitle?: string;
  description?: string;
  checklist?: ModalChecklistItem[];
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'success' | 'danger' | 'warning';
  confirmIcon?: React.ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  note?: string;
  error?: string | null;
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'info' | 'danger';
  };
  // Optional input mode (e.g. for reopen justification prompt)
  inputField?: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (val: string) => void;
    minLength?: number;
    required?: boolean;
    error?: string;
  };
  children?: React.ReactNode;
}

export function ModernConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  description,
  checklist = [],
  confirmLabel = 'Confirm & Proceed',
  cancelLabel = 'Cancel',
  confirmVariant = 'success',
  confirmIcon,
  isLoading = false,
  loadingLabel = 'Processing...',
  note,
  error,
  badge,
  inputField,
  children,
}: ModernConfirmModalProps) {
  // ESC key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  // Variant color definitions
  const variantStyles = {
    primary: {
      gradient: 'from-indigo-600 via-blue-600 to-indigo-800',
      iconBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    success: {
      gradient: 'from-emerald-600 via-teal-600 to-indigo-700',
      iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    warning: {
      gradient: 'from-amber-500 via-amber-600 to-orange-600',
      iconBg: 'bg-amber-50 border-amber-200 text-amber-700',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    danger: {
      gradient: 'from-red-600 via-rose-600 to-pink-700',
      iconBg: 'bg-red-50 border-red-200 text-red-700',
      btn: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20',
      badgeBg: 'bg-red-50 text-red-700 border-red-200',
    },
  }[confirmVariant];

  const defaultIcon = {
    primary: <ShieldCheck size={22} className="stroke-[2.2]" />,
    success: <ShieldCheck size={22} className="stroke-[2.2]" />,
    warning: <AlertTriangle size={22} className="stroke-[2.2]" />,
    danger: <AlertTriangle size={22} className="stroke-[2.2]" />,
  }[confirmVariant];

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col font-sans max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Stripe */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${variantStyles.gradient}`} />

        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-start justify-between gap-4 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center shadow-sm shrink-0 mt-0.5 ${variantStyles.iconBg}`}
            >
              {confirmIcon || defaultIcon}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight font-serif leading-snug">
                  {title}
                </h3>
                {badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      badge.variant === 'danger'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : badge.variant === 'warning'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : variantStyles.badgeBg
                    }`}
                  >
                    {badge.text}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-normal">{subtitle}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors disabled:opacity-40"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-700 text-sm">
          {description && <p className="leading-relaxed text-slate-600 text-xs sm:text-sm">{description}</p>}

          {children}

          {/* Checklist Cards */}
          {checklist.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Execution Steps &amp; Safeguards
              </div>
              <div className="space-y-2 rounded-xl bg-slate-50/80 border border-slate-200/70 p-3.5">
                {checklist.map((item, idx) => {
                  const status = item.status || 'success';
                  const iconBg =
                    status === 'warning'
                      ? 'bg-amber-100/90 text-amber-700'
                      : status === 'error'
                      ? 'bg-red-100/90 text-red-700'
                      : status === 'neutral'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-emerald-100/90 text-emerald-700';

                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                        {item.icon || <CheckCircle2 size={13} className="stroke-[2.5]" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 leading-snug">{item.title}</div>
                        <div className="text-[11.5px] text-slate-500 leading-relaxed mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional Input Field (Prompt Mode) */}
          {inputField && (
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-800">
                {inputField.label}{' '}
                {inputField.required && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={inputField.value}
                onChange={(e) => inputField.onChange(e.target.value)}
                placeholder={inputField.placeholder}
                rows={3}
                disabled={isLoading}
                className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 bg-white shadow-inner resize-none font-sans"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {inputField.minLength ? `Minimum ${inputField.minLength} characters` : ''}
                </span>
                <span
                  className={
                    inputField.minLength && inputField.value.trim().length < inputField.minLength
                      ? 'text-amber-600 font-semibold'
                      : 'text-slate-500'
                  }
                >
                  {inputField.value.trim().length} chars
                </span>
              </div>
              {inputField.error && (
                <div className="text-xs font-medium text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> {inputField.error}
                </div>
              )}
            </div>
          )}

          {/* Blocking Validation Error Callout */}
          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold block mb-0.5">Publication Blocked</span>
                {error}
              </div>
            </div>
          )}

          {/* Policy Note Callout */}
          {note && (
            <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200/70 text-amber-900 text-xs flex items-start gap-2.5">
              <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{note}</div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 border border-slate-200 transition-all disabled:opacity-40"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={async () => {
              await onConfirm();
            }}
            disabled={
              isLoading ||
              Boolean(inputField?.minLength && inputField.value.trim().length < inputField.minLength)
            }
            className={`px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles.btn}`}
          >
            {isLoading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>{loadingLabel}</span>
              </>
            ) : (
              <>
                {confirmIcon}
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

