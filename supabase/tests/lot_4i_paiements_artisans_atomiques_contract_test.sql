BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION pg_temp.set_claims(p_sub uuid,p_role text,p_aal text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',coalesce(p_sub::text,''),true);
  PERFORM set_config('request.jwt.claim.role',p_role,true);
  PERFORM set_config('request.jwt.claim.aal',p_aal,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_sub,'role',p_role,'aal',p_aal
  )::text,true);
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.try_invoice(
  p_sale uuid,p_status text,p_version bigint,p_key uuid,p_notes text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_artisan_emettre_facture(p_sale,p_status,p_version,p_key,NULL,p_notes);
  RETURN 'OK:'||coalesce(v->>'invoice_status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE; END;
$fn$;
CREATE OR REPLACE FUNCTION pg_temp.try_create_payment(
  p_invoice uuid,p_status text,p_version bigint,p_method uuid,p_key uuid,p_notes text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_artisan_creer_paiement(p_invoice,p_status,p_version,p_method,p_key,p_notes);
  RETURN 'OK:'||coalesce(v->>'payment_status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE; END;
$fn$;
CREATE OR REPLACE FUNCTION pg_temp.try_payment_transition(
  p_payment uuid,p_status text,p_version bigint,p_new text,p_key uuid,p_notes text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_artisan_transition_paiement(p_payment,p_status,p_version,p_new,p_key,p_notes);
  RETURN 'OK:'||coalesce(v->>'payment_status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE; END;
$fn$;
CREATE OR REPLACE FUNCTION pg_temp.try_tax_transition(
  p_tax uuid,p_status text,p_version bigint,p_new text,p_key uuid,
  p_reference text DEFAULT NULL,p_notes text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v jsonb;
BEGIN
  v:=public.snp_artisan_transition_reversement_taxe(
    p_tax,p_status,p_version,p_new,p_key,p_reference,p_notes
  );
  RETURN 'OK:'||coalesce(v->>'tax_status','')||':'||coalesce(v->>'replayed','');
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE; END;
$fn$;
CREATE OR REPLACE FUNCTION pg_temp.try_tax_transition_for_sale(
  p_sale uuid,p_type text,p_status text,p_version bigint,p_new text,p_key uuid,
  p_reference text DEFAULT NULL,p_notes text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v_tax uuid;
BEGIN
  SELECT id INTO v_tax FROM public.snp_artisan_taxes_retenues
  WHERE vente_or_id=p_sale AND type_taxe=p_type;
  RETURN pg_temp.try_tax_transition(
    v_tax,p_status,p_version,p_new,p_key,p_reference,p_notes
  );
END;
$fn$;
CREATE OR REPLACE FUNCTION pg_temp.try_direct(p_sql text)
RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN EXECUTE p_sql; RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN 'ERR:'||SQLSTATE; END;
$fn$;

SELECT plan(83);

-- Structure/RLS/grants -------------------------------------------------------
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.snp_artisan_ventes_or'::regclass),'vente FORCE RLS');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.snp_artisan_factures_definitives'::regclass),'facture FORCE RLS');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.snp_artisan_paiements'::regclass),'paiement FORCE RLS');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.snp_artisan_taxes_retenues'::regclass),'taxes FORCE RLS');
SELECT ok((SELECT relforcerowsecurity FROM pg_class WHERE oid='public.snp_artisan_finance_operation_ledger'::regclass),'ledger FORCE RLS');
SELECT is((SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name IN(
  'snp_artisan_ventes_or','snp_artisan_factures_definitives','snp_artisan_paiements','snp_artisan_taxes_retenues'
) AND column_name='version'),4::bigint,'versions sur quatre agrégats');
SELECT is((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN(
    'snp_artisan_emettre_facture','snp_artisan_creer_paiement',
    'snp_artisan_transition_paiement','snp_artisan_transition_reversement_taxe'
  ) AND p.prosecdef),4::bigint,'quatre RPC SECURITY DEFINER');
SELECT is((SELECT count(*) FROM information_schema.routine_privileges
  WHERE specific_schema='public' AND grantee='authenticated' AND privilege_type='EXECUTE'
    AND routine_name IN('snp_artisan_emettre_facture','snp_artisan_creer_paiement',
      'snp_artisan_transition_paiement','snp_artisan_transition_reversement_taxe')),4::bigint,'allowlist RPC authenticated');
SELECT is((SELECT count(*) FROM information_schema.routine_privileges
  WHERE specific_schema='public' AND grantee IN('PUBLIC','anon')
    AND routine_name IN('snp_artisan_emettre_facture','snp_artisan_creer_paiement',
      'snp_artisan_transition_paiement','snp_artisan_transition_reversement_taxe')),0::bigint,'aucune RPC anon/PUBLIC');
SELECT is((SELECT count(*) FROM public.snp_capability_catalog WHERE code IN(
  'comptoir.invoices.issue','comptoir.payments.execute','comptoir.payments.reconcile',
  'comptoir.tax.execute','sonasp.tax.reconcile') AND sensitive),5::bigint,'cinq capabilities sensibles');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_artisan_factures_definitives','INSERT'),'aucun INSERT facture');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_artisan_factures_definitives','UPDATE'),'aucun UPDATE facture');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_artisan_paiements','INSERT'),'aucun INSERT paiement');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_artisan_paiements','UPDATE'),'aucun UPDATE paiement');
