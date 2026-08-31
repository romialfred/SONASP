-- =============================================================================
-- Référentiel administrable des organisations institutionnelles
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.snp_ministries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_ministries_code_format CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{1,29}$'),
  CONSTRAINT snp_ministries_name_required CHECK (length(trim(name)) >= 3)
);

INSERT INTO public.snp_ministries (id, code, name, is_active)
VALUES
  ('70000000-0000-4000-8000-000000000001', 'MEF', 'Ministère de l’Économie et des Finances', true),
  ('70000000-0000-4000-8000-000000000002', 'MEMC', 'Ministère de l’Énergie, des Mines et des Carrières', true)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name,
  is_active=true,
  updated_at=now();

ALTER TABLE public.snp_organizations
  DROP CONSTRAINT IF EXISTS snp_organizations_organization_type_check;
ALTER TABLE public.snp_organizations
  ADD CONSTRAINT snp_organizations_organization_type_check CHECK (
    organization_type IN (
      'sonasp', 'dgmg', 'dgi', 'public_institution', 'mine', 'comptoir',
      'collector', 'factory', 'airport', 'refinery', 'customer'
    )
  );

ALTER TABLE public.snp_organizations
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS organization_subtype text,
  ADD COLUMN IF NOT EXISTS supervising_ministry_id uuid,
  ADD COLUMN IF NOT EXISTS parent_organization_id uuid,
  ADD COLUMN IF NOT EXISTS legal_form text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS administrative_region text,
  ADD COLUMN IF NOT EXISTS zone_code text,
  ADD COLUMN IF NOT EXISTS service_code text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS scope_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.snp_organizations
  DROP CONSTRAINT IF EXISTS snp_organizations_supervising_ministry_id_fkey;
ALTER TABLE public.snp_organizations
  ADD CONSTRAINT snp_organizations_supervising_ministry_id_fkey
  FOREIGN KEY (supervising_ministry_id)
  REFERENCES public.snp_ministries(id) ON DELETE RESTRICT;

ALTER TABLE public.snp_organizations
  DROP CONSTRAINT IF EXISTS snp_organizations_parent_organization_id_fkey;
ALTER TABLE public.snp_organizations
  ADD CONSTRAINT snp_organizations_parent_organization_id_fkey
  FOREIGN KEY (parent_organization_id)
  REFERENCES public.snp_organizations(id) ON DELETE SET NULL;

UPDATE public.snp_organizations
SET supervising_ministry_id = CASE
  WHEN organization_type='dgi' THEN '70000000-0000-4000-8000-000000000001'::uuid
  ELSE '70000000-0000-4000-8000-000000000002'::uuid
END
WHERE supervising_ministry_id IS NULL;

ALTER TABLE public.snp_organizations
  ALTER COLUMN supervising_ministry_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_snp_organizations_type_active
  ON public.snp_organizations(organization_type, is_active);
CREATE INDEX IF NOT EXISTS idx_snp_organizations_ministry
  ON public.snp_organizations(supervising_ministry_id, is_active);
CREATE INDEX IF NOT EXISTS idx_snp_organizations_parent
  ON public.snp_organizations(parent_organization_id)
  WHERE parent_organization_id IS NOT NULL;

DROP POLICY IF EXISTS snp_organizations_scope ON public.snp_organizations;
CREATE POLICY snp_organizations_scope ON public.snp_organizations
  FOR SELECT TO authenticated USING (
    id=public.snp_current_organization_id()
    OR public.snp_actor_has_capability('collectors.manage')
    OR public.snp_actor_has_capability('accounts.manage')
    OR public.snp_actor_has_capability('referentials.manage')
  );

INSERT INTO public.snp_organizations (
  code, name, short_name, organization_type, organization_subtype,
  supervising_ministry_id, service_code, is_active, scope_metadata
)
VALUES
  (
    'SONASP', 'Société Nationale des Substances Précieuses', 'SONASP',
    'sonasp', 'societe_etat', '70000000-0000-4000-8000-000000000002',
    'SONASP', true, '{"scope":"national"}'::jsonb
  ),
  (
    'DGI', 'Direction générale des Impôts', 'DGI',
    'dgi', 'direction_generale', '70000000-0000-4000-8000-000000000001',
    'DGI', true, '{"scope":"national"}'::jsonb
  ),
  (
    'DGI-PS', 'Perception spécialisée de la Direction générale des Impôts', 'Perception spécialisée DGI',
    'dgi', 'perception_specialisee', '70000000-0000-4000-8000-000000000001',
    'DGI-PS', true, '{"scope":"specialized"}'::jsonb
  ),
  (
    'DGMG', 'Direction générale des Mines et de la Géologie', 'DGMG',
    'dgmg', 'direction_generale', '70000000-0000-4000-8000-000000000002',
    'DGMG', true, '{"scope":"national"}'::jsonb
  ),
  (
    'BUMIGEM', 'Bureau des Mines et de la Géologie', 'BUMIGEM',
    'public_institution', 'office_public', '70000000-0000-4000-8000-000000000002',
    'BUMIGEM', true, '{"scope":"national","sector":"mining"}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name,
  short_name=EXCLUDED.short_name,
  organization_type=EXCLUDED.organization_type,
  organization_subtype=EXCLUDED.organization_subtype,
  supervising_ministry_id=EXCLUDED.supervising_ministry_id,
  service_code=EXCLUDED.service_code,
  is_active=true,
  scope_metadata=EXCLUDED.scope_metadata,
  updated_at=now();

UPDATE public.snp_organizations child
SET parent_organization_id=parent.id, updated_at=now()
FROM public.snp_organizations parent
WHERE child.code='DGI-PS' AND parent.code='DGI'
  AND child.parent_organization_id IS DISTINCT FROM parent.id;

ALTER TABLE public.snp_ministries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_ministries_read ON public.snp_ministries;
CREATE POLICY snp_ministries_read ON public.snp_ministries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.id=auth.uid() AND profile.is_active
    )
  );

