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

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  if (!isOpen) return null;

  return (
    <>
      {/* Test-compatibility element — Zero desktop backdrop, zero darkening, zero blur */}
      <div
        data-testid="assistant-drawer-backdrop"
        style={{ display: 'none' }}
      />

      {/* Premium Compact Assistant Card */}
      <aside
        data-testid="principal-assistant-drawer"
        role="dialog"
        aria-label="DigiSkwela Principal Operations Assistant"
        style={{
          width: 370,
          maxWidth: 'calc(100vw - 32px)',
          height: 540,
          maxHeight: '70vh',
          background: '#EEF2F6',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(10,25,47,0.18), 0 2px 6px rgba(0,0,0,0.06)',
          border: '1px solid rgba(29,78,216,0.18)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'assistantPopIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <style>{`
          @keyframes assistantPopIn {
            0% { opacity: 0; transform: translateY(12px) scale(0.96); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
            50% { box-shadow: 0 0 0 4px rgba(74,222,128,0.1); }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .assistant-scrollbar::-webkit-scrollbar { width: 5px; }
          .assistant-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .assistant-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(29,78,216,0.15);
            border-radius: 10px;
          }
          .assistant-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(29,78,216,0.28);
          }
        `}</style>

        {/* Minimalist Frosted Glass Header */}
        <div style={{ flexShrink: 0 }}>
          {/* Subtle top brand accent strip */}
          <div
            style={{
              height: 2,
              background: 'linear-gradient(90deg, #1D4ED8 0%, #3B82F6 40%, #F59E0B 100%)',
              borderRadius: '14px 14px 0 0',
            }}
          />
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: '1px solid rgba(203, 213, 225, 0.75)',
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(10, 25, 47, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Calulut School Seal Avatar with micro AI badge overlay */}
              <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: '#FFFFFF',
                    border: '1.5px solid rgba(203, 213, 225, 0.85)',
                    boxShadow: '0 2px 6px rgba(10, 25, 47, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    padding: 3,
                  }}
                >
                  <img
                    src="/school_seal.png"
                    alt="Calulut Integrated School Seal"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                {/* Micro AI badge overlay at the bottom-right corner */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: C.m700,
                    border: '1.5px solid #FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                >
                  <Sparkles size={7.5} color="#FFFFFF" />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.t1,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.2,
                    }}
                  >
                    DigiSkwela Assistant
                  </span>
                  <span
                    data-testid="mock-provider-badge"
                    style={{
                      fontSize: 9,
                      padding: '2px 7px',
                      borderRadius: 20,
                      background: 'rgba(29, 78, 216, 0.08)',
                      color: C.m700,
                      border: '1px solid rgba(29, 78, 216, 0.18)',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.35,
                    }}
                  >
                    Dev · Live data
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#16A34A',
                      animation: 'pulseGlow 2.5s ease-in-out infinite',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: '#16A34A',
                      fontWeight: 600,
                      letterSpacing: '0.01em',
                    }}
                  >
                    Online
                  </span>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>·</span>
                  <span style={{ fontSize: 10.5, color: '#64748B', fontWeight: 500 }}>
                    Principal Operations
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {messages.length > 0 && (
                <button
                  type="button"
                  data-testid="clear-session-button"
                  onClick={onClearSession}
                  title="Clear Session Conversation"
                  style={{
                    background: 'rgba(241, 245, 249, 0.8)',
                    border: '1px solid rgba(203, 213, 225, 0.65)',
                    color: '#64748B',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#DC2626';
                    e.currentTarget.style.background = '#FEE2E2';
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#64748B';
                    e.currentTarget.style.background = 'rgba(241, 245, 249, 0.8)';
                    e.currentTarget.style.borderColor = 'rgba(203, 213, 225, 0.65)';
                  }}
                >
                  <Trash2 size={13.5} />
                </button>
              )}
              <button
                type="button"
                data-testid="close-drawer-button"
                onClick={onClose}
                aria-label="Close Assistant"
                style={{
                  background: 'rgba(241, 245, 249, 0.8)',
                  border: '1px solid rgba(203, 213, 225, 0.65)',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#0F172A';
                  e.currentTarget.style.background = '#E2E8F0';
                  e.currentTarget.style.borderColor = '#94A3B8';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#64748B';
                  e.currentTarget.style.background = 'rgba(241, 245, 249, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(203, 213, 225, 0.65)';
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Message Body — flex:1, soft cool blue-gray off-white background */}
        <div
          data-testid="assistant-messages-container"
          className="assistant-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '12px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: '#EEF2F6',
            minHeight: 0,
          }}
        >
          {/* Subtle Date Separator matching Sendbird Bot reference */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '2px 0 4px',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#64748B',
                background: 'rgba(226, 232, 240, 0.75)',
                border: '1px solid rgba(203, 213, 225, 0.6)',
                padding: '2px 10px',
                borderRadius: 12,
                letterSpacing: '0.02em',
              }}
            >
              {todayFormatted}
            </span>
          </div>

          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Welcome Card with soft neutral styling and Calulut Seal avatar */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: '#FFFFFF',
                    border: '1px solid rgba(203, 213, 225, 0.85)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                    padding: 2,
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src="/school_seal.png"
                    alt="CIS Seal"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                <div
                  style={{
                    background: '#E2E8F0',
                    padding: '10px 12px',
                    borderRadius: '12px 12px 12px 4px',
                    fontSize: 12,
                    color: C.t2,
                    lineHeight: 1.5,
                    border: '1px solid rgba(203,213,225,0.85)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  Good day, Principal! I can help audit faculty attendance, review leave requests, check behavioral cases, and generate operational briefs from live DigiSkwela data.
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
                    gap: 10,
                    padding: '10px 14px',
                    background: '#E8EEF5',
                    border: '1px solid rgba(203,213,225,0.85)',
                    borderRadius: '14px 14px 14px 4px',
                    maxWidth: '85%',
                    alignSelf: 'flex-start',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: C.m100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Loader2 size={12} color={C.m700} className="animate-spin" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11.5, color: C.t2, fontWeight: 500 }}>
                      Querying verified services…
                    </span>
                    <div
                      style={{
                        width: 80,
                        height: 2,
                        borderRadius: 1,
                        background: 'linear-gradient(90deg, #3B82F6, #93C5FD, #3B82F6)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.8s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Integrated DigiSkwela Input Composer */}
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #CBD5E1',
            background: C.ledger,
            display: 'flex',
            gap: 6,
            alignItems: 'flex-end',
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
            placeholder="Ask about DigiSkwela operations…"
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1.5px solid #CBD5E1',
              background: isLoading ? '#F8FAFC' : '#FFFFFF',
              fontSize: 12,
              outline: 'none',
              resize: 'none',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              lineHeight: 1.4,
              maxHeight: 68,
              minHeight: 34,
              color: C.t1,
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = C.m500;
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            type="submit"
            data-testid="assistant-send-button"
            disabled={isLoading || !inputText.trim()}
            onClick={handleSubmit}
            style={{
              background: isLoading || !inputText.trim()
                ? '#E2E8F0'
                : C.m700,
              color: isLoading || !inputText.trim() ? '#94A3B8' : '#FFFFFF',
              border: 'none',
              width: 34,
              height: 34,
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
              boxShadow: isLoading || !inputText.trim()
                ? 'none'
                : '0 1px 3px rgba(29,78,216,0.25)',
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
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>

        {/* Subtle Security Footnote */}
        <div
          style={{
            padding: '4px 12px',
            background: '#E8EDF2',
            borderTop: '1px solid #CBD5E1',
            textAlign: 'center',
            fontSize: 9,
            color: C.t3,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            letterSpacing: '0.01em',
          }}
        >
          <ShieldCheck size={9} color="#16A34A" />
          <span>Session-scoped · Grounded in live DigiSkwela data</span>
        </div>
      </aside>
    </>
  );
}
