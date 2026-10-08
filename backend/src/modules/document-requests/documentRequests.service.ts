import prisma from '../../config/database.js';
import { generateId } from '../../common/utils/uuid.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { createAuditLog } from '../../audit/audit.service.js';
import { AuthenticatedUser } from '../../common/middleware/auth.js';

export async function getDocumentRequestsByStudent(studentId: string, authUser: AuthenticatedUser) {
  let whereClause: any = { student_id: studentId };

  if (authUser.roles.includes('Student')) {
    const studentProfile = await prisma.student.findUnique({ where: { user_id: authUser.id } });
    if (!studentProfile || studentProfile.id !== studentId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only view your own document requests.');
    }
  } else if (authUser.roles.includes('Teacher')) {
    const teacherProfile = await prisma.teacher.findUnique({ where: { user_id: authUser.id } });
    if (!teacherProfile) throw new AppError(403, 'FORBIDDEN', 'Teacher profile not found.');
    whereClause.teacher_id = teacherProfile.id;
  } else if (!authUser.roles.some(r => ['Admin', 'Principal', 'Registrar'].includes(r))) {
    throw new AppError(403, 'FORBIDDEN', 'Unauthorized role.');
  }

  const rawRecords = await prisma.documentRequest.findMany({
    where: whereClause,
    include: { principal: true },
    orderBy: { submitted_date: 'desc' }
  });
  
  return rawRecords.map(r => ({
    ...r,
    principalName: r.principal ? `${r.principal.first_name} ${r.principal.last_name}` : r.principal_id
  }));
}

export async function listDocumentRequests(authUser: AuthenticatedUser) {
  let whereClause = {};
  
  if (authUser.roles.includes('Student')) {
    const studentProfile = await prisma.student.findUnique({ where: { user_id: authUser.id } });
    if (!studentProfile) return [];
    whereClause = { student_id: studentProfile.id };
  } else if (authUser.roles.includes('Teacher')) {
    const teacherProfile = await prisma.teacher.findUnique({ where: { user_id: authUser.id } });
    if (!teacherProfile) return [];
    whereClause = { teacher_id: teacherProfile.id };
  } else if (!authUser.roles.some(r => ['Admin', 'Principal', 'Registrar'].includes(r))) {
    return [];
  }

  const rawRecords = await prisma.documentRequest.findMany({
    where: whereClause,
    include: {
      student: { include: { user: true, current_section: true } },
      teacher: { include: { user: true } },
      principal: true,
      attached_document: true,
    },
    orderBy: { created_at: 'desc' }
  });

  return rawRecords.map(r => ({
    ...r,
    id: r.id,
    studentId: r.student_id,
    studentName: r.student ? `${r.student.user.first_name} ${r.student.user.last_name}` : 'Unknown',
    section: r.student?.current_section ? r.student.current_section.name : 'Unknown',
    documentType: r.document_type,
    purpose: r.purpose,
    status: r.status,
    currentStage: r.current_stage,
    submittedDate: r.submitted_date.toISOString(),
    
    teacherId: r.teacher_id,
    teacherName: r.teacher ? `${r.teacher.user.first_name} ${r.teacher.user.last_name}` : undefined,
    teacherApprovedDate: r.teacher_approved_date?.toISOString(),
    teacherRemarks: r.teacher_remarks,
    
    principalId: r.principal_id,
    principalName: r.principal ? `${r.principal.first_name} ${r.principal.last_name}` : undefined,
    principalApprovedDate: r.principal_approved_date?.toISOString(),
    principalRemarks: r.principal_remarks,
    
    readyDate: r.ready_date?.toISOString(),
    attachedDocumentId: r.attached_document_id
  }));
}

export async function createStudentServicesDocRequest(input: any, authUser: AuthenticatedUser) {
  if (authUser.roles.includes('Student')) {
    const studentProfile = await prisma.student.findUnique({ where: { user_id: authUser.id } });
    if (!studentProfile || studentProfile.id !== input.studentId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only create requests for yourself.');
    }
  } else {
    throw new AppError(403, 'FORBIDDEN', 'Only students can create document requests through this service.');
  }

  const record = await prisma.documentRequest.create({
    data: {
      id: generateId(),
      student_id: input.studentId,
      document_type: input.documentType,
      purpose: input.purpose,
      status: 'Submitted',
      current_stage: 1,
      teacher_id: input.teacherId
    }
  });

  return record;
}

export async function createDocumentsDocRequest(input: any, actorId: string, correlationId: string) {
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
      student_id: student.id,
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

  return request;
}