REVOKE ALL ON TABLE public.snp_ministries FROM public, anon;
GRANT SELECT ON TABLE public.snp_ministries TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_save_organization(
  p_id uuid,
  p_code text,
  p_name text,
  p_short_name text,
  p_organization_type text,
  p_organization_subtype text,
  p_supervising_ministry_id uuid,
  p_parent_organization_id uuid,
  p_mining_company_id uuid,
  p_source_artisan_id uuid,
  p_legal_form text,
  p_email text,
  p_phone text,
  p_address text,
  p_website text,
  p_administrative_region text,
  p_zone_code text,
  p_service_code text,
  p_notes text,
  p_is_active boolean,
  p_scope_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_id uuid := COALESCE(p_id, gen_random_uuid());
  v_code text := upper(trim(COALESCE(p_code, '')));
  v_name text := trim(COALESCE(p_name, ''));
BEGIN
  PERFORM public.snp_require_capability('referentials.manage');

  IF v_code !~ '^[A-Z0-9][A-Z0-9._-]{1,29}$' THEN
    RAISE EXCEPTION 'Le code de l’organisation est invalide.' USING ERRCODE='22023';
  END IF;
  IF length(v_name)<3 OR length(v_name)>180 THEN
    RAISE EXCEPTION 'Le nom de l’organisation doit contenir entre 3 et 180 caractères.' USING ERRCODE='22023';
  END IF;
  IF p_organization_type NOT IN (
    'sonasp','dgmg','dgi','public_institution','mine','comptoir','collector',
    'factory','airport','refinery','customer'
  ) THEN
    RAISE EXCEPTION 'Le type d’organisation est invalide.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_ministries ministry
    WHERE ministry.id=p_supervising_ministry_id AND ministry.is_active
  ) THEN
    RAISE EXCEPTION 'Le ministère de tutelle est obligatoire et doit être actif.' USING ERRCODE='23502';
  END IF;
  IF p_parent_organization_id=v_id OR (
    p_parent_organization_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.snp_organizations parent
      WHERE parent.id=p_parent_organization_id AND parent.is_active
    )
  ) THEN
    RAISE EXCEPTION 'L’organisation parente est invalide.' USING ERRCODE='23503';
  END IF;
  IF p_organization_type='mine' AND p_mining_company_id IS NULL THEN
    RAISE EXCEPTION 'La société minière liée est obligatoire.' USING ERRCODE='23502';
  END IF;
  IF p_organization_type='collector' AND p_source_artisan_id IS NULL THEN
    RAISE EXCEPTION 'Le profil collecteur lié est obligatoire.' USING ERRCODE='23502';
  END IF;
  IF NULLIF(trim(COALESCE(p_email,'')),'') IS NOT NULL
     AND trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'L’adresse e-mail est invalide.' USING ERRCODE='22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.snp_organizations (
      id, code, name, short_name, organization_type, organization_subtype,
      supervising_ministry_id, parent_organization_id, mining_company_id,
      source_artisan_id, legal_form, email, phone, address, website,
      administrative_region, zone_code, service_code, notes, is_active,
      scope_metadata, created_by, updated_at
    ) VALUES (
      v_id, v_code, v_name, nullif(trim(p_short_name),''), p_organization_type,
      nullif(trim(p_organization_subtype),''), p_supervising_ministry_id,
      p_parent_organization_id,
      CASE WHEN p_organization_type='mine' THEN p_mining_company_id ELSE NULL END,
      CASE WHEN p_organization_type='collector' THEN p_source_artisan_id ELSE NULL END,
      nullif(trim(p_legal_form),''), nullif(trim(p_email),''), nullif(trim(p_phone),''),
      nullif(trim(p_address),''), nullif(trim(p_website),''),
      nullif(trim(p_administrative_region),''), nullif(trim(p_zone_code),''),
      nullif(trim(p_service_code),''), nullif(trim(p_notes),''), coalesce(p_is_active,true),
      coalesce(p_scope_metadata,'{}'::jsonb), auth.uid(), now()
    );
  ELSE
    UPDATE public.snp_organizations SET
      code=v_code,
      name=v_name,
      short_name=nullif(trim(p_short_name),''),
      organization_type=p_organization_type,
      organization_subtype=nullif(trim(p_organization_subtype),''),
      supervising_ministry_id=p_supervising_ministry_id,
      parent_organization_id=p_parent_organization_id,
      mining_company_id=CASE WHEN p_organization_type='mine' THEN p_mining_company_id ELSE NULL END,
      source_artisan_id=CASE WHEN p_organization_type='collector' THEN p_source_artisan_id ELSE NULL END,
      legal_form=nullif(trim(p_legal_form),''),
      email=nullif(trim(p_email),''),
      phone=nullif(trim(p_phone),''),
      address=nullif(trim(p_address),''),
      website=nullif(trim(p_website),''),
      administrative_region=nullif(trim(p_administrative_region),''),
      zone_code=nullif(trim(p_zone_code),''),
      service_code=nullif(trim(p_service_code),''),
      notes=nullif(trim(p_notes),''),
      is_active=coalesce(p_is_active,true),
      scope_metadata=coalesce(p_scope_metadata,'{}'::jsonb),
      updated_at=now()
    WHERE id=p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Organisation introuvable.' USING ERRCODE='P0002';
    END IF;
  END IF;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_save_organization(
  uuid,text,text,text,text,text,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,boolean,jsonb
) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.snp_save_organization(
  uuid,text,text,text,text,text,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,boolean,jsonb
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
