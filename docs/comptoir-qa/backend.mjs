import { createComptoirTestDb,comptoirTestActor } from '../../scripts/testing/comptoir-db.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const routes={
 snp_list_comptoir_dossiers:{sql:'SELECT public.snp_list_comptoir_dossiers($1) AS result',args:['p_id']},
 snp_save_comptoir_dossier:{sql:'SELECT public.snp_save_comptoir_dossier($1,$2::jsonb,$3,$4::timestamptz,$5) AS result',args:['p_id','p_values','p_expected_version','p_expected_organization_updated_at','p_request_id']},
 snp_archive_comptoir_document:{sql:'SELECT public.snp_archive_comptoir_document($1) AS result',args:['p_id']},
};
export async function comptoirQaBackend(server) {
 const db=await createComptoirTestDb();
 await db.query('INSERT INTO auth.users VALUES($1)',[owner]);await db.query("INSERT INTO public.user_profiles(id,role) VALUES($1,'owner')",[owner]);
 await comptoirTestActor(db,owner);
 await db.query(routes.snp_save_comptoir_dossier.sql,['22222222-2222-4222-8222-222222222222',{name:'Comptoir de démonstration QA',legal_form:'SARL',country:'BF',city:'Ouagadougou',district:'Gounghin',rccm_number:'QA-RCCM-001',ifu_number:'QA-IFU-001',tax_regime:'RNI',tax_office_code:'DGE',authorization_number:'QA-ACH-001',authorization_issued_on:'2025-01-01',authorization_expires_on:'2025-12-31',authorization_issuer:'Autorité de démonstration',representative_last_name:'Démonstration',representative_first_name:'Responsable',representative_position:'Gérante',representative_phone:'+226 70 00 00 00',representative_email:'responsable@example.test'},0,null,'33333333-3333-4333-8333-333333333333']);
 let queue=Promise.resolve();const requests=[];
 server.httpServer?.on('close',()=>{void db.close();});
 server.middlewares.use((req,res,next)=>{
  const url=new URL(req.url,'http://127.0.0.1:5185');
  if(url.pathname==='/qa-evidence'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({transport:'Supabase JS réel',database:'PostgreSQL jetable PGlite',requests}));return;}
  if(!url.pathname.startsWith('/rest/v1/'))return next();
  let text='';req.on('data',chunk=>{text+=chunk;});req.on('end',()=>{
   queue=queue.then(async()=>{
    try {
     const name=url.pathname.split('/').at(-1),route=routes[name];
     let result=[];
     if(route){const body=text?JSON.parse(text):{};await comptoirTestActor(db,owner);result=(await db.query(route.sql,route.args.map(k=>body[k]??null))).rows[0].result;requests.push({method:req.method,rpc:name,status:200});}
     res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(result));
    }catch(error){requests.push({rpc:url.pathname.split('/').at(-1),status:400});res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({message:error.message,code:error.code}));}
   });
  });
 });
}
