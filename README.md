# SideQuest

SideQuest is a campus micro-freelancing platform connecting verified student freelancers with
clients offering short-term quests. It uses a Vite multipage frontend, Express API, and SQLite.

## Setup

Requires Node.js 24+ and npm 11+.

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The local database is created at `data/sidequest.db`.
Frontend changes reload automatically while the development server is running.

## Demo accounts

All demo accounts use `SideQuest123!`.
The login page also provides one-click Student, Client, and Administrator demo buttons.

| Role | Email |
|---|---|
| Student (main) | `student@dlsu.edu.ph` |
| Student (completed work) | `jamie.cruz@dlsu.edu.ph` |
| Student (multimedia profile) | `sam.lee@dlsu.edu.ph` |
| Student (pending verification) | `nina.patel@dlsu.edu.ph` |
| Client (main) | `client@sidequest.demo` |
| Client (active/completed quests) | `luis@sidequest.demo` |
| Client (open quest) | `bea@sidequest.demo` |
| Administrator | `admin@sidequest.demo` |

## Commands

```powershell
npm run dev      # Start frontend and API
npm test         # Run backend integration tests
npm run build    # Verify the production frontend build
npm run db:reset # Reset and reseed the local database
npm start        # Serve the built app at http://localhost:3000
```

Run `npm run build` before `npm start`. You do not need to build after every development change.

## Testing

Run the automated checks:

```powershell
npm test
npm run build
```

For manual testing, use separate regular/private browser windows for different roles:

1. Register a student, submit verification details, and approve the student as an administrator.
2. Create a quest as a client and apply as the verified student.
3. Accept the student, submit and approve all deliverables, then complete the quest.
4. Review from both accounts and confirm the student's portfolio and admin analytics update.
5. Check navigation, dark mode, refresh behavior, and mobile layout for visual issues.

To reset local test data, stop the server and run:

```powershell
npm run db:reset
```

This permanently removes local changes and recreates the database with the sample data.

## MVP features

- Student and client registration with role-based login and protected sessions
- Student verification and verified-only quest applications
- Quest discovery, creation, applications, and applicant selection
- Client talent discovery, full profile review, and quest invitations
- Dedicated student application history and quest conversations
- Student/client workspaces with deliverable review and completion
- Participant reviews and automatic verified portfolio entries
- Client dashboard and administrator operations/analytics
- Persistent SQLite data and account-based preferences
- Student/client issue reporting with administrator resolution

## Current status

The core end-to-end workflow is functional and covered by integration tests. Remaining proposal
work is:

1. A decision on whether skill tags require an administrator-managed taxonomy.

See `docs/MVP_CHECKLIST.md` for acceptance-level status and release checks.

## Limitations

- Real-time messaging, notifications, uploads, password reset, and email delivery are not implemented.
- Payments are external; SideQuest does not process or hold funds.
- AI matching, RAG, MCP, blockchain, and escrow are outside the MVP.
- SQLite is intended for local/course use rather than production scaling.

## Documentation

- `docs/BACKEND.md` - API reference
- `docs/MVP_CHECKLIST.md` - proposal acceptance status and next priorities
- `docs/PRODUCT_SCOPE.md` - MVP scope
- `docs/SCREEN_AND_ROUTE_MAP.md` - screens and routes
- `docs/IMPLEMENTATION_PLAN.md` - completed work and release hardening
