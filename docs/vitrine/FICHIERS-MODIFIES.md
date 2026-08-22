# Inventaire des fichiers de la livraison

Les documents métier déjà présents à la racine du dépôt n’ont pas été modifiés.

## Entrée applicative et routage

- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/PrivateApp.tsx`
- `src/pages/Login.tsx`
- `src/pages/auth/AuthCallback.tsx`
- `src/pages/auth/RecoverPassword.tsx`
- `src/pages/auth/UpdatePassword.tsx`

## Vitrine publique

- `src/pages/public/PublicHomePage.tsx`
- `src/pages/public/PublicLayout.tsx`
- `src/pages/public/PublicComponents.tsx`
- `src/pages/public/PublicLocaleContext.tsx`
- `src/pages/public/PublicNewsPage.tsx`
- `src/pages/public/PublicNewsDetailPage.tsx`
- `src/pages/public/PublicAssistancePage.tsx`
- `src/pages/public/PublicLegalPage.tsx`
- `src/pages/public/PublicNotFoundPage.tsx`
- `src/pages/public/publicContent.ts`
- `src/pages/public/publicNews.ts`
- `src/pages/public/publicSupport.ts`
- `src/pages/public/public-site.css`

## Portail Mine et sécurité

- `src/components/auth/MinePortalGuard.tsx`
- `src/pages/mine/MinePortalPage.tsx`
- `src/services/minePortalService.ts`
- `src/services/pdfParsingService.ts`
- `src/contexts/AuthContext.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/auth/PublicRoute.tsx`
- `src/lib/permissions.ts`
- `src/types/auth.ts`
- `src/components/layout/sidebarNavigation.ts`
- `supabase/migrations/20260821_031_portail_mine_securite.sql`

## Publications et assistance

- `src/pages/admin/PublicationsAdminPage.tsx`
- `supabase/migrations/20260821_032_vitrine_publique.sql`
- `supabase/functions/public-assistance/index.ts`

## SEO, PWA et configuration

- `src/components/seo/PageMetadata.tsx`
- `index.html`
- `vite.config.ts`
- `public/robots.txt`
- `public/sitemap.xml`
- `public/apple-touch-icon.png`
- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/pwa-maskable-512x512.png`
- `public/og.png`

## Ressources institutionnelles

- `public/institutional/armoiries-burkina-faso.png`
- `public/institutional/mine-hero-1600.avif`
- `public/institutional/mine-hero-1600.webp`
- `public/institutional/mine-hero-1600.jpg`
- `public/institutional/mine-hero-960.avif`
- `public/institutional/mine-hero-960.webp`

## Tests

- `src/components/auth/MinePortalGuard.test.tsx`
- `src/components/auth/ProfileGuard.test.tsx`
- `src/components/auth/PublicRoute.test.tsx`
- `src/components/seo/PageMetadata.test.tsx`
- `src/contexts/AuthContext.fallback.test.tsx`
- `src/lib/permissions.test.ts`
- `src/pages/mine/MinePortalPage.test.tsx`
- `src/pages/public/PublicHomePage.test.tsx`
- `src/pages/public/publicSupport.test.ts`
- `src/services/minePortalService.test.ts`

## Documentation et captures

- `docs/vitrine/README.md`
- `docs/vitrine/RAPPORT-COMPARAISON-VISUELLE.md`
- `docs/vitrine/RAPPORT-NON-REGRESSION.md`
- `docs/vitrine/RAPPORT-DEPENDANCES.md`
- `docs/vitrine/AUDIT-FINAL.md`
- `docs/vitrine/FICHIERS-MODIFIES.md`
- `docs/vitrine/captures/vitrine-1440.png`
- `docs/vitrine/captures/vitrine-1280.png`
- `docs/vitrine/captures/vitrine-1024.png`
- `docs/vitrine/captures/vitrine-768.png`
- `docs/vitrine/captures/vitrine-430.png`
- `docs/vitrine/captures/vitrine-390.png`
- `docs/vitrine/captures/vitrine-360.png`
