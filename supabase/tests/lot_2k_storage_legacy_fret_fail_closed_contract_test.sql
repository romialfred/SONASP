BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.try_insert_2k(p_name text)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO storage.objects(id,bucket_id,name,owner_id,metadata)
  VALUES(gen_random_uuid(),'freight-documents',p_name,auth.uid()::text,
         '{"size":64,"mimetype":"application/pdf"}'::jsonb);
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_update_2k()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count integer;
BEGIN
  UPDATE storage.objects
  SET user_metadata='{"forged":true}'::jsonb
  WHERE bucket_id='freight-documents';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN 'ROWS:'||v_count;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_delete_2k()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_count integer;
BEGIN
  DELETE FROM storage.objects WHERE bucket_id='freight-documents';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN 'ROWS:'||v_count;
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE;
END;
$fn$;

GRANT EXECUTE ON FUNCTION pg_temp.try_insert_2k(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION pg_temp.try_update_2k() TO PUBLIC;
GRANT EXECUTE ON FUNCTION pg_temp.try_delete_2k() TO PUBLIC;

SELECT plan(10);

SELECT ok(EXISTS(SELECT 1 FROM storage.buckets WHERE id='freight-documents'),
  'le bucket legacy existe');
SELECT ok((SELECT NOT public FROM storage.buckets WHERE id='freight-documents'),
  'le bucket legacy est privé');
SELECT is((SELECT file_size_limit FROM storage.buckets WHERE id='freight-documents'),
  10485760::bigint,'la limite legacy est de 10 MiB');
SELECT is((SELECT allowed_mime_types FROM storage.buckets WHERE id='freight-documents'),
  ARRAY['application/pdf']::text[],'le bucket legacy reste PDF-only');
SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND roles && ARRAY['public','anon','authenticated']::name[]
    AND coalesce(qual,'')||' '||coalesce(with_check,'') ILIKE '%freight-documents%'
    AND coalesce(qual,'')||' '||coalesce(with_check,'') NOT ILIKE '%freight-customs-documents%'),
  0::bigint,'aucune policy client ne vise freight-documents');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass),
  'RLS Storage reste active');

INSERT INTO storage.objects(id,bucket_id,name,owner_id,metadata)
VALUES(gen_random_uuid(),'freight-documents','shipment/legacy.pdf',NULL,
       '{"size":64,"mimetype":"application/pdf"}'::jsonb);

SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','27000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='freight-documents'),
  0::bigint,'authenticated ne lit aucun objet legacy');
SELECT is(pg_temp.try_insert_2k('shipment/forged.pdf'),'ERR:42501',
  'authenticated ne peut pas insérer dans le bucket legacy');
SELECT is(pg_temp.try_update_2k(),'ROWS:0',
  'authenticated ne peut pas modifier le bucket legacy');
SELECT is(pg_temp.try_delete_2k(),'ROWS:0',
  'authenticated ne peut pas supprimer le bucket legacy');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
