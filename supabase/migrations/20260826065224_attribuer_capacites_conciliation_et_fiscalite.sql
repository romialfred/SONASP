-- Les capacites de conciliation et du referentiel fiscal existaient au catalogue
-- sans etre attribuees a aucun role : les ecrans correspondants seraient restes
-- inaccessibles a tous, hormis le proprietaire que la regle generale laisse
-- passer.

INSERT INTO public.snp_role_capabilities (role, capability_code)
VALUES
  -- La direction conduit la conciliation de bout en bout.
  ('management', 'reconciliation.read'),
  ('management', 'reconciliation.create'),
  ('management', 'reconciliation.edit'),
  ('management', 'reconciliation.submit'),
  ('management', 'reconciliation.approve'),
  ('management', 'reconciliation.reject'),
  ('management', 'reconciliation.dispute'),
  ('management', 'reconciliation.close'),
  ('management', 'reconciliation.export'),
  ('management', 'reconciliation.tax.adjust'),
  ('management', 'reconciliation.credit.apply'),
  ('management', 'tax.rules.read'),
  ('management', 'tax.rules.manage'),

  -- L'administration technique consulte et administre le referentiel fiscal,
  -- sans conduire les dossiers.
  ('admin', 'reconciliation.read'),
  ('admin', 'reconciliation.export'),
  ('admin', 'tax.rules.read'),
  ('admin', 'tax.rules.manage'),

  -- Le manager lit sans agir, conformement a son role.
  ('manager', 'reconciliation.read'),
  ('manager', 'reconciliation.export'),
  ('manager', 'tax.rules.read'),

  -- Une societe miniere suit ses propres dossiers et les prepare.
  ('mine', 'reconciliation.read'),
  ('mine', 'reconciliation.submit'),
  ('mine', 'reconciliation.export'),
  ('mine', 'tax.rules.read')
ON CONFLICT (role, capability_code) DO NOTHING;

DO $$
DECLARE
  v_attribuees integer;
BEGIN
  SELECT count(*) INTO v_attribuees
  FROM public.snp_role_capabilities
  WHERE capability_code LIKE 'reconciliation.%' OR capability_code LIKE 'tax.rules.%';

  IF v_attribuees = 0 THEN
    RAISE EXCEPTION 'Postflight : aucune capacite attribuee.';
  END IF;

  -- La direction doit pouvoir valider, sans quoi aucun dossier ne se cloture.
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_role_capabilities
    WHERE role = 'management' AND capability_code = 'reconciliation.approve'
  ) THEN
    RAISE EXCEPTION 'Postflight : la validation n''est attribuee a personne.';
  END IF;
END;
$$;
