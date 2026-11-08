import path from 'path';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { AppError } from '../common/middleware/errorHandler.js';
import { AuthenticatedUser } from '../common/middleware/auth.js';

export interface PublicDocumentMetadata {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: Date | string;
}

export interface DocumentDownloadTokenPayload {
  purpose: 'document_download';
  documentId: string;
  actorUserId: string;
}

/**
 * Strictly resolves a single storage key / filename inside a designated storage directory.
 * Rejects empty keys, null bytes, path separators, traversal segments ('..'), dotfiles,
 * or any path that resolves outside `baseDir`.
 * Never leaks filesystem paths in error messages.
 */
export function resolveSafeStorageFilePath(baseDir: string, storageKeyOrFilename: string): string {
  if (typeof storageKeyOrFilename !== 'string') {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid document storage key.');
  }

  const trimmed = storageKeyOrFilename.trim();
  if (
    !trimmed ||
    trimmed.includes('\0') ||
    trimmed.includes('..') ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes(':') ||
    trimmed.startsWith('.')
  ) {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid document storage key.');
  }

  if (path.basename(trimmed) !== trimmed) {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid document storage key.');
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, trimmed);
  const relative = path.relative(resolvedBase, resolvedTarget);

  if (
    !relative ||
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    path.dirname(relative) !== '.'
  ) {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid document storage key.');
  }

  return resolvedTarget;
}

/**
 * Sanitizes a filename for safe use in Content-Disposition headers.
 */
