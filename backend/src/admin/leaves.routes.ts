import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { requirePermissions, authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { generateId } from '../common/utils/uuid.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'leaves');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

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

// We make days a string in multipart form, so we parse it
const createLeaveSchema = z.object({
  type: z.string().min(1, "Leave type is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  days: z.string().transform(Number).refine(n => n >= 0, "Days must be non-negative"),
  reason: z.string().min(1, "Reason is required"),
}).refine(data => {
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  return start <= end;
}, {
  message: "End date cannot be before start date",
  path: ["end_date"]
});

/**
 * POST /api/admin/leaves
 */
router.post('/', authMiddleware, upload.single('attachment'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createLeaveSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    
    let attachmentUrl = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname) || '.pdf';
      const filename = `leave_${generateId()}${ext}`;
      const filePath = path.join(STORAGE_DIR, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      attachmentUrl = `/storage/leaves/${filename}`; // Or however you want to store it
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        id: generateId(),
        user_id: authUser.id,
        type: input.type,
        start_date: new Date(input.start_date),
        end_date: new Date(input.end_date),
        days: input.days,
        reason: input.reason,
        status: 'Pending',
        attachment_url: attachmentUrl
      }
    });

    // Notify Principals
    const principals = await prisma.user.findMany({
      where: {
        user_roles: {
          some: {
            role: { name: 'Principal' }
          }
        }
      }
    });

    if (principals.length > 0) {
      await prisma.notification.createMany({
        data: principals.map(p => ({
          id: generateId(),
          recipient_id: p.id,
          title: 'New Leave Request',
          body: `${authUser.firstName} ${authUser.lastName} submitted a ${input.days}-day ${input.type} request.`,
          icon_type: 'calendar',
        }))
      });
    }
    
    res.status(201).json({ success: true, data: leaveRequest });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/leaves/me
 */
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const leaves = await prisma.leaveRequest.findMany({
      where: { user_id: authUser.id },
      orderBy: { submitted_on: 'desc' },
      include: {
        approver: {
          select: { id: true, first_name: true, last_name: true }
        }
      }
    });
    
    // UI expects flat object with approverName
    const mapped = leaves.map(l => ({
      ...l,
      approverName: l.approver ? `${l.approver.first_name} ${l.approver.last_name}` : null
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
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

    // Notify the requester
    await prisma.notification.create({
      data: {
        id: generateId(),
        recipient_id: leaveRequest.user_id,
        title: `Leave Request ${status}`,
        body: `Your ${leaveRequest.type} request has been ${status.toLowerCase()} by the School Head.`,
        icon_type: status === 'Approved' ? 'check' : 'alert'
      }
    });

    res.json({ success: true, data: updatedLeave });
  } catch (err) {
    next(err);
  }
});

export default router;
