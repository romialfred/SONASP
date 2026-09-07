import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
const migration = 'supabase/migrations/20260907044811_enregistrer_dossier_client_atomique.sql';
const customer = (label, overrides = {}) => ({
  name: ` QA ${label} `,email:` ${label}@example.test `,phone:' +226 00000000 ',country:' Burkina Faso ',
  address:' Adresse fictive de recette ',contact_person:' Personne fictive ',tax_id:' QA-IFU ',
  payment_terms:'Net 30 days',credit_limit:0,status:'pending',...overrides,
});
const bank = (label, overrides = {}) => ({bank_name:`Banque ${label}`,country:'Burkina Faso',city:'Ouagadougou',currency:'XOF',account_number:' 001 ',iban:'',swift_code:'',is_primary:false,is_active:true,...overrides});

test('Dossier client atomique — PostgreSQL embarqué, sans Auth/MFA ou réseau réel', async t => {
  const db = new PGlite();
  const q = (sql,params=[]) => db.query(sql,params);
  const one = async (sql,params=[]) => (await q(sql,params)).rows[0];
  const actor = async ({role='authenticated',capability='sonasp.prepare',aal='aal2',session='active',uid='aa000000-0000-4000-8000-000000000001'}={}) => {
    await db.exec('RESET ROLE');
    await q("SELECT set_config('test.uid',$1,false),set_config('test.capability',$2,false),set_config('test.aal',$3,false),set_config('test.session',$4,false)",[uid,capability,aal,session]);
    if(!['authenticated','anon'].includes(role)) throw new Error('Role de test invalide');
    await db.exec(`SET ROLE ${role}`);
  };
  const save = async (id,c,b=[]) => (await one('SELECT public.save_customer_dossier($1,$2,$3) AS id',[id,JSON.stringify(c),b===null?null:JSON.stringify(b)])).id;
  const admin = async fn => { await db.exec('RESET ROLE');try{return await fn();}finally{await actor();} };
  const rows = id => q('SELECT * FROM public.customer_banks WHERE customer_id=$1 ORDER BY bank_name',[id]).then(r=>r.rows);
  const rejects = (promise,code) => assert.rejects(promise,e=>e.code===code);
  try {
    await db.exec(await read('supabase/tests/fixtures/customer-dossier-baseline.sql'));
    // Le helper d'autorisation SONASP est le vrai SQL existant ; son lecteur de capacités reste une fixture.
    const permissions = await read('supabase/migrations/20260823180000_capacites_et_separation_fonctions.sql');
    const helper = permissions.match(/CREATE OR REPLACE FUNCTION public\.snp_est_agent_sonasp\(\)[\s\S]*?\$fn\$;/)?.[0];
    assert.ok(helper,'Le contrat du helper SONASP doit être présent');
    await db.exec(helper);
    await db.exec(await read('supabase/migrations/20260905000000_durcir_rls_clients.sql'));
    await db.exec(await read(migration));
    await actor();

    await t.test('RPC invoker, rôle API autorisé, anon interdit', async()=>{
      const row = await one("SELECT prosecdef,has_function_privilege('anon',oid,'execute') AS anon,has_function_privilege('authenticated',oid,'execute') AS authenticated FROM pg_proc WHERE oid='public.save_customer_dossier(uuid,jsonb,jsonb)'::regprocedure");
      assert.deepEqual(row,{prosecdef:false,anon:false,authenticated:true});
    });
    await t.test('helper de session privé : contrôle indirect conservé sans élargir ses ACL',async()=>{
      assert.equal((await one("SELECT has_function_privilege('authenticated','public.snp_session_est_active()','EXECUTE') AS allowed")).allowed,false);
      await rejects(one('SELECT public.snp_session_est_active()'),'42501');
      const id=await save(null,customer('private-session'));
      await actor({session:'expired'});
      await rejects(save(id,customer('private-session',{name:'Refusé'})),'42501');
      await actor();
      assert.equal((await one('SELECT name FROM public.customers WHERE id=$1',[id])).name,'QA private-session');
      assert.equal((await one("SELECT has_function_privilege('authenticated','public.snp_session_est_active()','EXECUTE') AS allowed")).allowed,false);
    });
    await t.test('création : tous les champs, zéro crédit, banque principale, normalisation',async()=>{
      const id=await save(null,customer('CREATE'),[bank('A',{is_primary:true})]);
      const row=await one('SELECT * FROM public.customers WHERE id=$1',[id]);
      assert.equal(row.name,'QA CREATE');assert.equal(row.email,'create@example.test');assert.equal(row.credit_limit,'0');
      assert.equal(row.phone,'+226 00000000');assert.equal(row.country,'Burkina Faso');assert.equal(row.address,'Adresse fictive de recette');
      assert.equal(row.contact_person,'Personne fictive');assert.equal(row.tax_id,'QA-IFU');assert.equal(row.payment_terms,'Net 30 days');assert.equal(row.status,'pending');
      const [saved]=await rows(id);assert.equal(saved.customer_id,id);assert.equal(saved.account_number,'001');assert.equal(saved.iban,null);assert.equal(saved.swift_code,null);assert.equal(saved.is_primary,true);
    });
    await t.test('édition : identité bancaire, dates de création et champs hors formulaire conservés',async()=>{
      const id=await save(null,customer('edit'),[bank('A')]);const [original]=await rows(id);
      await admin(()=>q('UPDATE public.customers SET company=$2,is_active=false WHERE id=$1',[id,'Champ historique']));
      await save(id,customer('edit',{name:'Modifié',credit_limit:0,status:'inactive'}),[bank('A',{id:original.id,city:'Bobo-Dioulasso'})]);
      const [updated]=await rows(id);assert.equal(updated.id,original.id);assert.equal(updated.city,'Bobo-Dioulasso');assert.deepEqual(updated.created_at,original.created_at);
      const c=await one('SELECT * FROM public.customers WHERE id=$1',[id]);assert.equal(c.company,'Champ historique');assert.equal(c.is_active,false);assert.equal(c.credit_limit,'0');assert.equal(c.status,'inactive');
    });
    await t.test('statut et conditions de paiement explicitement null : création et édition sans faux défaut',async()=>{
      const id=await save(null,customer('nullable',{status:null,payment_terms:null}),[bank('A')]);
      const before=await one('SELECT status,payment_terms FROM public.customers WHERE id=$1',[id]);
      assert.deepEqual(before,{status:null,payment_terms:null});
      const [original]=await rows(id);
      await save(id,customer('nullable',{name:'Dossier historique modifié',status:null,payment_terms:null}),[bank('A',{id:original.id})]);
      assert.deepEqual(await one('SELECT status,payment_terms FROM public.customers WHERE id=$1',[id]),before);
      assert.equal((await rows(id))[0].id,original.id);
      assert.equal((await one('SELECT name FROM public.customers WHERE id=$1',[id])).name,'Dossier historique modifié');
    });
    await t.test('clés statut et conditions de paiement absentes : rejet sans effacement implicite',async()=>{
      const id=await save(null,customer('missing-keys'),[bank('A')]);
      const before=await one('SELECT * FROM public.customers WHERE id=$1',[id]);const beforeBanks=await rows(id);
      for(const field of ['status','payment_terms']){
        const payload=customer('missing-keys',{name:'Modification refusée'});delete payload[field];
        await rejects(save(id,payload,[]),'22023');
        assert.deepEqual(await one('SELECT * FROM public.customers WHERE id=$1',[id]),before);
        assert.deepEqual(await rows(id),beforeBanks);
      }
    });
    await t.test('conditions, pays et devise historiques hors listes UI conservés selon les colonnes texte existantes',async()=>{
      const legacy=customer('legacy-text',{payment_terms:'Conditions contractuelles historiques',country:'Pays historique'});
      const historicalBank=bank('Historique',{currency:'HIST',country:'Territoire historique'});
      const id=await save(null,legacy,[historicalBank]);const [original]=await rows(id);
      await save(id,{...legacy,name:'Nom actualisé'},[{...historicalBank,id:original.id}]);
      assert.deepEqual(await one('SELECT payment_terms,country FROM public.customers WHERE id=$1',[id]),{payment_terms:legacy.payment_terms,country:legacy.country});
      const [saved]=await rows(id);assert.equal(saved.currency,'HIST');assert.equal(saved.country,'Territoire historique');assert.equal(saved.id,original.id);
    });
    await t.test('banque retirée : désactivation et conservation des références paiement/prévente',async()=>{
      const id=await save(null,customer('retire'),[bank('A',{is_primary:true})]);const [old]=await rows(id);
      await admin(async()=>{await q('INSERT INTO public.payments(customer_bank_id) VALUES($1)',[old.id]);await q('INSERT INTO public.pre_sales(customer_bank_id) VALUES($1)',[old.id]);});
      await save(id,customer('retire'),[bank('B',{is_primary:true})]);
      const banks=await rows(id);assert.equal(banks.length,2);assert.equal(banks.find(b=>b.id===old.id).is_active,false);assert.equal(banks.find(b=>b.id===old.id).is_primary,false);
      const references=await admin(()=>one('SELECT (SELECT count(*) FROM payments WHERE customer_bank_id=$1)::int AS payments,(SELECT count(*) FROM pre_sales WHERE customer_bank_id=$1)::int AS pre_sales',[old.id]));
      assert.deepEqual(references,{payments:1,pre_sales:1});
    });
    await t.test('liste vide autorisée : création sans banque, retrait sans suppression',async()=>{
      const id=await save(null,customer('empty'));assert.equal((await rows(id)).length,0);
      await save(id,customer('empty'),[bank('A')]);await save(id,customer('empty'),[]);assert.equal((await rows(id))[0].is_active,false);
    });
    await t.test('échec SQL sur le second enfant : création entièrement annulée',async()=>{
      await admin(()=>db.exec("ALTER TABLE public.customer_banks ADD CONSTRAINT qa_reject CHECK(bank_name<>'REJECT_SQL')"));
      try{await rejects(save(null,customer('rollback-new'),[bank('A'),bank('B',{bank_name:'REJECT_SQL'})]),'23514');assert.equal((await one("SELECT count(*)::int AS n FROM public.customers WHERE email='rollback-new@example.test'")).n,0);}
      finally{await admin(()=>db.exec('ALTER TABLE public.customer_banks DROP CONSTRAINT qa_reject'));}
    });
    await t.test('échec SQL en édition : parent, ancienne banque et ses flags restaurés',async()=>{
      const id=await save(null,customer('rollback-edit'),[bank('A',{is_primary:true})]);const before=await rows(id);
      await admin(()=>db.exec("ALTER TABLE public.customer_banks ADD CONSTRAINT qa_reject CHECK(bank_name<>'REJECT_SQL')"));
      try{await rejects(save(id,customer('rollback-edit',{name:'Ne doit pas persister'}),[bank('B',{bank_name:'REJECT_SQL'})]),'23514');assert.deepEqual(await rows(id),before);assert.equal((await one('SELECT name FROM public.customers WHERE id=$1',[id])).name,'QA rollback-edit');}
      finally{await admin(()=>db.exec('ALTER TABLE public.customer_banks DROP CONSTRAINT qa_reject'));}
    });
    await t.test('banque d’un autre client : rejet et absence de déplacement',async()=>{
      const a=await save(null,customer('foreign-a'),[bank('A')]);const b=await save(null,customer('foreign-b'));const [foreign]=await rows(a);
      await rejects(save(b,customer('foreign-b',{name:'Refusé'}),[bank('A',{id:foreign.id})]),'42501');assert.equal((await rows(a))[0].id,foreign.id);assert.equal((await rows(b)).length,0);
    });
    await t.test('banque inconnue et identifiant répété refusés',async()=>{
      const id=await save(null,customer('ids'),[bank('A')]);const [original]=await rows(id);
      await rejects(save(id,customer('ids'),[bank('A',{id:'bb000000-0000-4000-8000-000000000009'})]),'42501');
      await rejects(save(id,customer('ids'),[bank('A',{id:original.id}),bank('B',{id:original.id})]),'22023');
      await rejects(save(null,customer('new-with-id'),[bank('A',{id:original.id})]),'22023');
    });
    await t.test('client inconnu ne produit pas de faux succès',async()=>{
      await rejects(save('bb000000-0000-4000-8000-000000000009',customer('missing')),'42501');
    });
    await t.test('banques absentes ou mal formées ne valent pas une suppression',async()=>{
      const id=await save(null,customer('malformed'),[bank('A')]);
      for(const payload of [null,{},'invalid',[null]])await rejects(save(id,customer('malformed'),payload),'22023');
      assert.equal((await rows(id))[0].is_active,true);
    });
    await t.test('validations existantes : requis, email, crédit, statuts, banque, principal unique',async()=>{
      for(const field of ['name','email','phone','country','address','contact_person'])await rejects(save(null,customer('invalid',{[field]:' '})),'22023');
      for(const c of [customer('invalid',{email:'invalid'}),customer('invalid',{credit_limit:-1}),customer('invalid',{credit_limit:'NaN'}),customer('invalid',{status:'invented'})])await rejects(save(null,c),'22023');
      for(const field of ['bank_name','country','city','currency'])await rejects(save(null,customer('invalid'),[bank('A',{[field]:''})]),'22023');
      await rejects(save(null,customer('invalid'),[bank('A',{bank_name:'__other__'})]),'22023');
      await rejects(save(null,customer('invalid'),[bank('A',{is_primary:true}),bank('B',{is_primary:true})]),'22023');
    });
    await t.test('champs système, parent bancaire injecté et mauvais types refusés',async()=>{
      await rejects(save(null,customer('system',{company:'Interdit'})),'22023');
      await rejects(save(null,customer('system'),[bank('A',{customer_id:'bb000000-0000-4000-8000-000000000009'})]),'22023');
      for(const extra of [{is_primary:'true'},{id:'invalid'},{iban:{invalid:true}}])await rejects(save(null,customer('system'),[bank('A',extra)]),'22023');
    });
    await t.test('email unique : contrainte serveur propagée sans nouveau dossier',async()=>{
      await save(null,customer('duplicate'));await rejects(save(null,customer('DUPLICATE')),'23505');
    });
    await t.test('absence de capacité, AAL1, sessions absente/révoquée/expirée, absence d’identité et anon refusés',async()=>{
      for(const context of [{capability:'mine.production'},{aal:'aal1'},{session:''},{session:'revoked'},{session:'expired'},{uid:''},{role:'anon'}]){
        await actor(context);await rejects(save(null,customer('denied')),'42501');
      }await actor();
    });
    await t.test('restriction RLS additionnelle sur le parent reste opposable',async()=>{
      const id=await save(null,customer('rls-parent'));
      await admin(()=>db.exec('CREATE POLICY qa_no_update ON public.customers AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false)'));
      try{await rejects(save(id,customer('rls-parent',{name:'Refusé'})),'42501');}
      finally{await admin(()=>db.exec('DROP POLICY qa_no_update ON public.customers'));}
    });
    await t.test('restriction RLS enfant annule la mise à jour du parent',async()=>{
      const id=await save(null,customer('rls-child'),[bank('A')]);
      await admin(()=>db.exec('CREATE POLICY qa_no_update ON public.customer_banks AS RESTRICTIVE FOR UPDATE TO authenticated USING(false) WITH CHECK(false)'));
      try{await rejects(save(id,customer('rls-child',{name:'Refusé'}),[]),'42501');assert.equal((await one('SELECT name FROM public.customers WHERE id=$1',[id])).name,'QA rls-child');}
      finally{await admin(()=>db.exec('DROP POLICY qa_no_update ON public.customer_banks'));}
    });
    await t.test('trigger ignorant UPDATE : zéro ligne détecté, aucun faux succès',async()=>{
      const id=await save(null,customer('zero-update'));
      await admin(()=>db.exec('CREATE FUNCTION public.qa_skip_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$; CREATE TRIGGER qa_skip BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.qa_skip_update()'));
      try{await rejects(save(id,customer('zero-update',{name:'Refusé'})),'42501');}
      finally{await admin(()=>db.exec('DROP TRIGGER qa_skip ON public.customers; DROP FUNCTION public.qa_skip_update()'));}
    });
    await t.test('migration rejouable sans modifier les policies ni les données',async()=>{
      const before=await one('SELECT count(*)::int AS n FROM public.customers');
      await db.exec('RESET ROLE');await db.exec(await read(migration));await actor();
      assert.deepEqual(await one('SELECT count(*)::int AS n FROM public.customers'),before);
      assert.equal((await one("SELECT count(*)::int AS n FROM pg_policies WHERE tablename IN ('customers','customer_banks')")).n,8);
    });
  } finally { await db.close(); }
});
