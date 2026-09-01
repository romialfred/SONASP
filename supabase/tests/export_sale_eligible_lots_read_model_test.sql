BEGIN;

DO $guard$
BEGIN
  IF current_database() NOT IN (
    'sonasp_sales_eligibility_20260901',
    'sonasp_sales_post154_20260901',
    'sonasp_release_20260830',
    'sonasp_iam_audit_full_release_20260830'
  ) THEN
    RAISE EXCEPTION 'Run only in an isolated SONASP test database.';
  END IF;
END;
$guard$;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();

CREATE FUNCTION pg_temp.eligible_claims(p_id uuid,p_session text,p_aal text DEFAULT 'aal2')
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',p_id::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.aal',p_aal,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_id,'role','authenticated','aal',p_aal,
    'session_id',p_session,
    'exp',floor(extract(epoch FROM clock_timestamp()))::bigint+3600
  )::text,true);
END;
$fn$;

CREATE FUNCTION pg_temp.try_eligible() RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM public.snp_lots_vente_export_eligibles();
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$fn$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

SELECT has_function(
  'public','snp_lots_vente_export_eligibles',ARRAY[]::text[],
  'the physical eligibility RPC exists'
);
SELECT function_returns(
  'public','snp_lots_vente_export_eligibles',ARRAY[]::text[],'jsonb',
  'the RPC exposes one bounded JSON document'
);
SELECT ok(
  has_function_privilege(
    'authenticated','public.snp_lots_vente_export_eligibles()','EXECUTE'
  ),
  'authenticated browser sessions may execute the read RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon','public.snp_lots_vente_export_eligibles()','EXECUTE'
  ) AND NOT has_function_privilege(
    'service_role','public.snp_lots_vente_export_eligibles()','EXECUTE'
  ),
  'anonymous and service roles cannot use the browser read RPC'
);
SELECT ok(
  EXISTS(
    SELECT 1 FROM public.snp_rpc_execution_allowlist allowlist
    WHERE allowlist.function_signature='snp_lots_vente_export_eligibles()'
      AND allowlist.grantee='authenticated'
      AND allowlist.purpose='runtime-browser'
  ),
  'the RPC is registered in the runtime allowlist'
);
SELECT ok(
  position('snp_actor_can_module_action(''sales'',''view'')' IN pg_get_functiondef(
    'public.snp_lots_vente_export_eligibles()'::regprocedure
  ))>0
  AND position('snp_actor_can_module_action(''sales'',''create'')' IN pg_get_functiondef(
    'public.snp_lots_vente_export_eligibles()'::regprocedure
  ))>0,
  'both sales view and create capabilities are mandatory'
);
SELECT ok(
  position('SONASP:exportable-stock' IN pg_get_functiondef(
    'public.snp_lots_vente_export_eligibles()'::regprocedure
  ))>0,
  'the read model shares the P0 stock serialization lock'
);
SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class WHERE oid='public.snp_export_sale_inventory_allocations'::regclass)
  AND
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class WHERE oid='public.snp_export_sale_physical_backing_gaps'::regclass),
  'the underlying P0 allocation and gap ledgers remain protected by forced RLS'
);

SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_eligible(),'42501','an unauthenticated request fails closed');
RESET ROLE;

INSERT INTO auth.users(
  id,instance_id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) VALUES
('73000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','eligible-owner@invalid.test','','{}','{}',now(),now()),
('73000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','eligible-customer@invalid.test','','{}','{}',now(),now());
INSERT INTO public.user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at)
VALUES
('73000000-0000-4000-8000-000000000001','eligible-owner@invalid.test','Owner éligibilité','owner',true,now()),
('73000000-0000-4000-8000-000000000002','eligible-customer@invalid.test','Client éligibilité','customer',true,now());
INSERT INTO public.user_sessions(user_id,token_hash,expires_at)
VALUES
('73000000-0000-4000-8000-000000000001',extensions.digest('eligible-owner-session','sha256'),now()+interval '1 hour'),
('73000000-0000-4000-8000-000000000002',extensions.digest('eligible-customer-session','sha256'),now()+interval '1 hour');

