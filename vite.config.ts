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
              `    <meta property="og:image" content="${publicBaseUrl}/og.png" />`,
              '    <meta property="og:image:alt" content="Identité visuelle de la plateforme nationale SONASP" />',
              `    <meta name="twitter:image" content="${publicBaseUrl}/og.png" />`,
              '    <meta name="twitter:image:alt" content="Identité visuelle de la plateforme nationale SONASP" />',
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SONASP_');
  const publicBaseUrl = getPublicBaseUrl(env[PUBLIC_BASE_URL_ENV]);

  return {
  plugins: [
    react(),
    publicSeoFilesPlugin(publicBaseUrl),
    VitePWA({
      // `autoUpdate` rechargeait la page des qu'un nouveau service worker etait
      // detecte : sur un deploiement frequent, l'application se rafraichissait
      // seule, en pleine saisie, sans que rien ne l'annonce. `prompt` installe la
      // mise a jour sans jamais recharger de lui-meme.
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
        name: 'SONASP — Plateforme nationale de collecte et de vente de l’or',
        short_name: 'SONASP',
        description: 'Plateforme nationale sécurisée de collecte, d’achat et de vente de l’or au Burkina Faso.',
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
        // Une nouvelle version attend la prochaine navigation complète. Elle ne
        // prend jamais le contrôle d'un onglet actif et ne force aucun refresh.
        skipWaiting: false,
        clientsClaim: false,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // Large application bundle and PDF.js library
        // Les images éditoriales et les captures métier ne doivent pas toutes
        // être téléchargées lors de l'installation du service worker.
        // Le cache d'installation reste volontairement réduit au noyau et à la
        // vitrine. Les dizaines d'écrans métier sont désormais chargés à la
        // demande ; les précacher annulerait le gain et téléchargerait plusieurs
        // mégaoctets dès la première visite.
        globPatterns: [
          'index.html',
          'registerSW.js',
          'assets/index-*.{js,css}',
          'assets/Public*.js',
          'assets/public-*.css',
          '**/*.{ico,woff,woff2}',
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
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
   * Port fixe : le poste de developpement heberge d'autres projets Vite qui occupent
   * le 5173 par defaut. Un port dedie evite que l'apercu pointe sur une autre application.
   */
  server: {
    // Le navigateur de travail utilise explicitement 127.0.0.1. Sans cette
    // adresse, Node peut n'écouter que sur ::1 et laisser l'onglet en erreur
    // malgré un serveur annoncé comme démarré.
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts réexporte plusieurs primitives qui s'importent entre elles.
        // Les laisser réparties entre les chunks de pages produit des cycles de
        // chargement Rollup. Toutes les primitives du paquet restent donc dans
        // un même chunk, chargé uniquement par les vues qui affichent un graphe.
        manualChunks(id) {
          if (id.includes('/node_modules/recharts/')) return 'recharts';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
};
});
