-- ============================================================================
-- Comptoirs, Agents Collecteurs et stock artisanal
-- ============================================================================
-- Cette migration ajoute les périmètres manquants autour des tables artisanales
-- existantes. Elle conserve les identifiants et le champ historique collecteur_id.

CREATE TABLE IF NOT EXISTS public.snp_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  organization_type text NOT NULL CHECK (
    organization_type IN (
      'sonasp', 'mine', 'comptoir', 'collector',
      'factory', 'airport', 'refinery', 'customer'
    )
  ),
  mining_company_id uuid,
  source_artisan_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_organizations_source_shape CHECK (
    (organization_type = 'mine' AND mining_company_id IS NOT NULL)
    OR (organization_type = 'collector' AND source_artisan_id IS NOT NULL)
    OR organization_type NOT IN ('mine', 'collector')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_organizations_mining_company
  ON public.snp_organizations(mining_company_id)
  WHERE mining_company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_organizations_source_artisan
  ON public.snp_organizations(source_artisan_id)
  WHERE source_artisan_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.snp_user_organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.snp_organizations(id) ON DELETE CASCADE,
  membership_role text NOT NULL DEFAULT 'operator'
    CHECK (membership_role IN ('manager', 'operator', 'viewer')),
  is_primary boolean NOT NULL DEFAULT true,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  reason text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_membership_validity CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT snp_membership_reason CHECK (length(trim(reason)) >= 10)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_membership_current
  ON public.snp_user_organization_memberships(user_id, organization_id)
  WHERE valid_until IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_membership_primary_current
  ON public.snp_user_organization_memberships(user_id)
  WHERE valid_until IS NULL AND is_primary;

CREATE TABLE IF NOT EXISTS public.snp_collector_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  collector_id uuid NOT NULL,
  comptoir_organization_id uuid
    REFERENCES public.snp_organizations(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz,
  reason text NOT NULL,
  CONSTRAINT snp_collector_account_reason CHECK (length(trim(reason)) >= 10)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_collector_account_user_active
  ON public.snp_collector_accounts(user_id)
  WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_collector_account_artisan_active
  ON public.snp_collector_accounts(collector_id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.snp_collector_artisan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id uuid NOT NULL,
  artisan_id uuid NOT NULL,
  comptoir_organization_id uuid
    REFERENCES public.snp_organizations(id) ON DELETE RESTRICT,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_collector_assignment_distinct CHECK (collector_id <> artisan_id),
  CONSTRAINT snp_collector_assignment_validity CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT snp_collector_assignment_reason CHECK (length(trim(reason)) >= 10)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_artisan_current_collector
  ON public.snp_collector_artisan_assignments(artisan_id)
  WHERE valid_until IS NULL;
CREATE INDEX IF NOT EXISTS idx_snp_collector_assignments_collector
  ON public.snp_collector_artisan_assignments(collector_id, valid_until);
CREATE INDEX IF NOT EXISTS idx_snp_collector_assignments_comptoir
  ON public.snp_collector_artisan_assignments(comptoir_organization_id, valid_until);

DO $block$
BEGIN
  IF to_regclass('public.mining_companies') IS NOT NULL THEN
    ALTER TABLE public.snp_organizations
      DROP CONSTRAINT IF EXISTS snp_organizations_mining_company_id_fkey;
    ALTER TABLE public.snp_organizations
      ADD CONSTRAINT snp_organizations_mining_company_id_fkey
      FOREIGN KEY (mining_company_id)
      REFERENCES public.mining_companies(id) ON DELETE RESTRICT;
  END IF;
  IF to_regclass('public.snp_artisans_miniers') IS NOT NULL THEN
    ALTER TABLE public.snp_organizations
      DROP CONSTRAINT IF EXISTS snp_organizations_source_artisan_id_fkey;
    ALTER TABLE public.snp_organizations
      ADD CONSTRAINT snp_organizations_source_artisan_id_fkey
      FOREIGN KEY (source_artisan_id)
      REFERENCES public.snp_artisans_miniers(id) ON DELETE RESTRICT;

    ALTER TABLE public.snp_collector_accounts
      DROP CONSTRAINT IF EXISTS snp_collector_accounts_collector_id_fkey;
    ALTER TABLE public.snp_collector_accounts
      ADD CONSTRAINT snp_collector_accounts_collector_id_fkey
      FOREIGN KEY (collector_id)
      REFERENCES public.snp_artisans_miniers(id) ON DELETE RESTRICT;

    ALTER TABLE public.snp_collector_artisan_assignments
      DROP CONSTRAINT IF EXISTS snp_collector_assignments_collector_id_fkey;
    ALTER TABLE public.snp_collector_artisan_assignments
      ADD CONSTRAINT snp_collector_assignments_collector_id_fkey
      FOREIGN KEY (collector_id)
      REFERENCES public.snp_artisans_miniers(id) ON DELETE RESTRICT;

    ALTER TABLE public.snp_collector_artisan_assignments
      DROP CONSTRAINT IF EXISTS snp_collector_assignments_artisan_id_fkey;
    ALTER TABLE public.snp_collector_artisan_assignments
      ADD CONSTRAINT snp_collector_assignments_artisan_id_fkey
      FOREIGN KEY (artisan_id)
      REFERENCES public.snp_artisans_miniers(id) ON DELETE RESTRICT;
  END IF;
END;
$block$;

-- Les mines existantes deviennent des organisations sans changer leur UUID.
DO $block$
BEGIN
  IF to_regclass('public.mining_companies') IS NOT NULL THEN
    INSERT INTO public.snp_organizations (
      id, code, name, organization_type, mining_company_id, is_active
    )
    SELECT mc.id, mc.code, mc.name, 'mine', mc.id, mc.is_active
    FROM public.mining_companies mc
    ON CONFLICT (id) DO UPDATE
    SET code = EXCLUDED.code,
        name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        mining_company_id = EXCLUDED.mining_company_id;

    INSERT INTO public.snp_user_organization_memberships (
      user_id, organization_id, membership_role, is_primary, reason
    )
    SELECT p.id, p.mining_company_id, 'operator', true,
           'Reprise automatique du rattachement historique à la mine'
    FROM public.user_profiles p
    WHERE p.mining_company_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END;
$block$;

-- Historise les rattachements collecteur_id existants sans réécrire les lignes.
DO $block$
BEGIN
  IF to_regclass('public.snp_artisans_miniers') IS NOT NULL THEN
    INSERT INTO public.snp_collector_artisan_assignments (
      collector_id, artisan_id, valid_from, assigned_by, reason
    )
    SELECT a.collecteur_id, a.id, COALESCE(a.created_at, now()), a.created_by,
           'Reprise du rattachement collecteur historique'
    FROM public.snp_artisans_miniers a
    WHERE a.collecteur_id IS NOT NULL AND a.collecteur_id <> a.id
    ON CONFLICT DO NOTHING;
  END IF;
END;
$block$;

CREATE OR REPLACE FUNCTION public.snp_current_organization_id()
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT COALESCE(
    (
      SELECT m.organization_id
      FROM public.snp_user_organization_memberships m
      JOIN public.snp_organizations o ON o.id = m.organization_id AND o.is_active
      WHERE m.user_id = auth.uid()
        AND m.valid_from <= clock_timestamp()
        AND (m.valid_until IS NULL OR m.valid_until > clock_timestamp())
      ORDER BY m.is_primary DESC, m.valid_from DESC
      LIMIT 1
    ),
    (
      SELECT ca.comptoir_organization_id
      FROM public.snp_collector_accounts ca
      JOIN public.snp_organizations o
        ON o.id = ca.comptoir_organization_id AND o.is_active
      WHERE ca.user_id = auth.uid() AND ca.is_active
      ORDER BY ca.linked_at DESC
      LIMIT 1
    )
  );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_current_organization_type()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT o.organization_type
  FROM public.snp_organizations o
  WHERE o.id = public.snp_current_organization_id();
$fn$;

CREATE OR REPLACE FUNCTION public.snp_current_collector_id()
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT ca.collector_id
  FROM public.snp_collector_accounts ca
  WHERE ca.user_id = auth.uid() AND ca.is_active
  ORDER BY ca.linked_at DESC
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_can_access_artisan(p_artisan_id uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_actor_has_capability('collectors.manage')
      OR (
        public.snp_actor_has_capability('collector.operate')
        AND (
          p_artisan_id = public.snp_current_collector_id()
          OR EXISTS (
            SELECT 1
            FROM public.snp_collector_artisan_assignments a
            WHERE a.artisan_id = p_artisan_id
              AND a.collector_id = public.snp_current_collector_id()
              AND a.valid_from <= clock_timestamp()
              AND (a.valid_until IS NULL OR a.valid_until > clock_timestamp())
          )
        )
      )
      OR (
        public.snp_actor_has_capability('comptoir.manage')
        AND public.snp_current_organization_type() = 'comptoir'
        AND EXISTS (
          SELECT 1
          FROM public.snp_collector_artisan_assignments a
          WHERE a.artisan_id = p_artisan_id
            AND a.comptoir_organization_id = public.snp_current_organization_id()
            AND a.valid_from <= clock_timestamp()
            AND (a.valid_until IS NULL OR a.valid_until > clock_timestamp())
        )
      );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_create_comptoir_organization(
  p_code text,
  p_name text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_id uuid;
BEGIN
  PERFORM public.snp_require_capability('collectors.manage');
  IF length(trim(COALESCE(p_code, ''))) < 2 OR length(trim(COALESCE(p_name, ''))) < 3 THEN
    RAISE EXCEPTION 'Le code et le nom du comptoir sont obligatoires.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'La création du comptoir doit être justifiée.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.snp_organizations (
    code, name, organization_type, created_by
  ) VALUES (upper(trim(p_code)), trim(p_name), 'comptoir', auth.uid())
  RETURNING id INTO v_id;

  PERFORM public.snp_record_workflow_event(
    'organization', v_id, 'comptoir-created', NULL, 'active',
    'collectors.manage', p_reason,
    jsonb_build_object('code', upper(trim(p_code)), 'name', trim(p_name))
  );
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_assign_user_organization(
  p_user_id uuid,
  p_organization_id uuid,
  p_membership_role text,
  p_reason text,
  p_is_primary boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_id uuid;
BEGIN
  PERFORM public.snp_require_capability('accounts.manage');
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier votre propre périmètre.' USING ERRCODE = '42501';
  END IF;
  IF p_membership_role NOT IN ('manager', 'operator', 'viewer') THEN
    RAISE EXCEPTION 'Rôle d’adhésion inconnu.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Le rattachement doit être justifié.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_organizations
    WHERE id = p_organization_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Organisation introuvable ou inactive.' USING ERRCODE = 'P0002';
  END IF;

  IF p_is_primary THEN
    UPDATE public.snp_user_organization_memberships
    SET valid_until = GREATEST(
      clock_timestamp(),
      valid_from + interval '1 microsecond'
    )
    WHERE user_id = p_user_id AND valid_until IS NULL AND is_primary;
  END IF;

  INSERT INTO public.snp_user_organization_memberships (
    user_id, organization_id, membership_role, is_primary,
    reason, granted_by
  ) VALUES (
    p_user_id, p_organization_id, p_membership_role, p_is_primary,
    trim(p_reason), auth.uid()
  ) RETURNING id INTO v_id;

  PERFORM public.snp_record_workflow_event(
    'organization-membership', v_id, 'membership-created', NULL, 'active',
    'accounts.manage', p_reason,
    jsonb_build_object('user_id', p_user_id, 'organization_id', p_organization_id)
  );
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_link_collector_account(
  p_user_id uuid,
  p_collector_id uuid,
  p_comptoir_organization_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_id uuid;
BEGIN
  PERFORM public.snp_require_capability('collectors.manage');
  IF length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Le rattachement du collecteur doit être justifié.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_artisans_miniers
    WHERE id = p_collector_id AND actif AND type_artisan = 'collecteur'
  ) THEN
    RAISE EXCEPTION 'Le profil collecteur est introuvable ou inactif.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_organizations
    WHERE id = p_comptoir_organization_id
      AND organization_type = 'comptoir' AND is_active
  ) THEN
    RAISE EXCEPTION 'Le comptoir est introuvable ou inactif.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.snp_collector_accounts
  SET is_active = false, unlinked_at = now()
  WHERE (user_id = p_user_id OR collector_id = p_collector_id) AND is_active;

  INSERT INTO public.snp_collector_accounts (
    user_id, collector_id, comptoir_organization_id, linked_by, reason
  ) VALUES (
    p_user_id, p_collector_id, p_comptoir_organization_id, auth.uid(), trim(p_reason)
  ) RETURNING id INTO v_id;

  INSERT INTO public.snp_user_capabilities (
    user_id, capability_code, allowed, reason, granted_by
  ) VALUES (
    p_user_id, 'collector.operate', true, trim(p_reason), auth.uid()
  )
  ON CONFLICT (user_id, capability_code) DO UPDATE
  SET allowed = true, valid_from = now(), valid_until = NULL,
      reason = EXCLUDED.reason, granted_by = EXCLUDED.granted_by, granted_at = now();

  PERFORM public.snp_record_workflow_event(
    'collector-account', v_id, 'collector-linked', NULL, 'active',
    'collectors.manage', p_reason,
    jsonb_build_object(
      'user_id', p_user_id,
      'collector_id', p_collector_id,
      'comptoir_organization_id', p_comptoir_organization_id
    )
  );
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_assign_artisan_to_collector(
  p_artisan_id uuid,
  p_collector_id uuid,
  p_comptoir_organization_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_id uuid;
BEGIN
  PERFORM public.snp_require_capability('collectors.manage');
  IF p_artisan_id = p_collector_id THEN
    RAISE EXCEPTION 'Un collecteur ne peut pas être son propre orpailleur.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Le rattachement doit être justifié.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_artisans_miniers
    WHERE id = p_collector_id AND actif AND type_artisan = 'collecteur'
  ) THEN
    RAISE EXCEPTION 'Collecteur introuvable ou inactif.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_artisans_miniers
    WHERE id = p_artisan_id AND actif AND type_artisan <> 'collecteur'
  ) THEN
    RAISE EXCEPTION 'Orpailleur introuvable, inactif ou de type incorrect.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_organizations
    WHERE id = p_comptoir_organization_id
      AND organization_type = 'comptoir' AND is_active
  ) THEN
    RAISE EXCEPTION 'Comptoir introuvable ou inactif.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.snp_collector_artisan_assignments
  SET valid_until = GREATEST(
    clock_timestamp(),
    valid_from + interval '1 microsecond'
  )
  WHERE artisan_id = p_artisan_id AND valid_until IS NULL;

  INSERT INTO public.snp_collector_artisan_assignments (
    collector_id, artisan_id, comptoir_organization_id, assigned_by, reason
  ) VALUES (
    p_collector_id, p_artisan_id, p_comptoir_organization_id,
    auth.uid(), trim(p_reason)
  ) RETURNING id INTO v_id;

  UPDATE public.snp_artisans_miniers
  SET collecteur_id = p_collector_id,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_artisan_id;

  PERFORM public.snp_record_workflow_event(
    'collector-assignment', v_id, 'artisan-assigned', NULL, 'active',
    'collectors.manage', p_reason,
    jsonb_build_object(
      'artisan_id', p_artisan_id,
      'collector_id', p_collector_id,
      'comptoir_organization_id', p_comptoir_organization_id
    )
  );
  RETURN v_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Ledger de stock append-only et idempotent
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snp_artisanal_stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES public.snp_organizations(id) ON DELETE RESTRICT,
  artisan_id uuid,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  quantity_grams numeric(18, 3) NOT NULL CHECK (quantity_grams > 0),
  movement_type text NOT NULL CHECK (
    movement_type IN (
      'purchase', 'sale', 'transfer', 'tax', 'adjustment', 'reversal'
    )
  ),
  business_reference text NOT NULL,
  idempotency_key text NOT NULL,
  source_type text,
  source_id uuid,
  reverses_entry_id uuid REFERENCES public.snp_artisanal_stock_ledger(id) ON DELETE RESTRICT,
  reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_reference),
  UNIQUE (organization_id, idempotency_key),
  CONSTRAINT snp_stock_reversal_reason CHECK (
    movement_type <> 'reversal' OR length(trim(COALESCE(reason, ''))) >= 10
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_artisanal_stock_ledger_org_date
  ON public.snp_artisanal_stock_ledger(organization_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_artisanal_stock_single_reversal
  ON public.snp_artisanal_stock_ledger(reverses_entry_id)
  WHERE reverses_entry_id IS NOT NULL;

DO $block$
BEGIN
  IF to_regclass('public.snp_artisans_miniers') IS NOT NULL THEN
    ALTER TABLE public.snp_artisanal_stock_ledger
      DROP CONSTRAINT IF EXISTS snp_artisanal_stock_ledger_artisan_id_fkey;
    ALTER TABLE public.snp_artisanal_stock_ledger
      ADD CONSTRAINT snp_artisanal_stock_ledger_artisan_id_fkey
      FOREIGN KEY (artisan_id)
      REFERENCES public.snp_artisans_miniers(id) ON DELETE RESTRICT;
  END IF;
END;
$block$;

CREATE OR REPLACE FUNCTION public.snp_comptoir_stock_balance(p_organization_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_balance numeric;
BEGIN
  IF p_organization_id IS DISTINCT FROM public.snp_current_organization_id()
     AND NOT public.snp_actor_has_capability('collectors.manage') THEN
    RAISE EXCEPTION 'Le solde appartient à un autre comptoir.' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(sum(
    CASE WHEN direction = 'in' THEN quantity_grams ELSE -quantity_grams END
  ), 0) INTO v_balance
  FROM public.snp_artisanal_stock_ledger
  WHERE organization_id = p_organization_id;
  RETURN v_balance;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_record_comptoir_stock_movement(
  p_organization_id uuid,
  p_artisan_id uuid,
  p_direction text,
  p_quantity_grams numeric,
  p_movement_type text,
  p_business_reference text,
  p_idempotency_key text,
  p_source_type text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL,
  p_reverses_entry_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_existing public.snp_artisanal_stock_ledger%ROWTYPE;
  v_id uuid;
  v_balance numeric;
  v_reverse public.snp_artisanal_stock_ledger%ROWTYPE;
BEGIN
  PERFORM public.snp_require_capability('comptoir.manage');
  IF public.snp_current_organization_type() = 'comptoir'
     AND p_organization_id <> public.snp_current_organization_id() THEN
    RAISE EXCEPTION 'Le mouvement appartient à un autre comptoir.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_organizations
    WHERE id = p_organization_id AND organization_type = 'comptoir' AND is_active
  ) THEN
    RAISE EXCEPTION 'Comptoir introuvable ou inactif.' USING ERRCODE = 'P0002';
  END IF;
  IF p_direction NOT IN ('in', 'out') OR p_quantity_grams IS NULL OR p_quantity_grams <= 0 THEN
    RAISE EXCEPTION 'La direction et une quantité strictement positive sont obligatoires.'
      USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_business_reference, ''))) < 3
     OR length(trim(COALESCE(p_idempotency_key, ''))) < 8 THEN
    RAISE EXCEPTION 'La référence métier et la clé d’idempotence sont obligatoires.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));

  SELECT * INTO v_existing
  FROM public.snp_artisanal_stock_ledger
  WHERE organization_id = p_organization_id
    AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.artisan_id IS NOT DISTINCT FROM p_artisan_id
       AND v_existing.direction = p_direction
       AND v_existing.quantity_grams = p_quantity_grams
       AND v_existing.movement_type = p_movement_type
       AND v_existing.business_reference = trim(p_business_reference)
       AND v_existing.source_type IS NOT DISTINCT FROM p_source_type
       AND v_existing.source_id IS NOT DISTINCT FROM p_source_id
       AND v_existing.reverses_entry_id IS NOT DISTINCT FROM p_reverses_entry_id THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'La clé d’idempotence est déjà liée à un autre mouvement.'
      USING ERRCODE = '23505';
  END IF;

  IF p_movement_type = 'reversal' THEN
    IF p_reverses_entry_id IS NULL OR length(trim(COALESCE(p_reason, ''))) < 10 THEN
      RAISE EXCEPTION 'Une écriture compensatoire doit référencer et justifier l’écriture annulée.'
        USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_reverse
    FROM public.snp_artisanal_stock_ledger
    WHERE id = p_reverses_entry_id AND organization_id = p_organization_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Écriture d’origine introuvable.' USING ERRCODE = 'P0002';
    END IF;
    IF p_direction = v_reverse.direction OR p_quantity_grams <> v_reverse.quantity_grams THEN
      RAISE EXCEPTION 'La compensation doit inverser exactement la quantité d’origine.'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.snp_artisanal_stock_ledger
      WHERE reverses_entry_id = p_reverses_entry_id
    ) THEN
      RAISE EXCEPTION 'Cette écriture a déjà été compensée.' USING ERRCODE = '23505';
    END IF;
  ELSIF p_reverses_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Seul un mouvement de compensation référence une écriture antérieure.'
      USING ERRCODE = '22023';
  END IF;

  v_balance := public.snp_comptoir_stock_balance(p_organization_id);
  IF p_direction = 'out' AND p_quantity_grams > v_balance THEN
    RAISE EXCEPTION 'Stock insuffisant : % g disponibles pour % g demandés.',
      v_balance, p_quantity_grams USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.snp_artisanal_stock_ledger (
    organization_id, artisan_id, direction, quantity_grams, movement_type,
    business_reference, idempotency_key, source_type, source_id,
    reverses_entry_id, reason, created_by
  ) VALUES (
    p_organization_id, p_artisan_id, p_direction, p_quantity_grams,
    p_movement_type, trim(p_business_reference), trim(p_idempotency_key),
    p_source_type, p_source_id, p_reverses_entry_id, p_reason, auth.uid()
  ) RETURNING id INTO v_id;

  PERFORM public.snp_record_workflow_event(
    'artisanal-stock', v_id, 'movement-recorded', NULL, p_direction,
    'comptoir.manage', p_reason,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'quantity_grams', p_quantity_grams,
      'movement_type', p_movement_type,
      'business_reference', p_business_reference
    )
  );
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_block_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF COALESCE(auth.role(), '') = 'authenticated' THEN
    RAISE EXCEPTION 'Le ledger est append-only ; utilisez une écriture compensatoire.'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_artisanal_stock_ledger_append_only
  ON public.snp_artisanal_stock_ledger;
