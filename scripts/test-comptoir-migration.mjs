import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createComptoirTestDb,comptoirTestActor } from './testing/comptoir-db.mjs';
const db=await createComptoirTestDb();
const q=(sql,args=[])=>db.query(sql,args);
let checks=0;
const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
const deny=async(sql,args,regex)=>{await assert.rejects(()=>q(sql,args),regex);checks++;};
const actor=(id,role,aal,session)=>comptoirTestActor(db,id,role,aal,session);
const sql='SELECT public.snp_save_comptoir_dossier($1,$2::jsonb,$3,$4::timestamptz,$5) AS result';
const owner=randomUUID(), admin=randomUUID(), dgmg=randomUUID(), outsider=randomUUID(), id=randomUUID(), request=randomUUID();
const values={name:'Comptoir de test isolé',legal_form:'SARL',country:'BF',city:'Ouagadougou',district:'Gounghin',phone:'+226 70 00 00 00',email:'societe@example.test',
 rccm_number:'BF-TEST-1',ifu_number:'00000001A',rccm_issued_on:'2020-01-02',ifu_issued_on:'2020-01-03',tax_regime:'RNI',tax_office_code:'DGE',
 authorization_number:'AUTH-TEST',authorization_issuer:'Autorité de test',authorization_issued_on:'2026-01-01',authorization_expires_on:'2026-12-31',
 representative_last_name:'Test',representative_first_name:'Dossier',representative_position:'Gérante',representative_email:'responsable@example.test',representative_phone:'+226 71 00 00 00',
 representative_identity_type:'CNIB',representative_identity_number:'TEST-ID',representative_identity_issued_on:'2025-01-01',representative_identity_expires_on:'2030-01-01'};
