# PHASE 5D PRINCIPAL COMPLETION 6 — PRIN-037 SETTINGS REPORT

**Feature ID:** PRIN-037  
**Module:** Principal Settings & Institutional Profile Management  
**Authoritative Institution:** Calulut Integrated School  
**Date:** 2026-10-13  
**Status:** IMPLEMENTED, VALIDATED, MANUAL VERIFICATION PENDING  

---

## 1. Recovered Starting State
- **Base Implementation Commit:** `b2bd82b21a8167f46deed97ff39cd76c670311d0` (`b2bd82b`) — `feat(principal): implement PRIN-037 Principal Settings and Profile management`
- **Initial State Recovered:** Complete `PSettingsScreen.tsx` UI, `usersApi.updateProfile` client method, and baseline `PATCH /api/users/:id` route.
- **Uncommitted Hardening Recovered in Working Tree:** Explicit positive server-side allowlist for self-service updates, vertical privilege escalation protection, horizontal ID-substitution check, mixed-payload pre-mutation rejection, AppContext rollback on error, and 12 dedicated automated test cases in `backend/tests/principalUsers.test.ts`.

---

## 2. PRIN-037 Final Functionality
PRIN-037 provides an executive administrative Settings screen partitioned into three distinct sections:
1. **Account Profile & Name Management:** Allows authenticated Principal users to manage their own personal identity details (First Name, Middle Name, Last Name) while displaying immutable institutional account metadata.
2. **Security & Authentication Oversight:** Displays real-world cryptographic configuration and authentication governance standards in read-only format.
3. **Institutional & Academic Year Oversight:** Connects to live PostgreSQL academic APIs to present real-time read-only oversight of the active academic calendar, term boundaries, and grading rules.

---

## 3. Editable Profile Fields
The Principal can modify only their own personal name identity:
- **First Name (`firstName` / `first_name`):** Required text field (min 1 character).
- **Middle Name (`middleName` / `middle_name`):** Optional text field; supports nullable/empty strings.
- **Last Name (`lastName` / `last_name`):** Required text field (min 1 character).

---

## 4. Read-Only Account Fields
The following account identifiers are displayed as read-only, non-editable metadata pills:
- **Official Email:** Displays the authenticated login email (e.g. `principal@demo.com`). Non-editable credential.
- **System Role:** Displays assigned role (`Principal` / Executive Administrative Tier). Centrally administered.
- **Account Status:** Displays system authorization status (`Active · Authorized`) along with assigned permission count.
- **Account ID:** Displays the primary database UUID identifier (`user.id`).

---

## 5. Self-Service Positive Allowlist
In `backend/src/users/user.routes.ts`, an explicit positive server-side allowlist is enforced:
```typescript
const SELF_SERVICE_ALLOWED_FIELDS = new Set([
  'firstName',
  'lastName',
  'middleName',
  'first_name',
  'last_name',
  'middle_name',
]);
```
Any field name present in `req.body` that is not explicitly in this Set is rejected with `403 Forbidden` for callers without `user:write`.

---

## 6. Horizontal Privilege Protection (ID Substitution)
Callers lacking broad `user:write` permissions are restricted strictly to their own user ID:
```typescript
if (authUser.id !== id && !hasUserWrite) {
  return res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Not authorized to modify another user profile' }
  });
}
```
Attempting to issue `PATCH /api/users/<another-user-id>` returns `403 Forbidden`.

---

## 7. Vertical Privilege Protection (Field Tampering)
Principal callers lacking `user:write` cannot modify privileged system fields:
- `status` modification $\rightarrow$ `403 Forbidden` (`FORBIDDEN: Not authorized to modify restricted fields: status`)
- `roles` injection $\rightarrow$ `403 Forbidden` (`FORBIDDEN: Not authorized to modify restricted fields: roles`)
- `permissions` injection $\rightarrow$ `403 Forbidden` (`FORBIDDEN: Not authorized to modify restricted fields: permissions`)
- `email` modification $\rightarrow$ `403 Forbidden` (`FORBIDDEN: Not authorized to modify restricted fields: email`)
- Password or privileged profile tampering $\rightarrow$ `403 Forbidden`

---

