import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

/** Run against the same isolated PostgreSQL instance as the original contracts. */
export async function checkPaidAffiliationWorkflow(db, maker, checker, outsider, price) {
 const query=(sql,args=[])=>db.query(sql,args), one=async(sql,args=[]) => (await query(sql,args)).rows[0];
 let checks=0;
 const reject=async(sql,args,pattern)=>{ await assert.rejects(()=>query(sql,args),pattern); checks++; };
 const actor=async id=>{ await db.exec('RESET ROLE'); await query("SELECT set_config('test.uid',$1,false),set_config('test.session','active',false),set_config('test.aal','aal2',false)",[id]); await db.exec('SET ROLE authenticated'); };
 await db.exec('RESET ROLE');
 const historical=await query('SELECT id,montant,statut,date_paiement FROM snp_adhesion_encaissements ORDER BY id');
 await db.exec(await fs.readFile(new URL('../supabase/migrations/20260906235254_affiliation_payment_evidence_and_paid_generation.sql',import.meta.url),'utf8'));
 assert.deepEqual((await query('SELECT id,montant,statut,date_paiement FROM snp_adhesion_encaissements ORDER BY id')).rows,historical.rows);checks++;
 const member=randomUUID(),card=randomUUID(),dues=randomUUID(),payment=randomUUID(),rest=randomUUID();
 await query("INSERT INTO snp_artisans_miniers(id,numero_carte,type_personne,type_artisan,nom,prenoms,photo_url,commune) VALUES($1,'FS-PAID-FIRST','physique','exploitant','PAIEMENT','Contrôle',$2,'Commune')",[member,member+'/photo.png']);
 await query("INSERT INTO snp_cartes_professionnelles(id,artisan_id,numero_carte,numero_affiliation,affiliation_version,date_emission,date_expiration,statut,created_by) VALUES($1,$2,'FS-PAID-FIRST','FS-PAID-FIRST',1,CURRENT_DATE,CURRENT_DATE,'en_cours',$3)",[card,member,maker]);
 await actor(maker);
 let item=(await one('SELECT snp_lister_affiliations($1) AS c',[member])).c;
 assert.equal(item.adhesion_status,'non_renseigne');assert.equal(item.identity_ready,false);assert.equal(item.artisan_role,'exploitant');assert.equal(item.site_name,'Non rattaché');checks++;
 // Preparing the dossier takes no payment and does not render a card.
 await query('SELECT snp_preparer_carte_affiliation($1)',[card]);
 await reject('SELECT snp_claim_affiliation_render($1)',[card],/paiement intégral/);
 await query('SELECT snp_etablir_adhesion_droit($1,$2,$3,CURRENT_DATE,CURRENT_DATE+364)',[dues,card,price]);
 await reject("SELECT snp_enregistrer_adhesion_encaissement($1,$2,40,'PAID-LEGACY','cash',CURRENT_DATE)",[payment,dues],/preuve/);
 const year=Number((await one('SELECT EXTRACT(YEAR FROM CURRENT_DATE)::integer AS year')).year);
 const proof=async receipt=>{
  await db.exec('RESET ROLE'); const path=`${member}/${dues}/${receipt}.pdf`;
  await query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('affiliation-payment-proofs',$1,$2)",[path,JSON.stringify({size:25,mimetype:'application/pdf'})]);
  await query("INSERT INTO snp_adhesion_preuves(paiement_id,droit_id,artisan_id,path,file_name,mime_type,file_size,sha256,uploaded_by) VALUES($1,$2,$3,$4,'preuve.pdf','application/pdf',25,$5,$6)",[receipt,dues,member,path,'a'.repeat(64),maker]);
  await actor(maker); return path;
 };
 const record="SELECT to_jsonb(snp_enregistrer_adhesion_encaissement($1,$2,$3,$4,'cash',CURRENT_DATE,$5,$6,$7)) AS p";
 const firstProof=await proof(payment);
 await reject(record,[payment,dues,40,'PAID-1',year+1,'Ouagadougou',firstProof],/année/);
 await reject(record,[payment,dues,40,'PAID-1',year,'',firstProof],/lieu/);
 await reject(record,[payment,dues,40,'PAID-1',year,'Ouagadougou','other-proof'],/preuve/);
 await reject(record,[randomUUID(),dues,40,'PAID-1',year,'Ouagadougou',firstProof],/preuve/);
 await reject(record,[payment,dues,40.001,'PAID-1',year,'Ouagadougou',firstProof],/montant/);
 await reject("SELECT snp_enregistrer_adhesion_encaissement($1,$2,40,'PAID-1','cash',CURRENT_DATE+1,$3,'Ouagadougou',$4)",[payment,dues,year,firstProof],/date/);
 const receipt=(await one(record,[payment,dues,40,'PAID-1',year,'Ouagadougou',firstProof])).p;
 assert.equal(receipt.annee_adhesion,year);assert.equal(receipt.lieu_paiement,'Ouagadougou');assert.equal(receipt.preuve_path,firstProof);checks++;
 await query(record,[payment,dues,40,'PAID-1',year,'Ouagadougou',firstProof]);checks++;
 await reject(record,[payment,dues,40,'PAID-1',year,'Bobo-Dioulasso',firstProof],/Clé/);
 await reject('SELECT snp_claim_affiliation_render($1)',[card],/paiement intégral/);
 await reject("SELECT snp_controler_adhesion_encaissement($1,'confirme',NULL)",[payment],/Double contrôle/);
 await actor(checker);await query("SELECT snp_controler_adhesion_encaissement($1,'confirme',NULL)",[payment]);
 await actor(maker);await reject('SELECT snp_claim_affiliation_render($1)',[card],/paiement intégral/);
 const restProof=await proof(rest);
 await query(record,[rest,dues,60,'PAID-2',year,'Ouagadougou',restProof]);
 item=(await one('SELECT snp_lister_affiliations($1) AS c',[member])).c;
 assert.equal(item.adhesion_status,'partiel');assert.equal(item.adhesion_paid,40);assert.equal(item.adhesion_pending,60);checks++;
 await reject('SELECT snp_claim_affiliation_render($1)',[card],/paiement intégral/);
 await actor(checker);await query("SELECT snp_controler_adhesion_encaissement($1,'confirme',NULL)",[rest]);
 item=(await one('SELECT snp_lister_affiliations($1) AS c',[member])).c;
 assert.equal(item.adhesion_status,'paye');assert.equal(item.adhesion_paid,100);assert.equal(item.adhesion_pending,0);assert.equal(item.statut_effectif,'non_validee');checks++;
 // Registry readers keep status/period visibility, but never receive financial totals.
 const reader=randomUUID();await db.exec('RESET ROLE');
 await query('INSERT INTO auth.users VALUES($1)',[reader]);
 await query('INSERT INTO test_profiles(id,capabilities,scope) VALUES($1,$2,$3)',[reader,[],member]);
 await actor(reader);item=(await one('SELECT snp_lister_affiliations($1) AS c',[member])).c;
 assert.equal(item.adhesion_status,'paye');assert.equal(item.adhesion_year,year);assert.ok(item.adhesion_start);assert.ok(item.adhesion_end);
 for(const field of ['adhesion_amount','adhesion_paid','adhesion_pending','adhesion_currency']) assert.equal(item[field],null);
 assert.equal((await query('SELECT * FROM snp_adhesion_encaissements')).rows.length,0);checks++;
 // An activation-only reviewer can inspect the proof for the allowed dossier,
 // without receiving rights to create a receipt or opening another member's files.
 const activator=randomUUID();await db.exec('RESET ROLE');
 await query('INSERT INTO auth.users VALUES($1)',[activator]);
 await query('INSERT INTO test_profiles(id,capabilities,scope) VALUES($1,$2,$3)',[activator,['artisan.cards.activate'],member]);
 await actor(activator);
 assert.equal((await query('SELECT * FROM snp_adhesion_encaissements')).rows.length,2);
 assert.equal((await query('SELECT path FROM snp_adhesion_preuves')).rows.length,2);
 assert.equal((await query("SELECT name FROM storage.objects WHERE bucket_id='affiliation-payment-proofs'")).rows.length,2);checks++;
 await reject('SELECT snp_adhesion_preuve_allowed($1)',[dues],/périmètre/);
 await db.exec('RESET ROLE');await query('UPDATE test_profiles SET scope=$1 WHERE id=$2',[randomUUID(),activator]);
 await actor(activator);
 assert.equal((await query('SELECT * FROM snp_adhesion_preuves')).rows.length,0);
 assert.equal((await query("SELECT * FROM storage.objects WHERE bucket_id='affiliation-payment-proofs'")).rows.length,0);checks++;
 await actor(outsider);await reject('SELECT snp_adhesion_preuve_allowed($1)',[dues],/périmètre/);
 assert.equal((await query('SELECT * FROM snp_adhesion_preuves')).rows.length,0);checks++;
 assert.equal((await query("SELECT * FROM storage.objects WHERE bucket_id='affiliation-payment-proofs'")).rows.length,0);checks++;
 await actor(maker);await reject("INSERT INTO snp_adhesion_preuves(paiement_id) VALUES($1)",[randomUUID()],/permission/);
 assert.equal((await one('SELECT snp_adhesion_preuve_allowed($1) AS a',[dues])).a.artisan_id,member);checks++;
 const job=(await one('SELECT snp_claim_affiliation_render($1) AS job',[card])).job;
 await actor(checker);await query("SELECT snp_controler_adhesion_encaissement($1,'rembourse','Remboursement pendant le rendu')",[rest]);
 await db.exec('RESET ROLE');await query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
 await reject('SELECT snp_complete_affiliation_render($1,$2,1,$3)',[card,job.lease,{}],/paiement intégral/);
 await query('SELECT snp_complete_affiliation_render($1,$2,1,NULL)',[card,job.lease]);
 // Simulate a fresh settled replacement receipt after the reversal.
 const replacement=randomUUID(),replacementProof=await proof(replacement);
 await query(record,[replacement,dues,60,'PAID-3',year,'Ouagadougou',replacementProof]);
 await actor(checker);await query("SELECT snp_controler_adhesion_encaissement($1,'confirme',NULL)",[replacement]);
 await actor(maker);const finalJob=(await one('SELECT snp_claim_affiliation_render($1) AS job',[card])).job;
 const files={};await db.exec('RESET ROLE');
 for(const face of ['recto','verso','pdf','portrait']) { const path=`${member}/${card}/v1-r1/${finalJob.lease}/${face}.${face==='pdf'?'pdf':'png'}`;files[face]={path,sha256:'b'.repeat(64)};await query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('affiliation-cards',$1,$2)",[path,JSON.stringify({size:123,mimetype:face==='pdf'?'application/pdf':'image/png'})]); }
 await query('SELECT snp_complete_affiliation_render($1,$2,1,$3)',[card,finalJob.lease,files]);
 await actor(checker);await query("SELECT snp_transition_carte_professionnelle($1,'en_cours','validee',NULL)",[card]);
 assert.equal((await one('SELECT snp_artisan_affiliation_eligible($1) AS ok',[member])).ok,false);checks++;
 const active=(await one('SELECT snp_activer_carte_affiliation($1) AS c',[card])).c;
 assert.equal(active.statut_effectif,'active');assert.equal(active.adhesion_year,year);checks++;
 assert.equal((await one('SELECT snp_artisan_affiliation_eligible($1) AS ok',[member])).ok,true);checks++;
 await query("SELECT snp_controler_adhesion_encaissement($1,'rembourse','Remboursement après activation')",[replacement]);
 assert.equal((await one('SELECT snp_artisan_affiliation_eligible($1) AS ok',[member])).ok,false);checks++;
 await reject('SELECT snp_claim_affiliation_render($1)',[card],/paiement intégral/);
 await db.exec('RESET ROLE');
 return checks;
}
