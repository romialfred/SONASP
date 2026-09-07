import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { affiliationWorkflowServer } from './workflow-server.mjs';
export default defineConfig({
  root:path.resolve('docs/affiliation-qa'),
  plugins:[affiliationWorkflowServer(path.resolve('.')),react()],
  publicDir:path.resolve('public'),
  resolve:{alias:[
    {find:'@/contexts/AuthContext',replacement:path.resolve('docs/affiliation-qa/workflow-auth.ts')},
    {find:'@/lib/supabase',replacement:path.resolve('docs/affiliation-qa/workflow-supabase.ts')},
    {find:'@',replacement:path.resolve('src')},
  ]},
  server:{host:'127.0.0.1',port:5185,strictPort:true,fs:{allow:[path.resolve('.')]},hmr:false},
});