SELECT ok(NOT has_table_privilege('authenticated','public.snp_artisan_taxes_retenues','UPDATE'),'aucun UPDATE taxe');
SELECT ok(has_table_privilege('authenticated','public.snp_artisan_paiements','SELECT'),'lecture paiement seulement');
SELECT is((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN('v_artisan_paiements_resume','v_taxes_a_reverser','v_paiements_en_attente')
    AND 'security_invoker=true'=ANY(coalesce(c.reloptions,ARRAY[]::text[]))),3::bigint,'trois vues security_invoker');
SELECT ok(NOT has_function_privilege('authenticated','public.generer_numero_facture()','EXECUTE'),'générateur facture retiré');
SELECT ok(NOT has_function_privilege('authenticated','public.generer_reference_paiement()','EXECUTE'),'générateur paiement retiré');
SELECT ok(NOT has_function_privilege('authenticated','public.calculer_taxes_vente(numeric,numeric,numeric)','EXECUTE'),'calcul client retiré');
SELECT ok(NOT has_function_privilege('authenticated','public.snp_certify_artisan_invoice(uuid,text,text)','EXECUTE'),'certification DGI navigateur retirée');
SELECT has_index('public','snp_artisan_factures_definitives','uq_snp_artisan_facture_par_vente','facture unique par vente');
SELECT has_index('public','snp_artisan_paiements','uq_snp_artisan_paiement_actif_facture','paiement actif unique');
SELECT has_trigger('public','snp_artisan_ventes_or','snp_4i_sale_payment_fields','garde financière vente');
SELECT has_trigger('public','snp_artisan_paiements','snp_4i_rpc_only','paiement RPC-only');

-- Fixtures ------------------------------------------------------------------
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000099','service_role','aal2');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
 ('4b000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','issuer@test.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reconciler@test.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000003','00000000-0000-0000-8000-000000000000','authenticated','authenticated','tenant-b@test.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tax@test.invalid','','{}','{}',now(),now()),
 ('4b000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','insufficient@test.invalid','','{}','{}',now(),now());
