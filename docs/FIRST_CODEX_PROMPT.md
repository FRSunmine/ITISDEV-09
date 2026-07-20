# First Codex task

Inspect this repository and complete **Phase 0 plus the smallest safe part of Phase 1**.

## Objective
Make the existing static SideQuest prototype run reliably in Vite and establish working demo navigation without redesigning or converting it to React.

## Required work
1. Read `AGENTS.md`, `docs/PRODUCT_SCOPE.md`, `docs/SCREEN_AND_ROUTE_MAP.md`, and `docs/IMPLEMENTATION_PLAN.md`.
2. Run `npm install`, `npm run dev`, and `npm run build`.
3. Inspect every HTML page for missing local assets, incorrect relative paths, invalid scripts, and console errors.
4. Fix only baseline issues required for all canonical pages to load.
5. Update the login demo so:
   - selecting Student Freelancer and submitting routes to `/pages/student-dashboard.html`;
   - selecting Client routes to `/pages/client-dashboard.html`;
   - selecting Administrator routes to `/pages/admin-operations.html`.
6. Make the role selector visibly track the selected role and remain keyboard accessible.
7. Do not implement authentication, APIs, payments, RAG, MCP, a database, or React.
8. Do not redesign any page or consolidate Tailwind configs in this task.
9. Run `npm run build` after changes.

## Deliverable
Return:
- a short summary of what was fixed;
- files changed;
- commands/tests run and results;
- remaining broken links or console warnings;
- the recommended next single task.
