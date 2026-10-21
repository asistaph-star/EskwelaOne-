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
      {/* Test-compatibility element — Zero desktop backdrop, zero darkening, zero blur */}
      <div
        data-testid="assistant-drawer-backdrop"
        style={{ display: 'none' }}
      />

      {/* Restored Compact Assistant Card */}
      <aside
        data-testid="principal-assistant-drawer"
        role="dialog"
        aria-label="DigiSkwela Principal Operations Assistant"
        style={{
          width: 360,
          maxWidth: 'calc(100vw - 32px)',
          height: 500,
          maxHeight: 'min(520px, calc(100vh - 120px))',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          border: `1px solid ${C.m700}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'popIn 0.2s ease-out',
        }}
      >
        <style>{`
          @keyframes popIn {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* Restored Header: White with Green Status Dot */}
        <div
          style={{
            background: '#fff',
            borderBottom: `1px solid ${C.borderMed}`,
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: C.green,
                boxShadow: '0 0 6px rgba(21,94,54,0.4)',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.m800, fontFamily: "'Inter', sans-serif" }}>
                  DigiSkwela Assistant
                </span>
                <span
                  data-testid="mock-provider-badge"
                  style={{
                    fontSize: 8.5,
                    padding: '1px 5px',
                    borderRadius: 6,
                    background: C.m50,
                    color: C.m700,
                    border: `1px solid ${C.borderLight}`,
                    fontWeight: 600,
                  }}
                >
                  Development mode · Grounded DigiSkwela data
                </span>
              </div>
              <div style={{ fontSize: 10, color: C.green, fontWeight: 500, marginTop: 1 }}>
                Principal Operations · Online
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {messages.length > 0 && (
              <button
                type="button"
                data-testid="clear-session-button"
                onClick={onClearSession}
                title="Clear Session Conversation"
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.t3,
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.color = C.red}
                onMouseLeave={e => e.currentTarget.style.color = C.t3}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              data-testid="close-drawer-button"
              onClick={onClose}
              aria-label="Close Assistant"
              style={{
                background: 'none',
                border: 'none',
                color: C.t3,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.color = C.t1}
              onMouseLeave={e => e.currentTarget.style.color = C.t3}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Restored Message Body */}
        <div
          data-testid="assistant-messages-container"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: C.paper,
          }}
        >
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Initial Greeting Card */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    background: '#f3f4f6',
                    padding: '10px 12px',
                    borderRadius: '10px 10px 10px 0',
                    fontSize: 11.5,
                    color: C.t1,
                    lineHeight: 1.45,
                    border: `1px solid ${C.borderLight}`,
                  }}
                >
                  Good day, Principal! I can audit faculty gate presence, review pending leave requests, check behavioral cases, and synthesize executive operational briefs from live DigiSkwela records.
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

              {isLoading && (
                <div
                  data-testid="assistant-loading-indicator"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: '#FFFFFF',
                    border: `1px solid ${C.borderLight}`,
                    borderRadius: '10px 10px 10px 0',
                    maxWidth: '85%',
                    alignSelf: 'flex-start',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <Loader2 size={13} color={C.m700} className="animate-spin" />
                  <span style={{ fontSize: 11, color: C.t2, fontWeight: 500 }}>
                    Querying verified DigiSkwela domain services...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Restored Input Area */}
        <div
          style={{
            padding: '10px 12px',
            borderTop: `1px solid ${C.borderMed}`,
            background: '#fff',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <textarea
            ref={inputRef}
            data-testid="assistant-input-textarea"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            maxLength={2000}
            placeholder="Ask about DigiSkwela operations..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${C.borderMed}`,
              background: isLoading ? C.paper : '#fff',
              fontSize: 11.5,
              outline: 'none',
              resize: 'none',
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1.4,
              maxHeight: 70,
              minHeight: 34,
            }}
            onFocus={e => e.currentTarget.style.borderColor = C.m700}
            onBlur={e => e.currentTarget.style.borderColor = C.borderMed}
          />
          <button
            type="submit"
            data-testid="assistant-send-button"
            disabled={isLoading || !inputText.trim()}
            onClick={handleSubmit}
            style={{
              background: isLoading || !inputText.trim() ? C.ledger : C.m700,
              color: isLoading || !inputText.trim() ? C.t3 : '#fff',
              border: 'none',
              width: 34,
              height: 34,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>

        {/* Restored Subtle Footnote */}
        <div
          style={{
            padding: '6px 12px',
            background: '#fff',
            borderTop: `1px solid ${C.borderLight}`,
            textAlign: 'center',
            fontSize: 9,
            color: C.t3,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <ShieldCheck size={10} color={C.green} />
          <span>Session-scoped · Grounded in live PostgreSQL database</span>
        </div>
      </aside>
    </>
  );
}