SELECT pg_temp.eligible_claims(
  '73000000-0000-4000-8000-000000000001','eligible-owner-session'
);
SET LOCAL ROLE authenticated;
SELECT ok(
  (public.snp_lots_vente_export_eligibles()->'diagnostic'->>'blocked')::boolean,
  'unresolved historical sales block the read model'
);
SELECT is(
  jsonb_array_length(public.snp_lots_vente_export_eligibles()->'lots'),0,
  'no lot leaks while historical physical gaps remain'
);
SELECT ok(
  NOT (public.snp_lots_vente_export_eligibles()->'diagnostic' ? 'sale_number'),
  'historical diagnostics expose no out-of-scope sale reference'
);
RESET ROLE;

DELETE FROM public.snp_export_sale_physical_backing_gaps;

INSERT INTO public.mining_companies(
  id,name,code,country,is_active,company_type
) VALUES(
  '73000000-0000-4000-8000-000000000101','Mine physique éligible',
  'ELIG-MINE','Burkina Faso',true,'production_mine'
);
INSERT INTO public.daily_production(
  id,production_date,bullion_grams,estimated_fineness_pct,pure_gold_grams,
  estimated_oz,bar_reference,mining_company_id,status
) VALUES(
  '73000000-0000-4000-8000-000000000201',current_date-20,
  3110.34768,100,3110.34768,100,'ELIG-BAR-1',
  '73000000-0000-4000-8000-000000000101','prepared'
);
INSERT INTO public.snp_achats_mines(
  id,numero_achat,mining_company_id,periode_debut,periode_fin,date_achat,
  quantite_oz,prix_once_fcfa,statut
) VALUES(
  '73000000-0000-4000-8000-000000000301','AC-MI-2026-ELIG01',
  '73000000-0000-4000-8000-000000000101',current_date-25,current_date-15,
  current_date-14,100,1000000,'validee'
);
INSERT INTO public.freight_shipments(
  id,reference_number,status,shipment_date,number_of_boxes,box_type,
  gold_price_usd_per_oz,exchange_rate,local_currency,mining_company_id,created_by
) VALUES(
  '73000000-0000-4000-8000-000000000401','HUM-ELIG-0001/2026','in_stock',
  now()-interval '10 days',1,'Caisse scellée',2500,600,'XOF',
  '73000000-0000-4000-8000-000000000101',
  '73000000-0000-4000-8000-000000000001'
);
INSERT INTO public.freight_shipment_productions(
  id,freight_shipment_id,production_id,production_date,bar_reference,
  bullion_grams,estimated_fineness_pct,pure_gold_grams,pure_gold_oz,added_by
) VALUES(
  '73000000-0000-4000-8000-000000000501',
  '73000000-0000-4000-8000-000000000401',
  '73000000-0000-4000-8000-000000000201',current_date-20,'ELIG-BAR-1',
  2488.278144,100,2488.278144,80,
  '73000000-0000-4000-8000-000000000001'
);
INSERT INTO public.gold_inventory(
  id,entry_date,freight_shipment_id,weight_before_melting_grams,
  weight_after_melting_grams,fineness_percentage,metal_retained_percentage,
  final_fine_grams,final_fine_oz,quantity_available_oz,transaction_type,
  mining_company_id,created_by
) VALUES(
  '73000000-0000-4000-8000-000000000601',current_date-5,
  '73000000-0000-4000-8000-000000000401',2177.243376,2177.243376,
  100,100,2177.243376,70,70,'entry',
  '73000000-0000-4000-8000-000000000101',
  '73000000-0000-4000-8000-000000000001'
);

SELECT pg_temp.eligible_claims(
  '73000000-0000-4000-8000-000000000001','eligible-owner-session'
);
SET LOCAL ROLE authenticated;
SELECT is(
  jsonb_array_length(public.snp_lots_vente_export_eligibles()->'lots'),1,
  'one exact mine-purchase lot is eligible'
);
SELECT is(
  public.snp_lots_vente_export_eligibles()->'lots'->0->>'source_type',
  'achat_mine','only a mine acquisition is returned'
);
SELECT is(
  round((public.snp_lots_vente_export_eligibles()->'lots'->0->>'disponible_oz')::numeric,6),
  70::numeric,
  'available quantity is bounded by the physical inventory capacity'
);
SELECT is(
  public.snp_lots_vente_export_eligibles()->'lots'->0->>'reference',
  'AC-MI-2026-ELIG01','the eligible acquisition reference is returned'
);

SELECT pg_temp.eligible_claims(
  '73000000-0000-4000-8000-000000000002','eligible-customer-session'
);
SELECT is(
  pg_temp.try_eligible(),'42501',
  'an active actor without sales view/create rights is denied'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
