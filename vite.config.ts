import fs from 'node:fs';
import { defineConfig, loadEnv, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const PUBLIC_BASE_URL_ENV = 'SONASP_PUBLIC_BASE_URL';

const PUBLIC_SITEMAP_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/actualites', changefreq: 'weekly', priority: '0.8' },
  { path: '/assistance', changefreq: 'monthly', priority: '0.6' },
  { path: '/mentions-legales', changefreq: 'yearly', priority: '0.3' },
  { path: '/confidentialite', changefreq: 'yearly', priority: '0.3' },
  { path: '/conditions-utilisation', changefreq: 'yearly', priority: '0.3' },
  { path: '/securite', changefreq: 'yearly', priority: '0.4' },
] as const;

function getPublicBaseUrl(rawValue: string | undefined): string | undefined {
  const value = rawValue?.trim();
  if (!value) return undefined;

  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`${PUBLIC_BASE_URL_ENV} doit utiliser HTTPS.`);
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error(`${PUBLIC_BASE_URL_ENV} doit contenir uniquement l'origine publique, sans chemin ni paramètres.`);
  }

  return url.origin;
}

/**
 * Les sitemaps exigent des URL absolues. Ce plugin renseigne donc les fichiers
 * copiés depuis `public/` uniquement quand l'origine officielle a été fournie au
 * build. En son absence, aucun domaine supposé n'est publié.
 */
function publicSeoFilesPlugin(publicBaseUrl: string | undefined): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    name: 'sonasp-public-seo-files',
    configResolved(config) {
      resolvedConfig = config;
    },
    closeBundle() {
      const outputDirectory = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir);
      const indexPath = path.join(outputDirectory, 'index.html');
      const robotsPath = path.join(outputDirectory, 'robots.txt');
      const sitemapPath = path.join(outputDirectory, 'sitemap.xml');

      if (fs.existsSync(indexPath)) {
        const publicUrlMetadata = publicBaseUrl
          ? [
              `    <link rel="canonical" href="${publicBaseUrl}/" />`,
              `    <meta property="og:url" content="${publicBaseUrl}/" />`,
              `    <meta property="og:image" content="${publicBaseUrl}/login-faso/faso-sanama.png" />`,
              '    <meta property="og:image:alt" content="Faso SANAMA, plateforme de la Présidence du Faso" />',
              `    <meta name="twitter:image" content="${publicBaseUrl}/login-faso/faso-sanama.png" />`,
              '    <meta name="twitter:image:alt" content="Faso SANAMA, plateforme de la Présidence du Faso" />',
            ].join('\n')
          : '';
        const index = fs
          .readFileSync(indexPath, 'utf8')
          .replace('    <!-- SONASP_PUBLIC_URL_METADATA -->', publicUrlMetadata);
        fs.writeFileSync(indexPath, index, 'utf8');
      }

      if (fs.existsSync(robotsPath)) {
        const directive = publicBaseUrl
          ? `Sitemap: ${publicBaseUrl}/sitemap.xml`
          : '# Sitemap non déclaré : SONASP_PUBLIC_BASE_URL doit être renseignée au build.';
        const robots = fs
          .readFileSync(robotsPath, 'utf8')
          .replace('# SONASP_SITEMAP_DIRECTIVE', directive);
        fs.writeFileSync(robotsPath, robots, 'utf8');
      }

      if (fs.existsSync(sitemapPath)) {
        const urls = publicBaseUrl
          ? PUBLIC_SITEMAP_ROUTES.map(({ path: routePath, changefreq, priority }) =>
              [
                '  <url>',
                `    <loc>${publicBaseUrl}${routePath}</loc>`,
                `    <changefreq>${changefreq}</changefreq>`,
                `    <priority>${priority}</priority>`,
                '  </url>',
              ].join('\n'),
            ).join('\n')
          : '';
        const sitemap = fs
          .readFileSync(sitemapPath, 'utf8')
          .replace('  <!-- SONASP_SITEMAP_URLS -->', urls);
        fs.writeFileSync(sitemapPath, sitemap, 'utf8');
      }
    },
  };
}

