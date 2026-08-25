-- Corrige des politiques restrictives qui interdisaient aussi la lecture.
--
-- CONSTAT
-- Les tables de conciliation, les grands livres et le referentiel fiscal
-- portaient chacune une politique restrictive « aucune ecriture directe »
-- declaree FOR ALL avec USING (false). Or FOR ALL couvre egalement SELECT :
-- combinee en ET avec la politique de lecture, elle la reduisait a rien. Ces
-- tables etaient donc illisibles pour tout compte authentifie, y compris un
-- proprietaire habilite.
--
-- Le defaut n'apparaissait sur aucun controle de structure : les tables, les
-- politiques et les droits etaient bien en place. Il a fallu derouler un essai
-- de bout en bout — ouvrir un dossier, y rattacher un resultat d'acheteur, le
-- valider — pour le mettre au jour : la procedure recevait un identifiant nul,
-- la sous-requete qui le lisait ne renvoyant aucune ligne.
--
-- La migration 20260822173000, reprise plus tot dans la journee, avait retenu la
-- forme juste : trois politiques distinctes pour INSERT, UPDATE et DELETE.
-- PostgreSQL n'admet pas de politique portant sur ces trois commandes a la fois.
--
-- PARTI PRIS
-- Remplacer chaque politique FOR ALL par trois politiques restrictives ciblees.
-- L'ecriture directe demeure impossible ; la lecture redevient gouvernee par la
-- seule politique prevue a cet effet.
--
-- RETOUR ARRIERE : restaurer les politiques FOR ALL, ce qui rendrait de nouveau
-- ces tables illisibles.

BEGIN;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'snp_regles_fiscales', 'snp_calculs_fiscaux',
    'snp_grand_livre_commercial', 'snp_grand_livre_fiscal',
    'snp_conciliations', 'snp_conciliations_versions', 'snp_conciliations_ecarts',
    'snp_conciliations_operation_ledger'
  ] LOOP
    -- L'ancienne politique, quel que soit son nom selon la table.
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      CASE v_table
        WHEN 'snp_regles_fiscales' THEN 'snp_regles_fiscales_aucune_ecriture_directe'
        WHEN 'snp_calculs_fiscaux' THEN 'snp_calculs_fiscaux_aucune_ecriture_directe'
        WHEN 'snp_grand_livre_commercial' THEN 'snp_glc_aucune_ecriture_directe'
        WHEN 'snp_grand_livre_fiscal' THEN 'snp_glf_aucune_ecriture_directe'
        WHEN 'snp_conciliations' THEN 'snp_conciliations_aucune_ecriture_directe'
        WHEN 'snp_conciliations_versions' THEN 'snp_conciliations_versions_aucune_ecriture_directe'
        WHEN 'snp_conciliations_ecarts' THEN 'snp_conciliations_ecarts_aucune_ecriture_directe'
        WHEN 'snp_conciliations_operation_ledger' THEN 'snp_col_aucune_ecriture_directe'
      END,
      v_table
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      v_table || '_aucune_insertion_directe', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false)',
      v_table || '_aucune_insertion_directe', v_table
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      v_table || '_aucune_modification_directe', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false)',
      v_table || '_aucune_modification_directe', v_table
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      v_table || '_aucune_suppression_directe', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (false)',
      v_table || '_aucune_suppression_directe', v_table
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_restantes integer;
  v_ciblees integer;
BEGIN
  -- Plus aucune politique restrictive ne doit couvrir toutes les commandes.
  SELECT count(*) INTO v_restantes
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd = 'ALL'
    AND permissive = 'RESTRICTIVE'
    AND tablename IN (
      'snp_regles_fiscales', 'snp_calculs_fiscaux',
      'snp_grand_livre_commercial', 'snp_grand_livre_fiscal',
      'snp_conciliations', 'snp_conciliations_versions',
      'snp_conciliations_ecarts', 'snp_conciliations_operation_ledger'
    );

  IF v_restantes <> 0 THEN
    RAISE EXCEPTION
      'Postflight : % politique(s) restrictive(s) couvrent encore la lecture.',
      v_restantes;
  END IF;

  -- Trois politiques ciblees par table, soit vingt-quatre.
  SELECT count(*) INTO v_ciblees
  FROM pg_policies
  WHERE schemaname = 'public'
    AND permissive = 'RESTRICTIVE'
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    AND tablename IN (
      'snp_regles_fiscales', 'snp_calculs_fiscaux',
      'snp_grand_livre_commercial', 'snp_grand_livre_fiscal',
      'snp_conciliations', 'snp_conciliations_versions',
      'snp_conciliations_ecarts', 'snp_conciliations_operation_ledger'
    );

  IF v_ciblees <> 24 THEN
    RAISE EXCEPTION
      'Postflight : % politiques d''ecriture au lieu de 24.', v_ciblees;
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
