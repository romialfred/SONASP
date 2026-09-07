import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectorService } from './collectorService';

const api = vi.hoisted(() => ({ fetch:vi.fn() }));
vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return { supabase:createClient('https://collector-fixture.invalid','fixture-key',{
    global:{ fetch:api.fetch }, auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false },
  }) };
});
const makeRows = (count:number) => Array.from({length:count},(_,i) => ({
  id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,
  identity:{ nom:'Même nom',prenoms:'Même prénom',telephone:'',type_personne:'physique',type_artisan:'collecteur' },
  organization_id:'org',organization_name:'Organisme',organization_type:'comptoir',site_ids:[],version:1,payment_authorized_until:null,account_user_id:null,
}));
let rows:ReturnType<typeof makeRows>;
let cap:number;
let urls:URL[];
let alter:((offset:number, data:unknown, headers:Headers) => {data:unknown;status?:number}) | undefined;
beforeEach(() => {
  rows=[];cap=1000;urls=[];alter=undefined;
  api.fetch.mockImplementation(async (input:RequestInfo | URL, init?:RequestInit) => {
    const url=new URL(String(input));urls.push(url);
    expect(url.origin).toBe('https://collector-fixture.invalid');
    expect(url.pathname).toBe('/rest/v1/rpc/snp_list_collectors');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{}');
    const offset=Number(url.searchParams.get('offset')??0);
    const limit=Math.min(cap,Number(url.searchParams.get('limit')??cap));
    const data=rows.slice(offset,offset+limit);
    const headers=new Headers({ 'Content-Type':'application/json' });
    if (new Headers(init?.headers).get('Prefer')?.includes('count=exact')) headers.set('Content-Range',`${data.length ? `${offset}-${offset+data.length-1}` : '*'}/${rows.length}`);
    const reply=alter?.(offset,data,headers)??{data};
    return new Response(JSON.stringify(reply.data),{status:reply.status??200,headers});
  });
});

describe('Collecteurs : pagination avec le véritable client Supabase et transport simulé', () => {
  it.each([0,1,499,500,501,1000,1001,1500])('restitue les %i dossiers visibles', async count => {
    rows=makeRows(count);
    const result=await collectorService.list();
    expect(result).toHaveLength(count);
    expect(result.map(row=>row.id)).toEqual(rows.map(row=>row.id));
    expect(urls.every(url=>url.searchParams.get('limit')==='500')).toBe(true);
    expect(urls.every(url=>url.searchParams.get('order')==='pgrst_scalar->identity->>nom.asc,pgrst_scalar->identity->>prenoms.asc,pgrst_scalar->>id.asc')).toBe(true);
  });
  it('avance selon la taille reçue quand le serveur impose une limite plus petite', async () => {
    rows=makeRows(151);cap=73;
    expect(await collectorService.list()).toHaveLength(151);
    expect(urls.map(url=>url.searchParams.get('offset'))).toEqual(['0','73','146']);
  });
  it('ne renvoie pas la première page si une page suivante échoue', async () => {
    rows=makeRows(1001);
    alter=(offset,data)=>offset ? {data:{message:'Lecture refusée',code:'42501'},status:403} : {data};
    await expect(collectorService.list()).rejects.toThrow();
  });
  it.each(['count absent','count changé','vide prématuré','doublon','null'])('refuse une lecture non exhaustive : %s', async failure => {
    rows=makeRows(1001);
    alter=(offset,data,headers) => {
      if (failure==='count absent') headers.delete('Content-Range');
      if (failure==='null') return {data:null};
      if (offset && failure==='count changé') headers.set('Content-Range',`${offset}-${offset+499}/1002`);
      if (offset && failure==='vide prématuré') return {data:[]};
      if (offset && failure==='doublon') return {data:[rows[0]]};
      return {data};
    };
    await expect(collectorService.list()).rejects.toThrow();
  });
});
