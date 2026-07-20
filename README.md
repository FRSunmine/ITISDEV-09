# SideQuest Prototype

A desktop-first static prototype for a campus-focused student micro-freelancing platform. The current repository contains the approved Stitch-exported screens, styles, Tailwind runtime configurations, and basic demo interactions.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The root page redirects to `pages/login.html`.

## Production build

```bash
npm run build
npm run preview
```

Vite builds `index.html` and every approved screen in `pages/` as separate HTML entry points. Local JavaScript referenced from those pages, including the page-level Tailwind configuration files, must use `<script type="module" src="...">` so Vite includes them in its asset graph. Stylesheets should remain linked with paths relative to each HTML page.

The production build was last verified successfully on July 20, 2026.

## Current phase

The immediate goal is to make the static multipage prototype coherent and navigable. Backend integration, real authentication, database work, payments, and AI features are intentionally deferred.

## Next milestone

- Smoke-test navigation and interactions across all built pages.
- Fix broken links or browser console errors without changing the approved visual design.
- Keep using mock data and external payment handling for the current MVP.

## Maintenance

Update this README whenever setup, build behavior, project structure, supported flows, or known limitations change.

## Key documents

- `AGENTS.md` — Codex repository instructions
- `docs/PRODUCT_SCOPE.md` — MVP boundaries
- `docs/SCREEN_AND_ROUTE_MAP.md` — canonical screens and intended routes
- `docs/IMPLEMENTATION_PLAN.md` — phased work plan
- `docs/FIRST_CODEX_PROMPT.md` — first task to paste into Codex
"# ITISDEV-09" 
