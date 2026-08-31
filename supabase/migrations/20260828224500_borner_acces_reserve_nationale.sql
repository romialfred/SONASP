-- Le registre de la réserve nationale est un périmètre institutionnel SONASP.
-- Les comptes partenaires DGMG ne peuvent pas l'ouvrir par simple héritage de rôle.
DELETE FROM public.snp_role_capabilities
WHERE role = 'dgmg'
  AND capability_code IN (
    'reserve.allocations.view',
    'reserve.allocations.validate_level_1',
    'reserve.allocations.export'
  );