export async function updateDocumentRequest(id: string, input: any, actorId: string, correlationId: string, userRoles: string[]) {
  const existing = await prisma.documentRequest.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Document request not found.');
  }

  const isAdmin = userRoles.includes('Admin') || userRoles.includes('ITAdmin');
  const dataToUpdate: any = {};

  if (input.status !== undefined || input.currentStage !== undefined) {
    if (input.status === undefined || input.currentStage === undefined) {
      throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Both status and currentStage must be provided together.');
    }
    
    const reqStatus = input.status;
    const reqStage = input.currentStage;
    const currentStatus = existing.status;
    const currentStage = existing.current_stage;

    const isValidConsistency = 
      (reqStatus === 'Teacher Approved' && reqStage === 2) ||
      (reqStatus === 'Teacher Rejected' && reqStage === 1) ||
      (reqStatus === 'Principal Approved' && reqStage === 3) ||
      (reqStatus === 'Ready for Pickup' && reqStage === 4) ||
      (reqStatus === 'Completed' && reqStage === 4);
      
    if (!isValidConsistency) {
       throw new AppError(422, 'UNPROCESSABLE_ENTITY', `Invalid status/stage combination: ${reqStatus} (stage ${reqStage})`);
    }

    let isAllowed = false;

    if (isAdmin) {
      const allValidTransitions = 
        (currentStatus === 'Submitted' && currentStage === 1 && (reqStatus === 'Teacher Approved' || reqStatus === 'Teacher Rejected' || reqStatus === 'Principal Approved' || reqStatus === 'Ready for Pickup')) ||
        (currentStatus === 'Teacher Approved' && currentStage === 2 && (reqStatus === 'Principal Approved' || reqStatus === 'Teacher Rejected')) ||
        (currentStatus === 'Principal Approved' && currentStage === 3 && (reqStatus === 'Ready for Pickup' || reqStatus === 'Completed')) ||
        (currentStatus === 'Ready for Pickup' && currentStage === 4 && reqStatus === 'Completed');
      if (allValidTransitions) isAllowed = true;
    }

    if (!isAllowed && userRoles.includes('Teacher')) {
      const teacherProfile = await prisma.teacher.findUnique({ where: { user_id: actorId } });
      if (!teacherProfile || existing.teacher_id !== teacherProfile.id) {
        throw new AppError(403, 'FORBIDDEN', 'You are not assigned to this document request.');
      }
      
      if (currentStatus === 'Submitted' && currentStage === 1) {
        if (reqStatus === 'Teacher Approved' || reqStatus === 'Teacher Rejected') {
          isAllowed = true;
        }
      }
    }

    if (!isAllowed && userRoles.includes('Principal')) {
      if (currentStatus === 'Teacher Approved' && currentStage === 2) {
        if (reqStatus === 'Principal Approved' || reqStatus === 'Teacher Rejected') {
          isAllowed = true;
        }
      }
      if (currentStatus === 'Submitted' && currentStage === 1) {
        if (reqStatus === 'Principal Approved' || reqStatus === 'Ready for Pickup') {
          isAllowed = true; 
        }
      }
      if ((currentStatus === 'Principal Approved' && currentStage === 3) || 
          (currentStatus === 'Ready for Pickup' && currentStage === 4)) {
        if (reqStatus === 'Completed') {
          isAllowed = true; 
        }
      }
    }

    if (!isAllowed && userRoles.includes('Registrar')) {
      if (currentStatus === 'Principal Approved' && currentStage === 3) {
        if (reqStatus === 'Ready for Pickup') {
          isAllowed = true;
        }
      }
      if (currentStatus === 'Ready for Pickup' && currentStage === 4) {
        if (reqStatus === 'Completed') {
          isAllowed = true;
        }
      }
    }

    if (!isAllowed) {
      throw new AppError(422, 'UNPROCESSABLE_ENTITY', `Unauthorized transition from ${currentStatus} (stage ${currentStage}) to ${reqStatus} (stage ${reqStage})`);
    }

    dataToUpdate.status = reqStatus;
    dataToUpdate.current_stage = reqStage;
  }

  if (input.teacherApprovedDate !== undefined && (isAdmin || userRoles.includes('Teacher'))) {
    dataToUpdate.teacher_approved_date = new Date(input.teacherApprovedDate);
  }
  if (input.teacherRemarks !== undefined && (isAdmin || userRoles.includes('Teacher'))) {
    dataToUpdate.teacher_remarks = input.teacherRemarks;
  }
  if (input.principalApprovedDate !== undefined && (isAdmin || userRoles.includes('Principal'))) {
    dataToUpdate.principal_approved_date = new Date(input.principalApprovedDate);
  }
  if (input.principalRemarks !== undefined && (isAdmin || userRoles.includes('Principal'))) {
    dataToUpdate.principal_remarks = input.principalRemarks;
  }
  if (input.readyDate !== undefined && (isAdmin || userRoles.includes('Principal') || userRoles.includes('Registrar'))) {
    dataToUpdate.ready_date = new Date(input.readyDate);
  }
  if (input.attachedDocumentId !== undefined && (isAdmin || userRoles.includes('Principal'))) {
    dataToUpdate.attached_document_id = input.attachedDocumentId;
  }

  const updated = await prisma.documentRequest.update({
    where: { id },
    data: dataToUpdate
  });

  await createAuditLog({
    actorUserId: actorId,
    action: 'DOCUMENT_REQUEST_UPDATED',
    resourceType: 'document_request',
    resourceId: updated.id,
    newState: input,
    correlationId,
  });

  return updated;
}
