BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(48);

-- Structure, surface d'attaque et idempotence -----------------------------
SELECT has_table('public', 'snp_conciliation_financial_sync',
  'le journal prive de synchronisation existe');                                           -- 1
SELECT ok(EXISTS(
  SELECT 1 FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname = 'uq_snp_avoirs_client_conciliation'
    AND indexdef ILIKE '%UNIQUE%conciliation_id%WHERE%'
), 'un seul avoir est autorise par conciliation');                                         -- 2
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.snp_avoirs_client'::regclass
    AND conname = 'snp_avoirs_client_devise_iso_check'
    AND convalidated
), 'la devise de l avoir est explicitement normalisee');                                   -- 3
SELECT ok((
  SELECT relrowsecurity
  FROM pg_class WHERE oid = 'public.snp_conciliation_financial_sync'::regclass
), 'RLS couvre le journal de synchronisation');                                             -- 4
SELECT ok((
  SELECT relforcerowsecurity
  FROM pg_class WHERE oid = 'public.snp_conciliation_financial_sync'::regclass
), 'FORCE RLS couvre le journal de synchronisation');                                       -- 5
SELECT is((
  SELECT count(*)
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'snp_conciliation_financial_sync'
    AND grantee IN ('anon','authenticated')
), 0::bigint, 'aucun privilege client n est accorde au journal prive');                     -- 6
SELECT ok(to_regprocedure(
  'public.snp_apply_validated_conciliation_financials(uuid,uuid)'
) IS NOT NULL, 'le helper transactionnel existe');                                         -- 7
SELECT ok((
  SELECT prosecdef FROM pg_proc
  WHERE oid = 'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
), 'le helper est SECURITY DEFINER');                                                       -- 8
SELECT is((
  SELECT provolatile::text FROM pg_proc
  WHERE oid = 'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
), 'v', 'le helper est VOLATILE');                                                          -- 9
SELECT is((
  SELECT proconfig::text FROM pg_proc
  WHERE oid = 'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
), '{"search_path=pg_catalog, public, pg_temp"}', 'le helper fixe un search_path sur');     -- 10
SELECT is((
  SELECT count(*) FROM information_schema.role_routine_grants
  WHERE routine_schema = 'public'
    AND routine_name = 'snp_apply_validated_conciliation_financials'
    AND grantee IN ('PUBLIC','anon','authenticated','service_role')
), 0::bigint, 'le helper interne n est appelable par aucun role API');                      -- 11
SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.snp_conciliation_valider_pre_financial_sync(uuid,uuid)', 'EXECUTE'
), 'le validateur historique est devenu prive');                                           -- 12
SELECT ok(has_function_privilege(
  'authenticated', 'public.snp_conciliation_valider(uuid,uuid)', 'EXECUTE'
), 'authenticated conserve la facade stable');                                             -- 13
SELECT ok(NOT has_function_privilege(
  'anon', 'public.snp_conciliation_valider(uuid,uuid)', 'EXECUTE'
), 'anon ne peut pas valider une conciliation');                                            -- 14

-- Contrat transactionnel --------------------------------------------------
SELECT ok(position('snp_conciliation_valider_pre_financial_sync'
  IN pg_get_functiondef('public.snp_conciliation_valider(uuid,uuid)'::regprocedure)) > 0,
  'la facade conserve le traitement metier historique');                                   -- 15
SELECT ok(position('snp_apply_validated_conciliation_financials'
  IN pg_get_functiondef('public.snp_conciliation_valider(uuid,uuid)'::regprocedure)) > 0,
  'la facade applique la synchronisation dans la meme transaction');                       -- 16
SELECT ok(position('FROM public.snp_conciliations c'
  IN pg_get_functiondef(
    'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
  )) < position('FROM public.sales s'
  IN pg_get_functiondef(
    'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
  )), 'l ordre de verrouillage est conciliation puis vente');                               -- 17
SELECT ok(position('FOR UPDATE' IN pg_get_functiondef(
  'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
)) > 0, 'les agregats sont serialises par verrou pessimiste');                             -- 18
SELECT ok(position('devise_initiale IS DISTINCT FROM v_currency'
  IN pg_get_functiondef(
    'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
  )) > 0 AND position('v_sale.currency IS DISTINCT FROM v_currency'
  IN pg_get_functiondef(
    'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
  )) > 0, 'conciliation et vente partagent la meme devise explicite');                      -- 19
