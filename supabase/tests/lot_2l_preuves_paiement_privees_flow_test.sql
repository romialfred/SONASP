BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_claims_2l(
  p_sub uuid,p_role text,p_aal text,p_session text
)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',coalesce(p_sub::text,''),true);
  PERFORM set_config('request.jwt.claim.role',coalesce(p_role,''),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_sub,'role',p_role,'aal',p_aal,'session_id',p_session,
    'exp',floor(extract(epoch FROM clock_timestamp()))::bigint+3600
  )::text,true);
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_attach_2l(
  p_payment uuid,p_path text,p_size bigint,p_sha text,p_key uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_paiement_preuve_rattacher(
    p_payment,p_path,'preuve-bancaire.pdf',p_size,'application/pdf',p_sha,p_key
  );
  RETURN 'OK:'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_attach_named_2l(
  p_payment uuid,p_path text,p_name text,p_size bigint,p_sha text,p_key uuid
)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_paiement_preuve_rattacher(
    p_payment,p_path,p_name,p_size,'application/pdf',p_sha,p_key
  );
  RETURN 'OK:'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_decide_2l(p_payment uuid,p_key uuid)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_paiement_international_decider(
    p_payment,'processing',1,'approve','Rapprochement bancaire conforme',p_key
  );
  RETURN 'OK:'||coalesce(v->>'payment_status','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC;
SELECT plan(27);

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000099','service_role','aal2','service-2l');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
('2b000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','exec-2l@invalid.test','','{}','{}',now(),now()),
('2b000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reconcile-2l@invalid.test','','{}','{}',now(),now()),
('2b000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','customer-2l@invalid.test','','{}','{}',now(),now());
INSERT INTO public.mining_companies(id,code,name,is_active)
VALUES('2b000000-0000-4000-8000-000000000101','SONASP','SONASP 2L',true);
INSERT INTO public.customers(id,name,email)
VALUES('2b000000-0000-4000-8000-000000000201','Client 2L','customer-2l@invalid.test');
INSERT INTO public.user_profiles(id,email,full_name,role,customer_id) VALUES
('2b000000-0000-4000-8000-000000000001','exec-2l@invalid.test','Executeur 2L','management',NULL),
('2b000000-0000-4000-8000-000000000002','reconcile-2l@invalid.test','Rapprocheur 2L','management',NULL),
('2b000000-0000-4000-8000-000000000003','customer-2l@invalid.test','Client 2L','customer','2b000000-0000-4000-8000-000000000201');
INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed) VALUES
('2b000000-0000-4000-8000-000000000001','sonasp.finance.execute',true),
('2b000000-0000-4000-8000-000000000002','sonasp.finance.reconcile',true);
INSERT INTO public.customer_banks(id,customer_id,currency,bank_name,account_number,is_active)
VALUES('2b000000-0000-4000-8000-000000000301','2b000000-0000-4000-8000-000000000201','USD','Bank 2L','2L-001',true);
INSERT INTO public.stakeholder_bank_accounts(
  id,stakeholder_id,stakeholder_type,account_currency,is_active,
  verification_status,valid_from,valid_to
) VALUES(
  '2b000000-0000-4000-8000-000000000401','2b000000-0000-4000-8000-000000000101',
  'sonasp','USD',true,'verified',now()-interval '1 year',NULL
);
INSERT INTO public.sales(
  id,sale_number,customer_id,seller_id,seller_type,currency,final_proceeds,status
) VALUES(
  '2b000000-0000-4000-8000-000000000501','SALE-2L-001',
  '2b000000-0000-4000-8000-000000000201','2b000000-0000-4000-8000-000000000101',
  'sonasp','USD',1000,'waiting_for_payment'
);
SELECT set_config('sonasp.payment_4h_rpc','1',true);
INSERT INTO public.payments(
  id,sale_id,customer_id,amount,currency,expected_date,status,is_virtual,
  payment_type,created_by,version
) VALUES(
  '2b000000-0000-4000-8000-000000000601','2b000000-0000-4000-8000-000000000501',
  '2b000000-0000-4000-8000-000000000201',1000,'USD',current_date,'pending',true,
  'virtual','2b000000-0000-4000-8000-000000000003',0
);
SELECT set_config('sonasp.payment_4h_rpc','0',true);

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000001','authenticated','aal2','session-exec-2l');
SET LOCAL ROLE authenticated;
SELECT public.snp_session_enregistrer('pgTAP 2L','test','postgres','BF');
SELECT is((public.snp_paiement_international_executer(
  '2b000000-0000-4000-8000-000000000501','waiting_for_payment',0,1000,'USD',
  '2b000000-0000-4000-8000-000000000301','2b000000-0000-4000-8000-000000000401',
  current_date,'REF-2L-0001','TX-2L-0001',NULL,'Test 2L',
  '2b000000-0000-4000-8000-000000000701'
))->>'payment_status','processing','paiement execute via 4H');
RESET ROLE;

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000001','authenticated','aal2','session-exec-2l');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.snp_paiements_preuve_reprise_lister()),1::bigint,
  'reprise liste le paiement processing sans preuve de l executeur courant');
