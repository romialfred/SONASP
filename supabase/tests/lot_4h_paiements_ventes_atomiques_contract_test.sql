BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_claims(p_sub uuid,p_role text,p_aal text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',coalesce(p_sub::text,''),true);
  PERFORM set_config('request.jwt.claim.role',coalesce(p_role,''),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_sub,'role',p_role,'aal',p_aal,
    'session_id','4h-'||right(coalesce(p_sub::text,''),3),
    'exp',floor(extract(epoch FROM clock_timestamp()))::bigint+3600
  )::text,true);
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_execute(
  p_sale uuid,p_expected text,p_version bigint,p_amount numeric,p_currency text,
  p_customer_bank uuid,p_seller_bank uuid,p_reference text,p_proof text,p_key uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_paiement_international_executer(
    p_sale,p_expected,p_version,p_amount,p_currency,
    p_customer_bank,p_seller_bank,current_date,p_reference,
    'TX-'||right(p_reference,8),p_proof,'Test LOT 4H',p_key
  );
  RETURN 'OK:'||coalesce(v->>'payment_status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_decide(
  p_payment uuid,p_version bigint,p_decision text,p_key uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_paiement_international_decider(
    p_payment,'processing',p_version,p_decision,
    CASE WHEN p_decision='reject' THEN 'Reference bancaire non conforme'
         ELSE 'Rapprochement conforme' END,p_key
  );
  RETURN 'OK:'||coalesce(v->>'payment_status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_cancel(
  p_payment uuid,p_version bigint,p_key uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_paiement_international_annuler(
    p_payment,'processing',p_version,
    'Annulation motivee avant rapprochement',p_key
  );
  RETURN 'OK:'||coalesce(v->>'payment_status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_payment_update(p_payment uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.payments SET status='approved' WHERE id=p_payment;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_direct_sale_update(p_sale uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE public.sales SET status='payment_received' WHERE id=p_sale;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC;

SELECT plan(64);

-- Contrat structurel -------------------------------------------------------
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
  WHERE oid='public.payments'::regclass),'payments est FORCE RLS');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
  WHERE oid='public.snp_payment_operation_ledger'::regclass),'ledger est FORCE RLS');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename='payments'),1::bigint,'une seule policy canonique payments');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename='payments' AND cmd='SELECT'
  AND roles&&ARRAY['authenticated'::name]),1::bigint,'policy payments lecture seule');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='payments'
    AND grantee IN('anon','authenticated')
    AND privilege_type IN('INSERT','UPDATE','DELETE')),0::bigint,
  'aucun DML client payments');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='snp_payment_operation_ledger'
    AND grantee IN('anon','authenticated')),0::bigint,'ledger non expose');
SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public'
    AND routine_name IN('snp_paiement_international_executer',
      'snp_paiement_international_decider','snp_paiement_international_annuler')
    AND grantee='authenticated' AND privilege_type='EXECUTE'),3::bigint,
  'trois RPC runtime allowlistees authenticated');
SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public'
    AND routine_name IN('snp_paiement_international_executer',
      'snp_paiement_international_decider','snp_paiement_international_annuler')
    AND grantee IN('PUBLIC','anon')),0::bigint,'anon/PUBLIC ne recoivent aucune RPC');
SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public' AND routine_name='convert_virtual_to_actual_payment'
    AND grantee IN('PUBLIC','anon','authenticated','service_role')),0::bigint,
  'ancienne conversion est retiree du runtime');
SELECT ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.payments'::regclass
  AND tgname='snp_4h_payment_rpc_only' AND NOT tgisinternal),
  'garde RPC-only payments installee');
SELECT ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.sales'::regclass
  AND tgname='snp_4h_sale_payment_rpc_only' AND NOT tgisinternal),
  'garde statuts financiers sales installee');
SELECT ok(EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
  AND indexname='uq_payments_4h_execution_reference'),
  'unicite concurrente de reference bancaire installee');
