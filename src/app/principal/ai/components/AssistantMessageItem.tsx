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
        className="flex flex-col items-end gap-1 max-w-[85%] self-end"
      >
        <div className="bg-[#1D4ED8] text-white px-3.5 py-2 rounded-2xl rounded-tr-xs text-[13px] leading-relaxed shadow-xs break-words font-sans">
          {message.content}
        </div>
        {formattedTime && (
          <span className="text-[9.5px] text-slate-400 mr-1 font-sans">{formattedTime}</span>
        )}
      </div>
    );
  }

  // Assistant or Error message
  return (
    <div
      data-testid="chat-message-assistant"
      className="flex gap-2 max-w-[94%] self-start"
    >
      {/* Avatar */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
          isError ? 'bg-red-50 border-red-500' : 'bg-blue-50 border-blue-600'
        }`}
      >
        {isError ? (
          <AlertCircle size={12} className="text-red-600" />
        ) : (
          <Sparkles size={12} className="text-blue-700" />
        )}
      </div>

      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {/* Message bubble card */}
        <div
          className={`rounded-2xl rounded-tl-xs px-3.5 py-2.5 text-[13px] leading-relaxed border shadow-xs ${
            isError
              ? 'bg-red-50/70 border-red-200 text-red-900'
              : 'bg-white border-slate-200/90 text-slate-800'
          }`}
        >
          {/* Error Notice */}
          {isError && (
            <div className="flex flex-col gap-2">
              <div className="text-red-700 text-[12.5px] font-semibold">
                {message.errorState?.message || message.content}
              </div>
              {message.errorState?.canRetry && onRetry && (
                <button
                  type="button"
                  data-testid="retry-button"
                  onClick={onRetry}
                  className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-red-300 text-red-700 text-[11px] font-semibold hover:bg-red-50 cursor-pointer transition-colors"
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
                  className={`whitespace-pre-wrap break-words font-sans text-slate-800 ${
                    message.structuredData ? 'mb-2.5' : ''
                  }`}
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
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {message.navigationActions.map((action, idx) => (
                    <button
                      key={idx}
                      type="button"
                      data-testid={`safe-nav-${action.screen}`}
                      onClick={() => onNavigate(action.screen)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-blue-700 hover:bg-blue-800 cursor-pointer transition-colors"
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

        {formattedTime && (
          <span className="text-[9.5px] text-slate-400 ml-1 font-sans">
            {formattedTime} · DigiSkwela Assistant
          </span>
        )}
      </div>
    </div>
  );
}
