-- ============================================================================
-- Administration des comptes : hiérarchie inviolable, écritures atomiques et
-- désignation sécurisée des approbateurs.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.snp_niveau_role(p_role text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE lower(COALESCE(p_role, ''))
    WHEN 'owner' THEN 100
    WHEN 'admin' THEN 80
    WHEN 'management' THEN 60
    WHEN 'manager' THEN 40
    WHEN 'mine' THEN 20
    WHEN 'factory' THEN 20
    WHEN 'airport' THEN 20
    WHEN 'refinery' THEN 20
    WHEN 'customer' THEN 20
    ELSE -1
  END;
$fn$;

CREATE TABLE IF NOT EXISTS public.snp_account_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN (
    'profile_update', 'role_change', 'permissions_replace',
    'approver_grant', 'approver_revoke'
  )),
  previous_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snp_account_admin_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_account_admin_audit_read ON public.snp_account_admin_audit;
CREATE POLICY snp_account_admin_audit_read
  ON public.snp_account_admin_audit FOR SELECT TO authenticated
  USING (
    public.snp_mfa_satisfaite()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.is_active AND p.role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION public.snp_peut_administrer_compte(p_target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT public.snp_mfa_satisfaite()
    AND p_target_id IS NOT NULL
    AND p_target_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles actor
      JOIN public.user_profiles target ON target.id = p_target_id
      WHERE actor.id = auth.uid()
        AND actor.is_active
        AND actor.mining_company_id IS NULL
        AND actor.role IN ('owner', 'admin', 'management')
        AND public.snp_niveau_role(target.role) <= public.snp_niveau_role(actor.role)
        AND (target.role <> 'owner' OR actor.role = 'owner')
    );
$fn$;

REVOKE ALL ON FUNCTION public.snp_peut_administrer_compte(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_peut_administrer_compte(uuid) TO authenticated;

-- Point d'entrée unique de modification d'un compte. La signature correspond
-- exactement à celle consommée par l'interface et répare le cache RPC absent.
CREATE OR REPLACE FUNCTION public.snp_configurer_compte_portail(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_role text,
  p_is_active boolean,
  p_mining_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor_role text;
  v_target_role text;
  v_target_active boolean;
  v_target_company uuid;
  v_action text;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Validez votre second facteur avant d’administrer un compte.'
      USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'Compte ou état manquant.' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas administrer votre propre compte.'
      USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(p_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Le nom complet est obligatoire.' USING ERRCODE = '22023';
  END IF;
  IF public.snp_niveau_role(p_role) < 0 THEN
    RAISE EXCEPTION 'Rôle de compte invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_actor_role
  FROM public.user_profiles
  WHERE id = auth.uid() AND is_active AND mining_company_id IS NULL;
  IF v_actor_role NOT IN ('owner', 'admin', 'management') THEN
    RAISE EXCEPTION 'Habilitation insuffisante.' USING ERRCODE = '42501';
  END IF;

  SELECT role, is_active, mining_company_id
  INTO v_target_role, v_target_active, v_target_company
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte utilisateur introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF public.snp_niveau_role(v_target_role) > public.snp_niveau_role(v_actor_role)
    OR public.snp_niveau_role(p_role) > public.snp_niveau_role(v_actor_role)
    OR (v_target_role = 'owner' AND v_actor_role <> 'owner')
    OR (p_role = 'owner' AND v_actor_role <> 'owner')
  THEN
    RAISE EXCEPTION 'Vous ne pouvez pas administrer ou attribuer un rôle supérieur au vôtre.'
      USING ERRCODE = '42501';
  END IF;

  IF p_role = 'mine' AND p_mining_company_id IS NULL THEN
    RAISE EXCEPTION 'Un compte Société minière doit être rattaché à une société.'
      USING ERRCODE = '22023';
  END IF;
  IF p_role <> 'mine' AND p_mining_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ce rôle ne peut pas recevoir un périmètre de société minière.'
      USING ERRCODE = '22023';
  END IF;
  IF p_mining_company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.mining_companies
    WHERE id = p_mining_company_id AND is_active
  ) THEN
    RAISE EXCEPTION 'La société minière sélectionnée est inactive ou introuvable.'
      USING ERRCODE = '22023';
  END IF;

  -- Sérialise les promotions/rétrogradations Owner afin que deux opérations
  -- concurrentes ne puissent jamais supprimer le dernier propriétaire actif.
  IF v_target_role = 'owner' OR p_role = 'owner' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('snp-owner-role-guard', 0));
  END IF;

  IF v_target_role = 'owner'
    AND (p_role <> 'owner' OR NOT p_is_active)
    AND (SELECT count(*) FROM public.user_profiles WHERE role = 'owner' AND is_active) <= 1
  THEN
    RAISE EXCEPTION 'Le dernier compte propriétaire actif ne peut pas être rétrogradé ou désactivé.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.user_profiles
  SET full_name = trim(p_full_name),
      phone = NULLIF(trim(COALESCE(p_phone, '')), ''),
      role = p_role,
      is_active = p_is_active,
      mining_company_id = CASE WHEN p_role = 'mine' THEN p_mining_company_id ELSE NULL END,
      updated_at = now()
  WHERE id = p_user_id;

  v_action := CASE WHEN v_target_role IS DISTINCT FROM p_role THEN 'role_change' ELSE 'profile_update' END;
  INSERT INTO public.snp_account_admin_audit (
    actor_id, target_id, action, previous_values, new_values
  ) VALUES (
    auth.uid(), p_user_id, v_action,
    jsonb_build_object('role', v_target_role, 'is_active', v_target_active, 'mining_company_id', v_target_company),
    jsonb_build_object('role', p_role, 'is_active', p_is_active, 'mining_company_id', p_mining_company_id)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_configurer_compte_portail(uuid, text, text, text, boolean, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_configurer_compte_portail(uuid, text, text, text, boolean, uuid) TO authenticated;

-- Remplacement atomique des habilitations. L'appelant ne peut ni modifier ses
-- propres droits ni ceux d'un compte placé au-dessus de lui.
CREATE OR REPLACE FUNCTION public.snp_remplacer_habilitations_compte(
  p_user_id uuid,
  p_habilitations jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier les habilitations de ce compte.'
      USING ERRCODE = '42501';
  END IF;
  IF p_habilitations IS NULL OR jsonb_typeof(p_habilitations) <> 'array' THEN
    RAISE EXCEPTION 'Le format des habilitations est invalide.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_habilitations) > 200 THEN
    RAISE EXCEPTION 'Trop d’habilitations ont été transmises.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_habilitations) AS x(module_id uuid)
    LEFT JOIN public.modules m ON m.id = x.module_id AND COALESCE(m.is_active, true)
    WHERE m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Une habilitation référence un module inconnu ou inactif.'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.user_permissions WHERE user_id = p_user_id;

  INSERT INTO public.user_permissions (
    user_id, module_id, can_view, can_create, can_edit, can_delete,
    can_approve, can_read, can_write, field_permissions, granted_by
  )
  SELECT
    p_user_id,
    x.module_id,
    COALESCE(x.can_view, false),
    COALESCE(x.can_create, false),
    COALESCE(x.can_edit, false),
    COALESCE(x.can_delete, false),
    COALESCE(x.can_approve, false),
    COALESCE(x.can_view, false),
    COALESCE(x.can_edit, false),
    COALESCE(x.field_permissions, '{}'::jsonb),
    auth.uid()
  FROM jsonb_to_recordset(p_habilitations) AS x(
    module_id uuid,
    can_view boolean,
    can_create boolean,
    can_edit boolean,
    can_delete boolean,
    can_approve boolean,
    field_permissions jsonb
  )
  WHERE COALESCE(x.can_view, false)
     OR COALESCE(x.can_create, false)
     OR COALESCE(x.can_edit, false)
     OR COALESCE(x.can_delete, false)
     OR COALESCE(x.can_approve, false)
     OR COALESCE(x.field_permissions, '{}'::jsonb) <> '{}'::jsonb;

  INSERT INTO public.snp_account_admin_audit (
    actor_id, target_id, action, new_values
  ) VALUES (
    auth.uid(), p_user_id, 'permissions_replace',
    jsonb_build_object('count', jsonb_array_length(p_habilitations))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_remplacer_habilitations_compte(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_remplacer_habilitations_compte(uuid, jsonb) TO authenticated;

-- Même hiérarchie pour les écritures directes éventuelles. Ces politiques
-- RESTRICTIVE complètent les politiques permissives existantes.
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_habilitations_hierarchie_insert ON public.user_permissions;
CREATE POLICY snp_habilitations_hierarchie_insert
  ON public.user_permissions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.snp_peut_administrer_compte(user_id));
DROP POLICY IF EXISTS snp_habilitations_hierarchie_update ON public.user_permissions;
CREATE POLICY snp_habilitations_hierarchie_update
  ON public.user_permissions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.snp_peut_administrer_compte(user_id))
  WITH CHECK (public.snp_peut_administrer_compte(user_id));
DROP POLICY IF EXISTS snp_habilitations_hierarchie_delete ON public.user_permissions;
CREATE POLICY snp_habilitations_hierarchie_delete
  ON public.user_permissions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.snp_peut_administrer_compte(user_id));

-- Désigner un approbateur est une habilitation sensible. La direction approuve
-- d'office et n'est pas modifiable depuis ce registre.
CREATE OR REPLACE FUNCTION public.snp_definir_approbateur_ventes(
  p_user_id uuid,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_target_role text;
  v_previous boolean;
BEGIN
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier l’approbateur sélectionné.'
      USING ERRCODE = '42501';
  END IF;
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'État d’approbation manquant.' USING ERRCODE = '22023';
  END IF;

  SELECT role, is_sales_approver INTO v_target_role, v_previous
  FROM public.user_profiles
  WHERE id = p_user_id AND is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Le compte est inactif ou introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_role IN ('owner', 'management') THEN
    RAISE EXCEPTION 'La direction approuve d’office ; cette habilitation est non modifiable.'
      USING ERRCODE = '42501';
  END IF;
  IF v_previous = p_active THEN RETURN; END IF;

  UPDATE public.user_profiles
  SET is_sales_approver = p_active, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.snp_account_admin_audit (
    actor_id, target_id, action, previous_values, new_values
  ) VALUES (
    auth.uid(), p_user_id,
    CASE WHEN p_active THEN 'approver_grant' ELSE 'approver_revoke' END,
    jsonb_build_object('is_sales_approver', v_previous),
    jsonb_build_object('is_sales_approver', p_active)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_definir_approbateur_ventes(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_definir_approbateur_ventes(uuid, boolean) TO authenticated;