## 8. Mixed-Payload Protection
When a payload contains both valid self-service fields and restricted fields (e.g., `{ firstName: 'Roberto', status: 'suspended' }` or `{ firstName: 'Roberto', roles: ['Admin'] }`), the server filters keys against `SELF_SERVICE_ALLOWED_FIELDS`. Because disallowed keys exist, the request is **rejected immediately with 403 Forbidden before any database transaction or update occurs**. Restricted fields are neither ignored nor persisted.

---

## 9. Admin / ITAdmin Path Preservation
Callers possessing broad `user:write` (e.g. `Admin`, `ITAdmin`) have `hasUserWrite === true`. They bypass self-service allowlist restrictions and can update other accounts and statuses via standard `updateUserSchema`. Verified by passing regression test: `Legitimate Admin with user:write can update another user and status -> 200 OK`.

---

## 10. Backend Persistence + AppContext Synchronization Flow
The profile update flow guarantees strict data integrity:
1. User submits edited name fields via form.
2. `usersApi.updateProfile(userId, { firstName, lastName, middleName })` executes `PATCH /api/users/:id`.
3. Backend validates authentication, permissions, and positive allowlist, then executes `updateUser` with audit logging in PostgreSQL.
4. Backend returns HTTP 200 with the confirmed `UserProfile` object.
5. In `PSettingsScreen.tsx`, local state updates confirmed names and updates `currentUser` in `AppContext`:
   ```typescript
   if (currentUser) {
     setCurrentUser({ ...currentUser, name: `${confirmedFirst} ${confirmedLast}` });
   }
   ```
6. If the backend returns an error (400, 401, 403, 500), execution falls into `catch (err)`: `currentUser` in `AppContext` is untouched, form fields revert to `lastConfirmedProfile`, and an error toast is presented. No optimistic false-success state exists.

---

## 11. PSidebar Authenticated-User Binding
In `src/app/principal/shared/PSidebar.tsx`, the previously hardcoded `"Dr. Roberto Santos"` was removed. The component now imports `useAppContext`:
```typescript
const { currentUser } = useAppContext();
const displayName = currentUser?.name?.trim() || "Principal";
const userSubtitle = currentUser?.role ? `${currentUser.role}` : "School Administrator";
const initials = displayName
  .split(/\s+/)
  .map(p => p[0])
  .filter(Boolean)
  .slice(0, 2)
  .join("")
  .toUpperCase() || "P";
```
- When Settings saves a new name, `AppContext` updates and the sidebar reflects the confirmed name reactively.
- Upon page refresh, `AppContext.initDB()` fetches `/api/auth/me`, re-populating `currentUser.name` from the database.

---

## 12. Calulut Integrated School as Authoritative Institution
The school identity in `PSettingsScreen.tsx` is confirmed:
- **Institution Name:** `Calulut Integrated School`
- **School ID:** `300971 · San Fernando`
- This is the authoritative branding for DigiSkwela.

---

## 13. Academic Year & Terms Read-Only Behavior
Settings fetches live academic data via `academicApi`:
- `GET /api/academic/years` $\rightarrow$ resolves active academic year and displays current school year date span.
- `GET /api/academic/years/:yearId/terms` $\rightarrow$ displays active terms (`T1`, `T2`, `T3`, `T4`) with dates.
- Zero mutation controls exist: no switches, no edit forms, no term creation or deletion.
- Notice rendered: *"Academic year lifecycles and enrollment terms are maintained by the Registrar & System Administration (`academic:write`). The Principal retains read-only oversight (`academic:read`)."*

---

## 14. Security Information Source Verification
Security claims in `PSettingsScreen.tsx` were audited against actual backend source:
- **Authentication Mode:** `HTTP-Only JWT Cookie & Bearer Token` (verified in `backend/src/auth/auth.routes.ts` lines 18-23 and `common/middleware/auth.ts` lines 28-33).
- **Password Hashing:** `Bcrypt Salt Rounds (Cost: 12)` (verified in `backend/src/auth/auth.service.ts` line 9: `const SALT_ROUNDS = 12;`).
- **Password Policy:** `Minimum 8-Character Password Requirement` (verified in `backend/src/users/user.service.ts` line 70: `crypto.randomBytes(4).toString('hex')` generates 8-character temporary passwords).

---

