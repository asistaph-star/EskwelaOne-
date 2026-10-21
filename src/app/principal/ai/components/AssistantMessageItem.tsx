import React from 'react';
import { Sparkles, User, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { C } from '../../../shared/constants/tokens.js';
import { PrincipalAIMessage } from '../types.js';
import { PScreen } from '../../../shared/types';
import { StructuredDataRenderer } from './StructuredDataRenderer.js';
import { ProvenanceFooter } from './ProvenanceFooter.js';

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
          gap: 4,
          maxWidth: '85%',
          alignSelf: 'flex-end',
        }}
      >
        <div
          style={{
            background: C.m700,
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '12px 12px 2px 12px',
            fontSize: 12.5,
            lineHeight: 1.45,
            boxShadow: '0 2px 6px rgba(29,78,216,0.18)',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </div>
        {formattedTime && (
          <span style={{ fontSize: 9.5, color: C.t3, marginRight: 4 }}>{formattedTime}</span>
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
        gap: 10,
        maxWidth: '92%',
        alignSelf: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: isError ? C.redBg : C.m50,
          border: `1.5px solid ${isError ? C.red : C.m700}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {isError ? (
          <AlertCircle size={14} color={C.red} />
        ) : (
          <Sparkles size={14} color={C.m700} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        {/* Message bubble card */}
        <div
          style={{
            background: isError ? '#FFF5F5' : '#FFFFFF',
            border: `1px solid ${isError ? 'rgba(145,24,24,0.2)' : C.borderMed}`,
            borderRadius: '12px 12px 12px 2px',
            padding: '12px 14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            fontSize: 12,
            lineHeight: 1.5,
            color: C.t1,
          }}
        >
          {/* Error Notice */}
          {isError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ color: C.red, fontSize: 12, fontWeight: 600 }}>
                {message.errorState?.message || message.content}
              </div>
              {message.errorState?.canRetry && onRetry && (
                <button
                  type="button"
                  data-testid="retry-button"
                  onClick={onRetry}
                  style={{
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 4,
                    background: '#fff',
                    border: `1px solid ${C.red}`,
                    color: C.red,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
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
              {/* Natural language narrative */}
              {message.content && (
                <div 
                  data-testid="assistant-narrative-text"
                  style={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word', 
                    marginBottom: message.structuredData ? 12 : 0 
                  }}
                >
                  {message.content}
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {message.navigationActions.map((action, idx) => (
                    <button
                      key={idx}
                      type="button"
                      data-testid={`safe-nav-${action.screen}`}
                      onClick={() => onNavigate(action.screen)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff',
                        background: C.m700,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = C.m800}
                      onMouseLeave={e => e.currentTarget.style.background = C.m700}
                    >
                      <span>{action.label}</span>
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              )}

              {/* Provenance Footer */}
              <ProvenanceFooter provenance={message.provenance || message.structuredData?.provenance} />
            </>
          )}
        </div>

        {formattedTime && (
          <span style={{ fontSize: 9.5, color: C.t3, marginLeft: 4 }}>
            {formattedTime} · DigiSkwela Assistant
          </span>
        )}
      </div>
    </div>
  );
}
