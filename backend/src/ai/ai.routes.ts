import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AIService } from './ai.service.js';

const router = Router();
router.use(authMiddleware);

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string(),
    toolCallId: z.string().optional(),
    name: z.string().optional(),
  })),
  portal: z.string().optional().default('General'),
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
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
