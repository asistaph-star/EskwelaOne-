import prisma from '../config/database.js';
import { createAuditLog } from '../audit/audit.service.js';
import { UpdateSchoolSettingsInput } from './settings.schema.js';

export const AUTHORITATIVE_DEFAULT_BRANDING = {
  logo_url: '/school_seal.png',
  favicon_url: '/school_seal.png',
  login_background_url: null as string | null,
  primary_color: '#0A192F',
  secondary_color: '#1B3A6B',
  accent_color: '#F5A623',
  login_welcome_text: 'Education Shapes the Future',
  footer_text: 'DigiSkwela · School Management System',
};

export const DEFAULT_BRANDING_SETTINGS = {
  ...AUTHORITATIVE_DEFAULT_BRANDING,
};

export const AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS = {
  id: 'default',
  school_name: 'Calulut Integrated School',
  school_short_name: 'CIS',
  ...AUTHORITATIVE_DEFAULT_BRANDING,
  school_id: '500146',
  region: 'Region III',
  division: 'City of San Fernando (P)',
  district: 'North District',
  school_head_name: 'Jose Rizal',
  school_head_title: 'Principal IV',
  address: 'Calulut, City of San Fernando, Pampanga',
  contact_email: 'calulut.is@deped.gov.ph',
  contact_number: '(045) 455-1234',
};

export const DEFAULT_SCHOOL_SETTINGS = {
  ...AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS,
};

export interface PublicSchoolSettings {
  schoolName: string;
  schoolShortName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginBackgroundUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  address: string | null;
  contactEmail: string | null;
  contactNumber: string | null;
  loginWelcomeText: string | null;
  footerText: string | null;
}

/**
 * Formats a SchoolSettings Prisma record into a standardized response containing both
 * snake_case and camelCase field aliases for full cross-compatibility.
 */
export function formatSchoolSettingsResponse(settings: any) {
  if (!settings) return settings;
  return {
    ...settings,
    schoolName: settings.school_name,
    schoolShortName: settings.school_short_name,
    schoolId: settings.school_id,
    region: settings.region,
    division: settings.division,
    district: settings.district,
    schoolHeadName: settings.school_head_name,
    schoolHeadTitle: settings.school_head_title,
    logoUrl: settings.logo_url,
    faviconUrl: settings.favicon_url,
    loginBackgroundUrl: settings.login_background_url,
    primaryColor: settings.primary_color,
    secondaryColor: settings.secondary_color,
    accentColor: settings.accent_color,
    address: settings.address,
    contactEmail: settings.contact_email,
    contactNumber: settings.contact_number,
    loginWelcomeText: settings.login_welcome_text,
    footerText: settings.footer_text,
  };
}

/**
 * Retrieves the singleton SchoolSettings record or creates the default record if missing.
 */
export async function getOrCreateSchoolSettings() {
  let settings = await (prisma as any).schoolSettings.findUnique({
    where: { id: 'default' },
  });

  if (!settings) {
    settings = await (prisma as any).schoolSettings.create({
      data: DEFAULT_SCHOOL_SETTINGS,
    });
  }

  return settings;
}

/**
 * Returns non-sensitive public presentation fields for unauthenticated consumers.
 */
export async function getPublicSchoolSettings(): Promise<PublicSchoolSettings> {
  const settings = await getOrCreateSchoolSettings();

  return {
    schoolName: settings.school_name || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.school_name,
    schoolShortName: settings.school_short_name || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.school_short_name,
    logoUrl: settings.logo_url || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.logo_url,
    faviconUrl: settings.favicon_url || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.favicon_url,
    loginBackgroundUrl: settings.login_background_url,
    primaryColor: settings.primary_color || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.primary_color,
    secondaryColor: settings.secondary_color || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.secondary_color,
    accentColor: settings.accent_color || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.accent_color,
    address: settings.address,
    contactEmail: settings.contact_email,
    contactNumber: settings.contact_number,
    loginWelcomeText: settings.login_welcome_text || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.login_welcome_text,
    footerText: settings.footer_text || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.footer_text,
  };
}

/**
 * Updates the singleton SchoolSettings record with strict allowlisting and auditing.
 */
