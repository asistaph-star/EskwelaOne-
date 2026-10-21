import React from 'react';
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

export function AssistantMessageItem({ message, onNavigate, onRetry }: AssistantMessageItemProps) {
  const isUser = message.role === 'user';
  const isError = Boolean(message.errorState);

  // Format message timestamp
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
          maxWidth: '82%',
          alignSelf: 'flex-end',
        }}
      >
        <div
          style={{
            background: C.m700,
            color: '#FFFFFF',
            padding: '10px 14px',
            borderRadius: '16px 16px 4px 16px',
            fontSize: 12.5,
            lineHeight: 1.55,
            boxShadow: '0 1px 3px rgba(29,78,216,0.18)',
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
              color: C.t3,
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
        maxWidth: '92%',
        alignSelf: 'flex-start',
      }}
    >
      {/* Calulut School Seal Avatar */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
          background: isError ? '#FEE2E2' : '#FFFFFF',
          border: isError
            ? '1px solid rgba(239,68,68,0.25)'
            : '1px solid rgba(203,213,225,0.85)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          padding: isError ? 0 : 2,
        }}
      >
        {isError ? (
          <AlertCircle size={12} color="#DC2626" />
        ) : (
          <img
            src="/school_seal.png"
            alt="CIS Seal"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={e => (e.currentTarget.style.display = 'none')}
          />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
        {/* Message bubble card - Soft neutral / blue-gray surface, NOT bright white */}
        <div
          style={{
            borderRadius: '14px 14px 14px 4px',
            padding: '10px 14px',
            fontSize: 12.5,
            lineHeight: 1.55,
            border: isError
              ? '1px solid rgba(239,68,68,0.25)'
              : '1px solid rgba(203,213,225,0.85)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            background: isError ? '#FEF2F2' : '#E8EEF5',
            color: isError ? '#991B1B' : C.t1,
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

              {/* Navigation Actions (if present) */}
              {message.navigationActions && message.navigationActions.length > 0 && onNavigate && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                  {message.navigationActions.map((action, idx) => {
                    const isSecondary = Boolean(message.structuredData) || idx > 0;
                    return (
                      <button
                        key={idx}
                        type="button"
                        data-testid={`safe-nav-${action.screen}`}
                        onClick={() => onNavigate(action.screen)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          color: isSecondary ? C.m700 : '#FFFFFF',
                          background: isSecondary ? C.m50 : C.m700,
                          border: isSecondary ? '1px solid rgba(29,78,216,0.22)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSecondary ? 'none' : '0 1px 3px rgba(29,78,216,0.25)',
                          fontFamily: "'Inter', sans-serif",
                        }}
                        onMouseEnter={e => {
                          if (isSecondary) {
                            e.currentTarget.style.background = C.m100;
                            e.currentTarget.style.borderColor = C.m500;
                          } else {
                            e.currentTarget.style.background = C.m800;
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(10,25,47,0.3)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (isSecondary) {
                            e.currentTarget.style.background = C.m50;
                            e.currentTarget.style.borderColor = 'rgba(29,78,216,0.22)';
                          } else {
                            e.currentTarget.style.background = C.m700;
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(29,78,216,0.25)';
                          }
                        }}
                      >
                        <span>{action.label}</span>
                        <ArrowRight size={11} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Provenance Footer */}
              <ProvenanceFooter provenance={message.provenance || message.structuredData?.provenance} />
            </>
          )}
        </div>

        {formattedTime && (
          <span
            style={{
              fontSize: 9.5,
              color: C.t3,
              marginLeft: 4,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {formattedTime} · DigiSkwela Assistant
          </span>
        )}
      </div>
    </div>
  );
}
