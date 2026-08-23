-- ============================================================================
-- Sécurité : l'émission générique de notifications est un privilège serveur
-- ============================================================================
--
-- `snp_notifier` et `snp_notifier_roles` sont SECURITY DEFINER. Leur octroi au
-- rôle `authenticated` permettait à tout compte connecté d'émettre un contenu
-- arbitraire au nom de la plateforme, vers n'importe quel destinataire.
--
-- Les parcours métier disposent déjà de procédures spécialisées qui valident
-- l'objet, son statut et l'acteur (ex. `snp_notifier_requisition`). L'émission
-- générique reste donc réservée au backend/service role et à ces procédures.

REVOKE EXECUTE ON FUNCTION public.snp_notifier(
  uuid, text, text, text, text, text, uuid, text, jsonb, text, boolean
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.snp_notifier_roles(
  text[], text, text, text, text, text, uuid, text, jsonb, text, boolean
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.snp_notifier(
  uuid, text, text, text, text, text, uuid, text, jsonb, text, boolean
) TO service_role;

GRANT EXECUTE ON FUNCTION public.snp_notifier_roles(
  text[], text, text, text, text, text, uuid, text, jsonb, text, boolean
) TO service_role;

COMMENT ON FUNCTION public.snp_notifier(
  uuid, text, text, text, text, text, uuid, text, jsonb, text, boolean
) IS 'Émission générique réservée au backend. Les clients utilisent les procédures métier spécialisées.';

COMMENT ON FUNCTION public.snp_notifier_roles(
  text[], text, text, text, text, text, uuid, text, jsonb, text, boolean
) IS 'Émission générique par rôle réservée au backend.';
