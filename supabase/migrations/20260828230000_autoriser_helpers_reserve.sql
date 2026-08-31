-- Les helpers utilisés par les RPC et les politiques RLS doivent être
-- exécutables par le rôle authentifié, sans pour autant devenir mutateurs.
BEGIN;
REVOKE ALL ON FUNCTION public.snp_reserve_permission_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snp_reserve_permission_allowed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_reserve_draft_owned_or_owner(uuid) TO authenticated;
COMMIT;
