BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

SELECT plan(33);

SELECT ok(EXISTS(SELECT 1 FROM storage.buckets WHERE id='payment-proofs'),
  'bucket payment-proofs provisionne');
SELECT ok((SELECT NOT public FROM storage.buckets WHERE id='payment-proofs'),
  'bucket payment-proofs prive');
SELECT is((SELECT file_size_limit FROM storage.buckets WHERE id='payment-proofs'),
  10485760::bigint,'limite bucket 10 MiB');
SELECT is((SELECT allowed_mime_types FROM storage.buckets WHERE id='payment-proofs'),
  ARRAY['application/pdf','image/jpeg','image/png']::text[],'allowlist MIME fermee');

SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
  WHERE oid='public.snp_payment_proofs'::regclass),'metadata FORCE RLS');
SELECT is((SELECT count(*) FROM pg_constraint WHERE conrelid='public.snp_payment_proofs'::regclass
  AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (payment_id)'),1::bigint,
  'une seule preuve autoritative par paiement');
SELECT is((SELECT count(*) FROM pg_constraint WHERE conrelid='public.snp_payment_proofs'::regclass
  AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (file_path)'),1::bigint,
  'chemin objet unique');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='snp_payment_proofs'
    AND grantee IN('anon','authenticated')
    AND privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE')),0::bigint,
  'aucun DML client metadata');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='public'
  AND tablename='snp_payment_proofs' AND cmd='SELECT'
  AND roles&&ARRAY['authenticated'::name]),1::bigint,
  'seule lecture metadata authentifiee');

SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid=
  'public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)'::regprocedure),
  'rattachement SECURITY DEFINER');
SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public' AND routine_name='snp_paiement_preuve_rattacher'
    AND grantee='authenticated' AND privilege_type='EXECUTE'),1::bigint,
  'RPC rattachement allowlistee authenticated');
SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public' AND routine_name='snp_paiement_preuve_rattacher'
    AND grantee IN('PUBLIC','anon')),0::bigint,'RPC non exposee anon/PUBLIC');
SELECT ok(position('snp_require_capability(''sonasp.finance.execute'')' IN pg_get_functiondef(
  'public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)'::regprocedure))>0,
  'RPC exige capability finance execute');
SELECT ok(position('FOR UPDATE' IN pg_get_functiondef(
  'public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)'::regprocedure))>0,
  'RPC verrouille paiement et vente');
SELECT ok(position('snp_2l_payment_proof_object_matches' IN pg_get_functiondef(
  'public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)'::regprocedure))>0,
  'RPC exige objet Storage exact via helper autoritatif');
SELECT ok(position('payment-proofs/' IN pg_get_functiondef(
  'public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)'::regprocedure))>0,
  'chemin construit depuis paiement et idempotence');
SELECT ok(position('executed_by IS DISTINCT FROM v_actor' IN pg_get_functiondef(
  'public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)'::regprocedure))>0,
  'seul executeur JWT rattache sa preuve');
SELECT ok(position('snp_record_workflow_event' IN pg_get_functiondef(
  'public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)'::regprocedure))>0,
  'rattachement audite serveur');
SELECT ok(position('UPDATE public.payments' IN pg_get_functiondef(
  'public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)'::regprocedure))>0,
  'chemin legacy alimente uniquement par RPC');

SELECT ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.payments'::regclass
  AND tgname='snp_2l_require_private_proof_on_approval' AND NOT tgisinternal),
  'garde approbation metadata-backed installee');
SELECT ok(position('snp_2l_payment_proof_object_matches' IN pg_get_functiondef(
  'public.snp_2l_require_private_proof_on_approval()'::regprocedure))>0,
  'garde approbation exige objet prive exact');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='storage'
  AND tablename='objects' AND policyname='snp_2l_payment_proofs_storage_select'
  AND cmd='SELECT' AND permissive='PERMISSIVE'),1::bigint,
  'une policy Storage SELECT canonique cible le bucket');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='storage'
  AND tablename='objects' AND cmd IN('INSERT','UPDATE','DELETE','ALL')
  AND permissive='PERMISSIVE'
  AND coalesce(qual,'')||' '||coalesce(with_check,'') ILIKE '%payment-proofs%'),0::bigint,
  'aucune ecriture Storage permissive client payment-proofs');