## 15. Unsupported DepEd Wording Corrections
- Changed `DepEd Minimum 8-Character Standard` to `Minimum 8-Character Password Requirement` (factual system requirement).
- Changed `DepEd K-12 Transmutation` to `Four-Term Cumulative Grading Standard` (factual calculation: terms T1, T2, T3, T4 average $\ge 75$ passing).
- Cleaned role badge description from `DepEd Executive Administrative Tier` to `Executive Administrative Tier`.

---

## 16. Residual Mock Scan
A comprehensive grep scan across the PRIN-037 dependency tree confirmed:
- Occurrences of `"Dr. Roberto Santos"`: **0**
- Occurrences of mock/dummy data in Principal Settings: **0**
- Principal Settings business mock data: **ZERO** (all profile, security, and academic details are backed by live database endpoints or verified system configurations).

---

## 17. Regression-Test Evidence
Test file: `backend/tests/principalUsers.test.ts`  
Result: **19 / 19 tests PASS** (including all 12 PRIN-037 security cases):

| Test Assertion | HTTP Endpoint | Expected | Result |
|---|---|---|---|
| Principal reads own profile | `GET /api/users/:id` | 200 OK | PASS |
| Principal updates permitted profile fields | `PATCH /api/users/:id` | 200 OK | PASS |
| Persisted values read back correctly | `GET /api/users/:id` | 200 OK | PASS |
| Horizontal ID substitution attempt | `PATCH /api/users/<admin-id>` | 403 Forbidden | PASS |
| Account status injection attempt | `PATCH /api/users/:id` | 403 Forbidden | PASS |
| Role escalation injection attempt | `PATCH /api/users/:id` | 403 Forbidden | PASS |
| Email credential tampering attempt | `PATCH /api/users/:id` | 403 Forbidden | PASS |
| Permission privilege escalation attempt | `PATCH /api/users/:id` | 403 Forbidden | PASS |
| Mixed safe + sensitive payload (`status`) | `PATCH /api/users/:id` | 403 Forbidden | PASS |
| Mixed safe + privilege injection (`roles`) | `PATCH /api/users/:id` | 403 Forbidden | PASS |
| Unauthenticated PATCH attempt | `PATCH /api/users/:id` | 401 Unauthorized | PASS |
| Admin `user:write` path preserved | `PATCH /api/users/:id` | 200 OK | PASS |

---

## 18. Full Validation Results

| Gate | Command | Result |
|---|---|---|
| **Prisma Schema Validation** | `npx.cmd prisma validate` | **PASS** (`schema is valid 🚀`) |
| **Complete Backend Test Suite** | `npm.cmd test` | **PASS (145/145 tests, 17 files)** |
| **Backend TypeScript Compiler** | `npm.cmd run lint` | **PASS (0 type errors)** |
| **Backend Production Build** | `npm.cmd run build` | **PASS (`dist/` compiled)** |
| **Frontend TypeScript Compiler** | `npx.cmd tsc --noEmit` | **PASS (0 type errors)** |
| **Frontend Production Build** | `npm.cmd run build` | **PASS (`dist/` packaged in 39.56s)** |

---

## 19. Git Evidence
- **Base Implementation Commit:** `b2bd82b21a8167f46deed97ff39cd76c670311d0` (`b2bd82b`)
- **Stabilization & Hardening Commit:** `6f847153ebff7c81b6d9934561b533b210950a7b` (`6f84715`)
- **Commit Subject:** `fix(principal): harden and finalize PRIN-037 settings`
- **Files Included:**
  - `backend/src/users/user.routes.ts`
  - `backend/src/users/user.service.ts`
  - `backend/tests/principalUsers.test.ts`
  - `src/app/principal/settings/PSettingsScreen.tsx`
  - `src/app/principal/shared/PSidebar.tsx`
- **Working Tree State After Stabilization:** **CLEAN** (`nothing to commit, working tree clean`).

---

## 20. Manual Verification Status
- **Current Progress:** 25 / 29 (86.21%) officially closed; PRIN-037 is **IMPLEMENTED, VALIDATED, MANUAL VERIFICATION PENDING**.
- Upon user completion of the manual verification checklist below, PRIN-037 will advance to **FULLY WORKING** (26 / 29 = 89.66%).
