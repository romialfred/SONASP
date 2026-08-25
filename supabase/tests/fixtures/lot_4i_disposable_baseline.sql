-- Baseline minimale jetable du schéma réellement observé dans scripts/ puis
-- complété par 20260823190000, 20260824230000 et 4B. Jamais destinée au live.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

DO $roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$roles$;

CREATE TABLE public.user_profiles(
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,full_name text,role text NOT NULL,is_active boolean NOT NULL DEFAULT true,
  mfa_enrolled_at timestamptz
);
CREATE TABLE public.snp_capability_catalog(
  code text PRIMARY KEY,domain text,label text,description text,sensitive boolean NOT NULL
);
CREATE TABLE public.snp_role_capabilities(
  role text NOT NULL,capability_code text NOT NULL REFERENCES public.snp_capability_catalog(code),
  PRIMARY KEY(role,capability_code)
);
CREATE TABLE public.snp_user_capabilities(
  user_id uuid NOT NULL REFERENCES auth.users(id),
  capability_code text NOT NULL REFERENCES public.snp_capability_catalog(code),
  allowed boolean NOT NULL,valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,reason text,granted_by uuid,granted_at timestamptz DEFAULT now(),
  PRIMARY KEY(user_id,capability_code)
);

INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive) VALUES
 ('sonasp.prepare','sonasp','prepare','prepare',true),
 ('sonasp.finance.execute','finance','execute','execute',true),
 ('sonasp.finance.reconcile','finance','reconcile','reconcile',true),
 ('comptoir.manage','comptoir','manage','manage',true),
 ('collectors.manage','artisanat','collectors','collectors',true),
 ('collector.operate','artisanat','collector','collector',true);

CREATE OR REPLACE FUNCTION public.snp_mfa_satisfaite() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public','pg_temp' AS $fn$
  SELECT auth.role()='service_role' OR coalesce(
    current_setting('request.jwt.claim.aal',true),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal'
  )='aal2';
