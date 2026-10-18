import { Router } from 'express';
import { authMiddleware } from '../common/middleware/auth.js';
import executiveSummaryRoutes from '../admin/executive-summary/executiveSummary.routes.js';

const router = Router();
router.use(authMiddleware);

// GET /api/principal/ai-summary
router.use('/ai-summary', executiveSummaryRoutes);

export default router;
