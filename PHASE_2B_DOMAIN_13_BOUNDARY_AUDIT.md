# Domain 13: Document Requests Boundary Design Audit

## 1. Mapped Dependencies

| Consumer | Portal | Reads | Creates | Updates | Direct API? |
|---|---|---|---|---|---|
| `RDashboard.tsx` | Registrar | Yes | No | No | No (uses AppContext) |
| `RDocRequestsScreen.tsx` | Registrar | Yes | No | Yes | No (uses AppContext) |
| `DocRequestsScreen.tsx` | Teacher | Yes | No | Yes | No (uses AppContext) |
| `PDocRequestsScreen.tsx` | Principal | No | No | No | Yes (`apiClient.get`, `apiClient.patch`) |
| `StudentDocRequests.tsx` | Student | No | No | No | Yes (`studentApi.getDocumentRequests`, `apiClient.post`) |

*Note: The Principal and Student portals have already evolved completely away from AppContext and are fetching and modifying Document Requests directly through the authoritative backend API.*

## 2. Backend Authority
The `DocumentRequest` model is fully PostgreSQL-authoritative.
- **Model:** `DocumentRequest` in `prisma/schema.prisma`
- **GET Endpoint:** `/student-services/doc-requests` (and `/documents/requests/student/:id` for students)
- **POST Endpoint:** `/student-services/doc-requests`
- **PATCH Endpoint:** `/documents/requests/:id`
- **Statuses Supported:** "Submitted", "Teacher Approved", "Teacher Rejected", "Principal Approved", "Principal Rejected", "Ready for Pickup", "Completed"
- **Data Shape:** Includes document ID, purposes, status, remarks, and approval timestamps.
- **Attachments:** Yes, through `/documents/upload` and `attached_document_id`.

## 3. Current AppContext Behavior
Currently, `AppContext.tsx`:
- **Initial Fetch:** `apiClient.get('/student-services/doc-requests')`
- **Response Transformation:** None
- **Optimistic Updates:** Yes, `updateDocumentRequest` patches the backend and then manually updates the local cache array. `addDocumentRequest` posts to the backend and manually prepends to the array.
- **Sorting/Filtering:** None (done downstream in components).
- **Refetching:** None. It relies purely on the optimistic manual cache mutations.

## 4. Does Synchronized Frontend State Matter?
**No.**
The active AppContext consumers are:
1. Registrar Dashboard
2. Registrar Document Requests
3. Teacher Document Requests

The Teacher and Registrar are entirely different authenticated roles and portals. They **never** share the same React tree/session at the same time. The only components that could theoretically share the same React session are `RDashboard` and `RDocRequestsScreen`, but `RDashboard` only displays a static metric (`pendingDocs.length`) on load.

## 5. Mutation Synchronization
If a Teacher approves a document request on `DocRequestsScreen.tsx`, they update the `AppContext` array. Does this instantly update the Registrar Dashboard?
No! The Teacher and Registrar are different browser sessions for different human beings. Real-time synchronization between them requires WebSockets/SSE or polling the authoritative database, NOT a shared React Context. 
The shared React Context only synchronizes the array *within* the Teacher's own browser tab, which is completely unnecessary since they only have one screen for Document Requests.

## 6 & 11. Architecture Evaluation & Recommendation

**OPTION A — Keep in root AppContext**
*Rejected.* It is already bypassed by Principal and Student portals, and the Registrar and Teacher have no reason to share React Context state.

**OPTION B — Document Requests domain context (e.g. Registrar/Principal Context)**
*Rejected.* It adds unnecessary Provider nesting for screens that don't need simultaneous synchronization.

**OPTION C — Feature-owned API/hooks with local state (RECOMMENDED)**
Since the Student and Principal screens already independently use `apiClient.get('/student-services/doc-requests')`, the Registrar and Teacher screens should do the exact same. 

**Recommendation: EXTRACT TO FEATURE-OWNED API/LOCAL STATE**
We should completely remove `documentRequests` from `AppContext`. `RDashboard`, `RDocRequestsScreen`, and `DocRequestsScreen` (Teacher) should simply fetch their own authoritative data on mount using `apiClient.get()` or a custom hook like `useDocumentRequests()`, mirroring what the Principal portal already does. 
This removes the false illusion of cross-portal reactivity and correctly delegates authority to the PostgreSQL backend.

## 7. Avoid Unnecessary Abstraction
No new state management libraries (Zustand, Redux) are needed. Simple `useState` and `useEffect` with standard `apiClient` fetch calls are sufficient.

## 8. API Duplication
Currently:
- `PDocRequestsScreen.tsx` calls `apiClient.get('/student-services/doc-requests')`
- `StudentDocRequests.tsx` calls `studentApi.getDocumentRequests()`
- `AppContext.tsx` calls `apiClient.get('/student-services/doc-requests')`
Moving Registrar and Teacher away from AppContext would add two more independent fetch calls. A shared custom hook `useDocumentRequests()` could reduce this duplication across all portals later, but simple independent `fetch` calls are perfectly fine for now.

## 9. Types
The types `DocumentRequest` and `DocRequestStatus` currently live in `AppContext.tsx`. 
Because this data is genuinely consumed by all four portals (Principal, Registrar, Teacher, Student), these types are truly global DTOs representing a core database model. They should be relocated to `src/app/shared/types/index.ts`.

## 10. Runtime Behavior That Must Be Preserved
If we extract Domain 13, we must preserve:
- The pending/processed filtering logic in Registrar/Teacher screens.
- The PATCH mutations (`Teacher Approved`, `Principal Approved`) and optimistic or refetched UI updates.
- The `isCurrentTeacher` filtering in the Teacher screen.
- The Registrar Dashboard's `pendingDocs` KPI calculation.

## 12. Reassess Phase 2B Stop Point
Because Domain 13 (Document Requests) does not require a shared React Context and is already independently fetched by half the application, **it SHOULD be extracted out of AppContext.**

Once Document Requests are extracted (Option C), Phase 2B should **STOP**. The remaining properties in `AppContext` (Gate Attendance SSE, Announcements, Global Users Directory, Notifications/Messages, Auth) are genuinely cross-portal, highly reactive, or core infrastructure state.