$fn$;
CREATE OR REPLACE FUNCTION public.snp_actor_has_capability(p_code text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='public','pg_temp' AS $fn$
  WITH actor AS(
    SELECT id,role FROM public.user_profiles WHERE id=auth.uid() AND is_active
  ), cap AS(
    SELECT code,sensitive FROM public.snp_capability_catalog WHERE code=p_code
  ), override AS(
    SELECT allowed FROM public.snp_user_capabilities
    WHERE user_id=auth.uid() AND capability_code=p_code
      AND valid_from<=clock_timestamp()
      AND (valid_until IS NULL OR valid_until>clock_timestamp())
  )
  SELECT CASE
    WHEN auth.role()='service_role' THEN true
    WHEN NOT EXISTS(SELECT 1 FROM actor) OR NOT EXISTS(SELECT 1 FROM cap) THEN false
    WHEN (SELECT sensitive FROM cap) AND NOT public.snp_mfa_satisfaite() THEN false
    WHEN EXISTS(SELECT 1 FROM override) THEN (SELECT allowed FROM override LIMIT 1)
    WHEN (SELECT role FROM actor)='owner' THEN true
    ELSE EXISTS(SELECT 1 FROM public.snp_role_capabilities r
                WHERE r.role=(SELECT role FROM actor) AND r.capability_code=p_code)
  END;
$fn$;
CREATE OR REPLACE FUNCTION public.snp_require_capability(p_code text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_actor_has_capability(p_code) THEN
    RAISE EXCEPTION 'Capacité serveur requise : %.',p_code USING ERRCODE='42501';
  END IF;
END;
$fn$;

CREATE TABLE public.snp_organizations(
  id uuid PRIMARY KEY,code text UNIQUE NOT NULL,name text NOT NULL,
  organization_type text NOT NULL,is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.snp_user_organization_memberships(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid NOT NULL REFERENCES public.snp_organizations(id),
  membership_role text,is_primary boolean DEFAULT true,valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,reason text
);
CREATE OR REPLACE FUNCTION public.snp_current_organization_id() RETURNS uuid
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='public','pg_temp' AS $fn$
  SELECT m.organization_id FROM public.snp_user_organization_memberships m
  JOIN public.snp_organizations o ON o.id=m.organization_id AND o.is_active
  WHERE m.user_id=auth.uid() AND m.valid_from<=clock_timestamp()
    AND (m.valid_until IS NULL OR m.valid_until>clock_timestamp())
  ORDER BY m.is_primary DESC,m.valid_from DESC LIMIT 1;
$fn$;
CREATE OR REPLACE FUNCTION public.snp_current_organization_type() RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='public','pg_temp' AS $fn$
  SELECT organization_type FROM public.snp_organizations
  WHERE id=public.snp_current_organization_id();
$fn$;

CREATE TABLE public.snp_artisans_miniers(
  id uuid PRIMARY KEY,type_artisan text,type_personne text,actif boolean NOT NULL DEFAULT true,
  nom text,prenoms text,numero_carte text,telephone text,collecteur_id uuid
);
CREATE TABLE public.snp_collector_artisan_assignments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),collector_id uuid,
  artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),
  comptoir_organization_id uuid REFERENCES public.snp_organizations(id),
  valid_from timestamptz DEFAULT now(),valid_until timestamptz,reason text
);
CREATE OR REPLACE FUNCTION public.snp_can_access_artisan(p_artisan uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='public','pg_temp' AS $fn$
  SELECT public.snp_actor_has_capability('collectors.manage')
    OR EXISTS(
      SELECT 1 FROM public.snp_collector_artisan_assignments a
      WHERE a.artisan_id=p_artisan
        AND a.comptoir_organization_id=public.snp_current_organization_id()
        AND a.valid_from<=clock_timestamp()
        AND (a.valid_until IS NULL OR a.valid_until>clock_timestamp())
    );
$fn$;

CREATE TABLE public.snp_workflow_audit(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_type text,aggregate_id uuid,event_type text,from_status text,to_status text,
  actor_id uuid,actor_role text,capability_code text,reason text,context jsonb,
  occurred_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.snp_record_workflow_event(
  p_aggregate_type text,p_aggregate_id uuid,p_event_type text,
  p_from text,p_to text,p_capability text,p_reason text,p_context jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','pg_temp' AS $fn$
BEGIN
  INSERT INTO public.snp_workflow_audit(
    aggregate_type,aggregate_id,event_type,from_status,to_status,
    actor_id,actor_role,capability_code,reason,context
  ) VALUES(p_aggregate_type,p_aggregate_id,p_event_type,p_from,p_to,
           auth.uid(),auth.role(),p_capability,p_reason,p_context);
END;
$fn$;

CREATE TABLE public.snp_artisan_moyens_paiement(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),
  type text NOT NULL,libelle text,numero_telephone text,banque text,numero_compte text,
  code_swift text,titulaire text NOT NULL,est_principal boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,verifie_le timestamptz,verifie_par uuid,
  observations text,created_by uuid,updated_by uuid,created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.snp_4b_payment_snapshot(
  p_row public.snp_artisan_moyens_paiement
) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path='pg_catalog','pg_temp' AS $fn$
  SELECT CASE WHEN p_row IS NULL THEN NULL ELSE jsonb_build_object(
    'artisan_id',p_row.artisan_id,'type',p_row.type,'est_principal',p_row.est_principal,
    'actif',p_row.actif,'verifie',p_row.verifie_le IS NOT NULL,
    'mobile_last4',right(regexp_replace(coalesce(p_row.numero_telephone,''),'\s','','g'),4),
    'account_last4',right(regexp_replace(coalesce(p_row.numero_compte,''),'\s','','g'),4)
  ) END;
$fn$;

CREATE TABLE public.snp_artisan_ventes_or(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),
  date_vente date NOT NULL DEFAULT current_date,quantite_grammes numeric NOT NULL,
  type_or text NOT NULL,purete_karat numeric NOT NULL,prix_kg_fcfa numeric NOT NULL,
  montant_brut_fcfa numeric NOT NULL,tva_taux numeric DEFAULT 18,
  tva_montant_fcfa numeric DEFAULT 0,taxe_dev_comm_taux numeric DEFAULT 1,
  taxe_dev_comm_montant_fcfa numeric DEFAULT 0,montant_total_fcfa numeric NOT NULL,
  numero_recu text,reference_vente text,observations text,
  statut text DEFAULT 'en_attente' CHECK(statut IN('en_attente','validee','payee','annulee')),
  statut_paiement text DEFAULT 'non_paye' CHECK(statut_paiement IN(
    'non_paye','en_attente_facture','facture_emise','en_paiement','paye','paiement_partiel'
  )),
  statut_validation text DEFAULT 'en_attente',facture_definitive_id uuid,
  comptoir_organization_id uuid REFERENCES public.snp_organizations(id),
  acheteur_comptoir_organization_id uuid,acheteur_id uuid,
  created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
  created_by uuid,updated_by uuid
);
CREATE TABLE public.snp_artisan_factures_definitives(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),numero_facture text UNIQUE NOT NULL,
  vente_or_id uuid NOT NULL REFERENCES public.snp_artisan_ventes_or(id),
  artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),
  montant_brut numeric NOT NULL,montant_taxe_tva numeric DEFAULT 0,
  montant_taxe_retenue_source numeric DEFAULT 0,montant_autres_taxes numeric DEFAULT 0,
  montant_total_taxes numeric NOT NULL,montant_net_a_payer numeric NOT NULL,
  taux_tva numeric DEFAULT 0,taux_retenue_source numeric DEFAULT 0,
  date_emission timestamptz DEFAULT now(),date_echeance timestamptz,
  statut text DEFAULT 'emise' CHECK(statut IN('emise','en_paiement','payee','annulee')),
  pdf_url text,notes text,emise_par uuid REFERENCES auth.users(id),
  certification_dgi_status text NOT NULL DEFAULT 'pending',dgi_reference text,
  dgi_document_path text,dgi_certified_at timestamptz,dgi_certified_by uuid,
  comptoir_organization_id uuid REFERENCES public.snp_organizations(id),
  created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.snp_artisan_ventes_or ADD CONSTRAINT snp_vente_facture_fkey
  FOREIGN KEY(facture_definitive_id) REFERENCES public.snp_artisan_factures_definitives(id);

CREATE TABLE public.snp_artisan_paiements(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference_paiement text UNIQUE NOT NULL,
  facture_id uuid NOT NULL REFERENCES public.snp_artisan_factures_definitives(id),
  vente_or_id uuid NOT NULL REFERENCES public.snp_artisan_ventes_or(id),
  artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),
  moyen_paiement_id uuid REFERENCES public.snp_artisan_moyens_paiement(id),
  numero_facture text,type_paiement text NOT NULL CHECK(type_paiement IN(
    'virement_bancaire','cash','orange_money','mobile_money','moov_money','wave','cheque'
  )),montant_paye numeric NOT NULL,montant_taxes_retenues numeric NOT NULL DEFAULT 0,
  details_paiement jsonb DEFAULT '{}'::jsonb,
  statut text DEFAULT 'en_attente' CHECK(statut IN(
    'en_attente','en_traitement','valide','complete','annule','echec'
  )),date_paiement timestamptz DEFAULT now(),date_validation timestamptz,
  date_completion timestamptz,preuve_paiement_url text,recu_paiement_url text,
  traite_par uuid REFERENCES auth.users(id),valide_par uuid REFERENCES auth.users(id),
  notes text,comptoir_organization_id uuid REFERENCES public.snp_organizations(id),
  created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.snp_artisan_taxes_retenues(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id uuid NOT NULL REFERENCES public.snp_artisan_paiements(id),
  facture_id uuid NOT NULL REFERENCES public.snp_artisan_factures_definitives(id),
  vente_or_id uuid NOT NULL REFERENCES public.snp_artisan_ventes_or(id),
  artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),
  type_taxe text NOT NULL CHECK(type_taxe IN('tva','retenue_source','taxe_municipale','taxe_regionale','autre')),
  libelle_taxe text NOT NULL,taux_taxe numeric NOT NULL,montant_taxe numeric NOT NULL,
  compte_comptable text,reference_comptable text,
  statut_reversement text DEFAULT 'a_reverser' CHECK(statut_reversement IN(
    'a_reverser','en_cours','reverse','comptabilise'
  )),date_reversement timestamptz,reversement_reference text,
  periode_fiscale text,exercice_fiscal text,
  comptoir_organization_id uuid REFERENCES public.snp_organizations(id),
  created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.snp_artisanal_stock_ledger(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.snp_organizations(id),
  artisan_id uuid REFERENCES public.snp_artisans_miniers(id),
  direction text NOT NULL,movement_type text NOT NULL,quantity_grams numeric NOT NULL,
  business_reference text NOT NULL,idempotency_key text NOT NULL,source_type text,
  source_id uuid,reverses_entry_id uuid,reason text,created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),UNIQUE(organization_id,business_reference),
  UNIQUE(organization_id,idempotency_key)
);