CREATE TRIGGER snp_artisanal_stock_ledger_append_only
BEFORE UPDATE OR DELETE ON public.snp_artisanal_stock_ledger
FOR EACH ROW EXECUTE FUNCTION public.snp_block_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Certification DGI et preuve de paiement
-- ---------------------------------------------------------------------------
ALTER TABLE public.snp_artisan_factures_definitives
  ADD COLUMN IF NOT EXISTS certification_dgi_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS dgi_reference text,
  ADD COLUMN IF NOT EXISTS dgi_document_path text,
  ADD COLUMN IF NOT EXISTS dgi_certified_at timestamptz,
  ADD COLUMN IF NOT EXISTS dgi_certified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comptoir_organization_id uuid REFERENCES public.snp_organizations(id) ON DELETE RESTRICT;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'snp_artisan_factures_dgi_status_check'
      AND conrelid = 'public.snp_artisan_factures_definitives'::regclass
  ) THEN
    ALTER TABLE public.snp_artisan_factures_definitives
      ADD CONSTRAINT snp_artisan_factures_dgi_status_check
      CHECK (certification_dgi_status IN ('pending', 'certified', 'rejected', 'cancelled'));
  END IF;
END;
$block$;

ALTER TABLE public.snp_artisan_ventes_or
  ADD COLUMN IF NOT EXISTS comptoir_organization_id uuid REFERENCES public.snp_organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.snp_artisan_paiements
  ADD COLUMN IF NOT EXISTS comptoir_organization_id uuid REFERENCES public.snp_organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.snp_artisan_taxes_retenues
  ADD COLUMN IF NOT EXISTS comptoir_organization_id uuid REFERENCES public.snp_organizations(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.snp_force_comptoir_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF public.snp_current_organization_type() = 'comptoir' THEN
    NEW.comptoir_organization_id := public.snp_current_organization_id();
  ELSIF TG_OP = 'UPDATE'
        AND NOT public.snp_actor_has_capability('collectors.manage')
        AND NEW.comptoir_organization_id IS DISTINCT FROM OLD.comptoir_organization_id THEN
    RAISE EXCEPTION 'Le périmètre comptoir ne peut pas être remplacé.' USING ERRCODE = '42501';
  ELSIF TG_OP = 'INSERT'
        AND NEW.comptoir_organization_id IS NOT NULL
        AND NOT public.snp_actor_has_capability('collectors.manage') THEN
    RAISE EXCEPTION 'Le périmètre comptoir vient exclusivement du compte connecté.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DO $block$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'snp_artisan_ventes_or',
    'snp_artisan_factures_definitives',
    'snp_artisan_paiements',
    'snp_artisan_taxes_retenues'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS snp_force_comptoir_scope ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER snp_force_comptoir_scope BEFORE INSERT OR UPDATE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.snp_force_comptoir_scope()',
      v_table
    );
  END LOOP;
