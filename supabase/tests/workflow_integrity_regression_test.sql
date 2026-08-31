BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;

SELECT plan(14);

SELECT has_function('public','snp_guard_export_sale_lot_stock',ARRAY[]::text[],
  'le stock export et la réserve partagent une garde atomique');
SELECT has_trigger('public','snp_ventes_lots','snp_export_sale_lot_stock_guard',
  'chaque lot export est contrôlé en base');
SELECT has_function('public','snp_guard_artisan_gold_sale_workflow',ARRAY[]::text[],
  'le workflow des ventes artisanales est gouverné en base');
SELECT has_trigger('public','snp_artisan_ventes_or','snp_00_artisan_gold_sale_workflow_guard',
  'les insertions, transitions et suppressions artisanales sont contrôlées');
SELECT has_function('public','snp_guard_conciliation_analysis_source',ARRAY[]::text[],
  'la provenance de l’analyse de conciliation est contrôlée');
SELECT has_trigger('public','snp_conciliations','snp_conciliation_analysis_source_guard',
  'une analyse non autoritative ne peut pas être persistée');
SELECT has_function('public','snp_guard_organization_hierarchy_cycle',ARRAY[]::text[],
  'la hiérarchie des organisations possède une garde anti-cycle');
SELECT has_trigger('public','snp_organizations','snp_organization_hierarchy_cycle_guard',
  'la garde anti-cycle est active');
SELECT has_table('public','snp_data_quality_issues',
  'les anomalies historiques sont conservées dans un registre de remédiation');
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.snp_data_quality_issues'::regclass),
  'le registre de qualité est protégé par RLS'
);
SELECT ok(
  position('31.1034768' IN pg_get_functiondef('public.calculate_final_fine()'::regprocedure))>0
  AND position('28.3495' IN pg_get_functiondef('public.calculate_final_fine()'::regprocedure))=0,
  'le calcul du stock utilise exclusivement l’once troy'
);
SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM public.snp_ventes_lots lot
    JOIN public.snp_achats_mines purchase ON purchase.id=lot.achat_mine_id
    WHERE lot.released_at IS NULL AND purchase.statut='en_attente'
  ),
  'aucun achat minier en attente n’alimente une vente export active'
);
SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace
    WHERE namespace.nspname='public' AND procedure.prosecdef
      AND NOT EXISTS(
        SELECT 1 FROM unnest(coalesce(procedure.proconfig,ARRAY[]::text[])) setting
        WHERE setting LIKE 'search_path=%'
      )
  ),
  'toutes les fonctions SECURITY DEFINER possèdent un search_path explicite'
);

INSERT INTO public.snp_organizations(
  id,code,name,organization_type,supervising_ministry_id,is_active
)
SELECT '73000000-0000-4000-8000-000000000001','TEST-CYCLE-A','Organisation test cycle A',
  'public_institution',ministry.id,true
FROM public.snp_ministries ministry WHERE ministry.code='MEMC';
INSERT INTO public.snp_organizations(
  id,code,name,organization_type,supervising_ministry_id,parent_organization_id,is_active
)
SELECT '73000000-0000-4000-8000-000000000002','TEST-CYCLE-B','Organisation test cycle B',
  'public_institution',ministry.id,'73000000-0000-4000-8000-000000000001',true
FROM public.snp_ministries ministry WHERE ministry.code='MEMC';
SELECT throws_ok(
  $$UPDATE public.snp_organizations
    SET parent_organization_id='73000000-0000-4000-8000-000000000002'
    WHERE id='73000000-0000-4000-8000-000000000001'$$,
  '23514','La hiérarchie organisationnelle contiendrait un cycle.',
  'un cycle organisationnel indirect est refusé'
);

SELECT * FROM finish();
ROLLBACK;
