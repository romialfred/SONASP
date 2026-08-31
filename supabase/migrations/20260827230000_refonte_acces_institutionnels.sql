-- =============================================================================
-- Refonte IAM SONASP : rôles institutionnels, responsabilités, périmètres et
-- plafonds d'habilitation. Cette migration est additive et conserve les UUID.
-- =============================================================================

BEGIN;

-- 1. Référentiels opposables ---------------------------------------------------
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (
  role IN (
    'owner', 'admin', 'management', 'dgmg', 'dgi', 'mine', 'comptoir',
    'collector', 'customer', 'manager', 'factory', 'airport', 'refinery'
  )
);

ALTER TABLE public.snp_organizations
  DROP CONSTRAINT IF EXISTS snp_organizations_organization_type_check;
ALTER TABLE public.snp_organizations ADD CONSTRAINT snp_organizations_organization_type_check CHECK (
  organization_type IN (
    'sonasp', 'dgmg', 'dgi', 'mine', 'comptoir', 'collector',
    'factory', 'airport', 'refinery', 'customer'
  )
);
ALTER TABLE public.snp_organizations ADD COLUMN IF NOT EXISTS administrative_region text;
ALTER TABLE public.snp_organizations ADD COLUMN IF NOT EXISTS zone_code text;
ALTER TABLE public.snp_organizations ADD COLUMN IF NOT EXISTS service_code text;
ALTER TABLE public.snp_organizations ADD COLUMN IF NOT EXISTS scope_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.snp_organizations (code, name, organization_type, is_active)
VALUES
  ('SONASP', 'Société Nationale des Substances Précieuses', 'sonasp', true),
  ('DGMG', 'Direction Générale des Mines et de la Géologie', 'dgmg', true),
  ('DGI', 'Direction Générale des Impôts', 'dgi', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, organization_type = EXCLUDED.organization_type, is_active = true;

CREATE TABLE IF NOT EXISTS public.snp_access_role_policies (
  role text PRIMARY KEY,
  portal_code text NOT NULL CHECK (portal_code IN ('sonasp', 'dgmg', 'dgi', 'operator', 'collector', 'client')),
  organization_type text,
  organization_required boolean NOT NULL DEFAULT false,
  can_administer_accounts boolean NOT NULL DEFAULT false,
  is_legacy boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.snp_access_role_policies
  (role, portal_code, organization_type, organization_required, can_administer_accounts, is_legacy)
VALUES
  ('owner', 'sonasp', 'sonasp', false, true, true),
  ('admin', 'sonasp', 'sonasp', false, true, false),
  ('management', 'sonasp', 'sonasp', false, false, false),
  ('dgmg', 'dgmg', 'dgmg', true, false, false),
  ('dgi', 'dgi', 'dgi', true, false, false),
  ('mine', 'operator', 'mine', true, false, false),
  ('comptoir', 'operator', 'comptoir', true, false, false),
  ('collector', 'collector', 'comptoir', true, false, false),
  ('customer', 'client', 'customer', false, false, false),
  ('manager', 'sonasp', 'sonasp', false, false, true),
  ('factory', 'operator', 'factory', true, false, true),
  ('airport', 'operator', 'airport', true, false, true),
  ('refinery', 'operator', 'refinery', true, false, true)
ON CONFLICT (role) DO UPDATE SET
  portal_code = EXCLUDED.portal_code,
  organization_type = EXCLUDED.organization_type,
  organization_required = EXCLUDED.organization_required,
  can_administer_accounts = EXCLUDED.can_administer_accounts,
  is_legacy = EXCLUDED.is_legacy,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.snp_responsibility_catalog (
  code text PRIMARY KEY,
  capability_code text UNIQUE NOT NULL REFERENCES public.snp_capability_catalog(code) ON DELETE RESTRICT,
  label text NOT NULL,
  description text NOT NULL,
  sensitive boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.snp_role_responsibility_ceiling (
  role text NOT NULL REFERENCES public.snp_access_role_policies(role) ON DELETE CASCADE,
  responsibility_code text NOT NULL REFERENCES public.snp_responsibility_catalog(code) ON DELETE CASCADE,
  required boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, responsibility_code)
);

CREATE TABLE IF NOT EXISTS public.snp_responsibility_conflicts (
  left_code text NOT NULL REFERENCES public.snp_responsibility_catalog(code) ON DELETE CASCADE,
  right_code text NOT NULL REFERENCES public.snp_responsibility_catalog(code) ON DELETE CASCADE,
  reason text NOT NULL,
  PRIMARY KEY (left_code, right_code),
  CHECK (left_code < right_code)
);

CREATE TABLE IF NOT EXISTS public.snp_user_responsibilities (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  responsibility_code text NOT NULL REFERENCES public.snp_responsibility_catalog(code) ON DELETE RESTRICT,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 10),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, responsibility_code)
);

