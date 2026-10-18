# NMESIS Tracker

Production tracker for NMESIS MotionLab — the system the team works in (production runs the boards,
supervisors approve or send back, artists work their queue). Replaces ftrack as the source of truth;
ftrack is imported from, never written to.

Design: `docs/superpowers/specs/2026-10-18-production-tracker-design.md` · Plan: `docs/superpowers/plans/2026-10-18-production-tracker-mvp.md` · ftrack study: `research/ftrack-feature-map.md`.

## Run locally

    source ~/.nvm/nvm.sh
    cd "/Volumes/Extreme SSD/nmesis-tracker"
    npm run dev -- --port 3200        # http://localhost:3200

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` of the tracker's own Supabase project.

## Database (one-time, in the Supabase SQL editor)

1. `supabase/migrations/0001_tracker.sql`, then `0002_versions_asset.sql`.
2. Authentication → Users: create a login per manager (`<username>@nmesis.io` + password).
3. `supabase/seed-roster.sql` (re-runnable) — links logins to people and seeds the artists.
4. `npx tsx scripts/check-db.mts` — prints row counts; fails if a table is missing.

## Import from ftrack (read-only) and seed

    python3 scripts/import_ftrack.py project <ftrack project id>      # → data/seed/<code>.json; exits 2 on unmapped values
    npx tsx scripts/seed.mts data/seed/<code>.json                    # idempotent upsert on ftrack_id
    python3 scripts/import_ftrack.py pull-versions <ftrack project id> && npx tsx scripts/seed.mts data/seed/<code>.versions.json --versions-only

Mapping tables (statuses, version statuses, note labels, task types) live at the top of `scripts/import_ftrack.py`.

## Tests

    npm test                      # vitest (domain rules, planners, components)
    python3 -m unittest scripts/test_import_mapping.py

## Bundle size (next build, 2026-10-18)

18 client JS chunks, 730 KB raw, **220 KB gzipped in total** — so every route's client JS is well under the 300 KB gate (largest chunk 69 KB gz). No third-party UI libraries.
