import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, X, Send, Trash2, ArrowDown, ShieldCheck, Info, Loader2 
} from 'lucide-react';
import { C } from '../../shared/constants/tokens.js';
import { PrincipalAIMessage } from './types.js';
import { PScreen } from '../../shared/types';
import { AssistantMessageItem } from './components/AssistantMessageItem.js';
import { QuickPromptsGrid } from './components/QuickPromptsGrid.js';

interface PrincipalAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: PrincipalAIMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onClearSession: () => void;
  onNavigate?: (screen: PScreen) => void;
  onRetryLastMessage?: () => void;
}

export function PrincipalAssistantDrawer({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isLoading,
  onClearSession,
  onNavigate,
  onRetryLastMessage,
}: PrincipalAssistantDrawerProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or loading state change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    onSendMessage(trimmed);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile-only backdrop (hidden on sm/desktop to ensure zero darkening, zero blur, zero blocking modal feel) */}
      <div
        data-testid="assistant-drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/35 z-[490] sm:hidden"
      />

      {/* Compact Floating Chat Window */}
      <aside
        data-testid="principal-assistant-drawer"
        role="dialog"
        aria-label="DigiSkwela Principal Operations Assistant"
        className="fixed z-[500] flex flex-col bg-white overflow-hidden border border-slate-200/90 shadow-[0_16px_50px_-10px_rgba(15,23,42,0.28)]
          inset-x-0 bottom-0 top-12 rounded-t-2xl
          sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[416px] sm:h-[600px] sm:max-h-[75vh] sm:rounded-2xl"
        style={{
          animation: 'chatPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style>{`
          @keyframes chatPopIn {
            0% { opacity: 0; transform: scale(0.96) translateY(8px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Compact Header */}
        <header className="bg-[#0A192F] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-[#1D4ED8] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-[13.5px] font-bold font-serif text-white tracking-tight leading-none m-0">
                  DigiSkwela Assistant
                </h2>
                <span
                  data-testid="mock-provider-badge"
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-950/60 text-blue-200 border border-blue-400/20 font-medium tracking-tight whitespace-nowrap"
                >
                  Development mode · Grounded DigiSkwela data
                </span>
              </div>
              <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                Principal Assistant
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {messages.length > 0 && (
              <button
                type="button"
                data-testid="clear-session-button"
                onClick={onClearSession}
                title="Clear Session Conversation"
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              data-testid="close-drawer-button"
              onClick={onClose}
              aria-label="Close Assistant"
              className="text-slate-300 hover:text-white p-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {/* Scrollable Message Container */}
        <main
          data-testid="assistant-messages-container"
          className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 bg-[#F8FAFC] overscroll-contain"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3 pt-1">
              {/* Compact Greeting Card */}
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                <div className="text-[13px] font-bold text-slate-800 font-serif">
                  Good day, Principal.
                </div>
                <div className="text-[11.5px] text-slate-600 mt-1 leading-relaxed">
                  I can audit faculty gate attendance, review pending leaves, summarize school operations, and analyze academic records using live PostgreSQL data.
                </div>
              </div>

              {/* Quick Prompts */}
              <QuickPromptsGrid 
                onSelectPrompt={onSendMessage} 
                disabled={isLoading} 
              />
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <AssistantMessageItem
                  key={msg.id}
                  message={msg}
                  onNavigate={onNavigate}
                  onRetry={onRetryLastMessage}
                />
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div
                  data-testid="assistant-loading-indicator"
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200/80 rounded-xl rounded-tl-xs max-w-[85%] self-start shadow-xs"
                >
                  <Loader2 size={14} className="text-blue-700 animate-spin shrink-0" />
                  <span className="text-[11.5px] text-slate-600 font-medium">
                    Querying verified DigiSkwela domain services...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </main>

        {/* Compact Input Footer */}
        <footer className="p-2.5 bg-white border-t border-slate-200/80 flex flex-col gap-1.5 shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            <textarea
              ref={inputRef}
              data-testid="assistant-input-textarea"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
              maxLength={2000}
              placeholder="Ask about school operations, attendance, leaves..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none font-sans leading-snug max-h-24 min-h-[38px] bg-white disabled:bg-slate-50"
            />

            <button
              type="submit"
              data-testid="assistant-send-button"
              disabled={isLoading || !inputText.trim()}
              className="w-9 h-9 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-100 disabled:text-slate-400 text-white flex items-center justify-center shrink-0 transition-colors disabled:cursor-not-allowed shadow-xs"
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </form>

          {/* Footnote */}
          <div className="flex items-center justify-between text-[9px] text-slate-400 px-1">
            <div className="flex items-center gap-1">
              <ShieldCheck size={10} className="text-emerald-600" />
              <span>Session-scoped · Grounded in live PostgreSQL database</span>
            </div>
            <span className="hidden sm:inline">Enter to send · Shift+Enter newline</span>
          </div>
        </footer>
      </aside>
    </>
  );
}