INSERT INTO public.snp_capability_catalog (code, domain, label, description, sensitive)
VALUES
  ('dgmg.supervise', 'dgmg', 'Supervision DGMG', 'Contrôler les sites, opérateurs et déclarations du secteur minier.', true),
  ('dgmg.production.validate', 'dgmg', 'Validation production DGMG', 'Valider une déclaration de production dans le périmètre réglementaire.', true),
  ('dgi.fiscal.control', 'dgi', 'Contrôle fiscal DGI', 'Contrôler les assiettes, taxes et royalties.', true),
  ('dgi.fiscal.reconcile', 'dgi', 'Rapprochement fiscal DGI', 'Rapprocher les montants déclarés, appelés et payés.', true),
  ('mine.production.manage', 'mine', 'Gestion de production', 'Déclarer la production de la société rattachée.', true),
  ('refining.supervise', 'refining', 'Supervision du raffinage', 'Suivre les lots, résultats et réceptions autorisés.', true),
  ('reconciliation.manage', 'reconciliation', 'Gestion de la conciliation', 'Préparer et analyser les dossiers de conciliation.', true)
ON CONFLICT (code) DO UPDATE SET
  domain = EXCLUDED.domain, label = EXCLUDED.label,
  description = EXCLUDED.description, sensitive = EXCLUDED.sensitive;

INSERT INTO public.snp_responsibility_catalog (code, capability_code, label, description)
VALUES
  ('sonasp.prepare', 'sonasp.prepare', 'SONASP Gestionnaire', 'Prépare les dossiers et les soumet au contrôle.'),
  ('sonasp.approve', 'sonasp.approve', 'SONASP Approbateur', 'Contrôle, approuve ou rejette les dossiers préparés par un autre acteur.'),
  ('sonasp.finance.execute', 'sonasp.finance.execute', 'Finance — exécution', 'Exécute les règlements et joint les preuves.'),
  ('sonasp.finance.reconcile', 'sonasp.finance.reconcile', 'Finance — rapprochement', 'Rapproche les opérations exécutées par un autre acteur.'),
  ('refining.supervise', 'refining.supervise', 'Raffinage', 'Suit les lots et résultats autorisés.'),
  ('reconciliation.manage', 'reconciliation.manage', 'Conciliation', 'Prépare et analyse les dossiers de conciliation.'),
  ('dgmg.supervise', 'dgmg.supervise', 'Supervision DGMG', 'Contrôle réglementaire du secteur.'),
  ('dgmg.production.validate', 'dgmg.production.validate', 'Validation production', 'Valide les déclarations réglementaires.'),
  ('mine.production.manage', 'mine.production.manage', 'Gestion de la production', 'Déclare la production du périmètre société.'),
  ('comptoir.manage', 'comptoir.manage', 'Gestion du comptoir', 'Gère les opérations du comptoir rattaché.'),
  ('collectors.manage', 'collectors.manage', 'Gestion des collecteurs', 'Gère les rattachements collecteurs-orpailleurs.'),
  ('dgi.fiscal.control', 'dgi.fiscal.control', 'Contrôle fiscal', 'Contrôle les assiettes, taxes et royalties.'),
  ('dgi.fiscal.reconcile', 'dgi.fiscal.reconcile', 'Rapprochement fiscal', 'Rapproche les montants fiscaux.'),
  ('collector.operate', 'collector.operate', 'Collecte terrain', 'Opère sur les seuls orpailleurs rattachés.')
ON CONFLICT (code) DO UPDATE SET
  capability_code = EXCLUDED.capability_code,
  label = EXCLUDED.label,
  description = EXCLUDED.description;

DELETE FROM public.snp_role_responsibility_ceiling;
INSERT INTO public.snp_role_responsibility_ceiling (role, responsibility_code, required)
VALUES
  ('management', 'sonasp.prepare', false),
  ('management', 'sonasp.approve', false),
  ('management', 'sonasp.finance.execute', false),
  ('management', 'sonasp.finance.reconcile', false),
  ('management', 'refining.supervise', false),
  ('management', 'reconciliation.manage', false),
  ('management', 'collectors.manage', false),
  ('dgmg', 'dgmg.supervise', true),
  ('dgmg', 'dgmg.production.validate', false),
  ('dgmg', 'collectors.manage', false),
  ('mine', 'mine.production.manage', true),
  ('mine', 'refining.supervise', false),
  ('comptoir', 'comptoir.manage', true),
  ('comptoir', 'refining.supervise', false),
  ('dgi', 'dgi.fiscal.control', true),
  ('dgi', 'dgi.fiscal.reconcile', false),
  ('collector', 'collector.operate', true);

INSERT INTO public.snp_responsibility_conflicts (left_code, right_code, reason)
VALUES
  ('sonasp.approve', 'sonasp.prepare', 'Le préparateur ne peut pas approuver son propre flux.'),
  ('sonasp.finance.execute', 'sonasp.finance.reconcile', 'L’exécutant financier ne peut pas rapprocher son opération.')
ON CONFLICT DO NOTHING;

-- 2. Domaines stables et plafond CRUD -----------------------------------------
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS access_domain text;
UPDATE public.modules SET access_domain = CASE
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(user|utilisateur|account|compte)' THEN 'users'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ 'audit' THEN 'audit'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(setting|param|status|statut|workflow|configuration|referentiel)' THEN 'settings'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(tax|fiscal|royalt|redevance|dgi)' THEN 'tax'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(conciliation|reconciliation|rapprochement)' THEN 'reconciliation'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(site|mine)' THEN 'sites'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(artisan|orpailleur|collecteur|collecte)' THEN 'artisans'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(production|forecast|budget)' THEN 'production'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(achat|purchase|requisition)' THEN 'purchases'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(payment|paiement|reglement|facture|invoice)' THEN 'payments'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(shipping|expedition|freight|fret|douane)' THEN 'shipping'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(refining|raffinage|raffinerie)' THEN 'refining'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(inventory|stock|coffre)' THEN 'inventory'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(contract|contrat)' THEN 'contracts'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(customer|client|partie prenante)' THEN 'customers'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(document|certificat|assay)' THEN 'documents'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(report|rapport|analytic|dashboard|tableau de bord)' THEN 'reports'
  WHEN lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(sale|vente|marche|negoce)' THEN 'sales'
  ELSE 'unknown'