END;
$block$;

CREATE OR REPLACE FUNCTION public.snp_certify_artisan_invoice(
  p_facture_id uuid,
  p_dgi_reference text,
  p_document_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE v_facture public.snp_artisan_factures_definitives%ROWTYPE;
BEGIN
  PERFORM public.snp_require_capability('comptoir.manage');
  SELECT * INTO v_facture
  FROM public.snp_artisan_factures_definitives
  WHERE id = p_facture_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture artisanale introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.snp_can_access_artisan(v_facture.artisan_id) THEN
    RAISE EXCEPTION 'Cette facture appartient à un autre périmètre.' USING ERRCODE = '42501';
  END IF;
  IF v_facture.certification_dgi_status = 'certified' THEN
    RAISE EXCEPTION 'La facture DGI est déjà certifiée et immuable.' USING ERRCODE = '23505';
  END IF;
  IF length(trim(COALESCE(p_dgi_reference, ''))) < 5
     OR length(trim(COALESCE(p_document_path, ''))) < 5 THEN
    RAISE EXCEPTION 'La référence et le document DGI sont obligatoires.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('sonasp.certification_dgi_rpc', '1', true);
  BEGIN
    UPDATE public.snp_artisan_factures_definitives
    SET certification_dgi_status = 'certified',
        dgi_reference = trim(p_dgi_reference),
        dgi_document_path = trim(p_document_path),
        dgi_certified_at = now(),
        dgi_certified_by = auth.uid(),
        updated_at = now()
    WHERE id = p_facture_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.certification_dgi_rpc', '0', true);
    RAISE;
  END;
  -- Le marqueur est limité à l'instruction interne. Il ne doit jamais rester
  -- réutilisable par l'appelant dans la transaction courante.
  PERFORM set_config('sonasp.certification_dgi_rpc', '0', true);

  PERFORM public.snp_record_workflow_event(
    'artisan-invoice', p_facture_id, 'dgi-certified',
    v_facture.certification_dgi_status, 'certified',
    'comptoir.manage', NULL,
    jsonb_build_object('dgi_reference', trim(p_dgi_reference))
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_guard_artisan_invoice_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.certification_dgi_status = 'certified'
     AND OLD.certification_dgi_status IS DISTINCT FROM 'certified'
     AND current_setting('sonasp.certification_dgi_rpc', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Utilisez la procédure sécurisée de certification DGI.'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.certification_dgi_status = 'certified' AND (
    NEW.certification_dgi_status IS DISTINCT FROM OLD.certification_dgi_status
    OR NEW.dgi_reference IS DISTINCT FROM OLD.dgi_reference
    OR NEW.dgi_document_path IS DISTINCT FROM OLD.dgi_document_path
    OR NEW.montant_net_a_payer IS DISTINCT FROM OLD.montant_net_a_payer
    OR NEW.montant_total_taxes IS DISTINCT FROM OLD.montant_total_taxes
    OR NEW.vente_or_id IS DISTINCT FROM OLD.vente_or_id
    OR NEW.artisan_id IS DISTINCT FROM OLD.artisan_id
  ) THEN
    RAISE EXCEPTION 'Une facture certifiée DGI est immuable.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_artisan_invoice_immutable
  ON public.snp_artisan_factures_definitives;
CREATE TRIGGER snp_artisan_invoice_immutable
BEFORE UPDATE ON public.snp_artisan_factures_definitives
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_artisan_invoice_immutability();

CREATE OR REPLACE FUNCTION public.snp_guard_artisan_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_certification text;
  v_facture public.snp_artisan_factures_definitives%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.snp_require_capability('comptoir.manage');
    IF NOT public.snp_can_access_artisan(NEW.artisan_id) THEN
      RAISE EXCEPTION 'Ce paiement appartient à un autre périmètre.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_facture
    FROM public.snp_artisan_factures_definitives
    WHERE id = NEW.facture_id;
    IF NOT FOUND
       OR v_facture.artisan_id IS DISTINCT FROM NEW.artisan_id
       OR v_facture.vente_or_id IS DISTINCT FROM NEW.vente_or_id
       OR (
         v_facture.comptoir_organization_id IS DISTINCT FROM public.snp_current_organization_id()
         AND COALESCE(auth.role(), '') <> 'service_role'
         AND NOT public.snp_actor_has_capability('collectors.manage')
       ) THEN
      RAISE EXCEPTION 'Le paiement, la vente et la facture ne partagent pas le même périmètre.'
        USING ERRCODE = '23503';
    END IF;

    -- Le verrou par facture ferme la fenêtre de concurrence entre deux INSERT.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.facture_id::text, 0));
    IF EXISTS (
      SELECT 1
      FROM public.snp_artisan_paiements p
      WHERE p.facture_id = NEW.facture_id
        AND p.statut NOT IN ('annule', 'echec')
    ) THEN
      RAISE EXCEPTION 'Un paiement actif existe déjà pour cette facture.'
        USING ERRCODE = '23505';
    END IF;
    NEW.traite_par := COALESCE(NEW.traite_par, auth.uid());
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.artisan_id IS DISTINCT FROM OLD.artisan_id
    OR NEW.facture_id IS DISTINCT FROM OLD.facture_id
    OR NEW.vente_or_id IS DISTINCT FROM OLD.vente_or_id
    OR NEW.comptoir_organization_id IS DISTINCT FROM OLD.comptoir_organization_id
  ) THEN
    RAISE EXCEPTION 'Les rattachements d’un paiement enregistré sont immuables.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.statut IS DISTINCT FROM OLD.statut THEN
    PERFORM public.snp_require_capability('comptoir.manage');
    IF NOT (
      (OLD.statut = 'en_attente' AND NEW.statut IN ('en_traitement', 'annule', 'echec'))
      OR (OLD.statut = 'en_traitement' AND NEW.statut IN ('valide', 'annule', 'echec'))
      OR (OLD.statut = 'valide' AND NEW.statut IN ('complete', 'annule', 'echec'))
    ) THEN
      RAISE EXCEPTION 'Transition de paiement artisan interdite : % vers %.', OLD.statut, NEW.statut
        USING ERRCODE = '22023';
    END IF;
    IF NEW.statut = 'valide' THEN
      IF OLD.traite_par = auth.uid() THEN
        RAISE EXCEPTION 'Le préparateur ne valide pas son propre paiement.' USING ERRCODE = '42501';
      END IF;
      NEW.valide_par := auth.uid();
      NEW.date_validation := now();
    END IF;
    IF NEW.statut = 'complete' THEN
      SELECT certification_dgi_status INTO v_certification
      FROM public.snp_artisan_factures_definitives
      WHERE id = NEW.facture_id;
      IF v_certification IS DISTINCT FROM 'certified' THEN
        RAISE EXCEPTION 'La facture doit être certifiée DGI avant paiement.' USING ERRCODE = '23514';
      END IF;
      IF length(trim(COALESCE(NEW.preuve_paiement_url, ''))) < 5 THEN
        RAISE EXCEPTION 'Une preuve de paiement est obligatoire.' USING ERRCODE = '23514';
      END IF;
      NEW.date_completion := now();
    END IF;
    PERFORM public.snp_record_workflow_event(
      'artisan-payment', NEW.id, 'status-changed', OLD.statut, NEW.statut,
      'comptoir.manage', NEW.notes,
      jsonb_build_object(
        'artisan_id', NEW.artisan_id,
        'facture_id', NEW.facture_id,
        'comptoir_organization_id', NEW.comptoir_organization_id
      )
    );
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS snp_artisan_payment_guard ON public.snp_artisan_paiements;
CREATE TRIGGER snp_artisan_payment_guard
BEFORE INSERT OR UPDATE ON public.snp_artisan_paiements
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_artisan_payment();

