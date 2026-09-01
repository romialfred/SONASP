BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(40);

-- Structure et surface d'ecriture -----------------------------------------
SELECT ok(EXISTS(
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.snp_achats_productions'::regclass
    AND tgname = 'trg_snp_verifier_achat_production' AND NOT tgisinternal
), 'la garde d allocation est installee');                                                -- 1
SELECT ok((
  SELECT pg_get_triggerdef(oid) ILIKE '%BEFORE INSERT OR UPDATE%'
  FROM pg_trigger
  WHERE tgrelid = 'public.snp_achats_productions'::regclass
    AND tgname = 'trg_snp_verifier_achat_production'
), 'INSERT et UPDATE sont controles avant ecriture');                                      -- 2
SELECT ok(EXISTS(
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.daily_production'::regclass
    AND tgname = 'snp_daily_production_engagement_guard' AND NOT tgisinternal
), 'la garde d immutabilite de production est installee');                                -- 3
SELECT ok((
  SELECT pg_get_triggerdef(oid) ILIKE '%production_date%mining_company_id%site_id%bar_reference%bullion_grams%estimated_oz%'
  FROM pg_trigger
  WHERE tgrelid = 'public.daily_production'::regclass
    AND tgname = 'snp_daily_production_engagement_guard'
), 'les colonnes identitaires et physiques sont couvertes');                              -- 4
SELECT ok((SELECT prosecdef FROM pg_proc
  WHERE oid='public.snp_verifier_achat_production()'::regprocedure),
  'la verification d allocation est SECURITY DEFINER');                                   -- 5
SELECT ok((SELECT prosecdef FROM pg_proc
  WHERE oid='public.snp_guard_engaged_production_measurements()'::regprocedure),
  'la garde de production est SECURITY DEFINER');                                          -- 6
SELECT is((SELECT proconfig::text FROM pg_proc
  WHERE oid='public.snp_verifier_achat_production()'::regprocedure),
  '{"search_path=pg_catalog, public, pg_temp"}', 'la verification fixe son search_path'); -- 7
SELECT is((
  SELECT count(*) FROM information_schema.role_routine_grants
  WHERE routine_schema='public'
    AND routine_name IN (
      'snp_verifier_achat_production',
      'snp_guard_engaged_production_measurements'
    )
    AND grantee IN ('PUBLIC','anon','authenticated','service_role')
), 0::bigint, 'aucun helper interne n est executable par les roles API');                   -- 8
SELECT ok((SELECT relrowsecurity FROM pg_class
  WHERE oid='public.snp_achats_productions'::regclass),
  'RLS est active sur les allocations');                                                   -- 9
SELECT ok((SELECT relforcerowsecurity FROM pg_class
  WHERE oid='public.snp_achats_productions'::regclass),
  'FORCE RLS est active sur les allocations');                                             -- 10
SELECT ok(has_table_privilege(
  'authenticated','public.snp_achats_productions','SELECT'
), 'authenticated conserve la lecture perimetree');                                       -- 11
SELECT is((
  SELECT count(*) FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='snp_achats_productions'
    AND grantee IN ('anon','authenticated','service_role')
    AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
), 0::bigint, 'aucun DML API ne contourne les fonctions serveur');                         -- 12
SELECT ok(position('FOR UPDATE' IN pg_get_functiondef(
  'public.snp_verifier_achat_production()'::regprocedure
)) > 0, 'la production est verrouillee avant calcul du disponible');                       -- 13
SELECT ok(position('FOR SHARE' IN pg_get_functiondef(
  'public.snp_verifier_achat_production()'::regprocedure
)) > 0, 'l achat est stabilise pendant l allocation');                                    -- 14
SELECT ok(position('v_deja + NEW.quantite_oz' IN pg_get_functiondef(
  'public.snp_verifier_achat_production()'::regprocedure
)) > 0, 'le cumul inter-achats est borne par estimated_oz');                               -- 15
SELECT ok(position('purchase.statut <> ''annulee''' IN pg_get_functiondef(
  'public.snp_guard_engaged_production_measurements()'::regprocedure
)) > 0, 'seuls les achats vivants figent une production');                                -- 16
SELECT ok(position('NEW.notes' IN pg_get_functiondef(
  'public.snp_guard_engaged_production_measurements()'::regprocedure
)) = 0, 'les notes ne font pas partie des donnees figees');                               -- 17