/**
 * Un fichier minuscule, différent à chaque build, entre dans le manifeste
 * Workbox. Ainsi une livraison qui ne modifie que le portail privé produit tout
 * de même un nouveau worker et une transition de version unique et atomique.
 */
function buildVersionPlugin(buildId: string): Plugin {
  return {
    name: 'sonasp-build-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-version.json',
        source: `${JSON.stringify({ buildId })}\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SONASP_');
  const publicBaseUrl = getPublicBaseUrl(env[PUBLIC_BASE_URL_ENV]);
  const sourceRevision = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local';
  const buildId = `${sourceRevision}-${Date.now().toString(36)}`;

  return {
  plugins: [
    react(),
    publicSeoFilesPlugin(publicBaseUrl),
    buildVersionPlugin(buildId),
    VitePWA({
      // Une version attend la confirmation explicite de l'utilisateur. Le hook
      // React `virtual:pwa-register/react` est l'unique point qui demande son
      // activation ; aucun focus, retour d'onglet ou retour réseau ne recharge.
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
        'sonasp_logo.png',
      ],
      manifest: {
        id: '/',
        name: 'Faso SANAMA — Traçabilité du secteur minier',
        short_name: 'Faso SANAMA',
        description: 'Plateforme de la Présidence du Faso pour la traçabilité du secteur minier.',
        lang: 'fr-BF',
        start_url: '/',
        scope: '/',
        theme_color: '#006533',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Le worker reste en attente. Après le clic « Mettre à jour », le hook
        // lui envoie SKIP_WAITING. `clientsClaim` peut notifier tous les onglets,
        // mais `PwaUpdatePrompt.onNeedReload` interdit désormais tout reload dans
        // ceux qui n'ont pas eux-mêmes demandé l'activation.
        skipWaiting: false,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // Large application bundle and PDF.js library
        // Les images éditoriales et les captures métier ne doivent pas toutes
        // être téléchargées lors de l'installation du service worker.
        // Le cache d'installation reste volontairement réduit au noyau et à la
        // vitrine. Les dizaines d'écrans métier sont désormais chargés à la
        // demande ; les précacher annulerait le gain et téléchargerait plusieurs
        // mégaoctets dès la première visite.
        globPatterns: [
          'build-version.json',
          'assets/Public*.js',
          'assets/Public*.css',
          '**/*.{ico,woff,woff2}',
        ],
        // Le shell authentifié et son index ne sont jamais servis depuis le
        // précache. Chaque rechargement complet obtient donc la version Vercel
        // actuelle, tandis que les ressources publiques statiques restent PWA.
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.(?:js|css)$/i,
            // Les noms de fichiers portent leur empreinte de contenu : un cache
            // immuable par URL ne peut pas confondre deux versions du code.
            handler: 'CacheFirst',
            options: {
              cacheName: 'sonasp-route-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  /**
   * Journalisation : les appels `console.*` et `debugger` sont retires du bundle de
   * production. Ils restent disponibles en developpement. Repond au constat F14 de
   * l'audit (bruit et fuite d'informations en production) sans modifier le code applicatif.
   */
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  /**
   * Le port 5180 sert la plateforme locale compilée (`npm start`), sans client
   * de rechargement. Le développement HMR est isolé sur 5181 : une reconnexion
   * de son WebSocket ne doit pas réinitialiser les formulaires de l'usage local.
   */
  server: {
    // Le navigateur de travail utilise explicitement 127.0.0.1. Sans cette
    // adresse, Node peut n'écouter que sur ::1 et laisser l'onglet en erreur
    // malgré un serveur annoncé comme démarré.
    host: '127.0.0.1',
    port: 5181,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
};
});
