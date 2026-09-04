import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Banc isolé : il utilise les vrais composants sans authentification ni écriture distante.
const project = fileURLToPath(new URL('../../../', import.meta.url));
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: `${project}public`,
  envDir: project,
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/components/layout/MainLayout', replacement: local('./mocks/MainLayout.tsx') },
      { find: '@/contexts/AuthContext', replacement: local('./mocks/AuthContext.ts') },
      { find: '@/hooks/useAlert', replacement: local('./mocks/useAlert.ts') },
      { find: '@/services/saleSimulationService', replacement: local('./mocks/saleSimulationService.ts') },
      { find: '@', replacement: `${project}src` },
    ],
  },
  server: { host: '127.0.0.1', port: 5183, strictPort: true, fs: { allow: [project] } },
});