SELECT ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.payments'::regclass
  AND conname='payments_4h_executed_by_fkey' AND convalidated),
  'FK executeur validee');
SELECT ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.payments'::regclass
  AND conname='payments_4h_version_nonnegative_check' AND convalidated),
  'version non negative validee');
SELECT ok((SELECT prosecdef FROM pg_proc
  WHERE oid='public.snp_paiement_international_executer(uuid,text,bigint,numeric,text,uuid,uuid,date,text,text,text,text,uuid)'::regprocedure),
  'execution est SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc
  WHERE oid='public.snp_paiement_international_decider(uuid,text,bigint,text,text,uuid)'::regprocedure),
  'decision est SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc
  WHERE oid='public.snp_paiement_international_annuler(uuid,text,bigint,text,uuid)'::regprocedure),
  'annulation est SECURITY DEFINER');
SELECT ok((SELECT array_to_string(proconfig,',') LIKE '%search_path=pg_catalog, public, pg_temp%'
  FROM pg_proc WHERE oid='public.snp_paiement_international_executer(uuid,text,bigint,numeric,text,uuid,uuid,date,text,text,text,text,uuid)'::regprocedure),
  'search_path execution fixe');
SELECT ok(position('FOR UPDATE' IN pg_get_functiondef(
  'public.snp_paiement_international_executer(uuid,text,bigint,numeric,text,uuid,uuid,date,text,text,text,text,uuid)'::regprocedure))>0,
  'execution verrouille vente/paiement');
SELECT ok(position('fx_rates_daily' IN pg_get_functiondef(
  'public.snp_paiement_international_executer(uuid,text,bigint,numeric,text,uuid,uuid,date,text,text,text,text,uuid)'::regprocedure))>0,
  'FX vient du referentiel serveur');
SELECT ok(position('sonasp.finance.execute' IN pg_get_functiondef(
  'public.snp_paiement_international_executer(uuid,text,bigint,numeric,text,uuid,uuid,date,text,text,text,text,uuid)'::regprocedure))>0,
  'execution exige capability dediee');
SELECT ok(position('sonasp.finance.reconcile' IN pg_get_functiondef(
  'public.snp_paiement_international_decider(uuid,text,bigint,text,text,uuid)'::regprocedure))>0,
  'decision exige reconcile distinct');

-- Fixtures -----------------------------------------------------------------
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000099','service_role','aal2');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
('4a000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','exec1@invalid.test','','{}','{}',now(),now()),
('4a000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','exec2@invalid.test','','{}','{}',now(),now()),
('4a000000-0000-4000-8000-000000000003','00000000-0000-0000-8000-000000000000','authenticated','authenticated','reconcile@invalid.test','','{}','{}',now(),now()),
('4a000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider@invalid.test','','{}','{}',now(),now()),
('4a000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','customer-a@invalid.test','','{}','{}',now(),now()),
('4a000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','customer-b@invalid.test','','{}','{}',now(),now());

INSERT INTO public.mining_companies(id,code,name,is_active) VALUES
('4a000000-0000-4000-8000-000000000101','SONASP','SONASP',true),
('4a000000-0000-4000-8000-000000000102','OTHER','Autre vendeur',true);
INSERT INTO public.customers(id,name,email) VALUES
('4a000000-0000-4000-8000-000000000201','Client A','customer-a@invalid.test'),
('4a000000-0000-4000-8000-000000000202','Client B','customer-b@invalid.test');
INSERT INTO public.user_profiles(id,email,full_name,role,customer_id) VALUES
('4a000000-0000-4000-8000-000000000001','exec1@invalid.test','Executeur 1','management',NULL),
('4a000000-0000-4000-8000-000000000002','exec2@invalid.test','Executeur 2','management',NULL),
('4a000000-0000-4000-8000-000000000003','reconcile@invalid.test','Rapprocheur','management',NULL),
('4a000000-0000-4000-8000-000000000004','outsider@invalid.test','Sans capability','manager',NULL),
('4a000000-0000-4000-8000-000000000005','customer-a@invalid.test','Client A','customer','4a000000-0000-4000-8000-000000000201'),
('4a000000-0000-4000-8000-000000000006','customer-b@invalid.test','Client B','customer','4a000000-0000-4000-8000-000000000202');
INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed) VALUES
('4a000000-0000-4000-8000-000000000001','sonasp.finance.execute',true),
('4a000000-0000-4000-8000-000000000001','sonasp.finance.reconcile',true),
('4a000000-0000-4000-8000-000000000002','sonasp.finance.execute',true),
('4a000000-0000-4000-8000-000000000003','sonasp.finance.reconcile',true);