-- Fixtures isolees. replica ne sert qu'a creer des parents documentaires ;
-- toutes les mutations verifiees ensuite executent les triggers normalement.
SET LOCAL session_replication_role = replica;

INSERT INTO public.mining_companies(id,name,code,country) VALUES
  ('e2100000-0000-4000-8000-000000000001','Mine Engagee 1','ME1','BF'),
  ('e2100000-0000-4000-8000-000000000002','Mine Engagee 2','ME2','BF');

INSERT INTO public.daily_production(
  id,production_date,bullion_grams,estimated_fineness_pct,pure_gold_grams,
  estimated_oz,bar_reference,notes,site_id,mining_company_id,status,
  estimated_gold_pct,estimated_silver_pct,silver_content_grams
) VALUES
  ('e2100000-0000-4000-8000-000000000101','2026-06-10',311.034768,95,
   295.483,10,'BAR-E210-1','initiale','SITE-A','e2100000-0000-4000-8000-000000000001',
   'prepared',95,5,15.5517),
  ('e2100000-0000-4000-8000-000000000102','2026-06-11',311.034768,95,
   295.483,10,'BAR-E210-2',NULL,'SITE-B','e2100000-0000-4000-8000-000000000002',
   'prepared',95,5,15.5517),
  ('e2100000-0000-4000-8000-000000000103','2026-07-10',311.034768,95,
   295.483,10,'BAR-E210-3',NULL,'SITE-A','e2100000-0000-4000-8000-000000000001',
   'prepared',95,5,15.5517),
  ('e2100000-0000-4000-8000-000000000104','2026-06-12',311.034768,95,
   295.483,10,'BAR-E210-4',NULL,'SITE-A','e2100000-0000-4000-8000-000000000001',
   'cancelled',95,5,15.5517);

INSERT INTO public.snp_achats_mines(
  id,numero_achat,mining_company_id,periode_debut,periode_fin,quantite_oz,
  prix_once_fcfa,statut
) VALUES
  ('e2100000-0000-4000-8000-000000000201','ACH-E210-1',
   'e2100000-0000-4000-8000-000000000001','2026-06-01','2026-06-30',5,1000,'en_attente'),
  ('e2100000-0000-4000-8000-000000000202','ACH-E210-2',
   'e2100000-0000-4000-8000-000000000001','2026-06-01','2026-06-30',2,1000,'annulee'),
  ('e2100000-0000-4000-8000-000000000203','ACH-E210-3',
   'e2100000-0000-4000-8000-000000000001','2026-06-01','2026-06-30',6,1000,'en_attente');

SET LOCAL session_replication_role = origin;

-- Allocation valide et rejets d'integrite --------------------------------
SELECT lives_ok($q$
  INSERT INTO public.snp_achats_productions(id,achat_id,production_id,quantite_oz)
  VALUES ('e2100000-0000-4000-8000-000000000301',
          'e2100000-0000-4000-8000-000000000201',
          'e2100000-0000-4000-8000-000000000101',5)
$q$, 'une allocation achat valide est acceptee');                                          -- 18
SELECT is((SELECT sum(quantite_oz) FROM public.snp_achats_productions
  WHERE production_id='e2100000-0000-4000-8000-000000000101'), 5::numeric,
  'le cumul initial est exact');                                                           -- 19