END
WHERE access_domain IS NULL;

-- Les identifiants métier prioritaires corrigent les collisions de libellés
-- (« production minière » ne doit jamais devenir un module Sites).
UPDATE public.modules SET access_domain='production'
WHERE lower(coalesce(name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,'')) ~ '(production|forecast|budget)';

DO $module_preflight$
DECLARE v_unknown text;
BEGIN
  SELECT string_agg(coalesce(name,id::text),', ' ORDER BY name) INTO v_unknown
  FROM public.modules WHERE coalesce(is_active,true) AND access_domain='unknown';
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight IAM : modules actifs sans domaine explicite : %',v_unknown;
  END IF;
END;
$module_preflight$;

ALTER TABLE public.modules DROP CONSTRAINT IF EXISTS modules_access_domain_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_access_domain_check CHECK (
  access_domain IN ('users','settings','sites','artisans','production','purchases','sales','payments','shipping','refining','inventory','reconciliation','tax','contracts','customers','documents','reports','audit','unknown')
);

CREATE TABLE IF NOT EXISTS public.snp_role_module_ceilings (
  role text NOT NULL REFERENCES public.snp_access_role_policies(role) ON DELETE CASCADE,
  access_domain text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, access_domain)
);

DELETE FROM public.snp_role_module_ceilings;
INSERT INTO public.snp_role_module_ceilings
  (role, access_domain, can_view, can_create, can_edit, can_delete, can_approve)
VALUES
  ('admin','users',true,true,true,true,false), ('admin','settings',true,true,true,true,false),
  ('admin','sites',true,false,false,false,false), ('admin','artisans',true,false,false,false,false),
  ('admin','production',true,false,false,false,false), ('admin','purchases',true,false,false,false,false),
  ('admin','sales',true,false,false,false,false), ('admin','payments',true,false,false,false,false),
  ('admin','shipping',true,false,false,false,false), ('admin','refining',true,false,false,false,false),
  ('admin','inventory',true,false,false,false,false), ('admin','reconciliation',true,false,false,false,false),
  ('admin','tax',true,false,false,false,false), ('admin','contracts',true,false,false,false,false),
  ('admin','customers',true,false,false,false,false), ('admin','documents',true,false,false,false,false),
  ('admin','reports',true,false,false,false,false), ('admin','audit',true,false,false,false,false),
  ('owner','users',true,true,true,true,false), ('owner','settings',true,true,true,true,false),
  ('owner','reports',true,false,false,false,false), ('owner','audit',true,false,false,false,false),
  ('management','sites',true,false,false,false,false), ('management','artisans',true,false,false,false,false),
  ('management','production',true,true,true,false,true), ('management','purchases',true,true,true,false,true),
  ('management','sales',true,true,true,false,true), ('management','payments',true,true,true,false,true),
  ('management','shipping',true,true,true,false,true), ('management','refining',true,true,true,false,true),
  ('management','inventory',true,true,true,false,false), ('management','reconciliation',true,true,true,false,true),
  ('management','tax',true,false,false,false,false), ('management','contracts',true,true,true,false,false),
  ('management','customers',true,true,true,false,false), ('management','documents',true,true,true,false,false),
  ('management','reports',true,false,false,false,false), ('management','audit',true,false,false,false,false),
  ('dgmg','sites',true,true,true,false,false), ('dgmg','artisans',true,true,true,false,false),
  ('dgmg','production',true,false,false,false,true), ('dgmg','documents',true,false,false,false,false),
  ('dgmg','reports',true,false,false,false,false), ('dgmg','audit',true,false,false,false,false),
  ('dgi','production',true,false,false,false,false), ('dgi','sales',true,false,false,false,false),
  ('dgi','payments',true,false,false,false,true), ('dgi','reconciliation',true,false,true,false,true),
  ('dgi','tax',true,false,true,false,false), ('dgi','documents',true,false,false,false,false),
  ('dgi','reports',true,false,false,false,false), ('dgi','audit',true,false,false,false,false),
  ('mine','production',true,true,true,false,false), ('mine','purchases',true,true,true,false,false),
  ('mine','sales',true,true,true,false,false), ('mine','payments',true,false,false,false,false),
  ('mine','shipping',true,true,true,false,false), ('mine','refining',true,false,false,false,false),
  ('mine','inventory',true,false,false,false,false), ('mine','contracts',true,true,true,false,false),
  ('mine','customers',true,false,false,false,false), ('mine','documents',true,true,true,false,false),
  ('mine','reports',true,false,false,false,false),
  ('comptoir','sites',true,false,false,false,false), ('comptoir','artisans',true,true,true,false,false),
  ('comptoir','production',true,true,true,false,false), ('comptoir','sales',true,true,true,false,false),
  ('comptoir','payments',true,true,true,false,false), ('comptoir','inventory',true,false,false,false,false),
  ('comptoir','tax',true,true,true,false,false),
  ('comptoir','documents',true,true,true,false,false), ('comptoir','reports',true,false,false,false,false),
  ('collector','sites',true,false,false,false,false), ('collector','artisans',true,true,true,false,false),
  ('collector','production',true,true,true,false,false), ('collector','documents',true,true,true,false,false),
  ('collector','reports',true,false,false,false,false),
  ('customer','sales',true,false,false,false,false), ('customer','payments',true,false,false,false,false),
  ('customer','documents',true,false,false,false,false), ('customer','reports',true,false,false,false,false);