SELECT ok(position('final_proceeds = v_final'
  IN pg_get_functiondef(
    'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
  )) > 0, 'ca_final alimente le montant canonique de la vente');                            -- 20
SELECT ok(position('ON CONFLICT (conciliation_id)'
  IN pg_get_functiondef(
    'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
  )) > 0, 'la creation de l avoir est idempotente');                                        -- 21
SELECT ok(position('p.status = ''approved'''
  IN pg_get_functiondef(
    'public.snp_apply_validated_conciliation_financials(uuid,uuid)'::regprocedure
  )) > 0, 'seuls les paiements approuves engendrent un avoir');                             -- 22
SELECT ok(position('v_other_active + NEW.amount > v_final'
  IN pg_get_functiondef('public.snp_4h_guard_payment_row()'::regprocedure)) > 0,
  'la garde canonique borne strictement tout nouveau paiement actif');                      -- 23
SELECT ok(position('FOR UPDATE'
  IN pg_get_functiondef('public.snp_4h_guard_payment_row()'::regprocedure)) > 0,
  'la garde de paiement verrouille la vente avant de sommer');                              -- 24
SELECT ok(position('current_user NOT IN (''anon'',''authenticated'')'
  IN pg_get_functiondef('public.snp_4h_guard_payment_row()'::regprocedure)) > 0,
  'un client ne peut pas forger le marker RPC');                                            -- 25
SELECT ok(EXISTS(
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.sales'::regclass
    AND tgname = 'snp_reconciled_sale_financials_guard'
    AND NOT tgisinternal
), 'la vente conciliee est protegee par un trigger dedie');                                 -- 26
SELECT ok(position('facture_definitive_generee'
  IN pg_get_functiondef('public.snp_guard_reconciled_sale_financials()'::regprocedure)) > 0,
  'la garde couvre tous les statuts post-validation');                                      -- 27
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.payments'::regclass
    AND conname = 'payments_4h_canonical_status_check'
    AND convalidated
), 'le vocabulaire canonique des paiements est valide');                                   -- 28
SELECT ok(NOT EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'public.payments'::regclass
    AND conname = 'payments_status_check'
) AND EXISTS(
  SELECT 1 FROM pg_trigger
  WHERE tgrelid = 'public.payments'::regclass
    AND tgname = 'snp_payments_99_sync_sale_summary'
    AND NOT tgisinternal AND tgdeferrable AND tginitdeferred
), 'le statut processing et son resume differe sont canoniques');                          -- 29
SELECT ok(position('NEW.devise := v_currency'
  IN pg_get_functiondef(
    'public.snp_normalize_conciliation_commercial_entry()'::regprocedure
  )) > 0 AND EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.snp_grand_livre_commercial'::regclass
      AND conname = 'snp_glc_conciliation_currency_complete_check'
      AND convalidated
  ), 'tout mouvement de conciliation porte devise et conversion explicites');               -- 30

-- Fixtures isolees : replica sert uniquement a contourner les nombreuses FK
-- documentaires sans desactiver les contraintes CHECK. Les fonctions testees
-- ci-dessous s'executent ensuite avec tous les triggers actifs.
SET LOCAL session_replication_role = replica;

INSERT INTO public.customers(id,name,email,country) VALUES
  ('6c130000-0000-4000-8000-000000000001','Client Sync 1','sync1@example.test','BF'),
  ('6c130000-0000-4000-8000-000000000002','Client Sync 2','sync2@example.test','BF'),
  ('6c130000-0000-4000-8000-000000000003','Client Sync 3','sync3@example.test','BF');
INSERT INTO public.mining_companies(id,name,code,country) VALUES
  ('6c130000-0000-4000-8000-000000000010','Mine Sync','MSYNC','BF');
