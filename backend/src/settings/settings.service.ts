import prisma from '../config/database.js';
import { createAuditLog } from '../audit/audit.service.js';
import { UpdateSchoolSettingsInput } from './settings.schema.js';

export const DEFAULT_BRANDING_SETTINGS = {
  logo_url: null as string | null,
  favicon_url: null as string | null,
  login_background_url: null as string | null,
  primary_color: '#0A192F',
  secondary_color: '#1B3A6B',
  accent_color: '#F5A623',
  login_welcome_text: 'Education Shapes the Future',
  footer_text: 'DigiSkwela · School Management System',
};

export const DEFAULT_SCHOOL_SETTINGS = {
  id: 'default',
  school_name: 'Calulut Integrated School',
  school_short_name: 'CIS',
  ...DEFAULT_BRANDING_SETTINGS,
  logo_url: '/school_seal.png',
  favicon_url: '/school_seal.png',
  address: null as string | null,
  contact_email: null as string | null,
  contact_number: null as string | null,
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
    schoolName: settings.school_name,
    schoolShortName: settings.school_short_name,
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

  return updated;
}

/**
 * Resets visual branding & presentation settings to defaults.
 * White-label safe: Strictly preserves institutional identity
 * (school_name, school_short_name, address, contact_email, contact_number).
 */
export async function resetSchoolSettings(
  actorUserId: string,
  correlationId?: string,
  clientMeta?: { actorSchoolId?: string | null; actorRole?: string | null; ipAddress?: string | null; userAgent?: string | null }
) {
  const current = await getOrCreateSchoolSettings();

  const resetData = {
    ...DEFAULT_BRANDING_SETTINGS,
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
    targetLabel: 'School Visual Branding',
    result: 'SUCCESS',
    previousState: {
      primary_color: current.primary_color,
      secondary_color: current.secondary_color,
      accent_color: current.accent_color,
      logo_url: current.logo_url,
    },
    newState: {
      primary_color: updated.primary_color,
      secondary_color: updated.secondary_color,
      accent_color: updated.accent_color,
      logo_url: updated.logo_url,
    },
    correlationId,
    ipAddress: clientMeta?.ipAddress,
    userAgent: clientMeta?.userAgent,
  });

  return updated;
}