-- Le propriétaire actif porte le périmètre global. La génération à partir des
-- domaines déclarés évite qu'un futur module soit oublié dans sa matrice.
INSERT INTO public.snp_role_module_ceilings
  (role, access_domain, can_view, can_create, can_edit, can_delete, can_approve)
SELECT 'owner', domain, true, true, true, true, true
FROM unnest(ARRAY[
  'users','settings','sites','artisans','production','purchases','sales','payments',
  'shipping','refining','inventory','reconciliation','tax','contracts','customers',
  'documents','reports','audit'
]::text[]) AS domain
ON CONFLICT (role, access_domain) DO UPDATE SET
  can_view=true, can_create=true, can_edit=true, can_delete=true, can_approve=true;

-- Continuité sûre : les comptes existants obtiennent seulement la lecture des
-- domaines de leur rôle. Les écritures exigent une responsabilité revue.
INSERT INTO public.user_permissions(
  user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,
  can_read,can_write,field_permissions,granted_by
)
SELECT p.id,m.id,true,false,false,false,false,true,false,'{}'::jsonb,NULL
FROM public.user_profiles p
JOIN public.snp_role_module_ceilings c ON c.role=p.role AND c.can_view
JOIN public.modules m ON m.access_domain=c.access_domain AND coalesce(m.is_active,true)
ON CONFLICT(user_id,module_id) DO NOTHING;

-- 3. Migration sans perte des comptes legacy ----------------------------------
CREATE TABLE IF NOT EXISTS public.snp_access_migration_review (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  legacy_role text NOT NULL,
  proposed_role text,
  reason text NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

UPDATE public.user_profiles p SET role = 'comptoir', updated_at = now()
WHERE p.role = 'customer' AND EXISTS (
  SELECT 1 FROM public.snp_user_capabilities uc
  WHERE uc.user_id = p.id AND uc.capability_code = 'comptoir.manage' AND uc.allowed
);
UPDATE public.user_profiles p SET role = 'collector', updated_at = now()
WHERE p.role = 'customer' AND EXISTS (
  SELECT 1 FROM public.snp_user_capabilities uc
  WHERE uc.user_id = p.id AND uc.capability_code = 'collector.operate' AND uc.allowed
);
INSERT INTO public.snp_access_migration_review (user_id, legacy_role, proposed_role, reason)
SELECT p.id, p.role, NULL, 'Profil historique à qualifier manuellement avant attribution de responsabilités.'
FROM public.user_profiles p
WHERE p.role IN ('manager','factory','airport','refinery')
ON CONFLICT (user_id) DO NOTHING;

-- Synchronise le rattachement des comptes mines existants.
INSERT INTO public.snp_user_organization_memberships
  (user_id, organization_id, membership_role, is_primary, reason, granted_by)
SELECT p.id, o.id, 'manager', true, 'Migration du périmètre minier historique', NULL
FROM public.user_profiles p
JOIN public.snp_organizations o ON o.mining_company_id = p.mining_company_id
WHERE p.role = 'mine' AND p.mining_company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.snp_user_organization_memberships m
    WHERE m.user_id = p.id AND m.valid_until IS NULL
  );

-- 4. Capabilities : aucun override ne peut dépasser le rôle -------------------
DELETE FROM public.snp_role_capabilities
WHERE role IN ('owner','admin','management','dgmg','dgi','mine','comptoir','collector');
INSERT INTO public.snp_role_capabilities (role, capability_code)
VALUES
  ('owner','accounts.manage'), ('owner','referentials.manage'), ('owner','support.read'), ('owner','reports.read'),
  ('owner','reconciliation.read'), ('owner','tax.rules.read'),
  ('admin','accounts.manage'), ('admin','referentials.manage'), ('admin','support.read'), ('admin','reports.read'),
  ('admin','reconciliation.read'), ('admin','tax.rules.read'),
  ('management','reports.read'), ('management','sonasp.workflow.read'), ('management','reconciliation.read'), ('management','tax.rules.read'),
  ('dgmg','reports.read'), ('dgi','reports.read'), ('dgi','reconciliation.read'), ('dgi','tax.rules.read'), ('mine','mine.operate'),
  ('comptoir','comptoir.manage'), ('collector','collector.operate'), ('customer','customer.operate')
ON CONFLICT DO NOTHING;

