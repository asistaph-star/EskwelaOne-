import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { requirePermissions } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';

const router = Router();

// Authoritative Criteria (Must match business rules)
const TEACHER_EVALUATION_CRITERIA = [
  { name: "Education", maxScore: 20 },
  { name: "Experience", maxScore: 15 },
  { name: "Performance (IPCRF)", maxScore: 30 },
  { name: "PPST-related Competencies", maxScore: 10 },
  { name: "Training & Professional Development", maxScore: 10 },
  { name: "Awards & Recognition", maxScore: 5 },
  { name: "Other Assessment Criteria", maxScore: 10 }
];

const criteriaScoreSchema = z.object({
  criteriaName: z.string(),
  score: z.number().min(0),
  remarks: z.string().optional()
});

const createRankingSchema = z.object({
  teacher_id: z.string().min(1),
  academic_year_id: z.string().min(1),
  current_position: z.string().min(1),
  target_position: z.string().min(1),
  assessment_info: z.string().optional().nullable(),
});

const updateRankingSchema = z.object({
  status: z.enum(['Pending', 'Under Review', 'Completed']).optional(),
  remarks: z.string().optional().nullable(),
  assessment_info: z.string().optional().nullable(),
  criteria_scores: z.array(criteriaScoreSchema).optional(),
  document_ids: z.array(z.string()).optional()
});

/**
 * GET /api/admin/rankings
 */
router.get('/', requirePermissions('academic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { academic_year_id, status } = req.query;
    
    const where: any = {};
    if (academic_year_id) where.academic_year_id = String(academic_year_id);
    if (status) where.status = String(status);

    const rankings = await prisma.teacherRanking.findMany({
      where,
      include: {
        teacher: {
          include: {
            user: { select: { first_name: true, last_name: true } }
          }
        },
        academic_year: true,
        supporting_documents: {
          include: { document: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    
    // Map response for frontend format
    const formattedRankings = rankings.map(r => ({
      ...r,
      teacherName: `${r.teacher.user.first_name} ${r.teacher.user.last_name}`,
      evaluationPeriod: r.academic_year.name,
      supportingDocuments: r.supporting_documents.map(sd => sd.document.filename),
      criteriaScores: Array.isArray(r.criteria_scores) ? r.criteria_scores : []
    }));

    res.json({ success: true, data: formattedRankings });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/rankings
 */
router.post('/', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createRankingSchema.parse(req.body);
    
    // Validate relations
    const teacher = await prisma.teacher.findUnique({ where: { id: input.teacher_id } });
    if (!teacher) throw new AppError(404, 'NOT_FOUND', 'Teacher not found');
    
    const academicYear = await prisma.academicYear.findUnique({ where: { id: input.academic_year_id } });
    if (!academicYear) throw new AppError(404, 'NOT_FOUND', 'Academic Year not found');

    // Init empty criteria scores based on authoritative definition
    const initialCriteria = TEACHER_EVALUATION_CRITERIA.map(c => ({
      criteriaName: c.name,
      score: 0,
      maxScore: c.maxScore,
      remarks: ""
    }));

    const ranking = await prisma.teacherRanking.create({
      data: {
        id: generateId(),
        teacher_id: input.teacher_id,
        academic_year_id: input.academic_year_id,
        current_position: input.current_position,
        target_position: input.target_position,
        assessment_info: input.assessment_info,
        status: 'Pending',
        total_score: 0,
        criteria_scores: initialCriteria,
      }
    });

    res.status(201).json({ success: true, data: ranking });
  } catch (err) {
    // Unique constraint error check
    if (err && (err as any).code === 'P2002') {
      next(new AppError(409, 'CONFLICT', 'Ranking for this target position already exists for the teacher in this academic year.'));
      return;
    }
    next(err);
  }
});

/**
 * PATCH /api/admin/rankings/:id
 */
router.patch('/:id', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const input = updateRankingSchema.parse(req.body);

    const existing = await prisma.teacherRanking.findUnique({ where: { id }, include: { teacher: true } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Teacher ranking not found');

    let totalScore = existing.total_score;
    let validatedCriteria: any[] | undefined = undefined;

    // Validate and calculate criteria scores server-side
    if (input.criteria_scores) {
      validatedCriteria = [];
      totalScore = 0;
      
      for (const submitted of input.criteria_scores) {
        const authCriteria = TEACHER_EVALUATION_CRITERIA.find(c => c.name === submitted.criteriaName);
        if (!authCriteria) {
          throw new AppError(400, 'BAD_REQUEST', `Unknown criteria: ${submitted.criteriaName}`);
        }
        
        if (submitted.score > authCriteria.maxScore) {
          throw new AppError(400, 'BAD_REQUEST', `Score for ${submitted.criteriaName} exceeds maximum of ${authCriteria.maxScore}`);
        }
        
        validatedCriteria.push({
          criteriaName: authCriteria.name,
          score: submitted.score,
          maxScore: authCriteria.maxScore,
          remarks: submitted.remarks || ""
        });
        
        totalScore += submitted.score;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Handle documents authorization and mapping
      if (input.document_ids) {
        // Find existing junction links
        await tx.teacherRankingDocument.deleteMany({ where: { ranking_id: id } });
        
        for (const docId of input.document_ids) {
          const doc = await tx.document.findUnique({ where: { id: docId } });
          if (!doc) throw new AppError(404, 'NOT_FOUND', `Document ${docId} not found`);
          
          // Verify authorization: document must have been uploaded by the teacher
          if (existing.teacher && doc.uploaded_by !== existing.teacher.user_id) {
            throw new AppError(403, 'FORBIDDEN', `Document ${docId} does not belong to this teacher`);
          }
          
          await tx.teacherRankingDocument.create({
            data: { ranking_id: id, document_id: docId }
          });
        }
      }

      const updated = await tx.teacherRanking.update({
        where: { id },
        data: {
          status: input.status !== undefined ? input.status : undefined,
          remarks: input.remarks !== undefined ? input.remarks : undefined,
          assessment_info: input.assessment_info !== undefined ? input.assessment_info : undefined,
          criteria_scores: validatedCriteria ? validatedCriteria : undefined,
          total_score: totalScore
        }
      });
      return updated;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