CREATE OR REPLACE FUNCTION public.snp_guard_artisan_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','pg_temp' AS $fn$
BEGIN RETURN NEW; END;
$fn$;
CREATE TRIGGER snp_artisan_payment_guard BEFORE INSERT OR UPDATE
ON public.snp_artisan_paiements FOR EACH ROW EXECUTE FUNCTION public.snp_guard_artisan_payment();

CREATE OR REPLACE FUNCTION public.snp_finalize_comptoir_purchase() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','pg_temp' AS $fn$
BEGIN RETURN NEW; END;
$fn$;
CREATE TRIGGER snp_finalize_comptoir_purchase AFTER INSERT OR UPDATE OF statut
ON public.snp_artisan_paiements FOR EACH ROW EXECUTE FUNCTION public.snp_finalize_comptoir_purchase();

CREATE OR REPLACE FUNCTION public.generer_numero_facture() RETURNS text
LANGUAGE sql AS $fn$ SELECT 'LEGACY-FACTURE'::text $fn$;
CREATE OR REPLACE FUNCTION public.generer_reference_paiement() RETURNS text
LANGUAGE sql AS $fn$ SELECT 'LEGACY-PAIEMENT'::text $fn$;
CREATE OR REPLACE FUNCTION public.calculer_taxes_vente(
  p_montant_brut numeric,p_taux_tva numeric DEFAULT 18,p_taux_retenue_source numeric DEFAULT 1.5
) RETURNS TABLE(montant_tva numeric,montant_retenue_source numeric,montant_total_taxes numeric,montant_net numeric)
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT round(p_montant_brut*p_taux_tva/100,2),
         round(p_montant_brut*p_taux_retenue_source/100,2),
         round(p_montant_brut*(p_taux_tva+p_taux_retenue_source)/100,2),
         round(p_montant_brut-p_montant_brut*(p_taux_tva+p_taux_retenue_source)/100,2)
