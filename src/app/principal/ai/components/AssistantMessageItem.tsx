import React, { useState, useEffect } from 'react';
import { Sparkles, User, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { C } from '../../../shared/constants/tokens.js';
import { PrincipalAIMessage } from '../types.js';
import { PScreen } from '../../../shared/types';
import { StructuredDataRenderer } from './StructuredDataRenderer.js';
import { ProvenanceFooter } from './ProvenanceFooter.js';
import { SafeMarkdownRenderer } from './SafeMarkdownRenderer.js';

interface AssistantMessageItemProps {
  message: PrincipalAIMessage;
  onNavigate?: (screen: PScreen) => void;
  onRetry?: () => void;
}

// Compute dynamic relative time according to Sendbird chatbot reference
function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return '';
  try {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hr ago';
    if (diffHours < 24) return `${diffHours} hrs ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  } catch {
    return '';
  }
}

export function AssistantMessageItem({ message, onNavigate, onRetry }: AssistantMessageItemProps) {
  const isUser = message.role === 'user';
  const isError = Boolean(message.errorState);

  // Dynamic relative time for Assistant messages, updating automatically without refresh
  const [relativeTime, setRelativeTime] = useState<string>(() => formatRelativeTime(message.timestamp));

  useEffect(() => {
    if (!message.timestamp) return;
    setRelativeTime(formatRelativeTime(message.timestamp));

    const interval = setInterval(() => {
      setRelativeTime(formatRelativeTime(message.timestamp));
    }, 10000); // Check every 10 seconds to smoothly transition from 'Just now' to '1 min ago'

    return () => clearInterval(interval);
  }, [message.timestamp]);

  const assistantMeta = relativeTime
    ? `DigiSkwela AI Agent • ${relativeTime}`
    : 'DigiSkwela AI Agent';

  // Format timestamp for user messages
  let formattedTime = '';
  if (message.timestamp) {
    try {
      const d = new Date(message.timestamp);
      formattedTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      formattedTime = '';
    }
  }

  if (isUser) {
    return (
      <div 
        data-testid="chat-message-user"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 3,
          maxWidth: '80%',
          alignSelf: 'flex-end',
        }}
      >
        <div
          style={{
            background: C.m700,
            color: '#FFFFFF',
            padding: '10px 14px',
            borderRadius: '14px 14px 4px 14px',
            fontSize: 12.5,
            lineHeight: 1.55,
            boxShadow: '0 1px 3px rgba(29, 78, 216, 0.18)',
            wordBreak: 'break-word',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {message.content}
        </div>
        {formattedTime && (
          <span
            style={{
              fontSize: 9.5,
              color: '#94A3B8',
              marginRight: 4,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {formattedTime}
          </span>
        )}
      </div>
    );
  }

  // Assistant or Error message
  return (
    <div
      data-testid="chat-message-assistant"
      style={{
        display: 'flex',
        gap: 8,
        maxWidth: '85%',
        alignSelf: 'flex-start',
      }}
    >
      {/* DigiSkwela AI Assistant Avatar */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
          background: isError ? '#FEE2E2' : '#EFF6FF',
          border: isError
            ? '1px solid rgba(239, 68, 68, 0.25)'
            : '1px solid rgba(29, 78, 216, 0.18)',
        }}
      >
        {isError ? (
          <AlertCircle size={12} color="#DC2626" />
        ) : (
          <Sparkles size={13} color={C.m700} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
        {/* Message bubble card - Distinct soft light gray surface on white canvas */}
        <div
          style={{
            borderRadius: '14px 14px 14px 4px',
            padding: '11px 14px',
            fontSize: 13,
            lineHeight: 1.55,
            border: isError
              ? '1px solid rgba(239, 68, 68, 0.25)'
              : '1px solid #E2E8F0',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            background: isError ? '#FEF2F2' : '#F1F5F9',
            color: isError ? '#991B1B' : '#1E293B',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {/* Error Notice */}
          {isError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#B91C1C' }}>
                {message.errorState?.message || message.content}
              </div>
              {message.errorState?.canRetry && onRetry && (
                <button
                  type="button"
                  data-testid="retry-button"
                  onClick={onRetry}
                  style={{
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 8,
                    background: '#FFFFFF',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#B91C1C',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#FEF2F2';
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#FFFFFF';
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
                  }}
                >
                  <RefreshCw size={11} />
                  <span>Retry Request</span>
                </button>
              )}
            </div>
          )}

          {/* Normal Assistant content */}
          {!isError && (
            <>
              {/* Natural language narrative with safe markdown rendering */}
              {message.content && (
                <div 
                  data-testid="assistant-narrative-text"
                  style={{
                    wordBreak: 'break-word',
                    color: C.t1,
                    marginBottom: message.structuredData ? 10 : 0,
                  }}
                >
                  <SafeMarkdownRenderer content={message.content} />
                </div>
              )}

              {/* Structured Tool Data (if present) */}
              {message.structuredData && (
                <StructuredDataRenderer 
                  data={message.structuredData} 
                  onNavigate={onNavigate} 
                />
              )}

              {/* Single Authoritative Primary Navigation Action (No CTA stacking) */}
              {message.navigationActions && message.navigationActions.length > 0 && onNavigate && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {message.navigationActions.slice(0, 1).map((action, idx) => (
                    <button
                      key={idx}
                      type="button"
                      data-testid={`safe-nav-${action.screen}`}
                      onClick={() => onNavigate(action.screen)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 12px',
                        borderRadius: 7,
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: '#FFFFFF',
                        background: C.m700,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 3px rgba(29,78,216,0.25)',
                        fontFamily: "'Inter', sans-serif",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = C.m800;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = C.m700;
                      }}
                    >
                      <span>{action.label}</span>
                      <ArrowRight size={11} />
                    </button>
                  ))}
                </div>
              )}

              {/* Provenance Footer */}
              <ProvenanceFooter provenance={message.provenance || message.structuredData?.provenance} />
            </>
          )}
        </div>

        <span
          data-testid="assistant-message-meta"
          style={{
            fontSize: 9.5,
            color: '#94A3B8',
            marginLeft: 4,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            letterSpacing: '0.01em',
          }}
        >
          {assistantMeta}
        </span>
      </div>
    </div>
  );
}
