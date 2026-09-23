import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';

const router = Router();

// Zod schemas for query params
const listLeavesQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  status: z.enum(['Pending', 'Approved', 'Rejected']).optional(),
  academic_year_id: z.string().uuid().optional()
});

const updateLeaveStatusSchema = z.object({
  status: z.enum(['Approved', 'Rejected']),
  approver_note: z.string().optional()
});

/**
 * GET /api/admin/leaves
 */
router.get('/', requirePermissions('leave:approve'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, academic_year_id } = listLeavesQuerySchema.parse(req.query);
    
    const where: any = {};
    if (status) {
      where.status = status;
    }

    if (academic_year_id) {
      const academicYear = await prisma.academicYear.findUnique({
        where: { id: academic_year_id }
      });
      if (academicYear) {
        where.start_date = { gte: academicYear.start_date };
        where.end_date = { lte: academicYear.end_date };
      }
    }

    const skip = (page - 1) * limit;

    const [leaves, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submitted_on: 'desc' },
        include: {
          user: {
            select: { id: true, first_name: true, last_name: true, email: true }
          },
          approver: {
            select: { id: true, first_name: true, last_name: true }
          }
        }
      }),
      prisma.leaveRequest.count({ where })
    ]);

    res.json({
      success: true,
      data: leaves,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/leaves/:id/status
 */
router.patch('/:id/status', requirePermissions('leave:approve'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const { status, approver_note } = updateLeaveStatusSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leaveRequest) {
      throw new AppError(404, 'NOT_FOUND', 'Leave request not found');
    }

    if (leaveRequest.status !== 'Pending') {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot update status of a non-pending leave request');
    }

    const updatedLeave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approver_note: approver_note || null,
        approver_id: authUser.id,
      },
      include: {
        user: { select: { id: true, first_name: true, last_name: true } },
        approver: { select: { id: true, first_name: true, last_name: true } }
      }
    });

    res.json({ success: true, data: updatedLeave });
  } catch (err) {
    next(err);
  }
});

export default router;
