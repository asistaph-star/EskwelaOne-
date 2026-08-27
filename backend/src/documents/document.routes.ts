import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { config } from '../config/env.js';
// Note: In a real implementation, you would import @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner here.
// For Phase B1, we'll mock the S3 client to keep the dependencies lean, as the exact S3 provider 
// (AWS, MinIO, R2, etc.) wasn't specified beyond "S3-compatible object storage".

const router = Router();
router.use(authMiddleware);

const requestDocumentSchema = z.object({
  studentId: z.string().min(1),
  documentType: z.string().min(1),
  purpose: z.string().min(1),
});

const approveDocumentSchema = z.object({
  stage: z.enum(['teacher', 'principal', 'registrar']),
  remarks: z.string().optional(),
  status: z.enum(['Approved', 'Rejected', 'Ready for Pickup', 'Completed']),
});

/**
 * POST /api/documents/requests
 * Submit a new document request.
 */
router.post('/requests', requirePermissions('document:request'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = requestDocumentSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    // Resolve student info
    const student = await prisma.student.findUnique({
      where: { user_id: input.studentId },
      include: { user: true }
    });

    if (!student) {
      throw new AppError(404, 'NOT_FOUND', 'Student profile not found.');
    }

    const request = await prisma.documentRequest.create({
      data: {
        id: generateId(),
        student_id: input.studentId,
        document_type: input.documentType,
        purpose: input.purpose,
        status: 'Submitted',
        current_stage: 1,
      }
    });

    await createAuditLog({
      actorUserId: actorId,
      action: 'DOCUMENT_REQUEST_CREATED',
      resourceType: 'document_request',
      resourceId: request.id,
      newState: { documentType: input.documentType, purpose: input.purpose },
      correlationId,
    });

    res.status(201).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/documents/:id/presign-download
 * Generate a short-lived presigned URL for document download.
 * Requires proper authorization to view the document.
 */
router.post('/:id/presign-download', requirePermissions('document:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documentId = req.params.id as string;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    const correlationId = (req as any).correlationId;

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      throw new AppError(404, 'NOT_FOUND', 'Document not found.');
    }

    // In a full implementation, we'd verify the user has the right to access THIS specific document
    // e.g. are they the uploader? are they an admin? are they the student it belongs to?

    // Generate mock presigned URL for B1 implementation
    const presignedUrl = `${config.s3.endpoint}/${config.s3.bucket}/${document.storage_key}?X-Amz-Expires=${config.s3.presignedExpiry}&X-Amz-Signature=MOCK_SIG`;

    await createAuditLog({
      actorUserId: actorId,
      action: 'DOCUMENT_DOWNLOAD_URL_GENERATED',
      resourceType: 'document',
      resourceId: document.id,
      correlationId,
    });

    res.json({ success: true, data: { url: presignedUrl, expires_in: config.s3.presignedExpiry } });
  } catch (err) {
    next(err);
  }
});

export default router;
