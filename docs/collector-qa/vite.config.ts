import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({root:path.resolve('docs/collector-qa'),plugins:[react()],publicDir:path.resolve('public'),resolve:{alias:[
 {find:'@/contexts/AuthContext',replacement:path.resolve('docs/collector-qa/mock-auth.ts')},
 {find:'@/lib/supabase',replacement:path.resolve('docs/collector-qa/mock-supabase.ts')},
 {find:'@/services/collectorService',replacement:path.resolve('docs/collector-qa/mock-service.ts')},
 {find:'@/services/artisanDocumentService',replacement:path.resolve('docs/collector-qa/mock-documents.ts')},
 {find:'@',replacement:path.resolve('src')},
]},server:{host:'127.0.0.1',port:5183,strictPort:true,fs:{allow:[path.resolve('.')]}}});