INSERT INTO public.snp_role_capabilities (role, capability_code)
SELECT 'owner', code FROM public.snp_capability_catalog
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.snp_actor_has_capability(p_capability_code text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  WITH actor AS (
    SELECT p.id, p.role FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.is_active
  ), catalog AS (
    SELECT c.code, c.sensitive FROM public.snp_capability_catalog c WHERE c.code = p_capability_code
  ), responsibility AS (
    SELECT 1 FROM public.snp_user_responsibilities ur
    JOIN public.snp_role_responsibility_ceiling rc
      ON rc.role = (SELECT role FROM actor) AND rc.responsibility_code = ur.responsibility_code
    JOIN public.snp_responsibility_catalog r
      ON r.code = ur.responsibility_code AND r.capability_code = p_capability_code
    WHERE ur.user_id = auth.uid()
  ), explicit_override AS (
    SELECT uc.allowed FROM public.snp_user_capabilities uc
    WHERE uc.user_id = auth.uid() AND uc.capability_code = p_capability_code
      AND uc.valid_from <= clock_timestamp()
      AND (uc.valid_until IS NULL OR uc.valid_until > clock_timestamp())
  )
  SELECT CASE
    WHEN COALESCE(auth.role(), '') = 'service_role' THEN true
    WHEN NOT EXISTS (SELECT 1 FROM actor) OR NOT EXISTS (SELECT 1 FROM catalog) THEN false
    WHEN COALESCE(auth.role(), '') = 'authenticated' AND NOT public.snp_session_est_active() THEN false
    WHEN (SELECT sensitive FROM catalog) AND NOT public.snp_mfa_satisfaite() THEN false
    WHEN (SELECT role FROM actor) = 'owner' THEN true
    WHEN EXISTS (SELECT 1 FROM public.snp_responsibility_catalog r WHERE r.capability_code = p_capability_code)
      THEN EXISTS (SELECT 1 FROM responsibility)
    WHEN EXISTS (SELECT 1 FROM explicit_override)
      THEN (SELECT allowed FROM explicit_override LIMIT 1)
           AND EXISTS (
             SELECT 1 FROM public.snp_role_capabilities rc
             WHERE rc.role = (SELECT role FROM actor) AND rc.capability_code = p_capability_code
           )
    ELSE EXISTS (
      SELECT 1 FROM public.snp_role_capabilities rc
      WHERE rc.role = (SELECT role FROM actor) AND rc.capability_code = p_capability_code
    )
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_definir_capacite_utilisateur(
  p_user_id uuid, p_capability_code text, p_allowed boolean, p_reason text,
  p_valid_until timestamptz DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_target_role text;
BEGIN
  PERFORM public.snp_require_capability('accounts.manage');
  IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'Auto-attribution interdite.' USING ERRCODE='42501'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason))<10 THEN RAISE EXCEPTION 'Justification insuffisante.' USING ERRCODE='22023'; END IF;
  SELECT role INTO v_target_role FROM public.user_profiles WHERE id=p_user_id AND is_active FOR UPDATE;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'Compte cible introuvable ou inactif.' USING ERRCODE='P0002'; END IF;
  IF EXISTS(SELECT 1 FROM public.snp_responsibility_catalog WHERE capability_code=p_capability_code) THEN
    RAISE EXCEPTION 'Une responsabilité métier doit être attribuée par la configuration d’accès atomique.' USING ERRCODE='42501';
  END IF;
  IF p_allowed AND NOT EXISTS(
    SELECT 1 FROM public.snp_role_capabilities rc
    WHERE rc.role=v_target_role AND rc.capability_code=p_capability_code
  ) THEN RAISE EXCEPTION 'La capacité dépasse le plafond du rôle.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed,valid_from,valid_until,reason,granted_by,granted_at)
  VALUES(p_user_id,p_capability_code,p_allowed,now(),p_valid_until,trim(p_reason),auth.uid(),now())
  ON CONFLICT(user_id,capability_code) DO UPDATE SET allowed=EXCLUDED.allowed,valid_from=EXCLUDED.valid_from,
    valid_until=EXCLUDED.valid_until,reason=EXCLUDED.reason,granted_by=EXCLUDED.granted_by,granted_at=now();
  PERFORM public.snp_record_workflow_event('account-capability',p_user_id,
    CASE WHEN p_allowed THEN 'capability-granted' ELSE 'capability-denied' END,NULL,p_capability_code,
    'accounts.manage',p_reason,jsonb_build_object('allowed',p_allowed));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_validate_responsibilities(p_role text, p_responsibilities jsonb)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF p_responsibilities IS NULL OR jsonb_typeof(p_responsibilities) <> 'object' THEN
    RAISE EXCEPTION 'Le format des responsabilités est invalide.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(p_responsibilities) x
    WHERE x.value::boolean AND NOT EXISTS (
      SELECT 1 FROM public.snp_role_responsibility_ceiling c
      WHERE c.role = p_role AND c.responsibility_code = x.key
    )
  ) THEN RAISE EXCEPTION 'Une responsabilité dépasse le plafond du rôle.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.snp_role_responsibility_ceiling c
    WHERE c.role = p_role AND c.required
      AND COALESCE((p_responsibilities ->> c.responsibility_code)::boolean, false) = false
  ) THEN RAISE EXCEPTION 'Une responsabilité obligatoire est absente.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.snp_responsibility_conflicts c
    WHERE COALESCE((p_responsibilities ->> c.left_code)::boolean, false)
      AND COALESCE((p_responsibilities ->> c.right_code)::boolean, false)
  ) THEN RAISE EXCEPTION 'Séparation des fonctions : responsabilités incompatibles.' USING ERRCODE = '42501'; END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_permission_allowed(
  p_role text, p_module_id uuid, p_action text
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT COALESCE(CASE p_action
    WHEN 'view' THEN c.can_view WHEN 'create' THEN c.can_create
    WHEN 'edit' THEN c.can_edit WHEN 'delete' THEN c.can_delete
    WHEN 'approve' THEN c.can_approve ELSE false END, false)
  FROM public.modules m
  LEFT JOIN public.snp_role_module_ceilings c
    ON c.role = p_role AND c.access_domain = m.access_domain
  WHERE m.id = p_module_id AND COALESCE(m.is_active, true);
$fn$;

-- Le plafond CRUD du rôle n'est qu'une borne supérieure. Pour toute mutation,
-- la responsabilité métier du compte cible doit également être active. Cette
-- vérification est utilisée par le trigger et par le RPC transactionnel : une
-- requête forgée ne peut donc pas contourner la matrice visible dans l'UI.
CREATE OR REPLACE FUNCTION public.snp_user_permission_allowed(
  p_user_id uuid, p_module_id uuid, p_action text
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  WITH target AS (
    SELECT p.role, m.access_domain
    FROM public.user_profiles p CROSS JOIN public.modules m
    WHERE p.id=p_user_id AND m.id=p_module_id
  ), selected AS (
    SELECT ur.responsibility_code
    FROM public.snp_user_responsibilities ur
    WHERE ur.user_id=p_user_id
  )
  SELECT COALESCE(
    CASE
      WHEN NOT public.snp_permission_allowed(t.role,p_module_id,p_action) THEN false
      WHEN p_action='view' THEN true
      WHEN t.role='owner' THEN true
      WHEN t.role='admin' THEN t.access_domain IN ('users','settings')
      WHEN t.role='management' AND p_action IN ('create','edit') THEN
        CASE
          WHEN t.access_domain='payments' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.finance.execute')
          WHEN t.access_domain='reconciliation' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='reconciliation.manage')
          ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.prepare')
        END
      WHEN t.role='management' AND p_action='approve' THEN
        CASE
          WHEN t.access_domain IN ('payments','reconciliation') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.finance.reconcile')
          ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.approve')
        END
      WHEN t.role='dgmg' AND p_action IN ('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgmg.supervise')
      WHEN t.role='dgmg' AND p_action='approve' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgmg.production.validate')
      WHEN t.role='dgi' AND p_action='edit' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgi.fiscal.control')
      WHEN t.role='dgi' AND p_action='approve' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgi.fiscal.reconcile')
      WHEN t.role='mine' AND p_action IN ('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='mine.production.manage')
      WHEN t.role='comptoir' AND p_action IN ('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='comptoir.manage')
      WHEN t.role='collector' AND p_action IN ('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='collector.operate')
      ELSE false
    END,
    false
  )
  FROM target t;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_actor_can_access_organization(p_organization_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT p_organization_id IS NOT NULL
    AND public.snp_session_est_active()
    AND EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND p.is_active)
    AND (
      EXISTS(
        SELECT 1 FROM public.snp_user_organization_memberships m
        WHERE m.user_id=auth.uid() AND m.organization_id=p_organization_id
          AND m.valid_from<=clock_timestamp()
          AND (m.valid_until IS NULL OR m.valid_until>clock_timestamp())
      )
      OR public.snp_actor_has_capability('accounts.manage')
    );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_authorize_scoped_action(
  p_capability_code text,p_organization_id uuid
) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT public.snp_actor_has_capability(p_capability_code)
    AND public.snp_actor_can_access_organization(p_organization_id);
$fn$;

CREATE OR REPLACE FUNCTION public.snp_guard_user_permission_ceiling()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.user_profiles WHERE id = NEW.user_id;
  IF NEW.can_view AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'view')
    OR NEW.can_create AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'create')
    OR NEW.can_edit AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'edit')
    OR NEW.can_delete AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'delete')
    OR NEW.can_approve AND NOT public.snp_user_permission_allowed(NEW.user_id, NEW.module_id, 'approve') THEN
    RAISE EXCEPTION 'Habilitation hors plafond pour le rôle %.', v_role USING ERRCODE = '42501';
  END IF;
  IF (NEW.can_create OR NEW.can_edit OR NEW.can_delete OR NEW.can_approve) AND NOT NEW.can_view THEN
    RAISE EXCEPTION 'La consultation est requise pour tout droit dépendant.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS snp_user_permission_ceiling ON public.user_permissions;
