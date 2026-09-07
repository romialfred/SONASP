import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const dir='docs/multiportail-qa';
export default defineConfig({root:path.resolve(dir),plugins:[react()],publicDir:path.resolve('public'),resolve:{alias:[{find:'@/contexts/AuthContext',replacement:path.resolve(dir,'auth.ts')},{find:'@/lib/supabase',replacement:path.resolve(dir,'supabase.ts')},...['@/services/modulesService','@/services/notificationsService','@/hooks/useCoursOr','@/services/liveGoldPriceService'].map(find=>({find,replacement:path.resolve(dir,'services.ts')})),{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:5186,strictPort:true,fs:{allow:[path.resolve('.')]},watch:{ignored:['**/docs/**/captures/**','**/reference.png']} }});