let current;
try {
 for(const [uid,role] of [[owner,'owner'],[admin,'admin'],[dgmg,'dgmg'],[outsider,'comptoir']]) {
  await q('INSERT INTO auth.users VALUES($1)',[uid]);await q('INSERT INTO public.user_profiles(id,role) VALUES($1,$2)',[uid,role]);
 }
 await actor(owner);
 check((await q('SELECT count(*)::int AS n FROM public.snp_comptoir_tax_offices')).rows[0].n,70);
 current=(await q(sql,[id,values,0,null,request])).rows[0].result;
 check(current.id,id);check(current.version,1);check(current.values.representative_email,values.representative_email);check(current.documents,[]);
 const replay=(await q(sql,[id,values,0,null,request])).rows[0].result;check(replay.version,1);
 await deny(sql,[id,{...values,name:'Autre demande'},0,null,request],/clé de reprise/);
 await deny(sql,[id,values,0,null,randomUUID()],/modifié depuis/);
 await deny(sql,[randomUUID(),values,0,null,randomUUID()],/déjà associé/);
 for(const patch of [{tax_office_code:'inconnu'},{tax_regime:'inconnu'},{legal_form:'Administration'},{country:'FR'},{name:''},{city:''},{capital:'1e7'},{representative_email:'invalide'},
 {authorization_issued_on:'2026-02-31'},{authorization_issued_on:'2026-13-01'},{authorization_expires_on:'2025-01-01'},{representative_identity_issued_on:'',representative_identity_expires_on:'2027-01-01'},
 {representative_identity_type:'faux'},{website:'javascript:alert(1)'},{is_active:true},{representative_phone:'abc'}, {rccm_number:'x'.repeat(251)}]) {
  await deny(sql,[id,{...values,...patch},1,current.organization_updated_at,randomUUID()],/invalide|Renseignez|autorisé|suivre|dépasse|Burkina|direction/);
 }
 for(const uid of [outsider]) {
  await actor(uid);
  await deny('SELECT public.snp_list_comptoir_dossiers()',[],/Accès réservé/);
  await deny(sql,[id,values,1,current.organization_updated_at,randomUUID()],/Gestion réservée/);
  check((await q('SELECT * FROM public.snp_comptoir_dossiers')).rows.length,0);
  check((await q('SELECT * FROM public.snp_comptoir_documents')).rows.length,0);
 }
 for(const [aal,session] of [['aal1','active'],['aal2','revoked']]) {
  await actor(owner,'authenticated',aal,session);
  await deny(sql,[id,values,1,current.organization_updated_at,randomUUID()],/Gestion réservée/);
 }
 await actor(owner,'anon');await deny('SELECT public.snp_list_comptoir_dossiers()',[],/permission denied/);
 for(const uid of [admin,dgmg]) {await actor(uid);check((await q('SELECT public.snp_list_comptoir_dossiers($1) AS result',[id])).rows[0].result[0].id,id);}
 await actor(admin);
 current=(await q(sql,[id,{...values,short_name:'Mis à jour'},1,current.organization_updated_at,randomUUID()])).rows[0].result;
 check(current.version,2);check(current.values.short_name,'Mis à jour');
 await deny('UPDATE public.snp_comptoir_dossiers SET data=$1',[{}],/permission denied/);
 await db.exec('RESET ROLE');
 const legacy=randomUUID();await q("INSERT INTO public.snp_organizations(id,code,name,organization_type,supervising_ministry_id,is_active,address) SELECT $1,'LEGACY','Ancien comptoir','comptoir',id,false,'Adresse conservée' FROM public.snp_ministries LIMIT 1",[legacy]);
 await actor(owner);const legacyRow=(await q('SELECT public.snp_list_comptoir_dossiers($1) AS result',[legacy])).rows[0].result[0];check(legacyRow.version,0);check(legacyRow.values.street,'Adresse conservée');
 const migrated=(await q(sql,[legacy,{...values,rccm_number:'BF-TEST-2',ifu_number:'00000002A'},0,legacyRow.organization_updated_at,randomUUID()])).rows[0].result;
 check(migrated.code,'LEGACY');check(migrated.is_active,false);
 const docId=randomUUID(),path=`${id}/${docId}.pdf`;
 const document={id:docId,organization_id:id,kind:'rccm',file_name:'rccm.pdf',path,mime_type:'application/pdf',size_bytes:15,sha256:'a'.repeat(64)};
 await deny('SELECT public.snp_register_comptoir_document_gateway($1,$2)',[document,owner],/permission denied/);
 await actor(owner,'service_role');
 await deny('SELECT public.snp_register_comptoir_document_gateway($1,$2)',[document,owner],/introuvable/);
 await q("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('comptoir-dossiers',$1,$2)",[path,{size:15,mimetype:'application/pdf'}]);
 for(const patch of [{path:`${legacy}/${docId}.pdf`},{kind:'representative_photo'},{size_bytes:16},{file_name:'../rccm.pdf'}]) await deny('SELECT public.snp_register_comptoir_document_gateway($1,$2)',[{...document,...patch},owner],/invalide|introuvable/);
 const registered=(await q('SELECT public.snp_register_comptoir_document_gateway($1,$2) AS result',[document,owner])).rows[0].result;check(registered.uploaded_by,owner);
 check((await q('SELECT public.snp_register_comptoir_document_gateway($1,$2) AS result',[document,owner])).rows[0].result.id,docId);
 await deny('SELECT public.snp_register_comptoir_document_gateway($1,$2)',[{...document,sha256:'b'.repeat(64)},owner],/autre pièce/);
 await actor(owner);check((await q("SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id='comptoir-dossiers'")).rows[0].n,1);
 await deny("INSERT INTO storage.objects(bucket_id,name) VALUES('comptoir-dossiers','bypass.pdf')",[],/row-level security/);
 check((await q("UPDATE storage.objects SET name='hijack.pdf' WHERE bucket_id='comptoir-dossiers' RETURNING name")).rows.length,0);
 check((await q("DELETE FROM storage.objects WHERE bucket_id='comptoir-dossiers' RETURNING name")).rows.length,0);
 await actor(outsider);check((await q("SELECT * FROM storage.objects WHERE bucket_id='comptoir-dossiers'")).rows.length,0);
 await deny('SELECT public.snp_archive_comptoir_document($1)',[docId],/refusé/);
 await actor(null,'anon');check((await q("SELECT * FROM storage.objects WHERE bucket_id='comptoir-dossiers'")).rows.length,0);
 await actor(owner);await q('SELECT public.snp_archive_comptoir_document($1)',[docId]);await q('SELECT public.snp_archive_comptoir_document($1)',[docId]);
 check((await q('SELECT public.snp_list_comptoir_dossiers($1) AS result',[id])).rows[0].result[0].documents.length,0);
 check((await q("SELECT * FROM storage.objects WHERE bucket_id='comptoir-dossiers'")).rows.length,0);
 check((await q("SELECT count(*)::int AS n FROM public.snp_comptoir_dossier_audit WHERE document_id=$1 AND action='document_retire'",[docId])).rows[0].n,1);
 await db.exec('RESET ROLE');await q('UPDATE public.user_profiles SET is_active=false WHERE id=$1',[owner]);await actor(owner);
 await deny('SELECT public.snp_list_comptoir_dossiers()',[],/Accès réservé/);
 console.log(`${checks} contrôles SQL Comptoir réussis (PostgreSQL jetable, aucun accès aux données métier).`);
} finally {await db.close();}