INSERT INTO public.customer_banks(id,customer_id,currency,bank_name,account_number,is_active) VALUES
('4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000201','USD','Bank A','A-001',true),
('4a000000-0000-4000-8000-000000000302','4a000000-0000-4000-8000-000000000202','USD','Bank B','B-001',true),
('4a000000-0000-4000-8000-000000000303','4a000000-0000-4000-8000-000000000201','EUR','Bank A EUR','A-EUR',true);
INSERT INTO public.stakeholder_bank_accounts(
  id,stakeholder_id,stakeholder_type,account_currency,is_active,
  verification_status,valid_from,valid_to
) VALUES
('4a000000-0000-4000-8000-000000000401','4a000000-0000-4000-8000-000000000101','sonasp','USD',true,'verified',now()-interval '1 year',NULL),
('4a000000-0000-4000-8000-000000000402','4a000000-0000-4000-8000-000000000102','sonasp','USD',true,'verified',now()-interval '1 year',NULL);
INSERT INTO public.fx_rates_daily(currency_pair,rate,rate_date,notes)
VALUES('EUR/USD',1.25,current_date,'BCEAO test');

INSERT INTO public.sales(id,sale_number,customer_id,seller_id,seller_type,currency,final_proceeds,status) VALUES
('4a000000-0000-4000-8000-000000000501','SALE-4H-A','4a000000-0000-4000-8000-000000000201','4a000000-0000-4000-8000-000000000101','sonasp','USD',1000,'waiting_for_payment'),
('4a000000-0000-4000-8000-000000000502','SALE-4H-B','4a000000-0000-4000-8000-000000000202','4a000000-0000-4000-8000-000000000101','sonasp','USD',500,'waiting_for_payment'),
('4a000000-0000-4000-8000-000000000503','SALE-4H-C','4a000000-0000-4000-8000-000000000201','4a000000-0000-4000-8000-000000000101','sonasp','USD',250,'waiting_for_payment');
SELECT set_config('sonasp.payment_4h_rpc','1',true);
INSERT INTO public.payments(id,sale_id,customer_id,amount,currency,expected_date,status,is_virtual,payment_type,created_by,version) VALUES
('4a000000-0000-4000-8000-000000000601','4a000000-0000-4000-8000-000000000501','4a000000-0000-4000-8000-000000000201',1000,'USD',current_date,'pending',true,'virtual','4a000000-0000-4000-8000-000000000005',0),
('4a000000-0000-4000-8000-000000000602','4a000000-0000-4000-8000-000000000502','4a000000-0000-4000-8000-000000000202',500,'USD',current_date,'pending',true,'virtual','4a000000-0000-4000-8000-000000000006',0),
('4a000000-0000-4000-8000-000000000603','4a000000-0000-4000-8000-000000000503','4a000000-0000-4000-8000-000000000201',250,'USD',current_date,'pending',true,'virtual','4a000000-0000-4000-8000-000000000005',0);
SELECT set_config('sonasp.payment_4h_rpc','0',true);