CREATE TRIGGER snp_user_permission_ceiling BEFORE INSERT OR UPDATE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_user_permission_ceiling();

CREATE OR REPLACE FUNCTION public.snp_remplacer_habilitations_compte(p_user_id uuid, p_habilitations jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_role text;
BEGIN
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier les habilitations de ce compte.' USING ERRCODE = '42501';
  END IF;
  IF p_habilitations IS NULL OR jsonb_typeof(p_habilitations) <> 'array' OR jsonb_array_length(p_habilitations) > 200 THEN
    RAISE EXCEPTION 'Le format des habilitations est invalide.' USING ERRCODE = '22023';
  END IF;
  SELECT role INTO v_role FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_habilitations) x(
      module_id uuid, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean, can_approve boolean
    ) WHERE
      (COALESCE(x.can_view,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'view')) OR
      (COALESCE(x.can_create,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'create')) OR
      (COALESCE(x.can_edit,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'edit')) OR
      (COALESCE(x.can_delete,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'delete')) OR
      (COALESCE(x.can_approve,false) AND NOT public.snp_user_permission_allowed(p_user_id,x.module_id,'approve'))
  ) THEN RAISE EXCEPTION 'Une habilitation dépasse le plafond du rôle.' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.user_permissions WHERE user_id = p_user_id;
  INSERT INTO public.user_permissions (
    user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve,can_read,can_write,field_permissions,granted_by
  ) SELECT p_user_id,x.module_id,COALESCE(x.can_view,false),COALESCE(x.can_create,false),
    COALESCE(x.can_edit,false),COALESCE(x.can_delete,false),COALESCE(x.can_approve,false),
    COALESCE(x.can_view,false),COALESCE(x.can_edit,false),COALESCE(x.field_permissions,'{}'::jsonb),auth.uid()
  FROM jsonb_to_recordset(p_habilitations) x(
    module_id uuid,can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_approve boolean,field_permissions jsonb
  ) WHERE COALESCE(x.can_view,false);
  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,new_values)
  VALUES(auth.uid(),p_user_id,'permissions_replace',jsonb_build_object('count',jsonb_array_length(p_habilitations),'role',v_role));
