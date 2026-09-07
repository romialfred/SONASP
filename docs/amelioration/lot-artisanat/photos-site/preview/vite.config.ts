import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const dir = path.resolve('docs/amelioration/lot-artisanat/photos-site/preview');
export default defineConfig({
  root: dir, envDir: dir, plugins: [react()], publicDir: path.resolve('public'),
  resolve: { alias: [
    { find: '@/contexts/AuthContext', replacement: path.join(dir, 'auth.ts') },
    { find: '@/lib/supabase', replacement: path.join(dir, 'transport.ts') },
    { find: '@/services/artisanalSiteService', replacement: path.join(dir, 'site-service.ts') },
    { find: '@/services/siteAeaDocumentService', replacement: path.join(dir, 'aea-service.ts') },
    ...['@/services/modulesService', '@/services/notificationsService', '@/hooks/useCoursOr', '@/services/liveGoldPriceService'].map(find => ({ find, replacement: path.resolve('docs/amelioration/preview-clients/shell-services.ts') })),
    { find: '@', replacement: path.resolve('src') },
  ] },
  server: { host: '127.0.0.1', port: 5188, strictPort: true, hmr: false,
    fs: { allow: [path.resolve('.')] },
    headers: {
      'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'self'",
      'Cache-Control': 'no-store',
    },
  },
});
