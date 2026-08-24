-- Gestion des dépositaires depuis le portail Mine : lecture et écriture sont
-- strictement limitées à la société du profil après validation du second facteur.

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.depositors') IS NULL THEN
    RAISE EXCEPTION 'La table depositors doit exister avant l ouverture du module Mine';
  END IF;
  IF to_regprocedure('public.snp_est_agent_sonasp()') IS NULL
    OR to_regprocedure('public.snp_est_direction_lecture()') IS NULL
    OR to_regprocedure('public.snp_societe_utilisateur()') IS NULL
  THEN
    RAISE EXCEPTION 'Les fonctions de périmètre et de MFA doivent être installées avant les règles des dépositaires';
  END IF;
END
$guard$;

ALTER TABLE public.depositors ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'depositors'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.depositors', v_policy.policyname);
  END LOOP;
END
$policies$;

CREATE POLICY snp_depositaires_lecture_perimetre
  ON public.depositors
  FOR SELECT
  TO authenticated
  USING (
    public.snp_est_agent_sonasp()
    OR public.snp_est_direction_lecture()
    OR mining_company_id = public.snp_societe_utilisateur()
  );

CREATE POLICY snp_depositaires_creation_perimetre
  ON public.depositors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.snp_est_agent_sonasp()
    OR mining_company_id = public.snp_societe_utilisateur()
  );

CREATE POLICY snp_depositaires_modification_perimetre
  ON public.depositors
  FOR UPDATE
  TO authenticated
  USING (
    public.snp_est_agent_sonasp()
    OR mining_company_id = public.snp_societe_utilisateur()
  )
  WITH CHECK (
    public.snp_est_agent_sonasp()
    OR mining_company_id = public.snp_societe_utilisateur()
  );

CREATE POLICY snp_depositaires_suppression_perimetre
  ON public.depositors
  FOR DELETE
  TO authenticated
  USING (
    public.snp_est_agent_sonasp()
    OR mining_company_id = public.snp_societe_utilisateur()
  );

-- Trois contacts fonctionnels de départ pour SOPAMIB. L'insertion est
-- idempotente et distingue les responsabilités nécessaires à une expédition.
WITH sopamib AS (
  SELECT id
  FROM public.mining_companies
  WHERE upper(code) = 'SOPAMIB'
  ORDER BY created_at
  LIMIT 1
), contacts(category, full_name, job_title, email, telephone, is_primary) AS (
  VALUES
    ('general_management', 'Aminata Ouédraogo', 'Directrice générale', 'direction@sopamib.bf', '+226 25 30 10 01', true),
    ('bullion_dispatch', 'Issouf Kaboré', 'Responsable expéditions', 'expeditions@sopamib.bf', '+226 25 30 10 02', true),
    ('security', 'Mariam Sawadogo', 'Responsable sécurité', 'securite@sopamib.bf', '+226 25 30 10 03', true)
)
INSERT INTO public.depositors (
  mining_company_id,
  category,
  full_name,
  job_title,
  email,
  telephone,
  is_primary,
  is_backup,
  is_active,
  notes
)
SELECT
  sopamib.id,
  contacts.category,
  contacts.full_name,
  contacts.job_title,
  contacts.email,
  contacts.telephone,
  contacts.is_primary,
  false,
  true,
  'Contact initial du circuit d expédition SOPAMIB'
FROM sopamib
CROSS JOIN contacts
WHERE NOT EXISTS (
  SELECT 1
  FROM public.depositors existing
  WHERE existing.mining_company_id = sopamib.id
    AND lower(existing.email) = lower(contacts.email)
);

COMMIT;