END;
$fn$;

-- Édition atomique : profil + organisation + responsabilités + habilitations.
CREATE OR REPLACE FUNCTION public.snp_configurer_acces_compte(
  p_user_id uuid, p_full_name text, p_phone text, p_role text, p_is_active boolean,
  p_mining_company_id uuid, p_organization_id uuid, p_collector_id uuid,
  p_responsibilities jsonb, p_permissions jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_expected_org text; v_org_type text; v_level_actor integer; v_level_target integer;
BEGIN
  PERFORM public.snp_require_capability('accounts.manage');
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Auto-modification des accès interdite.' USING ERRCODE='42501'; END IF;
  IF p_role NOT IN ('admin','management','dgmg','mine','comptoir','dgi','collector','customer') THEN
    RAISE EXCEPTION 'Rôle non attribuable.' USING ERRCODE='22023';
  END IF;
  v_level_actor := public.snp_niveau_role(public.snp_role_utilisateur());
  v_level_target := public.snp_niveau_role(p_role);
  IF v_level_actor <= v_level_target THEN RAISE EXCEPTION 'Attribution d’un rôle de niveau égal ou supérieur interdite.' USING ERRCODE='42501'; END IF;
  PERFORM public.snp_validate_responsibilities(p_role,p_responsibilities);
  SELECT organization_type INTO v_expected_org FROM public.snp_access_role_policies WHERE role=p_role;
  IF p_role = 'collector' THEN v_expected_org := 'comptoir'; END IF;
  IF EXISTS (SELECT 1 FROM public.snp_access_role_policies WHERE role=p_role AND organization_required)
     AND p_role <> 'mine' AND p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organisation obligatoire pour ce rôle.' USING ERRCODE='23502';
  END IF;
  IF p_organization_id IS NOT NULL THEN
    SELECT organization_type INTO v_org_type FROM public.snp_organizations WHERE id=p_organization_id AND is_active FOR SHARE;
    IF v_org_type IS DISTINCT FROM v_expected_org THEN RAISE EXCEPTION 'Type d’organisation incompatible.' USING ERRCODE='42501'; END IF;
  END IF;
  IF p_role='mine' AND p_mining_company_id IS NULL THEN RAISE EXCEPTION 'Société minière obligatoire.' USING ERRCODE='23502'; END IF;
  IF p_role='collector' AND p_collector_id IS NULL THEN RAISE EXCEPTION 'Profil collecteur obligatoire.' USING ERRCODE='23502'; END IF;
  IF p_role='collector' AND NOT EXISTS(
    SELECT 1 FROM public.snp_artisans_miniers a
    WHERE a.id=p_collector_id AND a.type_artisan='collecteur' AND a.actif
  ) THEN RAISE EXCEPTION 'Profil collecteur inactif ou incompatible.' USING ERRCODE='42501'; END IF;
  IF p_role='collector' AND EXISTS(
    SELECT 1 FROM public.snp_collector_accounts ca
    WHERE ca.collector_id=p_collector_id AND ca.is_active AND ca.user_id<>p_user_id
  ) THEN RAISE EXCEPTION 'Ce collecteur possède déjà un compte actif.' USING ERRCODE='23505'; END IF;

  UPDATE public.user_profiles SET full_name=trim(p_full_name),phone=nullif(trim(p_phone),''),role=p_role,
    is_active=p_is_active,mining_company_id=CASE WHEN p_role='mine' THEN p_mining_company_id ELSE NULL END,
    updated_at=now() WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte cible introuvable.' USING ERRCODE='P0002'; END IF;

  UPDATE public.snp_user_organization_memberships SET valid_until=now(),is_primary=false
  WHERE user_id=p_user_id AND valid_until IS NULL;
  IF p_role='mine' THEN SELECT id INTO p_organization_id FROM public.snp_organizations WHERE mining_company_id=p_mining_company_id;
  END IF;
  IF p_organization_id IS NOT NULL THEN
    INSERT INTO public.snp_user_organization_memberships(user_id,organization_id,membership_role,is_primary,reason,granted_by)
    VALUES(p_user_id,p_organization_id,CASE WHEN p_role IN ('mine','comptoir') THEN 'manager' ELSE 'operator' END,true,
      'Configuration administrative du périmètre',auth.uid());
  END IF;
  UPDATE public.snp_collector_accounts SET is_active=false,unlinked_at=now()
  WHERE user_id=p_user_id AND is_active;
  IF p_role='collector' THEN
    INSERT INTO public.snp_collector_accounts(user_id,collector_id,comptoir_organization_id,is_active,linked_by,reason)
    VALUES(p_user_id,p_collector_id,p_organization_id,true,auth.uid(),'Configuration administrative du collecteur');
  END IF;

  DELETE FROM public.snp_user_responsibilities WHERE user_id=p_user_id;
  INSERT INTO public.snp_user_responsibilities(user_id,responsibility_code,granted_by,reason)
  SELECT p_user_id,x.key,auth.uid(),'Configuration administrative des responsabilités'
  FROM jsonb_each_text(p_responsibilities) x WHERE x.value::boolean;
  DELETE FROM public.snp_user_capabilities uc WHERE uc.user_id=p_user_id
    AND EXISTS(SELECT 1 FROM public.snp_responsibility_catalog r WHERE r.capability_code=uc.capability_code);
  INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed,reason,granted_by)
  SELECT p_user_id,r.capability_code,true,'Responsabilité métier validée par le plafond',auth.uid()
  FROM public.snp_user_responsibilities ur JOIN public.snp_responsibility_catalog r ON r.code=ur.responsibility_code
  WHERE ur.user_id=p_user_id ON CONFLICT(user_id,capability_code) DO UPDATE SET allowed=true,reason=EXCLUDED.reason,granted_by=auth.uid(),granted_at=now();
  PERFORM public.snp_remplacer_habilitations_compte(p_user_id,p_permissions);
  PERFORM public.snp_sessions_revoquer_toutes(
    p_user_id, false, 'Révocation après modification des accès du compte'
  );
  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,new_values)
  VALUES(auth.uid(),p_user_id,'access_configuration',jsonb_build_object('role',p_role,'organization_id',p_organization_id));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_niveau_role(p_role text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public','pg_temp' AS $fn$
  SELECT CASE p_role WHEN 'owner' THEN 100 WHEN 'admin' THEN 80 WHEN 'management' THEN 60
    WHEN 'dgmg' THEN 50 WHEN 'dgi' THEN 50 WHEN 'manager' THEN 40
    WHEN 'mine' THEN 30 WHEN 'comptoir' THEN 30 WHEN 'factory' THEN 30 WHEN 'airport' THEN 30 WHEN 'refinery' THEN 30
    WHEN 'collector' THEN 20 WHEN 'customer' THEN 10 ELSE 0 END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_peut_administrer_compte(p_target_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path TO 'public','pg_temp' AS $fn$
  SELECT public.snp_actor_has_capability('accounts.manage')
    AND public.snp_mfa_satisfaite()
    AND p_target_id IS NOT NULL AND p_target_id<>auth.uid()
    AND EXISTS(
      SELECT 1 FROM public.user_profiles actor
      JOIN public.user_profiles target ON target.id=p_target_id
      WHERE actor.id=auth.uid() AND actor.is_active AND actor.role IN('owner','admin')
        AND target.role<>'owner'
        AND (actor.role='owner' OR public.snp_niveau_role(target.role)<public.snp_niveau_role(actor.role))
    );
$fn$;

-- L'ancien RPC fractionné ne doit plus être une porte d'entrée interactive.
REVOKE EXECUTE ON FUNCTION public.snp_configurer_compte_portail(uuid,text,text,text,boolean,uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_configurer_acces_compte(uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb) TO authenticated;

ALTER TABLE public.snp_access_role_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_responsibility_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_role_responsibility_ceiling ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_responsibility_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_user_responsibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_role_module_ceilings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_access_migration_review ENABLE ROW LEVEL SECURITY;
CREATE POLICY snp_access_role_policies_read ON public.snp_access_role_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY snp_responsibility_catalog_read ON public.snp_responsibility_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY snp_role_responsibility_ceiling_read ON public.snp_role_responsibility_ceiling FOR SELECT TO authenticated USING (true);
CREATE POLICY snp_responsibility_conflicts_read ON public.snp_responsibility_conflicts FOR SELECT TO authenticated USING (true);
CREATE POLICY snp_role_module_ceilings_read ON public.snp_role_module_ceilings FOR SELECT TO authenticated USING (true);
CREATE POLICY snp_access_migration_review_read ON public.snp_access_migration_review FOR SELECT TO authenticated
USING (public.snp_actor_has_capability('accounts.manage'));
CREATE POLICY snp_user_responsibilities_read ON public.snp_user_responsibilities FOR SELECT TO authenticated
USING (user_id=auth.uid() OR public.snp_actor_has_capability('accounts.manage'));

COMMIT;
