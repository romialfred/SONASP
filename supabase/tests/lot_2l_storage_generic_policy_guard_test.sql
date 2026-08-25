BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.set_claims_2l_guard(
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

CREATE OR REPLACE FUNCTION pg_temp.try_insert_payment_proof_object()
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO storage.objects(id,bucket_id,name,owner_id,metadata,user_metadata)
  VALUES(gen_random_uuid(),'payment-proofs','forged/insert.pdf',auth.uid(),
    '{"size":8,"mimetype":"application/pdf"}'::jsonb,'{}'::jsonb);
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_update_payment_proof_object()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  UPDATE storage.objects SET user_metadata='{"forged":true}'::jsonb
  WHERE bucket_id='payment-proofs';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN 'ROWS:'||v_count;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_delete_payment_proof_object()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count bigint;
BEGIN
  DELETE FROM storage.objects WHERE bucket_id='payment-proofs';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN 'ROWS:'||v_count;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO PUBLIC;

-- Simule une regression catalogue : quatre policies permissives totalement
-- generiques. Les gardes RESTRICTIVE 2L doivent rester le dernier rempart.
CREATE POLICY snp_2l_test_generic_select ON storage.objects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY snp_2l_test_generic_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY snp_2l_test_generic_update ON storage.objects
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY snp_2l_test_generic_delete ON storage.objects
  FOR DELETE TO authenticated USING (true);

SELECT pg_temp.set_claims_2l_guard(
  '2c000000-0000-4000-8000-000000000099','service_role','aal2','service-guard-2l');
INSERT INTO storage.objects(id,bucket_id,name,owner_id,metadata,user_metadata)
VALUES(gen_random_uuid(),'payment-proofs','2c000000-0000-4000-8000-000000000001/proof.pdf',NULL,
  '{"size":8,"mimetype":"application/pdf"}'::jsonb,'{}'::jsonb);

SELECT plan(8);
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='storage'
  AND tablename='objects' AND policyname LIKE 'snp_2l_test_generic_%'
  AND permissive='PERMISSIVE'),4::bigint,'regression generique permissive simulee');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='storage'
  AND tablename='objects' AND policyname LIKE 'snp_2l_payment_proofs_storage_%_guard'
  AND permissive='RESTRICTIVE'),4::bigint,'quatre gardes restrictives actives');

SELECT pg_temp.set_claims_2l_guard(
  '2c000000-0000-4000-8000-000000000001','authenticated','aal2','session-guard-2l');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='payment-proofs'),0::bigint,
  'policy SELECT true ne contourne pas session/capability/metadata');
SELECT is(pg_temp.try_insert_payment_proof_object(),'ERR:42501',
  'policy INSERT true ne contourne pas le gateway');
SELECT ok(pg_temp.try_update_payment_proof_object() IN ('ROWS:0','ERR:42501'),
  'policy UPDATE true ne modifie aucun objet payment-proofs');
SELECT ok(pg_temp.try_delete_payment_proof_object() IN ('ROWS:0','ERR:42501'),
  'policy DELETE true ne supprime aucun objet payment-proofs');
RESET ROLE;

SELECT pg_temp.set_claims_2l_guard(
  '2c000000-0000-4000-8000-000000000099','service_role','aal2','service-guard-2l');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='payment-proofs'),1::bigint,
  'objet prive reste intact apres les tentatives navigateur');
SELECT ok((SELECT NOT public FROM storage.buckets WHERE id='payment-proofs'),
  'bucket reste prive sous regression de policy');

SELECT * FROM finish();
ROLLBACK;
