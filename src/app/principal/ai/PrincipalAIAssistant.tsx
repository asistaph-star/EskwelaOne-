import React, { useState } from 'react';
import { AssistantMessageSquareIcon } from './components/AssistantMessageSquareIcon.js';
import { C } from '../../shared/constants/tokens.js';
import { PScreen } from '../../shared/types';
import { PrincipalAIMessage } from './types.js';
import { aiApi, AIMessagePayload } from '../../../api/ai.api.js';
import { ApiError } from '../../../api/client.js';
import { normalizeAssistantResponse } from './utils/parseAssistantResponse.js';
import { PrincipalAssistantDrawer } from './PrincipalAssistantDrawer.js';

interface PrincipalAIAssistantProps {
  onNavigate?: (screen: PScreen) => void;
  currentScreen?: PScreen;
}

export function PrincipalAIAssistant({ onNavigate, currentScreen }: PrincipalAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<PrincipalAIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const prevScreenRef = React.useRef<PScreen | undefined>(currentScreen);
  const activeTurnRef = React.useRef<string | null>(null);

  // 1. Auto-close Assistant on route navigation without deleting conversation or context
  React.useEffect(() => {
    if (prevScreenRef.current !== undefined && prevScreenRef.current !== currentScreen) {
      setIsOpen(false);
    }
    prevScreenRef.current = currentScreen;
  }, [currentScreen]);

  // Secondary router listener: auto-close on hash change (DigiSkwela module navigation)
  React.useEffect(() => {
    const handleHash = () => {
      setIsOpen(false);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // 2. Restore active ephemeral conversation session on mount / page refresh
  React.useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      try {
        const res = await aiApi.getSession({ portal: 'Principal' });
        if (isMounted && res?.session?.messages && res.session.messages.length > 0) {
          const restored: PrincipalAIMessage[] = res.session.messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            responseType: m.responseType,
            structuredData: m.structuredData,
            provenance: m.provenance,
            navigationActions: m.navigationActions,
            traceId: m.traceId,
          }));
          setMessages(restored);
        }
      } catch (err) {
        // Fallback safely to fresh home state without corrupting authenticated session
        console.warn('AI conversation session restore fallback:', err);
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const currentTurnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    activeTurnRef.current = currentTurnId;

    const userMsgId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const userMessage: PrincipalAIMessage = {
      id: userMsgId,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const newConversation = [...messages, userMessage];
    setMessages(newConversation);
    setIsLoading(true);

    try {
      // Build conversation payload for backend POST /api/ai/chat
      // Send minimum conversation window needed (last 6 turns)
      const recentConversation = newConversation.slice(-6);
      const payloadMessages: AIMessagePayload[] = recentConversation.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const res = await aiApi.chat({
        messages: payloadMessages,
        portal: 'Principal',
        turnId: currentTurnId,
      });

      // Reject stale out-of-order network responses
      if (activeTurnRef.current !== currentTurnId) {
        return;
      }

      const parsed = normalizeAssistantResponse(res);

      const assistantMsgId = `asst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const assistantMessage: PrincipalAIMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: parsed.displayText,
        timestamp: new Date().toISOString(),
        traceId: res.traceId,
        responseType: parsed.responseType,
        toolsExecuted: res.toolsExecuted,
        structuredData: parsed.structuredData,
        provenance: parsed.provenance,
        navigationActions: parsed.navigationActions,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      if (activeTurnRef.current !== currentTurnId) {
        return;
      }

      let errorMessage = 'DigiSkwela AI encountered an error processing your request. Please try again.';
      let errorCode = 'UNKNOWN_ERROR';
      let canRetry = true;

      if (err instanceof ApiError) {
        errorCode = err.code;
        if (err.status === 401) {
          errorMessage = 'Your session has expired. Please sign in again.';
          canRetry = false;
        } else if (err.status === 403) {
          errorMessage = 'You are not authorized to perform this AI operation.';
          canRetry = false;
        } else if (err.status === 429 || err.code === 'RATE_LIMITED' || err.code === 'FREE_QUOTA_EXHAUSTED') {
          errorMessage = 'DigiSkwela AI is temporarily unavailable because the free AI service limit has been reached. Please try again later.';
        } else if (err.status === 503 || err.code === 'PROVIDER_UNAVAILABLE' || err.code === 'PROVIDER_TIMEOUT') {
          errorMessage = 'DigiSkwela AI is temporarily unavailable. Please try again later.';
        } else {
          errorMessage = err.message || errorMessage;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      const errorMsgId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const errorMsg: PrincipalAIMessage = {
        id: errorMsgId,
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date().toISOString(),
        errorState: {
          code: errorCode,
          message: errorMessage,
          canRetry,
        },
      };

      setMessages(prev => [...prev, errorMsg]);
    } finally {
      if (activeTurnRef.current === currentTurnId) {
        setIsLoading(false);
      }
    }
  };

  const handleRetryLastMessage = () => {
    // Find last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    // Remove any trailing error message
    setMessages(prev => prev.filter(m => !m.errorState));
    handleSendMessage(lastUserMsg.content);
  };

  const handleClearSession = async () => {
    setMessages([]);
    try {
      await aiApi.clearSession({ portal: 'Principal' });
    } catch (err) {
      console.warn('Failed to clear server AI session:', err);
    }
  };

  return (
    <>
      {/* Fixed Trigger Affordance & Restored Popup Container */}
      <div
        data-testid="principal-ai-trigger-container"
        style={{
          position: 'fixed',
          bottom: isOpen ? 0 : 24,
          right: 24,
          zIndex: 390,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
        }}
      >
        {/* Floating Assistant Card */}
        <PrincipalAssistantDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          onClearSession={handleClearSession}
          onNavigate={screen => {
            if (onNavigate) {
              onNavigate(screen);
            }
          }}
          onRetryLastMessage={handleRetryLastMessage}
        />

        {/* Circular Fixed Launcher Button — circle-inside-circle, Message SVG, hidden when drawer is open */}
        {!isOpen && (
          <button
            type="button"
            data-testid="principal-ai-assistant-trigger"
            aria-label="Open DigiSkwela Assistant"
            onClick={() => setIsOpen(true)}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
              border: 'none',
              boxShadow: '0 6px 20px rgba(29, 78, 216, 0.38), 0 2px 6px rgba(0, 0, 0, 0.08)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.06)';
              e.currentTarget.style.boxShadow = '0 8px 26px rgba(29, 78, 216, 0.48), 0 3px 8px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(29, 78, 216, 0.38), 0 2px 6px rgba(0, 0, 0, 0.08)';
            }}
            onFocus={e => {
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(147, 197, 253, 0.5), 0 6px 20px rgba(29, 78, 216, 0.38)';
            }}
            onBlur={e => {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(29, 78, 216, 0.38), 0 2px 6px rgba(0, 0, 0, 0.08)';
            }}
          >
            {/* Circle-inside-circle style with DigiSkwela primary blue & centered Message SVG */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.18)',
              }}
            >
              <AssistantMessageSquareIcon size={20} color="#FFFFFF" />
            </div>
          </button>
        )}
      </div>
    </>
  );
}