INSERT INTO public.sales(
  id,sale_number,customer_id,quantity_oz,london_am_rate,gross_proceeds,
  net_proceeds,royalty_amount,final_proceeds,total_amount,currency,status,seller_type
) VALUES
  ('6c130000-0000-4000-8000-000000000101','SL-2026-931',
   '6c130000-0000-4000-8000-000000000001',10,100,1200,1200,0,1200,1200,
   'USD','virtual_payment','sonasp'),
  ('6c130000-0000-4000-8000-000000000102','SL-2026-932',
   '6c130000-0000-4000-8000-000000000002',10,100,1000,1000,0,1000,1000,
   'USD','virtual_payment','sonasp'),
  ('6c130000-0000-4000-8000-000000000103','SL-2026-933',
   '6c130000-0000-4000-8000-000000000003',10,100,1000,1000,0,1000,1000,
   'USD','virtual_payment','sonasp');
INSERT INTO public.snp_conciliations(
  id,reference,sale_id,mining_company_id,customer_id,source_analyse_type,
  assay_certificate_id,ca_initial,ca_final,devise_initiale,devise_finale,
  statut,valide_par,valide_le
) VALUES
  ('6c130000-0000-4000-8000-000000000201','CONC-2026-931',
   '6c130000-0000-4000-8000-000000000101','6c130000-0000-4000-8000-000000000010',
   '6c130000-0000-4000-8000-000000000001','certificat_acheteur',
   '6c130000-0000-4000-8000-000000000301',1200,1000,'USD','USD','validee',
   '6c130000-0000-4000-8000-000000000401',clock_timestamp()),
  ('6c130000-0000-4000-8000-000000000202','CONC-2026-932',
   '6c130000-0000-4000-8000-000000000102','6c130000-0000-4000-8000-000000000010',
   '6c130000-0000-4000-8000-000000000002','certificat_acheteur',
   '6c130000-0000-4000-8000-000000000302',1000,1200,'USD','USD','validee',
   '6c130000-0000-4000-8000-000000000401',clock_timestamp()),
  ('6c130000-0000-4000-8000-000000000203','CONC-2026-933',
   '6c130000-0000-4000-8000-000000000103','6c130000-0000-4000-8000-000000000010',
   '6c130000-0000-4000-8000-000000000003','certificat_acheteur',
   '6c130000-0000-4000-8000-000000000303',1000,900,'EUR','EUR','validee',
   '6c130000-0000-4000-8000-000000000401',clock_timestamp());
INSERT INTO public.payments(
  id,sale_id,customer_id,expected_date,amount,currency,status,is_virtual,payment_type,version
) VALUES
  ('6c130000-0000-4000-8000-000000000501','6c130000-0000-4000-8000-000000000101',
   '6c130000-0000-4000-8000-000000000001',current_date,700,'USD','approved',false,'actual',1),
  ('6c130000-0000-4000-8000-000000000502','6c130000-0000-4000-8000-000000000101',
   '6c130000-0000-4000-8000-000000000001',current_date,500,'USD','approved',false,'actual',1),
  ('6c130000-0000-4000-8000-000000000503','6c130000-0000-4000-8000-000000000102',
   '6c130000-0000-4000-8000-000000000002',current_date,400,'USD','approved',false,'actual',1),
  ('6c130000-0000-4000-8000-000000000504','6c130000-0000-4000-8000-000000000102',
   '6c130000-0000-4000-8000-000000000002',current_date,200,'USD','processing',false,'actual',1),
  ('6c130000-0000-4000-8000-000000000505','6c130000-0000-4000-8000-000000000102',
   '6c130000-0000-4000-8000-000000000002',current_date,400,'USD','pending',true,'virtual',1);

SET LOCAL session_replication_role = origin;

-- Scenarios PostgreSQL reels ----------------------------------------------
SELECT lives_ok($q$
  SELECT public.snp_apply_validated_conciliation_financials(
    '6c130000-0000-4000-8000-000000000201', NULL
  )
$q$, 'la baisse definitive est synchronisee atomiquement');                               -- 31
SELECT is((SELECT final_proceeds FROM public.sales
  WHERE id='6c130000-0000-4000-8000-000000000101'), 1000::numeric,
  'ca_final devient final_proceeds');                                                       -- 32
SELECT is((SELECT payment_amount FROM public.sales
  WHERE id='6c130000-0000-4000-8000-000000000101'), 1200::numeric,
  'le resume conserve tous les paiements actifs reels');                                   -- 33
