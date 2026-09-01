BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(43);

-- Structure et filiation ---------------------------------------------------
SELECT has_table('public', 'freight_shipment_preparations',
  'la cardinalite complete preparation vers fret est materialisee');
SELECT has_table('public', 'freight_shipment_documents',
  'les documents Shipping disposent d un instantane fret');
SELECT has_table('public', 'snp_freight_create_operations',
  'le journal prive d idempotence existe');
SELECT has_column('public', 'freight_shipment_signatories',
  'source_shipping_signatory_id',
  'un signataire fret conserve sa filiation Shipping');

SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.freight_shipment_preparations'::regclass
    AND conname = 'freight_shipment_preparations_freight_company_fkey'
    AND contype = 'f' AND convalidated
), 'le fret et son association partagent le meme tenant');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.freight_shipment_preparations'::regclass
    AND conname = 'freight_shipment_preparations_shipping_company_fkey'
    AND contype = 'f' AND convalidated
), 'la preparation et son association partagent le meme tenant');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.freight_shipment_preparations'::regclass
    AND conname = 'freight_shipment_preparations_shipping_key'
    AND contype = 'u'
), 'une preparation ne peut alimenter qu un seul fret');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.freight_shipment_documents'::regclass
    AND conname = 'freight_shipment_documents_source_key'
    AND contype = 'u'
), 'un document source ne peut etre copie qu une fois');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname = 'uq_freight_signatories_source_shipping'
), 'un signataire source ne peut etre copie qu une fois');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.snp_freight_create_operations'::regclass
    AND conname = 'snp_freight_create_operations_completion_check'
    AND contype = 'c' AND convalidated
), 'une operation idempotente est soit reservee soit completement terminee');

-- Surface d attaque --------------------------------------------------------
SELECT is((
  SELECT count(*) FROM pg_class
  WHERE oid IN (
    'public.freight_shipment_preparations'::regclass,
    'public.freight_shipment_documents'::regclass,
    'public.snp_freight_create_operations'::regclass
  ) AND relrowsecurity AND relforcerowsecurity
), 3::bigint, 'RLS et FORCE RLS couvrent les trois nouvelles tables');
SELECT is((
  SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (
      'freight_shipment_preparations', 'freight_shipment_documents',
      'snp_freight_create_operations'
    )
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN (
      'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    )
), 0::bigint, 'aucun DML client n existe sur les nouvelles tables');
SELECT is((
  SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (
      'freight_shipment_preparations', 'freight_shipment_documents'
    )
    AND grantee = 'authenticated' AND privilege_type = 'SELECT'
), 2::bigint, 'authenticated ne recoit que les deux lectures tenant-scoped');
SELECT is((
  SELECT count(*) FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'freight_shipment_preparations', 'freight_shipment_documents',
      'snp_freight_create_operations'
    )
    AND roles && ARRAY['authenticated'::name]
    AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
), 0::bigint, 'aucune policy DML authenticated ne contourne la RPC');
SELECT ok(NOT has_table_privilege(
  'authenticated', 'public.freight_shipments', 'INSERT'
), 'authenticated ne cree plus directement le parent fret');
SELECT ok(NOT has_table_privilege(
  'authenticated', 'public.freight_shipment_productions', 'INSERT'
), 'authenticated ne cree plus directement les productions fret');
SELECT ok(NOT has_table_privilege(
  'authenticated', 'public.freight_shipment_signatories', 'INSERT'
), 'authenticated ne cree plus directement les signataires fret');

-- Contrat RPC --------------------------------------------------------------
SELECT ok(to_regprocedure(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'
) IS NOT NULL, 'la RPC atomique expose une signature stable');
SELECT ok(has_function_privilege(
  'authenticated',
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)',
  'EXECUTE'
), 'authenticated peut appeler la RPC atomique');
SELECT ok(NOT has_function_privilege(
  'anon',
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)',
  'EXECUTE'
), 'anon ne peut pas appeler la RPC atomique');
SELECT ok(NOT has_function_privilege(
  'authenticated', 'public.generate_freight_shipment_reference()', 'EXECUTE'
), 'le generateur de reference legacy n est plus exposable au client');
SELECT ok((
  SELECT prosecdef
  FROM pg_proc
  WHERE oid = 'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
), 'la RPC est SECURITY DEFINER et peut ecrire malgre la revocation DML');
SELECT is((
  SELECT provolatile::text
  FROM pg_proc
  WHERE oid = 'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
), 'v', 'la RPC transactionnelle est declaree VOLATILE');
SELECT ok(position('search_path' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'la RPC fixe son search_path');
SELECT ok((
  SELECT NOT (
    'p_productions' = ANY(proargnames)
    OR 'p_signatories' = ANY(proargnames)
    OR 'p_documents' = ANY(proargnames)
  )
  FROM pg_proc
  WHERE oid = 'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
), 'aucun enfant forgeable n est accepte en parametre');

-- Invariants verifies dans la definition serveur ---------------------------
SELECT ok(position('snp_mfa_satisfaite' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'la creation exige le MFA');
SELECT ok(position('snp_actor_can_module_action' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'la permission effective du module Shipping est verifiee');
SELECT ok(position('snp_fret_exiger_portee' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'capability et tenant sont verifies par la garde canonique');
SELECT ok(position('snp_freight_create_operations' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'la RPC reserve et complete sa cle d idempotence');
SELECT ok(position('snp-freight-create:' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'les appels concurrents de meme cle sont serialises');
SELECT ok(position('snp-freight-reference:' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'la generation de reference possede son verrou annuel');
SELECT ok(position('FOR UPDATE' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'preparations, productions et reservation sont verrouillees');
SELECT ok(position('FOR SHARE' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'signataires et documents sources sont stabilises pendant la copie');
SELECT ok(position('ready_for_expedition' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'seules les preparations pretes alimentent le fret');
SELECT ok(position('ready_for_customs' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'seules les productions pretes pour douane sont consommees');
SELECT ok(position('production.bullion_grams' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'le poids expedie est borne par la production autoritaire');
SELECT ok(position('production.pure_gold_grams' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'la quantite d or fin est bornee par la production autoritaire');
SELECT ok(position('preparation.total_net_weight_grams' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'les totaux de preparation sont rapproches de leurs lignes');
SELECT ok(position('p_number_of_boxes <> v_expected_boxes' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'le nombre de colis est derive et controle');
SELECT ok(position('INSERT INTO public.freight_shipment_productions' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'les productions sont copiees dans la meme transaction');
SELECT ok(position('INSERT INTO public.freight_shipment_signatories' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'les signataires sont copies dans la meme transaction');
SELECT ok(position('INSERT INTO public.freight_shipment_documents' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'les documents sont copies dans la meme transaction');
SELECT ok(position('snp_record_workflow_event' IN pg_get_functiondef(
  'public.snp_create_freight_shipment_atomic(uuid,uuid[],timestamptz,uuid,integer,text,numeric,numeric,text,text)'::regprocedure
)) > 0, 'la creation complete emet un evenement d audit');

SELECT * FROM finish();

ROLLBACK;
