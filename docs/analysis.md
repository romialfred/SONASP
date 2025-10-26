# Analysis & Findings

## Architecture Overview

- **Framework & bundler:** React 18 rendered through Vite with TypeScript. Styling relies on Tailwind CSS utility classes.
- **Routing:** `react-router-dom` is used in `App.tsx` to declare an extensive set of routes. Authentication gates routes via a custom `ProtectedRoute` component that reads from the `AuthContext` provider.
- **State management:** Authentication state lives inside `AuthContext`, which coordinates with Supabase for session handling and profile loading. Most feature pages manage their own local UI state with React hooks.
- **API layer:** Supabase is accessed directly through the generated client (`supabase.from(...).select(...)`). Prior to this hardening pass, callers assumed the shape of the response and rarely guarded against null/undefined payloads.
- **Layout:** `MainLayout` renders a persistent header plus sidebar navigation (`AccordionSidebar`). Many high-level pages wrap their content with this layout.

## Root Cause Analysis

1. **Blank sales detail view & `status` errors**
   - `SaleDetails` initialized `sale` with `null` but computed `const status = statusConfig[sale.status]` before the asynchronous fetch resolved. During the initial render `sale` was still `null`, triggering `Cannot read properties of null (reading 'status')`, which React surfaced as a white screen.
   - `SalesDashboard` exhibited similar fragility: it mapped Supabase rows directly without validating the presence of `status`, leading to inconsistent UI states when the field was missing.

2. **Silent fetch failures cascading into logouts**
   - The User Management page executed a raw `fetch` against a Supabase Edge Function and immediately logged `response.status`. When the network call failed (e.g., connectivity, CORS, or 401), `response` was undefined and the logging line itself threw, short-circuiting the component and leaving the app in an apparently logged-out state.

3. **Missing error boundaries**
   - No top-level error boundary existed. Any unhandled render error (including the `status` issue above) bubbled to the root and left the viewport blank without context, giving the impression of an expired session.

## Fragile Areas

- **Auth initialization path:** `AuthContext` fetches the user profile and starts a session manager. Network delays or Supabase outages can leave the UI in a loading state. Guards are now in place, but further changes to the auth flow should respect the mounted checks already present.
- **Supabase data parsing:** Many pages depend on nested joins (`customer:customers(...)`). These results can be `null`. Future work with these datasets should reuse the new Zod schemas or extend them, rather than reintroducing unchecked property access.
- **Custom fetches / edge functions:** Any new calls to Supabase Edge Functions should go through `safeFetch` (or a similar abstraction) to ensure consistent error objects and avoid propagating undefined responses into the UI.
- **Layout side effects:** `AccordionSidebar` interacts with `localStorage` and DOM events. Unit tests mock `MainLayout` to avoid this complexity; UI changes in the layout should maintain compatibility with those mocks or update the tests.

## Behavior Summary

| Scenario | Previous Behavior | Current Behavior |
| --- | --- | --- |
| Navigate to `/sales/:id` | White screen, console `Cannot read properties of null (reading 'status')` | Sale details render or a descriptive inline error with retry/back actions |
| Navigate to Sales dashboard when Supabase returns incomplete rows | Rendering inconsistencies and occasional crashes | Sales cards render with normalized statuses; errors surface via an inline alert without breaking navigation |
| Fetch User Management data with failing Edge Function | Runtime error when logging `response.status`, sidebar becomes unresponsive | Error is captured, toast message displayed, UI remains interactive |
| Unexpected runtime error in any route | Entire screen blanks out | Route-level error boundary shows a recovery UI and allows retry |

## Runbook

1. **Reproducing navigation failures**
   - Run `npm run dev` with valid Supabase environment variables.
   - Navigate via the sidebar to Sales → choose any sale detail or open the User Management page.
   - Disconnect the network or tamper with the Supabase function to simulate failures; observe the new inline alerts instead of blank screens.

2. **Diagnostics checklist**
   - Check browser console for messages emitted from `RouteErrorBoundary` or the feature page (they log structured errors now).
   - Inspect the toast notifications—`UserManagement` surfaces Edge Function errors there.
   - For data issues, enable logging inside `saleDetailSchema`/`saleSummaryListSchema` by inspecting the console output (they log validation failures with context).

3. **Mitigation steps**
   - Use the inline “Retry” buttons provided in the Sales pages to re-trigger the fetch after transient failures.
   - If Supabase credentials are missing, populate `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and restart the dev server.
   - For persistent API validation errors, update the relevant Zod schema (`src/lib/schemas/sales.ts`) to match the backend contract before redeploying.

4. **Regression prevention**
   - Run `npm run lint` to catch unsafe property access or unhandled promises—new ESLint rules are enforced.
   - Execute `npm run test` to run the vitest suite, including component-level regression tests that guard against the previous blank-screen scenarios.
   - Review `docs/CHANGELOG.md` for a summary of the hardening work and ensure new features maintain the documented patterns.