$fn$;
CREATE OR REPLACE FUNCTION public.snp_certify_artisan_invoice(
  p_invoice_id uuid,p_reference text,p_document_path text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $fn$
BEGIN
  -- Stub de clone uniquement : consomme explicitement les paramètres afin que
  -- pg_prove/plpgsql_check mesure le lot 4I, pas une alerte artificielle.
  IF p_invoice_id IS NULL OR p_reference IS NULL OR p_document_path IS NULL THEN
    RETURN;
  END IF;
END;
$fn$;

ALTER TABLE public.snp_artisan_ventes_or ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_artisan_factures_definitives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_artisan_paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_artisan_taxes_retenues ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_sales_all ON public.snp_artisan_ventes_or FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY legacy_invoices_all ON public.snp_artisan_factures_definitives FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY legacy_payments_all ON public.snp_artisan_paiements FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY legacy_taxes_all ON public.snp_artisan_taxes_retenues FOR ALL TO authenticated USING(true) WITH CHECK(true);
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

CREATE VIEW public.v_artisan_paiements_resume AS SELECT a.id artisan_id,a.nom,a.prenoms,a.numero_carte,
  0::bigint nombre_ventes,0::bigint nombre_paiements,0::numeric total_brut,0::numeric total_taxes,
  0::numeric total_net,0::numeric total_paye,0::numeric solde_du FROM public.snp_artisans_miniers a;
CREATE VIEW public.v_taxes_a_reverser AS SELECT type_taxe,libelle_taxe,periode_fiscale,exercice_fiscal,
  count(*) nombre_transactions,sum(montant_taxe) montant_total,statut_reversement
  FROM public.snp_artisan_taxes_retenues GROUP BY 1,2,3,4,7;
CREATE VIEW public.v_paiements_en_attente AS SELECT v.id vente_id,v.reference_vente,v.date_vente,
  a.id artisan_id,a.nom||' '||a.prenoms artisan_nom_complet,a.numero_carte,a.telephone,
  f.id facture_id,f.numero_facture,f.montant_net_a_payer,f.date_emission date_facture,
  v.statut_paiement,current_date-f.date_emission::date jours_attente
  FROM public.snp_artisan_ventes_or v JOIN public.snp_artisans_miniers a ON a.id=v.artisan_id
  LEFT JOIN public.snp_artisan_factures_definitives f ON f.vente_or_id=v.id;
