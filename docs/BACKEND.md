# SideQuest backend

## Run locally

```powershell
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to Express on port `3000`.

## Demo accounts

All seeded accounts use `SideQuest123!`.

- Student: `student@dlsu.edu.ph`
- Client: `client@sidequest.demo`
- Administrator: `admin@sidequest.demo`

The SQLite database is created at `data/sidequest.db` and ignored by Git.

## Implemented API

- `GET /api/v1/health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/preferences`
- `PATCH /api/v1/preferences`
- `GET /api/v1/reports/me`
- `POST /api/v1/reports`
- `GET /api/v1/quests`
- `GET /api/v1/quests/:id`
- `POST /api/v1/quests`
- `POST /api/v1/quests/:id/applications`
- `GET /api/v1/applications/me`
- `GET /api/v1/client/dashboard`
- `GET /api/v1/client/profile`
- `PATCH /api/v1/client/profile`
- `GET /api/v1/client/applications`
- `PATCH /api/v1/client/applications/:id`
- `GET /api/v1/messages`
- `GET /api/v1/messages/:id`
- `POST /api/v1/messages/:id`
- `GET /api/v1/workspace`
- `PATCH /api/v1/workspace/deliverables/:id/submit`
- `PATCH /api/v1/workspace/deliverables/:id/review`
- `POST /api/v1/workspace/quests/:id/complete`
- `POST /api/v1/workspace/quests/:id/reviews`
- `GET /api/v1/profile/me`
- `PATCH /api/v1/profile/me/verification`
- `GET /api/v1/admin/operations`
- `PATCH /api/v1/admin/students/:id/verification`
- `PATCH /api/v1/admin/users/:id/status`
- `PATCH /api/v1/admin/reports/:id`
- `GET /api/v1/admin/analytics`

Run API tests with `npm test`. Build with `npm run build`, then run the production server with `npm start`.
Reset and reseed local demo data with `npm run db:reset` while the server is stopped.

Quest creation requires a client or administrator session plus `title`, `description`, `category`,
`budgetCents`, `deadline`, `workArrangement`, and non-empty `skills` and `deliverables` arrays.
Quest details and all metadata are committed together.

Client application endpoints only expose quests owned by the signed-in client. Accepting an
application rejects other pending applicants and moves the quest to `in_progress` atomically.
Accepting an application also creates its participant-only conversation. Students and clients can
list their conversations, read a thread, and send persisted text messages.

Workspace access follows the accepted application: students can submit or resubmit their own
deliverables, while quest owners can approve them or request revision. A client can complete a
quest only after every locked deliverable is approved.

Completing a quest atomically creates its verified student portfolio entry. Once completed, the
student and client may each submit one 1-5 rating for the other participant. The student profile
endpoint returns persisted profile details, skills, portfolio entries, received reviews, and the
aggregate rating.

Students submit university, course, bio, and up to 10 skills through the verification profile
endpoint. Submissions remain pending until an administrator verifies them; only verified students
can apply to quests. Editing an already verified profile does not remove its verified status.

Administrator endpoints expose the verification queue, account controls, auditable platform
totals, quest/application distributions, completion trends, and rule-based skill gaps. Suspended
accounts have their sessions invalidated and cannot sign in until restored.

## Current API limitations

- Quest discovery supports keyword search but not structured filter query parameters.
- There is no client-facing freelancer directory, public freelancer endpoint, or invitation flow.
- Messages are persisted and participant-only but use request/response updates rather than sockets.
- Deliverable submissions store links or notes; binary file storage is not implemented.