-- ---------------------------------------------------------------------------
-- RLS restrictive : deux collecteurs/comptoirs ne se voient jamais.
-- ---------------------------------------------------------------------------
ALTER TABLE public.snp_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_user_organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_collector_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_collector_artisan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_artisanal_stock_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_organizations_scope ON public.snp_organizations;
CREATE POLICY snp_organizations_scope ON public.snp_organizations
  FOR SELECT TO authenticated USING (
    id = public.snp_current_organization_id()
    OR public.snp_actor_has_capability('collectors.manage')
    OR public.snp_actor_has_capability('accounts.manage')
  );

DROP POLICY IF EXISTS snp_memberships_scope ON public.snp_user_organization_memberships;
CREATE POLICY snp_memberships_scope ON public.snp_user_organization_memberships
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.snp_actor_has_capability('collectors.manage')
    OR public.snp_actor_has_capability('accounts.manage')
  );

DROP POLICY IF EXISTS snp_collector_accounts_scope ON public.snp_collector_accounts;
CREATE POLICY snp_collector_accounts_scope ON public.snp_collector_accounts
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.snp_actor_has_capability('collectors.manage')
  );

DROP POLICY IF EXISTS snp_collector_assignments_scope ON public.snp_collector_artisan_assignments;
CREATE POLICY snp_collector_assignments_scope ON public.snp_collector_artisan_assignments
  FOR SELECT TO authenticated USING (
    collector_id = public.snp_current_collector_id()
    OR comptoir_organization_id = public.snp_current_organization_id()
    OR public.snp_actor_has_capability('collectors.manage')
  );

