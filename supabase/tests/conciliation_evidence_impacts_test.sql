-- Test métier transactionnel sur une copie isolée du schéma réel.
BEGIN;
DO $$ BEGIN IF current_database() NOT LIKE 'sonasp_iam_audit_%' AND current_database()<>'sonasp_release_20260830' THEN RAISE EXCEPTION 'Base isolée requise.'; END IF; END $$;
SET LOCAL search_path=public,extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
INSERT INTO snp_capability_catalog(code,domain,label,description,sensitive)
SELECT code,'reconciliation',code,'Test conciliation',code<>'reconciliation.read' FROM unnest(ARRAY['reconciliation.read','reconciliation.create','reconciliation.edit','reconciliation.approve']) code ON CONFLICT DO NOTHING;
INSERT INTO auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
SELECT ('32000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','conciliation-'||n||'@example.invalid','{}','{}' FROM generate_series(1,3) n;
INSERT INTO mining_companies(id,code,name,country,company_type,is_active)
VALUES('32000000-0000-4000-8000-000000000101','CON-MINE','Mine test','Burkina Faso','production_mine',true);
INSERT INTO user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at)
SELECT ('32000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'conciliation-'||n||'@example.invalid','Acteur conciliation '||n,CASE WHEN n<3 THEN 'owner' ELSE 'customer' END,true,now() FROM generate_series(1,3) n;
INSERT INTO user_sessions(user_id,expires_at,token_hash)
SELECT ('32000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour',extensions.digest('conciliation-session-'||n,'sha256') FROM generate_series(1,3) n;
CREATE FUNCTION pg_temp.claims(n integer,aal text DEFAULT 'aal2') RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub','32000000-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated','aal',aal,'session_id','conciliation-session-'||n,'exp',extract(epoch FROM now()+interval '1 hour'))::text,true); END $$;
CREATE FUNCTION pg_temp.try_sql(statement text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE statement; RETURN 'OK'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Conciliation test: % %',SQLSTATE,SQLERRM; RETURN SQLSTATE; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;
SELECT pg_temp.claims(1);
INSERT INTO customers(id,name,email,country) VALUES('32000000-0000-4000-8000-000000000201','Acheteur test','buyer@example.invalid','Suisse');
INSERT INTO refineries(id,name,location,country,email,phone) VALUES('32000000-0000-4000-8000-000000000301','Raffinerie test','Test','Suisse','ref@example.invalid','000');
INSERT INTO shipping_preparations(id,expedition_lot_number,refinery_id,shipped_at,total_net_weight_grams,mining_company_id)
SELECT ('32000000-0000-4000-8000-'||lpad((400+n)::text,12,'0'))::uuid,'CON-SP-'||n,'32000000-0000-4000-8000-000000000301',CASE WHEN n=1 THEN NULL ELSE now() END,1000,'32000000-0000-4000-8000-000000000101' FROM generate_series(1,2) n;
INSERT INTO sales(id,sale_number,customer_id,seller_id,seller_type,quantity_oz,london_am_rate,gross_proceeds,net_proceeds,royalty_amount,final_proceeds,total_amount,sale_date,currency,shipping_preparation_id)
SELECT ('32000000-0000-4000-8000-'||lpad((500+n)::text,12,'0'))::uuid,'CON-SALE-'||n,'32000000-0000-4000-8000-000000000201','32000000-0000-4000-8000-000000000101','mining_company',900/31.1034768,2000,57871.34,57871.34,0,57871.34,57871.34,current_date,'USD',CASE WHEN n<3 THEN NULL ELSE ('32000000-0000-4000-8000-'||lpad((398+n)::text,12,'0'))::uuid END FROM generate_series(1,4) n;
SELECT no_plan();
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_ouvrir('32000000-0000-4000-8000-000000000501',gen_random_uuid())$$),'23514','pas de conciliation sans expédition');
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_ouvrir('32000000-0000-4000-8000-000000000503',gen_random_uuid())$$),'23514','pas de conciliation pour une préparation non expédiée');
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_ouvrir('32000000-0000-4000-8000-000000000504',gen_random_uuid())$$),'OK','Owner ouvre le lot réellement expédié');
SELECT is((SELECT poids_initial_g FROM snp_conciliations WHERE sale_id='32000000-0000-4000-8000-000000000504'),1000::numeric,'poids déclaré = métal net, pas or fin');
SELECT is((SELECT teneur_initiale_pct FROM snp_conciliations WHERE sale_id='32000000-0000-4000-8000-000000000504'),90::numeric,'pureté initiale cohérente');
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO assay_certificates(id,certificate_number,file_name,file_path,shipping_preparation_id,approval_status,approved_by,approved_at,purity_percent)
SELECT ('32000000-0000-4000-8000-'||lpad((600+n)::text,12,'0'))::uuid,'CON-CERT-'||n,'cert.pdf','32000000-0000-4000-8000-'||lpad((400+n)::text,12,'0')||'/cert.pdf',('32000000-0000-4000-8000-'||lpad((400+n)::text,12,'0'))::uuid,'approved','32000000-0000-4000-8000-000000000002',now(),89.5 FROM generate_series(1,2) n;
INSERT INTO assay_certificate_data(certificate_id,shipping_preparation_id,total_weight_g,gold_purity_percentage,is_verified)
VALUES('32000000-0000-4000-8000-000000000602','32000000-0000-4000-8000-000000000402',990,89.5,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.claims(1);
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_enregistrer_analyse((SELECT id FROM snp_conciliations LIMIT 1),'certificat_acheteur','32000000-0000-4000-8000-000000000601',990,89.5,2000,current_date,gen_random_uuid())$$),'42501','certificat d’une autre expédition refusé');
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_enregistrer_analyse((SELECT id FROM snp_conciliations LIMIT 1),'certificat_acheteur','32000000-0000-4000-8000-000000000602',900,89.5,2000,current_date,gen_random_uuid())$$),'23514','poids fin initial interdit comme poids du lot');
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_enregistrer_analyse((SELECT id FROM snp_conciliations LIMIT 1),'certificat_acheteur','32000000-0000-4000-8000-000000000602',990,89.5,2000,current_date,gen_random_uuid())$$),'OK','mesures vérifiées de la bonne expédition acceptées');
SELECT is((SELECT or_fin_final_g FROM snp_conciliations LIMIT 1),886.05::numeric,'une seule application de la pureté');
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_valider((SELECT id FROM snp_conciliations LIMIT 1),gen_random_uuid())$$),'42501','Owner ne valide pas sa propre analyse');
SELECT pg_temp.claims(3);
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_impacts_fiscaux((SELECT id FROM snp_conciliations LIMIT 1))$$),'42501','projection fiscale fermée hors périmètre');
SELECT pg_temp.claims(1);
RESET ROLE;
INSERT INTO snp_regles_fiscales(id,code_taxe,libelle,assiette,mode_calcul,taux,date_effet,statut,approuve_par,approuve_le,profil_vendeur)
VALUES('32000000-0000-4000-8000-000000000701','fndl','Règle test','ca_ht','taux',0.02,current_date-1,'approuvee','32000000-0000-4000-8000-000000000002',now(),'mine_industrielle');
INSERT INTO fx_rates_daily(rate_date,currency_pair,rate,notes) VALUES(current_date,'USD/XOF',600,'Taux synthétique de test');
SET LOCAL ROLE authenticated;
SELECT is((SELECT x->>'etat' FROM jsonb_array_elements(snp_conciliation_impacts_fiscaux((SELECT id FROM snp_conciliations LIMIT 1))) x WHERE x->>'code_taxe'='fndl'),'base_initiale_absente','absence de base initiale signalée et non remplacée par zéro');
SELECT pg_temp.claims(2);
RESET ROLE;
UPDATE snp_conciliations SET ca_initial=NULL;
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_valider((SELECT id FROM snp_conciliations LIMIT 1),gen_random_uuid())$$),'23514','montant initial absent jamais remplacé par zéro');
RESET ROLE;
UPDATE snp_conciliations SET ca_initial=57871.34;
UPDATE snp_conciliations SET devise_finale='EUR';
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_valider((SELECT id FROM snp_conciliations LIMIT 1),gen_random_uuid())$$),'23514','devises initiale et finale incompatibles refusées');
RESET ROLE;
UPDATE snp_conciliations SET devise_finale='USD';
DELETE FROM fx_rates_daily WHERE notes='Taux synthétique de test';
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_valider((SELECT id FROM snp_conciliations LIMIT 1),gen_random_uuid())$$),'23514','aucune contrevaleur XOF sans taux documenté au fixing');
RESET ROLE;
INSERT INTO fx_rates_daily(rate_date,currency_pair,rate,notes) VALUES(current_date,'USD/XOF',600,'Taux synthétique de test');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_valider((SELECT id FROM snp_conciliations LIMIT 1),gen_random_uuid())$$),'23514','validation bloquée si fiscalité historique manquante');
SELECT is((SELECT count(*) FROM snp_grand_livre_commercial),0::bigint,'échec fiscal annule aussi l’ajustement commercial');
RESET ROLE;
INSERT INTO snp_calculs_fiscaux(code_taxe,assiette_retenue,montant_assiette,taux_applique,formule,montant_obtenu,devise,contexte_type,contexte_id,mining_company_id)
VALUES('fndl','ca_ht',57871.34,0.01,'base historique test',578.71,'USD','vente','32000000-0000-4000-8000-000000000504','32000000-0000-4000-8000-000000000101');
SET LOCAL ROLE authenticated;
SELECT is((SELECT (x->>'initial')::numeric FROM jsonb_array_elements(snp_conciliation_impacts_fiscaux((SELECT id FROM snp_conciliations LIMIT 1))) x WHERE x->>'code_taxe'='fndl'),578.71::numeric,'le taux final 2 % ne réécrit pas la taxe initiale à 1 %');
RESET ROLE;
SELECT is(pg_temp.try_sql($$UPDATE snp_conciliations SET assay_certificate_id=NULL,source_analyse_type=NULL$$),'23514','la contrainte interdit une analyse enregistrée sans preuve');
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_valider((SELECT id FROM snp_conciliations LIMIT 1),'32000000-0000-4000-8000-000000000801')$$),'OK','validation atomique par un autre Owner');
SELECT is((SELECT devise FROM snp_grand_livre_fiscal LIMIT 1),'USD','devise fiscale conservée');
SELECT is((SELECT devise FROM snp_grand_livre_commercial LIMIT 1),'USD','devise commerciale conservée');
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_valider((SELECT id FROM snp_conciliations LIMIT 1),'32000000-0000-4000-8000-000000000801')$$),'OK','réessai idempotent');
SELECT is((SELECT count(*) FROM snp_grand_livre_fiscal),1::bigint,'aucun double ajustement fiscal');
SELECT is((SELECT count(*) FROM snp_grand_livre_fiscal WHERE type_mouvement IN ('reversement','remboursement')),0::bigint,'aucun paiement ni remboursement fabriqué');
SELECT is((SELECT montant_xof FROM snp_grand_livre_commercial LIMIT 1),(SELECT round(montant*600,2) FROM snp_grand_livre_commercial LIMIT 1),'contrevaleur XOF issue du taux daté');
SELECT is((SELECT count(*) FROM snp_calculs_fiscaux WHERE contexte_type='vente' AND montant_obtenu=578.71),1::bigint,'calcul fiscal historique intact');
SELECT pg_temp.claims(1);
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_valider((SELECT id FROM snp_conciliations LIMIT 1),'32000000-0000-4000-8000-000000000801')$$),'42501','un autre acteur ne peut pas rejouer une clé idempotente');
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_impacts_fiscaux((SELECT id FROM snp_conciliations LIMIT 1),-1)$$),'22023','simulation négative refusée');
SELECT pg_temp.claims(1,'aal1');
SELECT is(pg_temp.try_sql($$SELECT snp_conciliation_ouvrir('32000000-0000-4000-8000-000000000504',gen_random_uuid())$$),'42501','Owner reste soumis à MFA');
SELECT pg_temp.claims(1);
RESET ROLE;
INSERT INTO mining_companies(id,code,name,country,company_type,is_active)
VALUES('32000000-0000-4000-8000-000000000102','CON-MINE-B','Mine B test','Burkina Faso','production_mine',true);
INSERT INTO auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
VALUES('32000000-0000-4000-8000-000000000004','authenticated','authenticated','mine-test@example.invalid','{}','{}');
INSERT INTO user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at,mining_company_id)
VALUES('32000000-0000-4000-8000-000000000004','mine-test@example.invalid','Mine B','mine',true,now(),'32000000-0000-4000-8000-000000000102');
INSERT INTO user_sessions(user_id,expires_at,token_hash) VALUES('32000000-0000-4000-8000-000000000004',now()+interval '1 hour',extensions.digest('conciliation-session-4','sha256'));
INSERT INTO snp_role_capabilities(role,capability_code) VALUES('mine','reconciliation.read') ON CONFLICT DO NOTHING;
SET LOCAL ROLE authenticated;
SELECT pg_temp.claims(4);
SELECT is((SELECT count(*) FROM snp_conciliations),0::bigint,'Mine B ne lit pas le dossier de Mine A');
SELECT is((SELECT count(*) FROM snp_grand_livre_fiscal),0::bigint,'Mine B ne lit pas les régularisations de Mine A');
SELECT pg_temp.claims(1);
SELECT is((SELECT count(*) FROM snp_conciliations),1::bigint,'Owner voit le dossier national');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
