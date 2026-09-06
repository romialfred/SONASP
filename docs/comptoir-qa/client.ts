import { createClient } from '@supabase/supabase-js';
// Véritable SDK ; seules l’authentification et la base sont isolées de la production.
export const supabase=createClient('http://127.0.0.1:5185','fixture-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
supabase.auth.getSession=async()=>({data:{session:null},error:null});
supabase.auth.getUser=async()=>({data:{user:null},error:null});
