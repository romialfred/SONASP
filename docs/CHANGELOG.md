# Changelog

## Unreleased

- Added application-wide error boundaries and suspense fallbacks to prevent white screens during route failures.
- Hardened Sales dashboard and Sale details pages with Zod-based validation, explicit loading/error states, and retry affordances.
- Normalized Supabase Edge Function handling via `safeFetch`, preventing undefined response usage in the User Management module.
- Introduced reusable sales data schemas (`src/lib/schemas/sales.ts`) and updated components to consume typed view models.
- Enabled type-aware ESLint rules (`no-floating-promises`, unsafe member access) to surface fragile patterns at lint time.
- Expanded automated coverage with vitest component tests for the Sales flows and improved documentation (`docs/analysis.md`).
