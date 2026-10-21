import React, { useState, useRef } from 'react';
import { Sparkles, GripHorizontal } from 'lucide-react';
import { C } from '../../shared/constants/tokens.js';
import { PScreen } from '../../shared/types';
import { PrincipalAIMessage } from './types.js';
import { aiApi, AIMessagePayload } from '../../../api/ai.api.js';
import { ApiError } from '../../../api/client.js';
import { normalizeAssistantResponse } from './utils/parseAssistantResponse.js';
import { PrincipalAssistantDrawer } from './PrincipalAssistantDrawer.js';

interface PrincipalAIAssistantProps {
  onNavigate?: (screen: PScreen) => void;
}

export function PrincipalAIAssistant({ onNavigate }: PrincipalAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<PrincipalAIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, startPos: { x: 24, y: 24 } });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, startPos: { ...position } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPosition({
      x: Math.max(10, Math.min(window.innerWidth - 180, dragStart.current.startPos.x - dx)),
      y: Math.max(10, Math.min(window.innerHeight - 80, dragStart.current.startPos.y - dy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

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
      });

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
      setIsLoading(false);
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

  const handleClearSession = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Floating Trigger Affordance & Restored Popup Container */}
      <div
        data-testid="principal-ai-trigger-container"
        style={{
          position: 'fixed',
          bottom: position.y,
          right: position.x,
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

        {/* Draggable Launcher Button — hidden when chat card is open */}
        {!isOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              title="Drag to reposition AI Assistant button"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                cursor: 'grab',
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.06)',
                borderRadius: '12px 12px 0 0',
                marginBottom: -4,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <GripHorizontal size={14} color={C.t3} />
            </div>

            <button
              type="button"
              data-testid="principal-ai-assistant-trigger"
              aria-label="Open DigiSkwela Principal Operations Assistant"
              onClick={() => setIsOpen(true)}
              style={{
                padding: '0 20px',
                height: 48,
                borderRadius: 24,
                background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
                border: 'none',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 6px 20px rgba(29,78,216,0.35), 0 2px 6px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.04)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(29,78,216,0.45), 0 2px 8px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(29,78,216,0.35), 0 2px 6px rgba(0,0,0,0.08)';
              }}
            >
              <Sparkles size={18} color="#FFFFFF" />
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>
                AI Assistant
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
