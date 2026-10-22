import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AIService } from './ai.service.js';
import { aiConversationSessionService, EphemeralSessionMessage } from './session/aiConversationSession.service.js';

import chatgptOAuthRoutes from './chatgpt/chatgptOAuth.routes.js';

const router = Router();

// Mount public/authenticated ChatGPT OAuth subrouter
router.use('/chatgpt-plan', chatgptOAuthRoutes);

// Apply authMiddleware to remaining AI assistant routes
router.use(authMiddleware);

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string(),
    toolCallId: z.string().optional(),
    name: z.string().optional(),
  })),
  portal: z.string().optional().default('General'),
  conversationId: z.string().optional(),
  turnId: z.string().optional(),
  sessionId: z.string().optional(),
});

/**
 * GET /api/ai/session
 * Restore the active ephemeral AI conversation session for the authenticated user and portal.
 */
router.get('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const portal = (req.query.portal as string) || 'General';
    const conversationId = (req.query.conversationId as string) || undefined;

    const session = aiConversationSessionService.getSession(authUser.id, portal, conversationId);
    res.json({
      success: true,
      data: {
        session: session
          ? {
              id: session.id,
              portal: session.portal,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt,
              expiresAt: session.expiresAt,
              messages: session.messages,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/ai/session
 * Clear/delete the active ephemeral AI conversation session for the authenticated user and portal.
 */
router.delete('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const portal = (req.query.portal as string) || (req.body && req.body.portal) || 'General';

    const cleared = aiConversationSessionService.clearSession(authUser.id, portal);
    res.json({
      success: true,
      message: cleared ? 'AI conversation session cleared.' : 'No active AI conversation session found.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/chat
 * Primary entrypoint for the DigiSkwela Conversational Assistant.
 */
router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = chatRequestSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const result = await AIService.processChat(input, authUser, correlationId);

    // Persist conversation turn in server-side ephemeral session for working-session continuity
    const lastUserMsg = [...input.messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      const userSessionMsg: EphemeralSessionMessage = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: lastUserMsg.content,
        timestamp: new Date().toISOString(),
      };
      const assistantSessionMsg: EphemeralSessionMessage = {
        id: `asst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: result.message.content,
        timestamp: new Date().toISOString(),
        responseType: result.responseType,
        structuredData: result.structuredData,
        provenance: result.provenance,
        navigationActions: result.navigationActions,
        traceId: result.traceId,
      };

      const session = aiConversationSessionService.appendTurn(
        authUser.id,
        authUser.roles[0] || 'User',
        input.portal,
        userSessionMsg,
        assistantSessionMsg
      );
      result.sessionId = session.id;
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