DROP POLICY IF EXISTS snp_artisanal_stock_scope ON public.snp_artisanal_stock_ledger;
CREATE POLICY snp_artisanal_stock_scope ON public.snp_artisanal_stock_ledger
  FOR SELECT TO authenticated USING (
    organization_id = public.snp_current_organization_id()
    OR public.snp_actor_has_capability('collectors.manage')
  );

ALTER TABLE public.snp_artisans_miniers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_artisans_perimeter_restrictive ON public.snp_artisans_miniers;
CREATE POLICY snp_artisans_perimeter_restrictive
  ON public.snp_artisans_miniers AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (public.snp_can_access_artisan(id));
DROP POLICY IF EXISTS snp_artisans_update_perimeter_restrictive ON public.snp_artisans_miniers;
CREATE POLICY snp_artisans_update_perimeter_restrictive
  ON public.snp_artisans_miniers AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.snp_can_access_artisan(id))
  WITH CHECK (public.snp_can_access_artisan(id));
DROP POLICY IF EXISTS snp_artisans_insert_internal_restrictive ON public.snp_artisans_miniers;
CREATE POLICY snp_artisans_insert_internal_restrictive
  ON public.snp_artisans_miniers AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.snp_actor_has_capability('collectors.manage'));
DROP POLICY IF EXISTS snp_artisans_delete_internal_restrictive ON public.snp_artisans_miniers;
CREATE POLICY snp_artisans_delete_internal_restrictive
  ON public.snp_artisans_miniers AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.snp_actor_has_capability('collectors.manage'));

