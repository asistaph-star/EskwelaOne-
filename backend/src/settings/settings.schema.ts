import { z } from 'zod';

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
// Permits valid root-relative paths (/...) or standard http/https URLs. Strictly forbids javascript:, data:, etc.
const SAFE_URL_REGEX = /^(\/[a-zA-Z0-9_\-./%]+|https?:\/\/[a-zA-Z0-9_\-./%:]+)$/;

export const hexColorSchema = z.string().regex(HEX_COLOR_REGEX, {
  message: 'Color must be a valid hex color code (e.g. #0A192F or #FFF)',
});

export const safeUrlSchema = z.string().max(500).regex(SAFE_URL_REGEX, {
  message: 'Asset URL must be a valid relative path starting with / or an http/https URL',
}).nullable().optional();

export const updateSchoolSettingsSchema = z.object({
  school_name: z.string().min(1, 'School name cannot be empty').max(255).optional(),
  schoolName: z.string().min(1, 'School name cannot be empty').max(255).optional(),

  school_short_name: z.string().min(1, 'School short name cannot be empty').max(50).optional(),
  schoolShortName: z.string().min(1, 'School short name cannot be empty').max(50).optional(),

  logo_url: safeUrlSchema,
  logoUrl: safeUrlSchema,

  favicon_url: safeUrlSchema,
  faviconUrl: safeUrlSchema,

  login_background_url: safeUrlSchema,
  loginBackgroundUrl: safeUrlSchema,

  primary_color: hexColorSchema.optional(),
  primaryColor: hexColorSchema.optional(),

  secondary_color: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),

  accent_color: hexColorSchema.optional(),
  accentColor: hexColorSchema.optional(),

  address: z.string().max(255).nullable().optional(),

  contact_email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  contactEmail: z.union([z.string().email(), z.literal(''), z.null()]).optional(),

  contact_number: z.string().max(50).nullable().optional(),
  contactNumber: z.string().max(50).nullable().optional(),

  login_welcome_text: z.string().max(255).nullable().optional(),
  loginWelcomeText: z.string().max(255).nullable().optional(),

  footer_text: z.string().max(255).nullable().optional(),
  footerText: z.string().max(255).nullable().optional(),
}).strict();

export type UpdateSchoolSettingsInput = z.infer<typeof updateSchoolSettingsSchema>;
