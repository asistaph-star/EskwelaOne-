import { describe, it, expect } from 'vitest';
import {
  createNotificationSchema,
  patchNotificationSchema,
  isAdministrativeUser,
  ALLOWED_ICON_TYPES
} from '../src/admin/notifications.routes.js';
import { AuthenticatedUser } from '../src/common/middleware/auth.js';

describe('Phase 1D: Notification Payload Schema Validation', () => {
  const validUUID = 'a1628af4-0ed8-4e9d-af93-41267ff72447';

  it('1. Accepts a valid notification payload with standard fields', () => {
    const payload = {
      recipientId: validUUID,
      title: 'Official School Advisory',
      body: 'Classes are suspended tomorrow due to severe weather conditions.',
      iconType: 'alert',
    };
    const parsed = createNotificationSchema.parse(payload);
    expect(parsed.recipientId).toBe(validUUID);
    expect(parsed.title).toBe('Official School Advisory');
    expect(parsed.body).toBe('Classes are suspended tomorrow due to severe weather conditions.');
    expect(parsed.iconType).toBe('alert');
  });

  it('2. Defaults iconType to "alert" when omitted', () => {
    const payload = {
      recipientId: validUUID,
      title: 'Meeting Notice',
      body: 'Faculty assembly will be held at 3:00 PM.',
    };
    const parsed = createNotificationSchema.parse(payload);
    expect(parsed.iconType).toBe('alert');
  });

  it('3. Accepts all approved design system icon types', () => {
    for (const icon of ALLOWED_ICON_TYPES) {
      const parsed = createNotificationSchema.parse({
        recipientId: validUUID,
        title: `Notice with icon ${icon}`,
        body: 'Details here.',
        iconType: icon,
      });
      expect(parsed.iconType).toBe(icon);
    }
  });

  it('4. Rejects payload missing recipientId', () => {
    const payload = {
      title: 'Missing Recipient',
      body: 'Some message.',
    };
    expect(() => createNotificationSchema.parse(payload)).toThrowError(/recipientId is required/i);
  });

  it('5. Rejects payload with non-UUID recipientId format', () => {
    const payload = {
      recipientId: 'invalid-non-uuid-string-12345',
      title: 'Bad UUID',
      body: 'Some message.',
    };
    expect(() => createNotificationSchema.parse(payload)).toThrowError(/recipientId must be a valid UUID/i);
  });

  it('6. Rejects payload with empty or whitespace-only title', () => {
    const payload = {
      recipientId: validUUID,
      title: '   ',
      body: 'Some message.',
    };
    expect(() => createNotificationSchema.parse(payload)).toThrowError(/Title cannot be empty/i);
  });

  it('7. Rejects title exceeding 120 characters', () => {
    const payload = {
      recipientId: validUUID,
      title: 'A'.repeat(121),
      body: 'Some message.',
    };
    expect(() => createNotificationSchema.parse(payload)).toThrowError(/Title cannot exceed 120 characters/i);
  });

  it('8. Rejects payload with empty or whitespace-only body', () => {
    const payload = {
      recipientId: validUUID,
      title: 'Valid Title',
      body: '     ',
    };
    expect(() => createNotificationSchema.parse(payload)).toThrowError(/Body cannot be empty/i);
  });

  it('9. Rejects body exceeding 1000 characters', () => {
    const payload = {
      recipientId: validUUID,
      title: 'Valid Title',
      body: 'B'.repeat(1001),
    };
    expect(() => createNotificationSchema.parse(payload)).toThrowError(/Body cannot exceed 1000 characters/i);
  });

  it('10. Rejects unsupported or arbitrary iconType values', () => {
    const payload = {
      recipientId: validUUID,
      title: 'Valid Title',
      body: 'Some message.',
      iconType: 'malicious_injected_icon_type',
    };
    expect(() => createNotificationSchema.parse(payload)).toThrowError(/iconType must be one of/i);
  });
});

describe('Phase 1D: Notification PATCH Schema Validation', () => {
  it('11. Accepts valid boolean isRead: true', () => {
    const parsed = patchNotificationSchema.parse({ isRead: true });
    expect(parsed.isRead).toBe(true);
  });

  it('12. Accepts valid boolean isRead: false', () => {
    const parsed = patchNotificationSchema.parse({ isRead: false });
    expect(parsed.isRead).toBe(false);
  });

  it('13. Rejects non-boolean isRead values (e.g. strings or numbers)', () => {
    expect(() => patchNotificationSchema.parse({ isRead: 'true' })).toThrowError(/isRead must be a boolean/i);
    expect(() => patchNotificationSchema.parse({ isRead: 1 })).toThrowError(/isRead must be a boolean/i);
    expect(() => patchNotificationSchema.parse({})).toThrowError(/isRead is required/i);
  });
});

describe('Phase 1D: Role-Based Notification Authorization Helper', () => {
  const baseUser: AuthenticatedUser = {
    id: 'usr-1',
    schoolId: 'EMP-001',
    firstName: 'Test',
    lastName: 'User',
    status: 'active',
    roles: [],
    permissions: [],
  };

  it('14. Identifies Admin as an administrative user', () => {
    const admin: AuthenticatedUser = { ...baseUser, roles: ['Admin'] };
    expect(isAdministrativeUser(admin)).toBe(true);
  });

  it('15. Identifies Principal as an administrative user', () => {
    const principal: AuthenticatedUser = { ...baseUser, roles: ['Principal'] };
    expect(isAdministrativeUser(principal)).toBe(true);
  });

  it('16. Identifies ITAdmin as an administrative user', () => {
    const itAdmin: AuthenticatedUser = { ...baseUser, roles: ['ITAdmin'] };
    expect(isAdministrativeUser(itAdmin)).toBe(true);
  });

  it('17. Identifies Registrar as an administrative user', () => {
    const registrar: AuthenticatedUser = { ...baseUser, roles: ['Registrar'] };
    expect(isAdministrativeUser(registrar)).toBe(true);
  });

  it('18. Identifies user with announcement:write permission as administrative', () => {
    const customUser: AuthenticatedUser = { ...baseUser, roles: ['Staff'], permissions: ['announcement:write'] };
    expect(isAdministrativeUser(customUser)).toBe(true);
  });

  it('19. Identifies ordinary Teacher as NON-administrative', () => {
    const teacher: AuthenticatedUser = { ...baseUser, roles: ['Teacher'], permissions: ['grade:write', 'attendance:write'] };
    expect(isAdministrativeUser(teacher)).toBe(false);
  });

  it('20. Identifies ordinary Student as NON-administrative', () => {
    const student: AuthenticatedUser = { ...baseUser, roles: ['Student'], permissions: ['academic:read'] };
    expect(isAdministrativeUser(student)).toBe(false);
  });

  it('21. Identifies Nurse as NON-administrative', () => {
    const nurse: AuthenticatedUser = { ...baseUser, roles: ['Nurse'], permissions: ['clinic:write'] };
    expect(isAdministrativeUser(nurse)).toBe(false);
  });
});