DO $block$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'snp_artisan_activities',
    'snp_artisan_documents',
    'snp_artisan_factures_definitives',
    'snp_artisan_moyens_paiement',
    'snp_artisan_paiements',
    'snp_artisan_taxes_retenues',
    'snp_artisan_transactions',
    'snp_artisan_ventes_or'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS snp_artisan_child_perimeter_restrictive ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY snp_artisan_child_perimeter_restrictive ON public.%I AS RESTRICTIVE ' ||
      'FOR ALL TO authenticated USING (public.snp_can_access_artisan(artisan_id)) ' ||
      'WITH CHECK (public.snp_can_access_artisan(artisan_id))',
      v_table
    );
  END LOOP;
END;
$block$;

REVOKE ALL ON TABLE public.snp_organizations FROM public, anon;
REVOKE ALL ON TABLE public.snp_user_organization_memberships FROM public, anon;
REVOKE ALL ON TABLE public.snp_collector_accounts FROM public, anon;
REVOKE ALL ON TABLE public.snp_collector_artisan_assignments FROM public, anon;
REVOKE ALL ON TABLE public.snp_artisanal_stock_ledger FROM public, anon;
GRANT SELECT ON public.snp_organizations TO authenticated;
GRANT SELECT ON public.snp_user_organization_memberships TO authenticated;
GRANT SELECT ON public.snp_collector_accounts TO authenticated;
GRANT SELECT ON public.snp_collector_artisan_assignments TO authenticated;
GRANT SELECT ON public.snp_artisanal_stock_ledger TO authenticated;