INSERT INTO public.user_profiles(id,email,full_name,role,is_active,mfa_enrolled_at) VALUES
 ('4b000000-0000-4000-8000-000000000001','issuer@test.invalid','Issuer A','customer',true,now()),
 ('4b000000-0000-4000-8000-000000000002','reconciler@test.invalid','Reconciler A','customer',true,now()),
 ('4b000000-0000-4000-8000-000000000003','tenant-b@test.invalid','Tenant B','customer',true,now()),
 ('4b000000-0000-4000-8000-000000000004','tax@test.invalid','Tax SONASP','management',true,now()),
 ('4b000000-0000-4000-8000-000000000005','insufficient@test.invalid','Insufficient A','customer',true,now());
INSERT INTO public.snp_organizations(id,code,name,organization_type,is_active) VALUES
 ('4b000000-0000-4000-8000-000000000101','CPT-A','Comptoir A','comptoir',true),
 ('4b000000-0000-4000-8000-000000000102','CPT-B','Comptoir B','comptoir',true);
INSERT INTO public.snp_user_organization_memberships(user_id,organization_id,membership_role,is_primary,reason) VALUES
 ('4b000000-0000-4000-8000-000000000001','4b000000-0000-4000-8000-000000000101','operator',true,'issuer A'),
 ('4b000000-0000-4000-8000-000000000002','4b000000-0000-4000-8000-000000000101','manager',true,'reconciler A'),
 ('4b000000-0000-4000-8000-000000000003','4b000000-0000-4000-8000-000000000102','manager',true,'tenant B'),
 ('4b000000-0000-4000-8000-000000000005','4b000000-0000-4000-8000-000000000101','viewer',true,'insufficient A');
INSERT INTO public.snp_artisans_miniers(id,type_artisan,type_personne,actif,nom,prenoms,numero_carte,telephone) VALUES
 ('4b000000-0000-4000-8000-000000000201','exploitant','physique',true,'Artisan','Alpha','ART-A','70000001'),
 ('4b000000-0000-4000-8000-000000000202','exploitant','physique',true,'Artisan','Beta','ART-B','70000002');
INSERT INTO public.snp_collector_artisan_assignments(artisan_id,comptoir_organization_id,reason) VALUES
 ('4b000000-0000-4000-8000-000000000201','4b000000-0000-4000-8000-000000000101','assignment A'),
 ('4b000000-0000-4000-8000-000000000202','4b000000-0000-4000-8000-000000000102','assignment B');
INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed,reason) VALUES
 ('4b000000-0000-4000-8000-000000000001','comptoir.invoices.issue',true,'test'),
 ('4b000000-0000-4000-8000-000000000001','comptoir.payments.execute',true,'test'),
 ('4b000000-0000-4000-8000-000000000001','comptoir.payments.reconcile',true,'test'),
 ('4b000000-0000-4000-8000-000000000001','comptoir.tax.execute',true,'test'),
 ('4b000000-0000-4000-8000-000000000001','sonasp.tax.reconcile',true,'test'),
 ('4b000000-0000-4000-8000-000000000002','comptoir.payments.execute',true,'test'),
 ('4b000000-0000-4000-8000-000000000002','comptoir.payments.reconcile',true,'test'),
 ('4b000000-0000-4000-8000-000000000003','comptoir.invoices.issue',true,'test'),
 ('4b000000-0000-4000-8000-000000000003','comptoir.payments.execute',true,'test'),
 ('4b000000-0000-4000-8000-000000000003','comptoir.tax.execute',true,'test'),
 ('4b000000-0000-4000-8000-000000000004','sonasp.tax.reconcile',true,'test');
INSERT INTO public.snp_artisan_moyens_paiement(
  id,artisan_id,type,titulaire,actif,verifie_le,est_principal
) VALUES
 ('4b000000-0000-4000-8000-000000000301','4b000000-0000-4000-8000-000000000201','virement_bancaire','Alpha',true,now(),true),
 ('4b000000-0000-4000-8000-000000000302','4b000000-0000-4000-8000-000000000201','wave','Alpha',true,NULL,false),
 ('4b000000-0000-4000-8000-000000000303','4b000000-0000-4000-8000-000000000202','virement_bancaire','Beta',true,now(),true);
