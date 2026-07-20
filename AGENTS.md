# SideQuest repository instructions

## Project map
- `pages/`: approved Stitch HTML screens.
- `assets/css/base.css`: global reset and accessibility rules.
- `assets/css/pages/`: page-specific styles.
- `assets/js/config/*.tailwind.js`: current page-level Tailwind design tokens.
- `assets/js/app.js`: shared demo UI interactions.
- `assets/js/pages/`: page-specific interactions.
- `assets/js/services/`: future API service layer; not active in the MVP UI.
- `docs/`: scope, route map, and implementation plan.

## Current objective
Turn the approved static Stitch export into a coherent, navigable SideQuest frontend while preserving visual parity. Work incrementally. Do not redesign the UI.

## MVP boundaries
- Campus-focused student micro-gig platform.
- Roles: student freelancer, client, administrator.
- Use mock data only for the current milestone.
- Payments are handled externally; SideQuest does not process or hold funds.
- Criteria coverage is rule-based, not AI matching.
- Do not implement RAG, MCP, escrow, payment gateways, blockchain, real authentication, or a database yet.
- `assets/js/services/rag-service.js` is experimental and must not be imported by production pages.

## Engineering rules
- First preserve the current static multipage application and make it run without broken links or console errors.
- Avoid broad rewrites. Make one focused change at a time.
- Do not replace the design with a component library.
- Keep the approved text, colors, spacing, and page hierarchy unless a task explicitly requests a change.
- Prefer shared utilities and data-driven navigation over copied event handlers.
- Use semantic HTML and retain keyboard-visible focus states.
- Do not remove responsive behavior.
- Before editing, inspect the relevant HTML, CSS, and Tailwind config.

## Commands
- Install: `npm install`
- Develop: `npm run dev`
- Build check: `npm run build`
- Preview production build: `npm run preview`

## Definition of done for each task
- Requested flow works in the browser.
- No new console errors.
- `npm run build` succeeds.
- Existing approved screens remain visually recognizable.
- Summarize changed files, behavior added, tests run, and remaining limitations.