REVOKE ALL ON FUNCTION public.snp_current_organization_id() FROM public;
REVOKE ALL ON FUNCTION public.snp_current_organization_type() FROM public;
REVOKE ALL ON FUNCTION public.snp_current_collector_id() FROM public;
REVOKE ALL ON FUNCTION public.snp_can_access_artisan(uuid) FROM public;
REVOKE ALL ON FUNCTION public.snp_create_comptoir_organization(text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_assign_user_organization(uuid, uuid, text, text, boolean) FROM public;
REVOKE ALL ON FUNCTION public.snp_link_collector_account(uuid, uuid, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_assign_artisan_to_collector(uuid, uuid, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_comptoir_stock_balance(uuid) FROM public;
REVOKE ALL ON FUNCTION public.snp_record_comptoir_stock_movement(uuid, uuid, text, numeric, text, text, text, text, uuid, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_certify_artisan_invoice(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_current_organization_type() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_current_collector_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_can_access_artisan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_create_comptoir_organization(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_assign_user_organization(uuid, uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_link_collector_account(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_assign_artisan_to_collector(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_comptoir_stock_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_record_comptoir_stock_movement(uuid, uuid, text, numeric, text, text, text, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_certify_artisan_invoice(uuid, text, text) TO authenticated;

COMMENT ON TABLE public.snp_collector_artisan_assignments IS
  'Historique autoritatif des rattachements d’orpailleurs aux collecteurs et comptoirs.';
COMMENT ON TABLE public.snp_artisanal_stock_ledger IS
  'Ledger append-only, idempotent et compensatoire du stock des comptoirs.';