INSERT INTO public.snp_artisan_ventes_or(
  id,artisan_id,date_vente,quantite_grammes,type_or,purete_karat,prix_kg_fcfa,
  montant_brut_fcfa,tva_taux,tva_montant_fcfa,taxe_dev_comm_taux,
  taxe_dev_comm_montant_fcfa,montant_total_fcfa,numero_recu,
  statut,statut_paiement,statut_validation,comptoir_organization_id
) VALUES
 ('4b000000-0000-4000-8000-000000000401','4b000000-0000-4000-8000-000000000201','2026-08-20',25,'poudre',22,40000000,1000000,18,180000,1,10000,1190000,'VENTE-A-1','validee','non_paye','validee','4b000000-0000-4000-8000-000000000101'),
 ('4b000000-0000-4000-8000-000000000402','4b000000-0000-4000-8000-000000000201','2026-08-21',12.5,'poudre',22,40000000,500000,18,90000,1,5000,595000,'VENTE-A-2','validee','non_paye','validee','4b000000-0000-4000-8000-000000000101'),
 ('4b000000-0000-4000-8000-000000000403','4b000000-0000-4000-8000-000000000202','2026-08-20',25,'poudre',22,40000000,1000000,18,180000,1,10000,1190000,'VENTE-B-1','validee','non_paye','validee','4b000000-0000-4000-8000-000000000102');

-- Facture : négatifs, calcul serveur, replay -------------------------------
SELECT pg_temp.set_claims(NULL,'anon','aal1'); SET LOCAL ROLE anon;
SELECT is(pg_temp.try_invoice('4b000000-0000-4000-8000-000000000401','validee',0,'4b000000-0000-4000-8000-000000000501'),'ERR:42501','anon facture refusé');
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal1'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_invoice('4b000000-0000-4000-8000-000000000401','validee',0,'4b000000-0000-4000-8000-000000000502'),'ERR:42501','AAL1 facture refusé');
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000005','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_invoice('4b000000-0000-4000-8000-000000000401','validee',0,'4b000000-0000-4000-8000-000000000503'),'ERR:42501','sans capability facture refusé');
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000003','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_invoice('4b000000-0000-4000-8000-000000000401','validee',0,'4b000000-0000-4000-8000-000000000504'),'ERR:42501','mauvais tenant facture refusé');
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_invoice('4b000000-0000-4000-8000-000000000401','validee',0,'4b000000-0000-4000-8000-000000000505'),'OK:emise:false','facture atomique émise');
SELECT is((SELECT montant_taxe_tva FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),180000::numeric,'TVA serveur 18%');
SELECT is((SELECT montant_taxe_retenue_source FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),50000::numeric,'retenue serveur 5%');
SELECT is((SELECT montant_autres_taxes FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),10000::numeric,'taxe communale serveur 1%');
SELECT is((SELECT montant_net_a_payer FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),950000::numeric,'net vendeur serveur');
SELECT is((SELECT statut_paiement||':'||version FROM public.snp_artisan_ventes_or WHERE id='4b000000-0000-4000-8000-000000000401'),'facture_emise:1','vente liée/versionnée');
SELECT is(pg_temp.try_invoice('4b000000-0000-4000-8000-000000000401','validee',0,'4b000000-0000-4000-8000-000000000505'),'OK:emise:true','replay facture idempotent');
SELECT is(pg_temp.try_invoice('4b000000-0000-4000-8000-000000000401','validee',0,'4b000000-0000-4000-8000-000000000505','payload différent'),'ERR:23505','collision idempotence facture');
SELECT is(pg_temp.try_direct($sql$INSERT INTO public.snp_artisan_factures_definitives(
  numero_facture,vente_or_id,artisan_id,montant_brut,montant_total_taxes,montant_net_a_payer
) VALUES('FORGED','4b000000-0000-4000-8000-000000000402','4b000000-0000-4000-8000-000000000201',1,0,1)$sql$),'ERR:42501','DML direct facture refusé');
SELECT is(pg_temp.try_direct($sql$UPDATE public.snp_artisan_ventes_or SET statut_paiement='paye' WHERE id='4b000000-0000-4000-8000-000000000401'$sql$),'ERR:42501','DML financier vente refusé');
SELECT is(pg_temp.try_direct($sql$UPDATE public.snp_artisan_ventes_or SET montant_brut_fcfa=1 WHERE id='4b000000-0000-4000-8000-000000000401'$sql$),'ERR:42501','montant vente validée immuable hors RPC');