SELECT ok((SELECT payload->>'proof_idempotency_key' IS NULL
  FROM public.snp_paiements_preuve_reprise_lister() AS r(payload) LIMIT 1),
  'reprise sans metadata demande une nouvelle cle preuve');
RESET ROLE;

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000002','authenticated','aal2','session-reconcile-2l');
SET LOCAL ROLE authenticated;
SELECT public.snp_session_enregistrer('pgTAP 2L','test','postgres','BF');
SELECT is(pg_temp.try_decide_2l(
  '2b000000-0000-4000-8000-000000000601','2b000000-0000-4000-8000-000000000702'
),'ERR:23514','approbation sans preuve refusee');
RESET ROLE;

-- Une simple valeur proof_url, meme posee sous le GUC historique, ne satisfait
-- plus le contrat metadata-backed 2L.
SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000099','service_role','aal2','service-2l');
SELECT set_config('sonasp.payment_4h_rpc','1',true);
UPDATE public.payments SET proof_url='payment-proofs/forged/public.pdf'
WHERE id='2b000000-0000-4000-8000-000000000601';
UPDATE public.sales SET payment_proof_url='payment-proofs/forged/public.pdf'
WHERE id='2b000000-0000-4000-8000-000000000501';
SELECT set_config('sonasp.payment_4h_rpc','0',true);
SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000002','authenticated','aal2','session-reconcile-2l');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_decide_2l(
  '2b000000-0000-4000-8000-000000000601','2b000000-0000-4000-8000-000000000703'
),'ERR:23514','proof_url libre ne permet jamais approbation');
RESET ROLE;

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000099','service_role','aal2','service-2l');
SELECT set_config('sonasp.payment_4h_rpc','1',true);
UPDATE public.payments SET proof_url=NULL WHERE id='2b000000-0000-4000-8000-000000000601';
UPDATE public.sales SET payment_proof_url=NULL WHERE id='2b000000-0000-4000-8000-000000000501';
SELECT set_config('sonasp.payment_4h_rpc','0',true);
INSERT INTO storage.objects(id,bucket_id,name,owner_id,metadata,user_metadata)
VALUES(gen_random_uuid(),'payment-proofs',
  '2b000000-0000-4000-8000-000000000601/2b000000-0000-4000-8000-000000000704.pdf',
  NULL,'{"size":24,"mimetype":"application/pdf"}'::jsonb,
  jsonb_build_object(
    'sha256',repeat('a',64),'safe_file_name','preuve-bancaire.pdf',
    'payment_id','2b000000-0000-4000-8000-000000000601',
    'idempotency_key','2b000000-0000-4000-8000-000000000704',
    'uploaded_by','2b000000-0000-4000-8000-000000000001'
  ));

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000001','authenticated','aal2','session-exec-2l');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_attach_2l(
  '2b000000-0000-4000-8000-000000000601',
  'payment-proofs/2b000000-0000-4000-8000-000000000601/2b000000-0000-4000-8000-000000000704.pdf',
  24,repeat('b',64),'2b000000-0000-4000-8000-000000000704'
),'ERR:23514','SHA fourni directement ne peut contredire user_metadata serveur');
SELECT is(pg_temp.try_attach_named_2l(
  '2b000000-0000-4000-8000-000000000601',
  'payment-proofs/2b000000-0000-4000-8000-000000000601/2b000000-0000-4000-8000-000000000704.pdf',
  'nom-audit-falsifie.pdf',24,repeat('a',64),'2b000000-0000-4000-8000-000000000704'
),'ERR:23514','nom fourni directement ne peut contredire user_metadata serveur');
SELECT is(pg_temp.try_attach_2l(
  '2b000000-0000-4000-8000-000000000601',
  'payment-proofs/2b000000-0000-4000-8000-000000000601/2b000000-0000-4000-8000-000000000704.pdf',
  24,repeat('a',64),'2b000000-0000-4000-8000-000000000704'
),'OK:false','executeur rattache preuve privee exacte');
SELECT is(pg_temp.try_attach_2l(
  '2b000000-0000-4000-8000-000000000601',
  'payment-proofs/2b000000-0000-4000-8000-000000000601/2b000000-0000-4000-8000-000000000704.pdf',
  24,repeat('a',64),'2b000000-0000-4000-8000-000000000704'
),'OK:true','rejeu rattachement sans doublon');
SELECT is(pg_temp.try_attach_2l(
  '2b000000-0000-4000-8000-000000000601',
  'payment-proofs/2b000000-0000-4000-8000-000000000601/2b000000-0000-4000-8000-000000000704.pdf',
  24,repeat('b',64),'2b000000-0000-4000-8000-000000000704'
),'ERR:23505','meme cle avec contenu different refusee');
SELECT is((SELECT count(*) FROM public.snp_payment_proofs),1::bigint,
  'une seule metadata autoritative');