export async function updateSchoolSettings(
  input: UpdateSchoolSettingsInput,
  actorUserId: string,
  correlationId?: string,
  clientMeta?: { actorSchoolId?: string | null; actorRole?: string | null; ipAddress?: string | null; userAgent?: string | null }
) {
  const current = await getOrCreateSchoolSettings();

  // Normalize incoming fields (accepting either camelCase or snake_case)
  const data: Record<string, any> = {};

  if (input.school_name !== undefined || input.schoolName !== undefined) {
    data.school_name = (input.school_name ?? input.schoolName)!.trim();
  }
  if (input.school_short_name !== undefined || input.schoolShortName !== undefined) {
    data.school_short_name = (input.school_short_name ?? input.schoolShortName)!.trim();
  }
  if (input.logo_url !== undefined || input.logoUrl !== undefined) {
    data.logo_url = input.logo_url ?? input.logoUrl ?? null;
  }
  if (input.favicon_url !== undefined || input.faviconUrl !== undefined) {
    data.favicon_url = input.favicon_url ?? input.faviconUrl ?? null;
  }
  if (input.login_background_url !== undefined || input.loginBackgroundUrl !== undefined) {
    data.login_background_url = input.login_background_url ?? input.loginBackgroundUrl ?? null;
  }
  if (input.primary_color !== undefined || input.primaryColor !== undefined) {
    data.primary_color = input.primary_color ?? input.primaryColor;
  }
  if (input.secondary_color !== undefined || input.secondaryColor !== undefined) {
    data.secondary_color = input.secondary_color ?? input.secondaryColor;
  }
  if (input.accent_color !== undefined || input.accentColor !== undefined) {
    data.accent_color = input.accent_color ?? input.accentColor;
  }
  if (input.address !== undefined) {
    data.address = input.address ? input.address.trim() : null;
  }
  if (input.contact_email !== undefined || input.contactEmail !== undefined) {
    const emailVal = input.contact_email ?? input.contactEmail;
    data.contact_email = emailVal ? emailVal.trim() : null;
  }
  if (input.contact_number !== undefined || input.contactNumber !== undefined) {
    const numVal = input.contact_number ?? input.contactNumber;
    data.contact_number = numVal ? numVal.trim() : null;
  }
  if (input.login_welcome_text !== undefined || input.loginWelcomeText !== undefined) {
    const textVal = input.login_welcome_text ?? input.loginWelcomeText;
    data.login_welcome_text = textVal ? textVal.trim() : null;
  }
  if (input.footer_text !== undefined || input.footerText !== undefined) {
    const footVal = input.footer_text ?? input.footerText;
    data.footer_text = footVal ? footVal.trim() : null;
  }
  if (input.school_head_name !== undefined || input.schoolHeadName !== undefined) {
    const headVal = input.school_head_name ?? input.schoolHeadName;
    data.school_head_name = headVal ? headVal.trim() : null;
  }
  if (input.school_head_title !== undefined || input.schoolHeadTitle !== undefined) {
    const titleVal = input.school_head_title ?? input.schoolHeadTitle;
    data.school_head_title = titleVal ? titleVal.trim() : null;
  }
  if (input.school_id !== undefined || input.schoolId !== undefined) {
    const sIdVal = input.school_id ?? input.schoolId;
    data.school_id = sIdVal ? sIdVal.trim() : null;
  }
  if (input.region !== undefined) {
    data.region = input.region ? input.region.trim() : null;
  }
  if (input.division !== undefined) {
    data.division = input.division ? input.division.trim() : null;
  }
  if (input.district !== undefined) {
    data.district = input.district ? input.district.trim() : null;
  }

  data.updated_by_id = actorUserId;

  const updated = await (prisma as any).schoolSettings.update({
    where: { id: 'default' },
    data,
  });

  await createAuditLog({
    actorUserId,
    actorSchoolId: clientMeta?.actorSchoolId,
    actorRole: clientMeta?.actorRole,
    action: 'SCHOOL_SETTINGS_UPDATED',
    category: 'CONFIGURATION',
    resourceType: 'school_settings',
    resourceId: 'default',
    targetLabel: 'School Customization Settings',
    result: 'SUCCESS',
    previousState: {
      school_name: current.school_name,
      school_short_name: current.school_short_name,
      primary_color: current.primary_color,
    },
    newState: {
      school_name: updated.school_name,
      school_short_name: updated.school_short_name,
      primary_color: updated.primary_color,
    },
    correlationId,
    ipAddress: clientMeta?.ipAddress,
    userAgent: clientMeta?.userAgent,
  });

  return formatSchoolSettingsResponse(updated);
}

/**
 * Authoritatively restores all School Customization settings to canonical defaults
 * (Calulut Integrated School, CIS, /school_seal.png, default theme colors, institutional texts & contact).
 * Strictly preserves DepEd School ID (500146).
 */
export async function resetSchoolSettings(
  actorUserId: string,
  correlationId?: string,
  clientMeta?: { actorSchoolId?: string | null; actorRole?: string | null; ipAddress?: string | null; userAgent?: string | null }
) {
  const current = await getOrCreateSchoolSettings();

  const resetData = {
    school_name: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.school_name,
    school_short_name: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.school_short_name,
    logo_url: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.logo_url,
    favicon_url: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.favicon_url,
    login_background_url: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.login_background_url,
    primary_color: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.primary_color,
    secondary_color: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.secondary_color,
    accent_color: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.accent_color,
    login_welcome_text: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.login_welcome_text,
    footer_text: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.footer_text,
    address: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.address,
    contact_email: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.contact_email,
    contact_number: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.contact_number,
    school_head_name: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.school_head_name,
    school_head_title: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.school_head_title,
    region: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.region,
    division: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.division,
    district: AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.district,
    school_id: current.school_id || AUTHORITATIVE_DEFAULT_SCHOOL_SETTINGS.school_id,
    updated_by_id: actorUserId,
  };

  const updated = await (prisma as any).schoolSettings.update({
    where: { id: 'default' },
    data: resetData,
  });

  await createAuditLog({
    actorUserId,
    actorSchoolId: clientMeta?.actorSchoolId,
    actorRole: clientMeta?.actorRole,
    action: 'SCHOOL_SETTINGS_BRANDING_RESET',
    category: 'CONFIGURATION',
    resourceType: 'school_settings',
    resourceId: 'default',
    targetLabel: 'School Customization Defaults Restored',
    result: 'SUCCESS',
    previousState: {
      school_name: current.school_name,
      school_short_name: current.school_short_name,
      primary_color: current.primary_color,
      secondary_color: current.secondary_color,
      accent_color: current.accent_color,
      logo_url: current.logo_url,
    },
    newState: {
      school_name: updated.school_name,
      school_short_name: updated.school_short_name,
      primary_color: updated.primary_color,
      secondary_color: updated.secondary_color,
      accent_color: updated.accent_color,
      logo_url: updated.logo_url,
    },
    correlationId,
    ipAddress: clientMeta?.ipAddress,
    userAgent: clientMeta?.userAgent,
  });

  return formatSchoolSettingsResponse(updated);
}