-- Paiement : DGI/moyen/tenant, SoD, preuve, parents -------------------------
SELECT is(pg_temp.try_create_payment(
  (SELECT id FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'emise',0,'4b000000-0000-4000-8000-000000000301','4b000000-0000-4000-8000-000000000510'
),'ERR:23514','paiement bloqué sans DGI');
RESET ROLE;
UPDATE public.snp_artisan_factures_definitives SET certification_dgi_status='certified',
  dgi_reference='DGI-SERVICE-001',dgi_document_path='service/dgi-001.pdf'
WHERE vente_or_id='4b000000-0000-4000-8000-000000000401';
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_create_payment(
  (SELECT id FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'emise',0,'4b000000-0000-4000-8000-000000000302','4b000000-0000-4000-8000-000000000511'
),'ERR:23514','moyen non vérifié refusé');
SELECT is(pg_temp.try_create_payment(
  (SELECT id FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'emise',0,'4b000000-0000-4000-8000-000000000303','4b000000-0000-4000-8000-000000000512'
),'ERR:23514','moyen autre artisan refusé');
SELECT is(pg_temp.try_create_payment(
  (SELECT id FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'emise',0,'4b000000-0000-4000-8000-000000000301','4b000000-0000-4000-8000-000000000513'
),'OK:en_attente:false','paiement atomique créé');
SELECT is((SELECT montant_paye FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),950000::numeric,'montant paiement dérivé facture');
SELECT is((SELECT montant_taxes_retenues FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),240000::numeric,'taxes paiement dérivées facture');
SELECT is((SELECT statut||':'||version FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),'en_paiement:1','facture passe en paiement');
SELECT is(pg_temp.try_create_payment(
  (SELECT id FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'emise',0,'4b000000-0000-4000-8000-000000000301','4b000000-0000-4000-8000-000000000513'
),'OK:en_attente:true','replay paiement idempotent');
SELECT is(pg_temp.try_create_payment(
  (SELECT id FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'emise',0,'4b000000-0000-4000-8000-000000000301','4b000000-0000-4000-8000-000000000513','payload différent'
),'ERR:23505','collision idempotence paiement');
SELECT is(pg_temp.try_direct($sql$UPDATE public.snp_artisan_paiements SET statut='complete'$sql$),'ERR:42501','DML direct paiement refusé');
SELECT is(pg_temp.try_payment_transition(
  (SELECT id FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'en_attente',0,'en_traitement','4b000000-0000-4000-8000-000000000520'
),'OK:en_traitement:false','préparateur soumet');
SELECT is(pg_temp.try_payment_transition(
  (SELECT id FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'en_traitement',1,'valide','4b000000-0000-4000-8000-000000000521'
),'ERR:42501','préparateur ne valide pas');
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000002','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_payment_transition(
  (SELECT id FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'en_traitement',1,'valide','4b000000-0000-4000-8000-000000000522'
),'OK:valide:false','second acteur valide');
SELECT is(pg_temp.try_payment_transition(
  (SELECT id FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'valide',2,'complete','4b000000-0000-4000-8000-000000000523'
),'ERR:42501','validateur ne clôture pas');
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_payment_transition(
  (SELECT id FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'valide',2,'complete','4b000000-0000-4000-8000-000000000524'
),'ERR:23514','clôture sans preuve refusée');
RESET ROLE;
SELECT set_config('sonasp.artisan_finance_rpc','1',true);
UPDATE public.snp_artisan_paiements SET preuve_paiement_url='service/payment-proof-a.pdf'
WHERE vente_or_id='4b000000-0000-4000-8000-000000000401';
SELECT set_config('sonasp.artisan_finance_rpc','0',true);
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000001','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_payment_transition(
  (SELECT id FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'valide',2,'complete','4b000000-0000-4000-8000-000000000525'
),'OK:complete:false','clôture avec preuve service');
SELECT is((SELECT statut||':'||version FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),'complete:3','paiement clôturé/versionné');
SELECT is((SELECT statut||':'||version FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),'payee:2','facture payée/versionnée');
SELECT is((SELECT statut||':'||statut_paiement||':'||version FROM public.snp_artisan_ventes_or WHERE id='4b000000-0000-4000-8000-000000000401'),'payee:paye:3','vente payée/versionnée');
SELECT is((SELECT count(*) FROM public.snp_artisanal_stock_ledger WHERE source_id=(SELECT id FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401')),1::bigint,'stock crédité une fois');
SELECT is((SELECT count(*) FROM public.snp_artisan_taxes_retenues WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),3::bigint,'trois taxes serveur');
SELECT is((SELECT sum(montant_taxe) FROM public.snp_artisan_taxes_retenues
  WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),240000::numeric,
  'ledger fiscal rapproche le total taxes facture/paiement');
SELECT is((SELECT p.montant_paye+f.montant_taxe_retenue_source
  FROM public.snp_artisan_paiements p
  JOIN public.snp_artisan_factures_definitives f ON f.id=p.facture_id
  WHERE p.vente_or_id='4b000000-0000-4000-8000-000000000401'),1000000::numeric,
  'net payé plus retenue source rapproche le brut de vente');
SELECT is(pg_temp.try_payment_transition(
  (SELECT id FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'valide',2,'complete','4b000000-0000-4000-8000-000000000525'
),'OK:complete:true','replay clôture sans second effet');
SELECT is(pg_temp.try_payment_transition(
  (SELECT id FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),
  'valide',2,'complete','4b000000-0000-4000-8000-000000000526'
),'ERR:40001','version obsolète conflit');

-- Taxes : tenant, référence, SoD, audit -------------------------------------
SELECT is(pg_temp.try_tax_transition(
  (SELECT id FROM public.snp_artisan_taxes_retenues WHERE vente_or_id='4b000000-0000-4000-8000-000000000401' AND type_taxe='retenue_source'),
  'a_reverser',0,'en_cours','4b000000-0000-4000-8000-000000000530'
),'OK:en_cours:false','reversement démarré');
SELECT is(pg_temp.try_tax_transition(
  (SELECT id FROM public.snp_artisan_taxes_retenues WHERE vente_or_id='4b000000-0000-4000-8000-000000000401' AND type_taxe='retenue_source'),
  'a_reverser',0,'en_cours','4b000000-0000-4000-8000-000000000530',NULL,'payload différent'
),'ERR:23505','collision idempotence reversement fiscal');
SELECT is(pg_temp.try_tax_transition(
  (SELECT id FROM public.snp_artisan_taxes_retenues WHERE vente_or_id='4b000000-0000-4000-8000-000000000401' AND type_taxe='retenue_source'),
  'en_cours',1,'reverse','4b000000-0000-4000-8000-000000000531'
),'ERR:22023','référence reversement requise');
SELECT is(pg_temp.try_tax_transition(
  (SELECT id FROM public.snp_artisan_taxes_retenues WHERE vente_or_id='4b000000-0000-4000-8000-000000000401' AND type_taxe='retenue_source'),
  'en_cours',1,'reverse','4b000000-0000-4000-8000-000000000532','DGI-REV-001'
),'OK:reverse:false','reversement exécuté');
SELECT is(pg_temp.try_tax_transition(
  (SELECT id FROM public.snp_artisan_taxes_retenues WHERE vente_or_id='4b000000-0000-4000-8000-000000000401' AND type_taxe='retenue_source'),
  'reverse',2,'comptabilise','4b000000-0000-4000-8000-000000000533'
),'ERR:42501','exécuteur ne comptabilise pas');
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000003','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_tax_transition_for_sale(
  '4b000000-0000-4000-8000-000000000401','tva',
  'a_reverser',0,'en_cours','4b000000-0000-4000-8000-000000000534'
),'ERR:42501','mauvais tenant taxe refusé');
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000004','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is(pg_temp.try_tax_transition(
  (SELECT id FROM public.snp_artisan_taxes_retenues WHERE vente_or_id='4b000000-0000-4000-8000-000000000401' AND type_taxe='retenue_source'),
  'reverse',2,'comptabilise','4b000000-0000-4000-8000-000000000535'
),'OK:comptabilise:false','SONASP comptabilise');
SELECT is((SELECT reversement_reference||':'||version FROM public.snp_artisan_taxes_retenues
  WHERE vente_or_id='4b000000-0000-4000-8000-000000000401' AND type_taxe='retenue_source'),'DGI-REV-001:3','référence/version fiscale');
SELECT is((SELECT comptabilise_par FROM public.snp_artisan_taxes_retenues
  WHERE vente_or_id='4b000000-0000-4000-8000-000000000401' AND type_taxe='retenue_source'),
  '4b000000-0000-4000-8000-000000000004'::uuid,'comptable dérivé JWT');
SELECT is(pg_temp.try_tax_transition(
  (SELECT id FROM public.snp_artisan_taxes_retenues WHERE vente_or_id='4b000000-0000-4000-8000-000000000401' AND type_taxe='retenue_source'),
  'reverse',2,'comptabilise','4b000000-0000-4000-8000-000000000535'
),'OK:comptabilise:true','replay fiscal idempotent');
SELECT is(pg_temp.try_direct($sql$UPDATE public.snp_artisan_taxes_retenues SET statut_reversement='comptabilise'$sql$),'ERR:42501','DML direct taxe refusé');

-- Cloisonnement et traces ---------------------------------------------------
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000003','authenticated','aal2'); SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.snp_artisan_factures_definitives WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),0::bigint,'tenant B ne lit pas facture A');
SELECT is((SELECT count(*) FROM public.snp_artisan_paiements WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),0::bigint,'tenant B ne lit pas paiement A');
SELECT is((SELECT count(*) FROM public.snp_artisan_taxes_retenues WHERE vente_or_id='4b000000-0000-4000-8000-000000000401'),0::bigint,'tenant B ne lit pas taxes A');
RESET ROLE;
SELECT pg_temp.set_claims('4b000000-0000-4000-8000-000000000099','service_role','aal2');
SELECT is((SELECT count(*) FROM public.snp_artisan_finance_operation_ledger WHERE completed_at IS NOT NULL),8::bigint,'huit opérations idempotentes finalisées');
SELECT ok((SELECT bool_and(actor_id IS NOT NULL AND capability_code IS NOT NULL) FROM public.snp_artisan_finance_operation_ledger),'ledger acteurs/capabilities dérivés');
SELECT is((SELECT count(*) FROM public.snp_workflow_audit WHERE aggregate_type IN('artisan-invoice','artisan-payment','artisan-tax')),8::bigint,'huit événements métier audités');
SELECT ok((SELECT bool_and(actor_id IS NOT NULL AND capability_code IS NOT NULL) FROM public.snp_workflow_audit WHERE aggregate_type IN('artisan-invoice','artisan-payment','artisan-tax')),'audit acteurs/capabilities dérivés');

SELECT * FROM finish();
ROLLBACK;
