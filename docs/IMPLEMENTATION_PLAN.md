# Implementation plan

## Phase 0 — Baseline and inventory
- Install dependencies and run Vite.
- Open every canonical page.
- Record console errors, missing resources, and broken controls.
- Do not refactor yet.

## Phase 1 — Static navigation and demo behavior
- Make role buttons on login update the active role.
- Route demo login to the selected role dashboard.
- Replace sidebar `href="#"` values with canonical page routes.
- Wire dashboard actions to the appropriate pages.
- Verify quest drawer, application modal, applicant drawer, and confirmation modal.
- Keep all data static.

## Phase 2 — Consistency cleanup
- Centralize route constants and repeated navigation behavior.
- Consolidate duplicate interaction code.
- Identify a canonical set of design tokens without changing visual output.
- Preserve page-level Tailwind configs until parity is confirmed.

## Phase 3 — Component migration decision
Choose only after the static application is stable:
1. Keep the multi-page HTML architecture for the course prototype, or
2. Migrate incrementally to React/Vite with shared layouts and mock-data modules.

Do not begin a full React rewrite before Phase 1 is complete and visually verified.

## Phase 4 — Backend preparation
- Define data contracts for users, quests, applications, deliverables, reviews, and portfolio entries.
- Keep API access behind service modules.
- Add backend integration only when the frontend flow and course requirements are stable.