SELECT is((SELECT sale_id FROM public.snp_payment_proofs LIMIT 1),
  '2b000000-0000-4000-8000-000000000501'::uuid,'vente derivee');
SELECT is((SELECT customer_id FROM public.snp_payment_proofs LIMIT 1),
  '2b000000-0000-4000-8000-000000000201'::uuid,'tenant derive du parent');
SELECT is((SELECT uploaded_by FROM public.snp_payment_proofs LIMIT 1),
  '2b000000-0000-4000-8000-000000000001'::uuid,'acteur derive du JWT');
SELECT is((SELECT proof_url FROM public.payments WHERE id='2b000000-0000-4000-8000-000000000601'),
  'payment-proofs/2b000000-0000-4000-8000-000000000601/2b000000-0000-4000-8000-000000000704.pdf',
  'seul chemin canonique stocke, aucune URL');
SELECT is((SELECT count(*) FROM public.snp_paiements_preuve_reprise_lister()),0::bigint,
  'preuve metadata-backed et objet exact sortent de la file de reprise');
RESET ROLE;

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000099','service_role','aal2','service-2l');
DELETE FROM storage.objects
WHERE bucket_id='payment-proofs'
  AND name='2b000000-0000-4000-8000-000000000601/2b000000-0000-4000-8000-000000000704.pdf';
SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000001','authenticated','aal2','session-exec-2l');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.snp_paiements_preuve_reprise_lister()),1::bigint,
  'metadata commitee dont objet manque revient dans la file de reprise');
SELECT is((SELECT payload->>'proof_idempotency_key'
  FROM public.snp_paiements_preuve_reprise_lister() AS r(payload) LIMIT 1),
  '2b000000-0000-4000-8000-000000000704',
  'reprise reutilise exactement la cle de la metadata commitee');
RESET ROLE;
SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000099','service_role','aal2','service-2l');
INSERT INTO storage.objects(id,bucket_id,name,owner_id,metadata,user_metadata)
VALUES(gen_random_uuid(),'payment-proofs',
  '2b000000-0000-4000-8000-000000000601/2b000000-0000-4000-8000-000000000704.pdf',
  NULL,'{"size":24,"mimetype":"application/pdf"}'::jsonb,
  jsonb_build_object(
    'sha256',repeat('a',64),'safe_file_name','preuve-bancaire.pdf',
    'payment_id','2b000000-0000-4000-8000-000000000601',
    'idempotency_key','2b000000-0000-4000-8000-000000000704',
    'uploaded_by','2b000000-0000-4000-8000-000000000001'
  ));

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000002','authenticated','aal2','session-reconcile-2l');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.snp_payment_proofs),1::bigint,
  'rapprocheur habilite lit la metadata');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='payment-proofs'),1::bigint,
  'rapprocheur habilite peut signer/lire objet exact');
SELECT is(pg_temp.try_decide_2l(
  '2b000000-0000-4000-8000-000000000601','2b000000-0000-4000-8000-000000000705'
),'OK:approved','approbation 4H reussit avec preuve exacte');
SELECT is((SELECT status FROM public.payments WHERE id='2b000000-0000-4000-8000-000000000601'),
  'approved','paiement approuve');
RESET ROLE;

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000003','authenticated','aal2','session-customer-2l');
SET LOCAL ROLE authenticated;
SELECT public.snp_session_enregistrer('pgTAP 2L','test','postgres','BF');
SELECT is((SELECT count(*) FROM public.snp_payment_proofs),0::bigint,
  'client sans capability finance ne lit pas la preuve');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='payment-proofs'),0::bigint,
  'client sans capability ne peut pas signer objet');
RESET ROLE;

SELECT pg_temp.set_claims_2l('2b000000-0000-4000-8000-000000000099','service_role','aal2','service-2l');
SELECT is((SELECT count(*) FROM public.snp_workflow_audit
  WHERE aggregate_type='international-payment' AND aggregate_id='2b000000-0000-4000-8000-000000000601'
    AND action='private-proof-attached'),1::bigint,'rattachement audite une fois');
SELECT is((SELECT count(*) FROM public.snp_payment_proofs
  WHERE file_path LIKE 'http%'),0::bigint,'aucune URL publique stockee');
SELECT ok((SELECT NOT public FROM storage.buckets WHERE id='payment-proofs'),
  'bucket reste prive apres le flux');

SELECT * FROM finish();
ROLLBACK;