SELECT ok(position('snp_session_est_active' IN pg_get_functiondef(
  'public.snp_2l_can_read_payment_proof(uuid,uuid)'::regprocedure))>0
  AND (SELECT provolatile='v' FROM pg_proc WHERE oid=
    'public.snp_2l_can_read_payment_proof(uuid,uuid)'::regprocedure),
  'lecture exige session active et conserve sa volatilite');
SELECT ok(position('sonasp.finance.reconcile' IN pg_get_functiondef(
  'public.snp_2l_can_read_payment_proof(uuid,uuid)'::regprocedure))>0
  AND position('mining_companies' IN pg_get_functiondef(
  'public.snp_2l_can_read_payment_proof(uuid,uuid)'::regprocedure))>0,
  'lecture exige rapprocheur habilite et vendeur SONASP autoritatif');
SELECT ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.snp_payment_proofs'::regclass
  AND tgname='snp_2l_payment_proof_rpc_only' AND NOT tgisinternal),
  'metadata immutable hors RPC');

SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid=
  'public.snp_2l_payment_proof_object_matches(text,text,bigint,text,text,uuid,uuid,uuid)'::regprocedure),
  'comparaison objet Storage SECURITY DEFINER');
SELECT ok(position('user_metadata' IN pg_get_functiondef(
  'public.snp_2l_payment_proof_object_matches(text,text,bigint,text,text,uuid,uuid,uuid)'::regprocedure))>0
  AND position('safe_file_name' IN pg_get_functiondef(
  'public.snp_2l_payment_proof_object_matches(text,text,bigint,text,text,uuid,uuid,uuid)'::regprocedure))>0
  AND position('idempotency_key' IN pg_get_functiondef(
  'public.snp_2l_payment_proof_object_matches(text,text,bigint,text,text,uuid,uuid,uuid)'::regprocedure))>0,
  'SHA nom paiement acteur et idempotence sont lies aux user_metadata serveur');
SELECT ok(position('pg_advisory_xact_lock' IN pg_get_functiondef(
  'public.snp_paiement_preuve_rattacher(uuid,text,text,bigint,text,text,uuid)'::regprocedure))>0,
  'rattachement concurrent serialise paiement et cle avant recheck');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid=
  'public.snp_paiements_preuve_reprise_lister()'::regprocedure)
  AND position('snp_require_capability(''sonasp.finance.execute'')' IN pg_get_functiondef(
  'public.snp_paiements_preuve_reprise_lister()'::regprocedure))>0,
  'reprise autoritative SECURITY DEFINER exige finance execute');
SELECT is((SELECT count(*) FROM information_schema.role_routine_grants
  WHERE specific_schema='public' AND routine_name='snp_paiements_preuve_reprise_lister'
    AND grantee='authenticated' AND privilege_type='EXECUTE'),1::bigint,
  'RPC reprise exposee seulement au navigateur authentifie');
SELECT is((SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='snp_payment_proofs'
    AND grantee='service_role' AND privilege_type='SELECT'),1::bigint,
  'gateway service_role peut confirmer un resultat RPC ambigu sans DML');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='storage'
  AND tablename='objects' AND permissive='RESTRICTIVE'
  AND policyname IN(
    'snp_2l_payment_proofs_storage_select_guard',
    'snp_2l_payment_proofs_storage_insert_guard',
    'snp_2l_payment_proofs_storage_update_guard',
    'snp_2l_payment_proofs_storage_delete_guard'
  )),4::bigint,'quatre gardes restrictives neutralisent les policies generiques');

SELECT * FROM finish();
ROLLBACK;