SELECT is((SELECT status::text FROM public.sales
  WHERE id='6c130000-0000-4000-8000-000000000101'), 'payment_received',
  'la vente trop payee est financierement recue');                                         -- 34
SELECT is((SELECT count(*) FROM public.snp_avoirs_client
  WHERE conciliation_id='6c130000-0000-4000-8000-000000000201'), 1::bigint,
  'un seul avoir est cree');                                                               -- 35
SELECT is((SELECT montant_initial FROM public.snp_avoirs_client
  WHERE conciliation_id='6c130000-0000-4000-8000-000000000201'), 200::numeric,
  'l avoir egale strictement le trop-percu approuve');                                     -- 36
SELECT is((SELECT devise FROM public.snp_avoirs_client
  WHERE conciliation_id='6c130000-0000-4000-8000-000000000201'), 'USD',
  'l avoir conserve la devise contractuelle');                                             -- 37
SELECT is((SELECT count(*) FROM public.snp_conciliation_financial_sync
  WHERE conciliation_id='6c130000-0000-4000-8000-000000000201'), 1::bigint,
  'une seule preuve d audit est inscrite');                                                 -- 38
SELECT lives_ok($q$
  SELECT public.snp_apply_validated_conciliation_financials(
    '6c130000-0000-4000-8000-000000000201', NULL
  )
$q$, 'la relecture idempotente reussit');                                                   -- 39
SELECT is((SELECT count(*) FROM public.snp_avoirs_client
  WHERE conciliation_id='6c130000-0000-4000-8000-000000000201'), 1::bigint,
  'la relecture ne double pas l avoir');                                                    -- 40
SELECT lives_ok($q$
  SELECT public.snp_apply_validated_conciliation_financials(
    '6c130000-0000-4000-8000-000000000202', NULL
  )
$q$, 'la hausse definitive recalcule le solde');                                            -- 41
SELECT is((SELECT final_proceeds FROM public.sales
  WHERE id='6c130000-0000-4000-8000-000000000102'), 1200::numeric,
  'la hausse est propagee a la vente');                                                     -- 42
SELECT is((SELECT amount FROM public.payments
  WHERE id='6c130000-0000-4000-8000-000000000505'), 600::numeric,
  'l engagement virtuel devient le solde exact');                                          -- 43
SELECT is((SELECT count(*) FROM public.snp_avoirs_client
  WHERE conciliation_id='6c130000-0000-4000-8000-000000000202'), 0::bigint,
  'aucun avoir n est invente sans trop-percu approuve');                                   -- 44
SELECT throws_ok($q$
  SELECT public.snp_apply_validated_conciliation_financials(
    '6c130000-0000-4000-8000-000000000203', NULL
  )
$q$, '23514', NULL, 'une devise incoherente bloque toute synchronisation');                 -- 45

SELECT set_config('sonasp.payment_4h_rpc', '1', true);
SELECT throws_ok($q$
  INSERT INTO public.payments(
    id,sale_id,customer_id,expected_date,amount,currency,status,is_virtual,payment_type
  ) VALUES (
    '6c130000-0000-4000-8000-000000000506',
    '6c130000-0000-4000-8000-000000000102',
    '6c130000-0000-4000-8000-000000000002',current_date,
    600.01,'USD','processing',false,'actual'
  )
$q$, '23514', NULL, 'un paiement ulterieur ne peut depasser le nouveau total');             -- 46
SELECT set_config('sonasp.payment_4h_rpc', '0', true);

SELECT throws_ok($q$
  UPDATE public.sales SET final_proceeds=999
  WHERE id='6c130000-0000-4000-8000-000000000101'
$q$, '42501', NULL, 'le montant final concilie ne peut plus etre modifie directement');     -- 47
SELECT is((SELECT count(*) FROM public.snp_conciliation_financial_sync
  WHERE conciliation_id IN (
    '6c130000-0000-4000-8000-000000000201',
    '6c130000-0000-4000-8000-000000000202'
  )), 2::bigint, 'chaque conciliation validee possede exactement une trace');                -- 48

SELECT * FROM finish();

ROLLBACK;