SELECT throws_ok($q$
  INSERT INTO public.snp_achats_productions(achat_id,production_id,quantite_oz)
  VALUES ('e2100000-0000-4000-8000-000000000202',
          'e2100000-0000-4000-8000-000000000101',1)
$q$, '23514', NULL, 'un achat annule ne peut allouer une production');                     -- 20
SELECT throws_ok($q$
  INSERT INTO public.snp_achats_productions(achat_id,production_id,quantite_oz)
  VALUES ('e2100000-0000-4000-8000-000000000201',
          'e2100000-0000-4000-8000-000000000102',1)
$q$, '23514', NULL, 'une production d un autre tenant est refusee');                       -- 21
SELECT throws_ok($q$
  INSERT INTO public.snp_achats_productions(achat_id,production_id,quantite_oz)
  VALUES ('e2100000-0000-4000-8000-000000000201',
          'e2100000-0000-4000-8000-000000000103',1)
$q$, '23514', NULL, 'une production hors periode est refusee');                            -- 22
SELECT throws_ok($q$
  INSERT INTO public.snp_achats_productions(achat_id,production_id,quantite_oz)
  VALUES ('e2100000-0000-4000-8000-000000000201',
          'e2100000-0000-4000-8000-000000000104',1)
$q$, '23514', NULL, 'une production annulee est refusee');                                 -- 23
SELECT throws_ok($q$
  INSERT INTO public.snp_achats_productions(achat_id,production_id,quantite_oz)
  VALUES ('e2100000-0000-4000-8000-000000000203',
          'e2100000-0000-4000-8000-000000000101',6)
$q$, '23514', NULL, 'la surallocation inter-achats est refusee');                          -- 24

-- Gel de chaque dimension opposable ---------------------------------------
SELECT throws_ok($q$UPDATE public.daily_production SET production_date='2026-06-09'
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'la date est figee');                                                                    -- 25
SELECT throws_ok($q$UPDATE public.daily_production
  SET mining_company_id='e2100000-0000-4000-8000-000000000002'
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'la societe est figee');                                                                 -- 26
SELECT throws_ok($q$UPDATE public.daily_production SET site_id='SITE-Z'
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'le site est fige');                                                                     -- 27
SELECT throws_ok($q$UPDATE public.daily_production SET bar_reference='BAR-ALTEREE'
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'la reference est figee');                                                               -- 28
SELECT throws_ok($q$UPDATE public.daily_production SET bullion_grams=300
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'le poids brut est fige');                                                               -- 29
SELECT throws_ok($q$UPDATE public.daily_production SET estimated_fineness_pct=94
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'la finesse est figee');                                                                 -- 30
SELECT throws_ok($q$UPDATE public.daily_production SET estimated_gold_pct=94
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'la teneur or est figee');                                                               -- 31
SELECT throws_ok($q$UPDATE public.daily_production SET estimated_silver_pct=6
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'la teneur argent est figee');                                                           -- 32
SELECT throws_ok($q$UPDATE public.daily_production SET pure_gold_grams=290
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'le poids d or fin est fige');                                                           -- 33
SELECT throws_ok($q$UPDATE public.daily_production SET estimated_oz=9
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'la quantite en onces est figee');                                                       -- 34
SELECT throws_ok($q$UPDATE public.daily_production SET silver_content_grams=14
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$, '42501', NULL,
  'le poids d argent est fige');                                                           -- 35

SELECT lives_ok($q$UPDATE public.daily_production SET notes='observation corrigee'
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$,
  'les notes restent modifiables');                                                        -- 36
SELECT is((SELECT notes FROM public.daily_production
  WHERE id='e2100000-0000-4000-8000-000000000101'), 'observation corrigee',
  'la nouvelle note est conservee');                                                       -- 37
SELECT lives_ok($q$UPDATE public.snp_achats_mines SET statut='annulee'
  WHERE id='e2100000-0000-4000-8000-000000000201'$q$,
  'l annulation de l achat libere ses engagements');                                       -- 38
SELECT is((SELECT count(*) FROM public.snp_achats_productions
  WHERE achat_id='e2100000-0000-4000-8000-000000000201'), 0::bigint,
  'les allocations de l achat annule sont liberees');                                     -- 39
SELECT lives_ok($q$UPDATE public.daily_production SET estimated_oz=9
  WHERE id='e2100000-0000-4000-8000-000000000101'$q$,
  'la correction physique redevient possible apres liberation');                          -- 40

SELECT * FROM finish();

ROLLBACK;
