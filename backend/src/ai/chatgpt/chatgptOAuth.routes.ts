import { Router, Request, Response, NextFunction } from 'express';
import { chatGPTOAuthService } from './chatgptOAuth.service.js';
import { chatGPTTokenStorage } from './chatgptTokenStorage.js';
import { authMiddleware, AuthenticatedUser } from '../../common/middleware/auth.js';
import { aiConfig } from '../../config/ai.config.js';

const router = Router();

/**
 * GET /api/ai/chatgpt-plan/auth-url
 * Returns the authorization URL for initiating Sign in with ChatGPT.
 * Protected by DigiSkwela authentication (Principal / Admin).
 */
router.get('/auth-url', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  try {
    const redirectUri = (req.query.redirectUri as string) || aiConfig.chatgptPlan?.callbackUrl || 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback';
    const authData = chatGPTOAuthService.generateAuthorizationUrl({
      redirectUri,
      agentNameHint: 'DigiSkwela',
    });

    res.json({
      success: true,
      data: {
        authorizationUrl: authData.url,
        state: authData.state,
        hostId: authData.hostId,
        clientId: authData.clientId,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ai/chatgpt-plan/callback
 * Loopback callback endpoint for OAuth code exchange.
 * Public redirect target: authenticated cryptographically via PKCE and state verification.
 */
router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const callbackClientId = (req.query.client_id as string) || undefined;
    const error = req.query.error as string;
    const errorDescription = req.query.error_description as string;

    if (error) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Sign in with ChatGPT Failed</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #dc2626;">ChatGPT Sign-In Error</h2>
          <p><strong>${error}</strong>: ${errorDescription || 'Authorization was rejected or cancelled.'}</p>
          <p><a href="http://localhost:5173">Return to DigiSkwela</a></p>
        </body>
        </html>
      `);
      return;
    }

    if (!code || !state) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Missing code or state parameter.' },
      });
      return;
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/ai/chatgpt-plan/callback`;
    const result = await chatGPTOAuthService.handleCallback({
      code,
      state,
      redirectUri,
      callbackClientId,
    });

    if (!result.success) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>ChatGPT Plan Authorization Failed</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2 style="color: #dc2626;">Authorization Exchange Failed</h2>
          <p>${result.error || 'Failed to exchange authorization code.'}</p>
          <p><a href="http://localhost:5173">Return to DigiSkwela</a></p>
        </body>
        </html>
      `);
      return;
    }

    // Success response: distinguish identity vs direct plan tokens
    const planMsg = result.planInferenceAuthorized
      ? 'ChatGPT Plan usage authorized (chatgpt.tokens.use.direct granted).'
      : 'Identity connected, but plan inference was declined/not granted.';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>ChatGPT Connected — DigiSkwela</title></head>
      <body style="font-family: sans-serif; padding: 40px; text-align: center; background-color: #f8fafc;">
        <h2 style="color: #16a34a;">ChatGPT Connected Successfully!</h2>
        <p style="color: #334155;">${planMsg}</p>
        <p style="color: #64748b; font-size: 14px;">You can now close this tab and return to the DigiSkwela application.</p>
        <p style="margin-top: 30px;"><a href="http://localhost:5173" style="color: #2563eb; text-decoration: none; font-weight: bold;">Return to DigiSkwela</a></p>
      </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/ai/chatgpt-plan/status
 * Returns current ChatGPT Plan provider connection & scope status.
 * Protected by DigiSkwela authentication. Zero credentials or tokens exposed!
 */
router.get('/status', authMiddleware, (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = chatGPTTokenStorage.getStatusSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/ai/chatgpt-plan/credentials
 * Disconnects ChatGPT Plan integration by clearing stored runtime credentials.
 * Protected by DigiSkwela authentication.
 */
router.delete('/credentials', authMiddleware, (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cleared = chatGPTTokenStorage.clearCredentials();
    res.json({
      success: true,
      message: cleared ? 'ChatGPT Plan credentials cleared.' : 'No active credentials found.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
