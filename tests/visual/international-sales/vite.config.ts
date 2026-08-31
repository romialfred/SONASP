import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Isolated component QA only. Not imported by the application or its Vite build.
const project = fileURLToPath(new URL('../../../', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: project,
  plugins: [react()],
  resolve: { alias: { '@': `${project}src` } },
  server: { host: '127.0.0.1', port: 5182, strictPort: true, fs: { allow: [project] } },
});
