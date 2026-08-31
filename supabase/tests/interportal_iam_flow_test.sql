-- Contrats inter-portails exécutés sur le schéma publié, sans mock des autorisations.
BEGIN;
DO $$ BEGIN
 IF current_database() NOT LIKE 'sonasp_iam_audit_%' AND current_database()<>'sonasp_release_20260830' THEN RAISE EXCEPTION 'Base isolée requise.'; END IF;
END $$;
SET LOCAL search_path=public,extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
INSERT INTO snp_capability_catalog(code,domain,label,description,sensitive)
SELECT code,'test',code,'Contrat inter-portails',true FROM unnest(ARRAY[
 'mine.operate','sonasp.prepare','sonasp.approve','comptoir.manage','collectors.manage',
 'sonasp.finance.execute','sonasp.finance.reconcile']) code ON CONFLICT DO NOTHING;
INSERT INTO snp_role_capabilities(role,capability_code) VALUES('mine','mine.operate'),('comptoir','comptoir.manage') ON CONFLICT DO NOTHING;
INSERT INTO mining_companies(id,code,name,country,company_type,is_active) VALUES
 ('31000000-0000-4000-8000-000000000101','FLOW-A','Mine A test','Burkina Faso','production_mine',true),
 ('31000000-0000-4000-8000-000000000102','FLOW-B','Mine B test','Burkina Faso','production_mine',true);
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT ('31000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'flow-'||n||'@example.invalid','','{}','{}',now(),now() FROM generate_series(1,5) n;
INSERT INTO user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at,mining_company_id)
SELECT ('31000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'flow-'||n||'@example.invalid','Compte test '||n,
 CASE WHEN n=3 THEN 'owner' WHEN n<3 THEN 'mine' ELSE 'comptoir' END,true,now(),
 CASE WHEN n<3 THEN ('31000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid ELSE NULL END
FROM generate_series(1,5) n;
INSERT INTO user_sessions(user_id,expires_at,token_hash)
SELECT ('31000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour',
 extensions.digest('flow-session-'||n,'sha256') FROM generate_series(1,5) n;
INSERT INTO snp_ministries(id,code,name) VALUES('31000000-0000-4000-8000-000000000900','TEST','Tutelle de test');
INSERT INTO snp_organizations(id,code,name,organization_type,supervising_ministry_id)
SELECT ('31000000-0000-4000-8000-'||lpad((900+n)::text,12,'0'))::uuid,
 CASE WHEN n=3 THEN 'SONASP' ELSE 'COMP-'||n END,'Organisation test '||n,
 CASE WHEN n=3 THEN 'sonasp' ELSE 'comptoir' END,'31000000-0000-4000-8000-000000000900'
FROM generate_series(3,5) n;
INSERT INTO snp_user_organization_memberships(user_id,organization_id,membership_role,is_primary,reason)
SELECT ('31000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('31000000-0000-4000-8000-'||lpad((900+n)::text,12,'0'))::uuid,'manager',true,'Rattachement de test'
FROM generate_series(3,5) n;
INSERT INTO snp_artisanal_stock_ledger(organization_id,direction,quantity_grams,movement_type,business_reference,idempotency_key,created_by)
VALUES('31000000-0000-4000-8000-000000000904','in',1000,'purchase','TEST-INITIAL','test-stock',
 '31000000-0000-4000-8000-000000000003');
INSERT INTO snp_regles_fiscales(code_taxe,libelle,assiette,mode_calcul,taux,date_effet,statut,approuve_par,approuve_le,profil_vendeur)
SELECT code,'Barème synthétique','ca_ht','taux',CASE WHEN code='tva' THEN 0 ELSE 0.01 END,
 current_date-1,'approuvee','31000000-0000-4000-8000-000000000003',now(),'mine_industrielle'
FROM unnest(ARRAY['tva','taxe_communale']) code;

CREATE FUNCTION pg_temp.claims(n integer,aal text DEFAULT 'aal2') RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object(
 'sub','31000000-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated','aal',aal,
 'session_id','flow-session-'||n,'exp',extract(epoch FROM now()+interval '1 hour')::bigint)::text,true);
END $$;
CREATE FUNCTION pg_temp.try_sql(statement text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE statement; RETURN 'OK'; EXCEPTION WHEN OTHERS THEN
 RAISE NOTICE 'Contrat inter-portails: % %',SQLSTATE,SQLERRM; RETURN SQLSTATE; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;
SELECT no_plan();

SET LOCAL ROLE authenticated;
SELECT pg_temp.claims(1);
SELECT is(pg_temp.try_sql($$SELECT snp_portail_mine_declarer_production(current_date,100,90,'FLOW-BAR',NULL)$$),
 'OK','Mine A déclare une production avec son tenant serveur');
SELECT is((SELECT pure_gold_grams FROM daily_production WHERE bar_reference='FLOW-BAR'),90::numeric,'or fin calculé en grammes');
SELECT pg_temp.claims(2);
SELECT is((SELECT count(*) FROM daily_production),0::bigint,'Mine B ne lit pas la production A');
SELECT pg_temp.claims(3);
SELECT is((SELECT count(*) FROM daily_production),1::bigint,'SONASP reçoit la production Mine A');
INSERT INTO snp_demandes_achat(id,numero_demande,mining_company_id,periode_debut,periode_fin,
 quantite_demandee_oz,prix_once_fcfa,statut,created_by)
SELECT ('31000000-0000-4000-8000-'||lpad((200+n)::text,12,'0'))::uuid,'FLOW-REQ-'||n,
 CASE WHEN n=2 THEN '31000000-0000-4000-8000-000000000102'::uuid ELSE '31000000-0000-4000-8000-000000000101'::uuid END,
 current_date-30,current_date,1,1000,CASE WHEN n=3 THEN 'brouillon' ELSE 'soumise' END,auth.uid()
FROM generate_series(1,4) n;
SELECT pg_temp.claims(1);
SELECT is((SELECT count(*) FROM snp_demandes_achat),2::bigint,'Mine A reçoit ses demandes soumises, pas les brouillons ni celles de B');
SELECT is(pg_temp.try_sql($$SELECT snp_portail_mine_repondre_demande('31000000-0000-4000-8000-000000000201','approuver',NULL)$$),
 'OK','le bouton Mine utilise une RPC existante et crée l’achat aval');
SELECT pg_temp.claims(3);
SELECT is((SELECT count(*) FROM snp_achats_mines WHERE demande_id='31000000-0000-4000-8000-000000000201'),1::bigint,'SONASP voit un achat issu de la réponse');
SELECT is((SELECT count(*) FROM snp_factures_achat WHERE demande_id='31000000-0000-4000-8000-000000000201'),1::bigint,'facture créée dans la même transaction');
SELECT pg_temp.claims(1);
SELECT is(pg_temp.try_sql($$SELECT snp_portail_mine_repondre_demande('31000000-0000-4000-8000-000000000204','approuver',NULL)$$),
 'OK','deux demandes du même mois et de la même mine peuvent être approuvées');
SELECT isnt(pg_temp.try_sql($$SELECT snp_portail_mine_repondre_demande('31000000-0000-4000-8000-000000000202','rejeter','Hors périmètre')$$),
 'OK','Mine A ne répond pas pour Mine B');
SELECT isnt(pg_temp.try_sql($$SELECT snp_portail_mine_repondre_demande('31000000-0000-4000-8000-000000000203','approuver',NULL)$$),
 'OK','Mine A ne traite pas un brouillon SONASP');
SELECT pg_temp.claims(2,'aal1');
SELECT is(pg_temp.try_sql($$SELECT snp_repondre_demande('31000000-0000-4000-8000-000000000202','rejetee','Tentative sans MFA')$$),
 '42501','appel canonique direct sans AAL2 refusé');
SELECT pg_temp.claims(2);
SELECT is(pg_temp.try_sql($$SELECT snp_portail_mine_repondre_demande('31000000-0000-4000-8000-000000000202','rejeter','Volume indisponible')$$),
 'OK','Mine B peut répondre à sa propre demande');

SELECT pg_temp.claims(3);
RESET ROLE;
INSERT INTO snp_requisitions(id,reference,objet,mining_company_id,regime_juridique,autorite_origine,
 nature_acte,reference_acte,type_requisition,quantite_oz,statut,date_notification)
SELECT ('31000000-0000-4000-8000-'||lpad((300+n)::text,12,'0'))::uuid,'FLOW-REQUIS-'||n,'Mise à disposition',
 ('31000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,'accord_requis','SONASP',
 'Décision','TEST-DECISION-'||n,'partielle',100,'notifiee',now() FROM generate_series(1,2) n;
SET LOCAL ROLE authenticated;
SELECT pg_temp.claims(1);
SELECT is((SELECT count(*) FROM snp_requisitions),1::bigint,'la réquisition n’est visible que pour la mine destinataire');
SELECT is(pg_temp.try_sql($$SELECT snp_portail_mine_repondre_requisition('31000000-0000-4000-8000-000000000301','approuver','Accord du destinataire')$$),
 'OK','Mine A répond à sa réquisition');
SELECT is(pg_temp.try_sql($$SELECT snp_portail_mine_repondre_requisition('31000000-0000-4000-8000-000000000302','approuver','Tentative hors périmètre')$$),
 '42501','réponse inter-société à une réquisition refusée');

SELECT pg_temp.claims(4);
SELECT is(pg_temp.try_sql($$SELECT snp_submit_comptoir_sale_to_sonasp(100,1000,'Cession de test')$$),
 'OK','Comptoir A soumet une cession sur son stock');
SELECT is((SELECT count(*) FROM snp_comptoir_ventes_sonasp),1::bigint,'Comptoir A lit sa cession');
SELECT pg_temp.claims(5);
SELECT is((SELECT count(*) FROM snp_comptoir_ventes_sonasp),0::bigint,'Comptoir B ne lit pas la cession A');
SELECT is(pg_temp.try_sql($$SELECT snp_comptoir_stock_balance('31000000-0000-4000-8000-000000000904')$$),
 '42501','Comptoir B ne consulte pas le stock A');
SELECT pg_temp.claims(3);
SELECT is((SELECT count(*) FROM snp_comptoir_ventes_sonasp),1::bigint,'SONASP reçoit la cession Comptoir A');
SELECT is(pg_temp.try_sql($$SELECT snp_transition_comptoir_sale_to_sonasp((SELECT id FROM snp_comptoir_ventes_sonasp LIMIT 1),'accepted','Contrôle effectué')$$),
 'OK','SONASP accepte la cession d’un autre acteur');
SELECT pg_temp.claims(4);
SELECT is((SELECT status FROM snp_comptoir_ventes_sonasp LIMIT 1),'accepted','Comptoir A reçoit la décision SONASP');
SELECT is((SELECT sum(CASE WHEN direction='in' THEN quantity_grams ELSE -quantity_grams END)
 FROM snp_artisanal_stock_ledger WHERE organization_id='31000000-0000-4000-8000-000000000904'),
 900::numeric,'acceptation déduit exactement la quantité cédée');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
