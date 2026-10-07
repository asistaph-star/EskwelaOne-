# DigiSkwela Deployment Readiness Guide

This guide outlines the production deployment strategy for the DigiSkwela backend and Gate Terminal, with a specific focus on the Campus Media functionality.

## Local Development
For local testing and development, no explicit storage configuration is necessary.

1. **Install Dependencies:** `npm install` in both root and `backend` directories.
2. **Database Setup:** Ensure a local PostgreSQL server is running. Set `DATABASE_URL` in `backend/.env`.
3. **Migrate Database:** Run `npm run db:migrate` from the `backend` directory to apply schema changes.
4. **Backend Startup:** Run `npm run dev` in the `backend`.
5. **Local Media Storage:** By default, uploaded media will be securely saved to `backend/storage/documents`. This directory is automatically created at startup.

## Production Requirements

### 1. PostgreSQL Database
You must provision a remote PostgreSQL database (e.g., Supabase, Neon, AWS RDS, Render Postgres).
- **Environment Variable:** `DATABASE_URL`
- Provide the full connection string to your production database.

### 2. Persistent Media Storage
The current Campus Media implementation utilizes local filesystem storage. **This architecture requires a persistent disk mount in production.**
- **Environment Variable:** `MEDIA_STORAGE_PATH`
- **If deploying to Render/Railway:** You MUST attach a Persistent Disk to your backend service and map its absolute path to `MEDIA_STORAGE_PATH` (e.g., `/var/data/media`). Without this, uploaded files will vanish upon the next deployment or container restart.
- **If deploying to Vercel/Serverless:** The current backend file-writing architecture is fundamentally incompatible with ephemeral serverless functions. You will need to replace the local `fs` calls in `media.routes.ts` with an object storage integration (e.g., AWS S3, Vercel Blob) before deploying to Vercel. 

### 3. Migration Command
Always use the formal migration command in production to prevent schema drift and accidental data loss:
- `npx prisma migrate deploy` or `npm run db:deploy`

## Deployment Sequence
When deploying to a containerized or persistent environment (like Render), follow this conceptual sequence:

1. **Provision Infrastructure:** Create the PostgreSQL instance and Persistent Media volume.
2. **Configure Environment:** Set `DATABASE_URL`, `MEDIA_STORAGE_PATH`, `JWT_SECRET`, etc.
3. **Install Dependencies:** `npm ci`
4. **Build Backend:** `npm run build`
5. **Database Migration (CRITICAL):** Run `npm run db:deploy` (this should be configured as a pre-deploy or build step).
6. **Start Application:** `npm start` (starts the Express server).
7. **Deploy Frontend:** Build and host the frontend independently if desired.

## Future Object Storage Compatibility
If you decide to migrate from local persistent disk to S3/Object Storage later:
- **Tightly Coupled Areas:** The Express route handlers (`backend/src/admin/media.routes.ts` and `document.routes.ts`) heavily use `fs.writeFileSync`, `fs.unlinkSync`, and `res.sendFile()`. These operations will need to be replaced with S3 SDK calls (e.g., `s3.putObject`, `s3.deleteObject`).
- **Isolated Areas:** The Prisma models (`CampusMedia`, `Document`) and the Frontend applications (Gate Terminal, Admin Portal) are fully decoupled. They simply rely on the `storage_key` and API endpoints, requiring **no changes** if the underlying storage layer changes.

## Health and Resiliency
- **Backend Health Check:** Available at `/api/health`.
- **Attendance Isolation:** The physical Gate Terminal attendance scanning logic is strictly isolated from Campus Media playback. If the media storage directory fails or is unconfigured, the Gate Terminal will seamlessly fall back to its standard "Ready to Scan" interface, ensuring core attendance operations remain uninterrupted.

## Final Classification

| Area | Status |
| :--- | :--- |
| Feature functionality | PASS |
| Migration history | PASS |
| Storage path configurable | PASS |
| Local development fallback | PASS |
| Production persistent-storage requirement documented | PASS |
| Migration deployment command documented | PASS |
| Environment variables documented | PASS |
| Attendance isolated from media failure | PASS |
| Actual production host configured | NOT CONFIGURED |
| Actual production deployment performed | NOT PERFORMED |

**Status:** FEATURE COMPLETE — HOST-READY — PRODUCTION DEPLOYMENT NOT YET PERFORMED
