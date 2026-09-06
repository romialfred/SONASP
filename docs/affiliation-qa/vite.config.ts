import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  root: path.resolve('docs/affiliation-qa'), plugins: [react()], publicDir: false,
  resolve: { alias: [
    { find: '@/services/affiliationService', replacement: path.resolve('docs/affiliation-qa/mock-service.ts') },
    { find: '@', replacement: path.resolve('src') },
  ] },
  server: { host: '127.0.0.1', port: 5182, strictPort: true, fs: { allow: [path.resolve('.')] } },
});
