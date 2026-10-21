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
      {/* Backdrop */}
      <div
        data-testid="assistant-drawer-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 25, 47, 0.45)',
          backdropFilter: 'blur(2px)',
          zIndex: 450,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Drawer Panel */}
      <aside
        data-testid="principal-assistant-drawer"
        role="dialog"
        aria-label="DigiSkwela Principal Operations Assistant"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: 520,
          background: '#FFFFFF',
          zIndex: 451,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(10, 25, 47, 0.25)',
          overflow: 'hidden',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header Band */}
        <header
          style={{
            background: C.m900,
            color: '#FFFFFF',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `2px solid ${C.m700}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: C.m700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <Sparkles size={18} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Fraunces', serif", margin: 0, color: '#fff' }}>
                  DigiSkwela Assistant
                </h2>
                {/* Subtle Mock Provider Indicator */}
                <span
                  data-testid="mock-provider-badge"
                  style={{
                    fontSize: 9.5,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.14)',
                    color: '#E2E8F0',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                  }}
                >
                  Development mode · Grounded DigiSkwela data
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>
                Principal Operations Assistant · Role-Authorized Facts
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {messages.length > 0 && (
              <button
                type="button"
                data-testid="clear-session-button"
                onClick={onClearSession}
                title="Clear Session Conversation"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
                onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              type="button"
              data-testid="close-drawer-button"
              onClick={onClose}
              aria-label="Close Assistant"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer',
                width: 30,
                height: 30,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Message Container / Body */}
        <main
          data-testid="assistant-messages-container"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: C.paper,
          }}
        >
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 10 }}>
              {/* Greeting Card */}
              <div
                style={{
                  padding: '16px 18px',
                  background: '#FFFFFF',
                  borderRadius: 10,
                  border: `1px solid ${C.borderMed}`,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>
                  Good day, Principal.
                </div>
                <div style={{ fontSize: 12, color: C.t2, marginTop: 4, lineHeight: 1.5 }}>
                  I can investigate school operations, audit today's faculty presence, review pending leave requests, check behavioral cases, and synthesize executive meeting briefs.
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: '#FFFFFF',
                    border: `1px solid ${C.borderLight}`,
                    borderRadius: '12px 12px 12px 2px',
                    maxWidth: '80%',
                    alignSelf: 'flex-start',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                >
                  <Loader2 size={16} color={C.m700} className="animate-spin" />
                  <span style={{ fontSize: 11.5, color: C.t2, fontWeight: 500 }}>
                    Querying verified DigiSkwela domain services...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </main>

        {/* Input Footer */}
        <footer
          style={{
            padding: '12px 18px 14px',
            background: '#FFFFFF',
            borderTop: `1px solid ${C.borderMed}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              data-testid="assistant-input-textarea"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={2}
              maxLength={2000}
              placeholder="Ask about DigiSkwela operations, faculty attendance, leaves, events..."
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1.5px solid ${C.borderMed}`,
                fontSize: 12,
                color: C.t1,
                background: isLoading ? C.paper : '#FFFFFF',
                resize: 'none',
                outline: 'none',
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.4,
              }}
              onFocus={e => e.currentTarget.style.borderColor = C.m700}
              onBlur={e => e.currentTarget.style.borderColor = C.borderMed}
            />

            <button
              type="submit"
              data-testid="assistant-send-button"
              disabled={isLoading || !inputText.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: isLoading || !inputText.trim() ? C.ledger : C.m700,
                color: isLoading || !inputText.trim() ? C.t3 : '#FFFFFF',
                border: 'none',
                cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!isLoading && inputText.trim()) {
                  e.currentTarget.style.background = C.m800;
                }
              }}
              onMouseLeave={e => {
                if (!isLoading && inputText.trim()) {
                  e.currentTarget.style.background = C.m700;
                }
              }}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>

          {/* Privacy & Scope Disclaimer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 9.5,
              color: C.t3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={11} color={C.green} />
              <span>Session-scoped · Grounded in live PostgreSQL database</span>
            </div>
            <span>Enter to send · Shift+Enter for newline</span>
          </div>
        </footer>
      </aside>
    </>
  );
}
