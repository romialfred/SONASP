import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const dir = path.resolve('docs/amelioration/preview-clients');
export default defineConfig({
  root: dir,
  envDir: dir,
  plugins: [react()],
  publicDir: path.resolve('public'),
  resolve: { alias: [
    { find: '@/contexts/AuthContext', replacement: path.join(dir, 'auth.ts') },
    { find: '@/lib/supabase', replacement: path.join(dir, 'supabase.ts') },
    { find: '@/services/customerDossierService', replacement: path.join(dir, 'customer-service.ts') },
    ...['@/services/modulesService', '@/services/notificationsService', '@/hooks/useCoursOr', '@/services/liveGoldPriceService'].map(find => ({ find, replacement: path.join(dir, 'shell-services.ts') })),
    { find: '@', replacement: path.resolve('src') },
  ] },
  server: {
    host: '127.0.0.1', port: 5187, strictPort: true, hmr: false,
    fs: { allow: [path.resolve('.')] },
    headers: {
      'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'self'",
      'Cache-Control': 'no-store',
    },
  },
});
