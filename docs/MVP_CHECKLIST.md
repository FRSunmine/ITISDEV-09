# SideQuest MVP checklist

This checklist aligns the current implementation with the four user stories and acceptance
criteria in the MCO1 project proposal.

Status key: **Complete**, **Partial**, **Not started**, **Release check**

## Proposal acceptance criteria

| Story | Acceptance criterion | Status | Evidence or remaining work |
|---|---|---|---|
| Student portfolio | Completed and approved quests are added automatically | **Complete** | Quest completion creates a verified portfolio entry atomically. |
| Student portfolio | Entries show the quest title, completion date, and client rating | **Partial** | Title and date appear on each entry; ratings appear in the profile review section rather than on the matching entry. |
| Student portfolio | Students can view all completed projects | **Complete** | The student profile renders all persisted portfolio entries. |
| Student portfolio | Clients can inspect a portfolio before hiring or inviting | **Partial** | Applicant review shows profile, skills, rating, and completed count, but not the full portfolio. Invitations are not implemented. |
| Freelancer discovery | Clients can search freelancers by keyword | **Not started** | There is no client freelancer directory. |
| Freelancer discovery | Clients can filter by skill, rating, experience, and availability | **Not started** | Add a persisted availability field, directory filters, and query support. |
| Freelancer discovery | Clients see matching freelancer results | **Not started** | Applicant comparison currently begins only after a student applies. |
| Freelancer discovery | Clients can inspect profiles and invite a freelancer | **Not started** | Add public client-facing profiles and an invitation workflow. |
| Structured selection | Quest creation requires skill tags and a deliverables checklist | **Partial** | Both are mandatory and become immutable after creation; skill tags are free-form rather than selected from a controlled taxonomy. |
| Structured selection | Selection matrix shows verification, history, and alignment | **Partial** | Verification, rating, completed count, and rule-based skill coverage are shown; full portfolio history is not shown in the matrix. |
| Structured selection | Selection starts work and locks communication/submissions to a workspace | **Partial** | Selection atomically starts the quest and creates a participant-only workspace and conversation. Deliveries use links/notes because file storage is outside the MVP. |
| Structured selection | Every deliverable must pass client review before closure | **Complete** | The API blocks completion until all locked deliverables are approved. |
| Quest discovery | Students can search by keyword | **Complete** | Server-side search covers title, description, category, client, and skills. |
| Quest discovery | Students can filter by skill, category, budget, deadline, and arrangement | **Complete** | Accessible marketplace controls submit structured API filters for all five criteria. |
| Quest discovery | Results reflect all selected filters | **Complete** | Filters combine server-side and are covered by an integration test. |
| Quest discovery | Cards show title, client, skills, budget, deadline, and arrangement | **Complete** | All required fields are rendered from persisted quest data. |

## Supporting MVP capabilities

- [x] Role-based registration, login, logout, sessions, and authorization
- [x] Student verification and administrator decisions
- [x] Quest creation, applications, applicant decisions, and status transitions
- [x] Participant-only persisted conversations and unread indicators
- [x] Deliverable submission, revision, approval, and quest completion
- [x] Participant reviews and verified portfolio generation
- [x] Student application history and profile editing
- [x] Client organization profile and settings
- [x] Administrator verification, reports, account moderation, and analytics
- [x] Account-scoped appearance, motion, visibility, and notification preferences
- [x] Seeded demo data and repeatable database reset
- [x] Backend integration tests and production build

## Next development priorities

1. Add the client freelancer directory, profile view, and invitations.
2. Show per-project client ratings on portfolio entries and full portfolio history during applicant review.
3. Decide whether standardized skill tags require a controlled administrator-managed taxonomy.

## Release checks

- [ ] Run manual acceptance tests in current Chrome, Edge, and Firefox.
- [ ] Verify every canonical page at mobile, tablet, laptop, and desktop widths.
- [ ] Complete keyboard, focus-order, form-label, contrast, and screen-reader checks.
- [ ] Verify a fresh database reset and all demo accounts.
- [ ] Define deployment configuration, database backup, logging, and recovery procedures.
