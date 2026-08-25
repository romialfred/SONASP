-- Rend explicites les droits de lecture des objets de conciliation.
--
-- CONSTAT
-- Les tables creees par les migrations precedentes n'accordaient aucun droit
-- explicite : elles s'en remettaient aux privileges par defaut du schema. Or
-- ceux-ci dependent du role qui applique la migration. En production, ou les
-- migrations s'executent sous `postgres`, les tables ont bien recu SELECT. Sur
-- le miroir, ou elles s'executent sous `supabase_admin`, elles n'ont rien recu :
-- les politiques de lecture y etaient inoperantes, RLS ne s'appliquant qu'une
-- fois le privilege accorde.
--
-- La difference a ete constatee en comparant les deux environnements pendant un
-- essai de bout en bout. Elle n'a pas produit d'incident en production, mais une
-- migration dont l'effet depend du role qui l'execute n'est pas reproductible.
--
-- PARTI PRIS
-- Accorder SELECT explicitement. L'ecriture reste interdite : elle passe par les
-- procedures de confiance, et les politiques restrictives posees precedemment
-- s'y opposent de toute facon.
--
-- Le journal d'idempotence fait exception et ne recoit aucun droit : il n'a pas
-- vocation a etre lu par l'application, seules les procedures y accedent.
--
-- RETOUR ARRIERE
--   REVOKE SELECT ON <chaque table> FROM authenticated;

BEGIN;

GRANT SELECT ON public.snp_regles_fiscales TO authenticated;
GRANT SELECT ON public.snp_calculs_fiscaux TO authenticated;
GRANT SELECT ON public.snp_grand_livre_commercial TO authenticated;
GRANT SELECT ON public.snp_grand_livre_fiscal TO authenticated;
GRANT SELECT ON public.snp_conciliations TO authenticated;
GRANT SELECT ON public.snp_conciliations_versions TO authenticated;
GRANT SELECT ON public.snp_conciliations_ecarts TO authenticated;

-- L'ecriture directe demeure exclue, quel que soit le role qui a cree la table.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.snp_regles_fiscales, public.snp_calculs_fiscaux,
     public.snp_grand_livre_commercial, public.snp_grand_livre_fiscal,
     public.snp_conciliations, public.snp_conciliations_versions,
     public.snp_conciliations_ecarts, public.snp_conciliations_operation_ledger
  FROM anon, authenticated;

-- Le journal d'idempotence reste hors de portee de l'application.
REVOKE ALL ON public.snp_conciliations_operation_ledger FROM anon, authenticated;

DO $$
DECLARE
  v_sans_lecture text;
  v_avec_ecriture integer;
BEGIN
  SELECT string_agg(t.nom, ', ') INTO v_sans_lecture
  FROM (VALUES
    ('snp_regles_fiscales'), ('snp_calculs_fiscaux'),
    ('snp_grand_livre_commercial'), ('snp_grand_livre_fiscal'),
    ('snp_conciliations'), ('snp_conciliations_versions'),
    ('snp_conciliations_ecarts')
  ) AS t(nom)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public' AND g.table_name = t.nom
      AND g.grantee = 'authenticated' AND g.privilege_type = 'SELECT'
  );

  IF v_sans_lecture IS NOT NULL THEN
    RAISE EXCEPTION 'Postflight : lecture non accordee sur %.', v_sans_lecture;
  END IF;

  SELECT count(*) INTO v_avec_ecriture
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    AND table_name IN (
      'snp_regles_fiscales', 'snp_calculs_fiscaux',
      'snp_grand_livre_commercial', 'snp_grand_livre_fiscal',
      'snp_conciliations', 'snp_conciliations_versions',
      'snp_conciliations_ecarts', 'snp_conciliations_operation_ledger'
    );

  IF v_avec_ecriture <> 0 THEN
    RAISE EXCEPTION
      'Postflight : % droit(s) d''ecriture subsistent sur les objets de conciliation.',
      v_avec_ecriture;
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