export function sanitizeContentDispositionFilename(filename: string): string {
  if (typeof filename !== 'string') {
    return 'document';
  }
  const cleaned = filename
    .replace(/[\r\n\0"\\/]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .trim();
  return cleaned.length > 0 ? cleaned : 'document';
}

/**
 * Applies strict private cache and content security headers to document responses.
 */
export function setPrivateDocumentResponseHeaders(
  res: Response,
  mimeType: string,
  filename: string,
  disposition: 'inline' | 'attachment' = 'inline'
): void {
  const safeFilename = sanitizeContentDispositionFilename(filename);
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename}"`);
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

/**
 * Strips internal storage_key and filesystem details from a Document record before returning to clients.
 */
export function toPublicDocumentMetadata(doc: any): PublicDocumentMetadata | null {
  if (!doc || typeof doc !== 'object') {
    return null;
  }
  return {
    id: String(doc.id),
    filename: String(doc.filename),
    mime_type: String(doc.mime_type),
    size_bytes: Number(doc.size_bytes),
    uploaded_by: String(doc.uploaded_by),
    created_at: doc.created_at,
  };
}

/**
 * Generates a short-lived, purpose-bound JWT for downloading a specific private document.
 */
export function signDocumentDownloadToken(
  payload: { documentId: string; actorUserId: string },
  secret: string,
  expiresInSeconds = 300
): string {
  const tokenPayload: DocumentDownloadTokenPayload = {
    purpose: 'document_download',
    documentId: payload.documentId,
    actorUserId: payload.actorUserId,
  };
  return jwt.sign(tokenPayload, secret, { expiresIn: expiresInSeconds });
}

/**
 * Verifies a short-lived document download token and prevents session-token confusion.
 */
export function verifyDocumentDownloadToken(
  token: string,
  secret: string
): { documentId: string; actorUserId?: string } {
  if (!token || typeof token !== 'string') {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing download token.');
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired download token.');
  }

  if (
    !decoded ||
    typeof decoded !== 'object' ||
    decoded.purpose !== 'document_download' ||
    typeof decoded.documentId !== 'string' ||
    decoded.documentId.trim().length === 0
  ) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired download token.');
  }

  return {
    documentId: decoded.documentId.trim(),
    actorUserId: typeof decoded.actorUserId === 'string' ? decoded.actorUserId : undefined,
  };
}

/**
 * Enforces strict per-document, relationship-aware authorization across all DigiSkwela modules:
 * - Clinic-uploaded documents (Nurse / clinic:read / linked student owner only)
 * - TeacherRankingDocument (Owning Teacher / Principal / Admin / ITAdmin only)
 * - ExcuseLetter attachment (Owning Student / Assigned Teacher / Nurse / Principal / Admin / ITAdmin only)
 * - DocumentRequest attachment (Owning Student / Assigned Teacher / Registrar / Principal / Admin / ITAdmin only)
 * - Sf9OfficialIssuance PDF (Assigned Adviser/Teacher / Registrar / Principal / Admin / ITAdmin only)
 * - CampusMedia (GateOperator / campus_media:read / campus_media:manage / Admin / ITAdmin only)
 * - Unlinked private document (Uploader / Admin / ITAdmin only)
 */
export async function authorizeDocumentAccess(
  prismaClient: any,
  documentId: string,
  authUser: AuthenticatedUser
) {
  if (!authUser || !authUser.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  const document = await prismaClient.document.findUnique({
    where: { id: documentId },
    include: {
      uploader: {
        include: {
          user_roles: {
            include: { role: true },
          },
        },
      },
      document_requests: true,
      excuseLetters: true,
      teacherRankingDocuments: {
        include: {
          ranking: {
            include: {
              teacher: true,
            },
          },
        },
      },
      campus_media: true,
    },
  });

  if (!document) {
    throw new AppError(404, 'NOT_FOUND', 'Document not found.');
  }

  const roles = authUser.roles || [];
  const permissions = authUser.permissions || [];

  const isAdmin = roles.includes('Admin') || roles.includes('ITAdmin');
  const isPrincipal = roles.includes('Principal');
  const isRegistrar = roles.includes('Registrar');
  const isTeacher = roles.includes('Teacher');
  const isStudent = roles.includes('Student');
  const isNurse = roles.includes('Nurse') || permissions.includes('clinic:read');
  const isUploader = document.uploaded_by === authUser.id;

  const uploaderRoles: string[] = (document.uploader?.user_roles ?? [])
    .map((ur: any) => ur?.role?.name)
    .filter(Boolean);
  const isClinicUploaded = uploaderRoles.includes('Nurse');

  const docRequests = Array.isArray(document.document_requests) ? document.document_requests : [];
  const excuseLetters = Array.isArray(document.excuseLetters) ? document.excuseLetters : [];
  const teacherRankings = Array.isArray(document.teacherRankingDocuments)
    ? document.teacherRankingDocuments
    : [];
  const hasCampusMedia = Boolean(document.campus_media);

  const sf9Issuances =
    typeof prismaClient.sf9OfficialIssuance?.findMany === 'function'
      ? await prismaClient.sf9OfficialIssuance.findMany({
          where: { issued_pdf_document_id: document.id },
        })
      : [];

  // 1. Clinic-Sensitive Documents (uploaded by Nurse and not CampusMedia)
  if (isClinicUploaded && !hasCampusMedia) {
    if (isNurse || isAdmin || isUploader) {
      return document;
    }
    if (isStudent && (excuseLetters.length > 0 || docRequests.length > 0)) {
      const student = await prismaClient.student.findUnique({ where: { user_id: authUser.id } });
      const ownsExcuse = student && excuseLetters.some((e: any) => e.student_id === student.id);
      const ownsRequest = student && docRequests.some((r: any) => r.student_id === student.id);
      if (ownsExcuse || ownsRequest) {
        return document;
      }
    }
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have permission to access this clinic-restricted document.'
    );
  }

  // 2. TeacherRankingDocument (Faculty evaluation / promotion records)
  if (teacherRankings.length > 0) {
    if (isAdmin || isPrincipal) {
      return document;
    }
    if (isTeacher) {
      const teacher = await prismaClient.teacher.findUnique({ where: { user_id: authUser.id } });
      const ownsRanking = teacherRankings.some(
        (trd: any) =>
          trd.ranking?.teacher?.user_id === authUser.id ||
          (teacher && trd.ranking?.teacher_id === teacher.id)
      );
      if (ownsRanking || isUploader) {
        return document;
      }
    }
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have permission to access this faculty ranking document.'
    );
  }

  // 3. ExcuseLetter Attachments
  if (excuseLetters.length > 0) {
    if (isAdmin || isPrincipal || isNurse) {
      return document;
    }
    if (isStudent) {
      const student = await prismaClient.student.findUnique({ where: { user_id: authUser.id } });
      if (student && excuseLetters.some((e: any) => e.student_id === student.id)) {
        return document;
      }
      throw new AppError(
        403,
        'FORBIDDEN',
        "You do not have access to another student's excuse letter attachment."
      );
    }
    if (isTeacher) {
      const teacher = await prismaClient.teacher.findUnique({ where: { user_id: authUser.id } });
      if (teacher && excuseLetters.some((e: any) => e.teacher_id === teacher.id)) {
        return document;
      }
      throw new AppError(
        403,
        'FORBIDDEN',
        "You are not assigned to this student's excuse letter."
      );
    }
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have permission to access this excuse letter attachment.'
    );
  }

  // 4. DocumentRequest Attachments
  if (docRequests.length > 0) {
    if (isAdmin || isPrincipal || isRegistrar) {
      return document;
    }
    if (isStudent) {
      const student = await prismaClient.student.findUnique({ where: { user_id: authUser.id } });
      if (student && docRequests.some((r: any) => r.student_id === student.id)) {
        return document;
      }
      throw new AppError(
        403,
        'FORBIDDEN',
        "You do not have access to another student's document request attachment."
      );
    }
    if (isTeacher) {
      const teacher = await prismaClient.teacher.findUnique({ where: { user_id: authUser.id } });
      if (teacher && docRequests.some((r: any) => r.teacher_id === teacher.id)) {
        return document;
      }
      throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this document request.');
    }
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have permission to access this document request attachment.'
    );
  }

  // 5. Sf9OfficialIssuance Archived PDFs (Forward-compatible for Phase H)
  if (sf9Issuances.length > 0) {
    if (isAdmin || isPrincipal || isRegistrar) {
      return document;
    }
    if (isStudent) {
      const student = await prismaClient.student.findUnique({ where: { user_id: authUser.id } });
      if (student && sf9Issuances.some((iss: any) => iss.student_id === student.id)) {
        return document;
      }
    }
    if (isTeacher) {
      const teacher = await prismaClient.teacher.findUnique({ where: { user_id: authUser.id } });
      if (teacher) {
        const sectionIds = sf9Issuances.map((iss: any) => iss.section_id).filter(Boolean);
        const assignment =
          sectionIds.length > 0
            ? await prismaClient.teacherSubjectAssignment.findFirst({
                where: {
                  teacher_id: teacher.id,
                  section_id: { in: sectionIds },
                },
              })
            : null;
        if (assignment) {
          return document;
        }
      }
    }
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have permission to access this official SF9 issuance.'
    );
  }

  // 6. CampusMedia Files
  if (hasCampusMedia) {
    if (
      isAdmin ||
      roles.includes('GateOperator') ||
      permissions.includes('campus_media:read') ||
      permissions.includes('campus_media:manage')
    ) {
      return document;
    }
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have permission to access this campus media file.'
    );
  }

  // 7. Unlinked / Newly Uploaded Private Document
  if (isUploader || isAdmin) {
    return document;
  }

  throw new AppError(403, 'FORBIDDEN', 'You do not have access to this private document.');
}

/**
 * Enforces strict authorization for faculty/staff LeaveRequest attachments.
 * Accessible only to the leave requester or authorized leave approvers (Principal / Admin / ITAdmin / leave:approve).
 */
export async function authorizeLeaveAttachmentAccess(
  prismaClient: any,
  leaveId: string,
  authUser: AuthenticatedUser
) {
  if (!authUser || !authUser.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  const leaveRequest = await prismaClient.leaveRequest.findUnique({
    where: { id: leaveId },
  });

  if (!leaveRequest || !leaveRequest.attachment_url) {
    throw new AppError(404, 'NOT_FOUND', 'Leave attachment not found.');
  }

  const roles = authUser.roles || [];
  const permissions = authUser.permissions || [];
  const isOwner = leaveRequest.user_id === authUser.id;
  const canApproveLeave =
    permissions.includes('leave:approve') ||
    roles.includes('Principal') ||
    roles.includes('Admin') ||
    roles.includes('ITAdmin');

  if (!isOwner && !canApproveLeave) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have permission to access this leave attachment.'
    );
  }

  return leaveRequest;
}

