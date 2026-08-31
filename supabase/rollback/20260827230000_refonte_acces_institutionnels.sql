-- Rollback contrôlé de 20260827230000_refonte_acces_institutionnels.sql.
-- À exécuter uniquement après restauration du snapshot pré-migration.
-- Le garde ci-dessous refuse toute perte silencieuse de comptes cibles.
BEGIN;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE role IN ('dgmg','dgi','comptoir','collector')
  ) THEN
    RAISE EXCEPTION
      'Rollback refusé : des comptes utilisent les nouveaux rôles. Restaurez le snapshot ou remappez-les explicitement.';
  END IF;
END;
$guard$;

REVOKE EXECUTE ON FUNCTION public.snp_configurer_acces_compte(
  uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb
) FROM authenticated;
DROP FUNCTION IF EXISTS public.snp_configurer_acces_compte(
  uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb
);
DROP TRIGGER IF EXISTS snp_user_permission_ceiling ON public.user_permissions;
DROP FUNCTION IF EXISTS public.snp_guard_user_permission_ceiling();
DROP FUNCTION IF EXISTS public.snp_permission_allowed(text,uuid,text);
DROP FUNCTION IF EXISTS public.snp_user_permission_allowed(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.snp_validate_responsibilities(text,jsonb);

-- Les données de revue et les rattachements historiques sont volontairement
-- conservés : ils permettent l'audit et une reprise sans perte. Le snapshot
-- pré-migration reste l'autorité pour restaurer les versions antérieures des RPC.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (
  role IN ('owner','admin','management','manager','mine','factory','airport','refinery','customer')
);

ALTER TABLE public.snp_organizations DROP CONSTRAINT IF EXISTS snp_organizations_organization_type_check;
ALTER TABLE public.snp_organizations ADD CONSTRAINT snp_organizations_organization_type_check CHECK (
  organization_type IN ('sonasp','mine','comptoir','collector','factory','airport','refinery','customer')
);

COMMIT;
