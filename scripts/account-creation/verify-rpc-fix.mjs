import assert from 'node:assert/strict';
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {writeFileSync} from 'node:fs';
config({quiet:true});
const client=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:categories,error}=await client.from('snp_actor_categories').select('code').eq('is_active',true);
assert.ifError(error);
const results=[];
for(const category of categories){
 for(const fn of ['snp_access_resources_search','snp_access_compatible_portals']){
  const {data,error,status}=await client.rpc(fn,{p_category_code:category.code});
  assert.ifError(error);assert.equal(status,200);
  results.push({category:category.code,function:fn,status,count:data.length});
 }
}
const anon=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
for(const fn of ['snp_access_resources_search','snp_access_compatible_portals']){
 const {error}=await anon.rpc(fn,{p_category_code:'societe-miniere'});assert.ok(error);results.push({function:fn,anonymousDenied:true});
}
const receipt={checkedAt:new Date().toISOString(),migration:'20260906073651',results,note:'RPC réelles, sans création de compte ni envoi de courriel. Validation finale du formulaire par utilisateur attendue.'};
writeFileSync('docs/audits/account-creation-rpc-fix-2026-09-06.receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
