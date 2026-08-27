import { Router, Request, Response, NextFunction } from 'express';
import { 
  upsertGrade, 
  getGradesForSectionAndSubject,
  upsertGradeSchema
} from './gradebook.service.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { getLedger, saveLedger, ledgerSchema } from './ledger.service.js';

const router = Router();

router.use(authMiddleware);

router.get('/ledger', requirePermissions('grade:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.query;
    if (!classId) return res.status(400).json({ success: false, message: 'Missing classId' });
    const data = await getLedger(classId as string);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger', requirePermissions('grade:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId, terms } = req.body;
    if (!classId || !terms) return res.status(400).json({ success: false, message: 'Missing classId or terms' });
    const actorId = ((req as any).user).id;
    await saveLedger(classId, terms, actorId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/gradebooks/grades
 * Retrieve all grades and enrollments for a specific section, subject, term, and school year.
 */
router.get('/grades', requirePermissions('grade:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { sectionId, subjectId, term, schoolYear } = req.query;

    if (!sectionId || !subjectId || !term || !schoolYear) {
      return res.status(400).json({ success: false, message: 'Missing required query parameters.' });
    }
    
    const gradesData = await getGradesForSectionAndSubject(
      sectionId as string, 
      subjectId as string, 
      term as 'T1'|'T2'|'T3'|'T4', 
      schoolYear as string, 
      authUser.id
    );
    res.json({ success: true, data: gradesData });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/gradebooks/entries
 * Create or update a grade entry.
 */
router.post('/entries', requirePermissions('grade:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = upsertGradeSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const entry = await upsertGrade(input, actorId, correlationId);
    res.status(200).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

export default router;
