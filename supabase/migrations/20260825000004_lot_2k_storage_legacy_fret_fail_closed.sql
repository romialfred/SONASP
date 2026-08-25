/*
  LOT 2K - Fermeture fail-closed du bucket legacy freight-documents.

  Le module freight_shipments conserve plusieurs références PDF directement
  sur la ligne parent, sans RPC atomique qui verrouille l'expédition, dérive le
  tenant et audite l'attachement. Tant que ce contrat n'existe pas, aucune
  policy client n'est recréée : les objets historiques deviennent inaccessibles
  plutôt que de rester publiquement partageables.

  Roll-forward uniquement : livrer ultérieurement une RPC parent/tenant et une
  policy SELECT metadata-backed avant de réactiver le service applicatif.
*/

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '0';

DO $preflight$
BEGIN
  IF to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL
     OR to_regclass('public.freight_shipments') IS NULL THEN
    RAISE EXCEPTION 'LOT 2K: socle Storage/freight_shipments absent.'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'freight-documents', 'freight-documents', false, 10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT(id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- PostgreSQL additionne les policies permissives par OR. Toute ancienne
-- policy visant ce bucket doit donc disparaître, quel que soit son nom.
DO $drop_legacy_freight_storage_policies$
DECLARE
  v_policy record;
  v_expression text;
BEGIN
  FOR v_policy IN
    SELECT policyname, roles,
           coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expression
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND roles && ARRAY['public','anon','authenticated']::name[]
  LOOP
    v_expression := v_policy.expression;
    IF (
      v_expression ILIKE '%freight-documents%'
      AND v_expression NOT ILIKE '%freight-customs-documents%'
    ) OR (
      v_policy.policyname ILIKE '%freight%document%'
      AND v_policy.policyname NOT ILIKE '%custom%'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
    END IF;
  END LOOP;
END;
$drop_legacy_freight_storage_policies$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $assert_fail_closed$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND roles && ARRAY['public','anon','authenticated']::name[]
      AND (
        (
          coalesce(qual, '') || ' ' || coalesce(with_check, '')
            ILIKE '%freight-documents%'
          AND coalesce(qual, '') || ' ' || coalesce(with_check, '')
            NOT ILIKE '%freight-customs-documents%'
        )
        OR (
          policyname ILIKE '%freight%document%'
          AND policyname NOT ILIKE '%custom%'
        )
      )
  ) THEN
    RAISE EXCEPTION 'LOT 2K: une policy client freight-documents subsiste.'
      USING ERRCODE = '55000';
  END IF;
END;
$assert_fail_closed$;

COMMIT;
