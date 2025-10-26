# GoldShipper

## Development Setup

```bash
npm install
npm run dev
```

The application relies on Supabase environment variables. Create a `.env.local` file populated with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before starting the dev server.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run test
```

The lint configuration enables type-aware rules that surface unsafe property access and unhandled promise rejections.

## Troubleshooting

- If protected routes redirect unexpectedly, confirm the Supabase session is available and that the environment variables are correct.
- When sales or admin pages show fallback messages, inspect the browser console and Supabase logs; the UI now surfaces errors without crashing.
- See `docs/analysis.md` for a detailed overview of the architecture, recent fixes, and a runbook for diagnosing navigation or data-loading issues.