-- AuthN/AAL/capability/tenant/validation -----------------------------------
SELECT pg_temp.set_claims(NULL,'anon','aal1'); SET LOCAL ROLE anon;
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,1000,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000401','REF-ANON-0001',NULL,'4a000000-0000-4000-8000-000000000701'),'ERR:42501','anon refuse');
RESET ROLE;
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000001','authenticated','aal1'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,1000,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000401','REF-AAL1-0001',NULL,'4a000000-0000-4000-8000-000000000702'),'ERR:42501','AAL1 refuse');
RESET ROLE;
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000004','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,1000,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000401','REF-NOCAP-001',NULL,'4a000000-0000-4000-8000-000000000703'),'ERR:42501','sans capability refuse');
RESET ROLE;
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000001','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,1000,'USD','4a000000-0000-4000-8000-000000000302','4a000000-0000-4000-8000-000000000401','REF-WRONG-CUST',NULL,'4a000000-0000-4000-8000-000000000704'),'ERR:23514','banque autre client refusee');
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,1000,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000402','REF-WRONG-SELL',NULL,'4a000000-0000-4000-8000-000000000705'),'ERR:23514','banque autre vendeur refusee');
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,900,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000401','REF-WRONG-AMNT',NULL,'4a000000-0000-4000-8000-000000000706'),'ERR:23514','montant incoherent refuse');
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,1000,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000401','REF-FORGE-PROOF','https://evil.invalid/proof.pdf','4a000000-0000-4000-8000-000000000707'),'ERR:42501','preuve URL libre refusee');

