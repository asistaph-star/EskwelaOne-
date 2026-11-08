/**
 * DigiSkwela — Learner Identity Extraction Helper
 * Safely resolves learner names and identity fields whether the Student Portal
 * User account is provisioned or unprovisioned (Approach A nullable user_id).
 */

export interface StudentWithOptionalUser {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  suffix?: string | null;
  lrn?: string | null;
  user?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    middle_name?: string | null;
    email?: string | null;
    school_id?: string | null;
  } | null;
}

export function getStudentIdentity(student?: StudentWithOptionalUser | null) {
  if (!student) {
    return {
      firstName: '',
      lastName: '',
      middleName: null,
      suffix: null,
      fullName: 'Unknown Student',
      formalName: 'Unknown Student',
      hasPortalAccount: false,
    };
  }

  const firstName = (student.user?.first_name || student.first_name || '').trim();
  const lastName = (student.user?.last_name || student.last_name || '').trim();
  const middleName = (student.user?.middle_name || student.middle_name || '').trim() || null;
  const suffix = (student.suffix || '').trim() || null;

  const formalName = `${lastName}${firstName ? ', ' + firstName : ''}${middleName ? ' ' + middleName : ''}${suffix ? ' ' + suffix : ''}`.trim() || 'Unknown Student';
  const fullName = `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}${suffix ? ' ' + suffix : ''}`.trim() || 'Unknown Student';

  return {
    firstName,
    lastName,
    middleName,
    suffix,
    fullName,
    formalName,
    hasPortalAccount: Boolean(student.user?.id),
  };
}

