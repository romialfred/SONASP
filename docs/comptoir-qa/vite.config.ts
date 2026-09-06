import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { comptoirQaBackend } from './backend.mjs';
export default defineConfig({root:path.resolve('docs/comptoir-qa'),publicDir:path.resolve('public'),plugins:[react(),{name:'comptoir-qa-postgres',configureServer:comptoirQaBackend}],resolve:{alias:[
 {find:'@/contexts/AuthContext',replacement:path.resolve('docs/collector-qa/mock-auth.ts')},
 {find:'@/lib/supabase',replacement:path.resolve('docs/comptoir-qa/client.ts')},
 {find:'@',replacement:path.resolve('src')},
]},server:{host:'127.0.0.1',port:5185,strictPort:true,fs:{allow:[path.resolve('.')]}}});