-- Execution atomique + idempotence ----------------------------------------
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,1000,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000401','REF-EXEC-A-001',NULL,'4a000000-0000-4000-8000-000000000710'),'OK:processing:false','execution valide');
SELECT is((SELECT status FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000601'),'processing','paiement processing');
SELECT is((SELECT status::text FROM public.sales WHERE id='4a000000-0000-4000-8000-000000000501'),'virtual_payment','vente atomiquement virtual_payment');
SELECT is((SELECT version FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000601'),1::bigint,'version incrementee');
SELECT is((SELECT executed_by FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000601'),'4a000000-0000-4000-8000-000000000001'::uuid,'executeur derive JWT');
SELECT is((SELECT fx_rate FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000601'),1::numeric,'parite serveur');
SELECT is((SELECT proof_url FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000601'),NULL::text,'aucune preuve forgee stockee');
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,1000,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000401','REF-EXEC-A-001',NULL,'4a000000-0000-4000-8000-000000000710'),'OK:processing:true','rejeu idempotent retourne meme resultat');
SELECT is((SELECT version FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000601'),1::bigint,'rejeu sans second effet');
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000501','waiting_for_payment',0,999,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000401','REF-EXEC-A-001',NULL,'4a000000-0000-4000-8000-000000000710'),'ERR:23505','cle reutilisee avec payload different refusee');
SELECT is(pg_temp.try_direct_payment_update('4a000000-0000-4000-8000-000000000601'),'ERR:42501','DML direct paiement refuse');
SELECT is(pg_temp.try_direct_sale_update('4a000000-0000-4000-8000-000000000501'),'ERR:42501','DML direct statut vente refuse');
RESET ROLE;

-- SoD et preuve bancaire ---------------------------------------------------
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000001','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_decide('4a000000-0000-4000-8000-000000000601',1,'approve','4a000000-0000-4000-8000-000000000711'),'ERR:42501','executeur ne rapproche pas son paiement');
RESET ROLE;
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000003','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_decide('4a000000-0000-4000-8000-000000000601',1,'approve','4a000000-0000-4000-8000-000000000712'),'ERR:23514','approbation sans preuve privee refusee');
RESET ROLE;
-- Simulation du futur gateway service-role: ce test ne pretend pas fournir ce gateway.
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000099','service_role','aal2');
SELECT set_config('sonasp.payment_4h_rpc','1',true);
UPDATE public.payments SET proof_url='payment-proofs/verified/4h-a.pdf'
WHERE id='4a000000-0000-4000-8000-000000000601';
SELECT set_config('sonasp.payment_4h_rpc','0',true);
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000003','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_decide('4a000000-0000-4000-8000-000000000601',1,'approve','4a000000-0000-4000-8000-000000000713'),'OK:approved:false','rapprocheur distinct approuve avec preuve');
SELECT is((SELECT status FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000601'),'approved','paiement approuve');
SELECT is((SELECT status::text FROM public.sales WHERE id='4a000000-0000-4000-8000-000000000501'),'payment_received','vente payment_received atomique');
SELECT is((SELECT approved_by FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000601'),'4a000000-0000-4000-8000-000000000003'::uuid,'approbateur derive JWT');
SELECT is((SELECT version FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000601'),2::bigint,'version decision incrementee');
SELECT is(pg_temp.try_decide('4a000000-0000-4000-8000-000000000601',1,'approve','4a000000-0000-4000-8000-000000000713'),'OK:approved:true','rejeu decision idempotent');
SELECT is(pg_temp.try_decide('4a000000-0000-4000-8000-000000000601',1,'approve','4a000000-0000-4000-8000-000000000714'),'ERR:40001','decision stale conflit 40001');
RESET ROLE;

-- Rejet et annulation ------------------------------------------------------
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000002','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000502','waiting_for_payment',0,500,'USD','4a000000-0000-4000-8000-000000000302','4a000000-0000-4000-8000-000000000401','REF-EXEC-B-001',NULL,'4a000000-0000-4000-8000-000000000720'),'OK:processing:false','execution vente B');
RESET ROLE;
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000003','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_decide('4a000000-0000-4000-8000-000000000602',1,'reject','4a000000-0000-4000-8000-000000000721'),'OK:rejected:false','rejet sans preuve autorise');
SELECT is((SELECT status::text FROM public.sales WHERE id='4a000000-0000-4000-8000-000000000502'),'waiting_for_payment','rejet remet vente en attente');
RESET ROLE;
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000002','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_execute('4a000000-0000-4000-8000-000000000503','waiting_for_payment',0,250,'USD','4a000000-0000-4000-8000-000000000301','4a000000-0000-4000-8000-000000000401','REF-EXEC-C-001',NULL,'4a000000-0000-4000-8000-000000000722'),'OK:processing:false','execution vente C');
SELECT is(pg_temp.try_cancel('4a000000-0000-4000-8000-000000000603',1,'4a000000-0000-4000-8000-000000000723'),'OK:cancelled:false','executeur annule avant rapprochement');
SELECT is((SELECT status FROM public.payments WHERE id='4a000000-0000-4000-8000-000000000603'),'cancelled','paiement annule');
SELECT is((SELECT status::text FROM public.sales WHERE id='4a000000-0000-4000-8000-000000000503'),'waiting_for_payment','annulation remet vente en attente');
SELECT is(pg_temp.try_cancel('4a000000-0000-4000-8000-000000000603',1,'4a000000-0000-4000-8000-000000000723'),'OK:cancelled:true','rejeu annulation idempotent');
RESET ROLE;

-- Cloisonnement lecture et audit ------------------------------------------
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000005','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.payments),2::bigint,'client A lit seulement ses deux paiements');
SELECT is((SELECT count(*) FROM public.payments WHERE sale_id='4a000000-0000-4000-8000-000000000502'),0::bigint,'client A ne lit pas client B');
RESET ROLE;
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000006','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.payments),1::bigint,'client B lit seulement son paiement');
RESET ROLE;
SELECT pg_temp.set_claims('4a000000-0000-4000-8000-000000000099','service_role','aal2');
SELECT is((SELECT count(*) FROM public.snp_payment_operation_ledger
  WHERE result IS NOT NULL),6::bigint,'six operations idempotentes finalisees');
SELECT is((SELECT count(*) FROM public.snp_workflow_audit
  WHERE aggregate_type='international-payment'),6::bigint,'six traces serveur produites');
SELECT ok((SELECT bool_and(actor_id IS NOT NULL AND capability_code IN(
  'sonasp.finance.execute','sonasp.finance.reconcile'))
  FROM public.snp_workflow_audit WHERE aggregate_type='international-payment'),
  'audit acteur/capability derives');

SELECT * FROM finish();
ROLLBACK;
