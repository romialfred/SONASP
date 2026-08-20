-- ---------------------------------------------------------------------------
-- « DELETE requires a WHERE clause » : la répartition d'un plan échouait
--
-- `snp_repartir_plan` constituait son assiette dans une table temporaire, et la
-- vidait par `DELETE FROM eligible_tmp;` avant de la remplir. Le garde-fou que
-- Supabase pose sur le rôle applicatif refuse toute suppression sans clause
-- `WHERE` — protection contre l'effacement d'une table entière par mégarde. Le
-- SECURITY DEFINER n'y change rien : le garde-fou s'applique à la session.
--
-- La table temporaire disparaît. L'assiette devient une fonction, qui se lit
-- deux fois — une pour le total, une pour la boucle — sans état intermédiaire à
-- nettoyer. Elle sert aussi à qui veut consulter l'assiette d'un mois sans
-- toucher au plan.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION snp_assiette_achat(p_debut date, p_fin date)
RETURNS TABLE (
  mining_company_id uuid,
  declaree numeric,
  validee numeric,
  engage numeric,
  eligible numeric,
  titre numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT
    mc.id,
    COALESCE(p.declaree, 0),
    COALESCE(p.validee, 0),
    COALESCE(e.engage, 0),
    -- L'assiette est la production déclarée du mois, diminuée de ce que
    -- d'autres achats retiennent déjà : on n'achète pas deux fois la même once.
    GREATEST(0, COALESCE(p.declaree, 0) - COALESCE(e.engage, 0)),
    p.titre
  FROM mining_companies mc
  LEFT JOIN (
    SELECT dp.mining_company_id,
           sum(dp.estimated_oz) AS declaree,
           COALESCE(sum(dp.estimated_oz) FILTER (WHERE dp.status = 'ready_for_customs'), 0) AS validee,
           avg(dp.estimated_fineness_pct) AS titre
    FROM daily_production dp
    WHERE dp.production_date BETWEEN p_debut AND p_fin AND dp.status <> 'cancelled'
    GROUP BY dp.mining_company_id
  ) p ON p.mining_company_id = mc.id
  LEFT JOIN (
    SELECT a.mining_company_id, sum(a.quantite_oz) AS engage
    FROM snp_achats_mines a
    WHERE a.statut <> 'annulee' AND a.periode_debut <= p_fin AND a.periode_fin >= p_debut
    GROUP BY a.mining_company_id
  ) e ON e.mining_company_id = mc.id
  WHERE mc.is_active AND mc.company_type = 'production_mine';
$fn$;

REVOKE ALL ON FUNCTION snp_assiette_achat(date, date) FROM public;
GRANT EXECUTE ON FUNCTION snp_assiette_achat(date, date) TO authenticated;

COMMENT ON FUNCTION snp_assiette_achat(date, date) IS
  'Production déclarée, validée, déjà engagée et assiette achetable de chaque mine sur une période.';


CREATE OR REPLACE FUNCTION snp_repartir_plan(p_plan_id uuid, p_ecraser_ajustements boolean DEFAULT false)
RETURNS TABLE (lignes_creees integer, lignes_mises_a_jour integer, lignes_preservees integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_plan snp_plans_achat%ROWTYPE;
  v_debut date;
  v_fin date;
  v_total_eligible numeric := 0;
  v_reste numeric;
  v_creees int := 0;
  v_maj int := 0;
  v_preservees int := 0;
  v_ligne record;
  v_quantite numeric;
  v_prix numeric;
  v_plus_grosse uuid;
  v_existait boolean;
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP peut répartir un plan d''achat.';
  END IF;

  SELECT * INTO v_plan FROM snp_plans_achat WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan introuvable.'; END IF;
  IF v_plan.statut NOT IN ('brouillon', 'pret_soumission') THEN
    RAISE EXCEPTION 'Un plan % ne se répartit plus.', v_plan.statut;
  END IF;

  v_debut := make_date(v_plan.annee, v_plan.mois, 1);
  v_fin := (v_debut + interval '1 month - 1 day')::date;
  v_prix := COALESCE(v_plan.prix_once_global_fcfa, 0);

  SELECT COALESCE(sum(a.eligible), 0) INTO v_total_eligible
  FROM snp_assiette_achat(v_debut, v_fin) a;

  FOR v_ligne IN SELECT * FROM snp_assiette_achat(v_debut, v_fin) LOOP
    SELECT EXISTS (
      SELECT 1 FROM snp_plans_achat_lignes
      WHERE plan_id = p_plan_id AND mining_company_id = v_ligne.mining_company_id
    ) INTO v_existait;

    IF NOT p_ecraser_ajustements AND EXISTS (
      SELECT 1 FROM snp_plans_achat_lignes
      WHERE plan_id = p_plan_id AND mining_company_id = v_ligne.mining_company_id
        AND ajustee_manuellement
    ) THEN
      v_preservees := v_preservees + 1;
      CONTINUE;
    END IF;

    v_quantite := CASE
      WHEN v_plan.mode_repartition = 'pourcentage'
        THEN round(v_ligne.eligible * COALESCE(v_plan.pourcentage_global, 0) / 100, 4)
      WHEN v_total_eligible > 0
        THEN round(v_plan.quantite_cible_oz * v_ligne.eligible / v_total_eligible, 4)
      ELSE 0
    END;

    -- Une cible nationale plus haute que l'assiette ne peut pas s'imposer aux
    -- mines : on n'achète pas une once qui n'a pas été produite.
    v_quantite := LEAST(v_quantite, v_ligne.eligible);

    INSERT INTO snp_plans_achat_lignes (
      plan_id, mining_company_id, periode_debut, periode_fin,
      production_declaree_oz, production_validee_oz, deja_engage_oz,
      production_eligible_oz, titre_moyen_pct,
      pourcentage_applique, quantite_proposee_oz, prix_once_fcfa, statut, ajustee_manuellement)
    VALUES (
      p_plan_id, v_ligne.mining_company_id, v_debut, v_fin,
      v_ligne.declaree, v_ligne.validee, v_ligne.engage, v_ligne.eligible, v_ligne.titre,
      CASE WHEN v_ligne.eligible > 0 THEN round(v_quantite * 100 / v_ligne.eligible, 4) END,
      v_quantite, v_prix, 'brouillon', false)
    ON CONFLICT (plan_id, mining_company_id) DO UPDATE
    SET production_declaree_oz = EXCLUDED.production_declaree_oz,
        production_validee_oz = EXCLUDED.production_validee_oz,
        deja_engage_oz = EXCLUDED.deja_engage_oz,
        production_eligible_oz = EXCLUDED.production_eligible_oz,
        titre_moyen_pct = EXCLUDED.titre_moyen_pct,
        pourcentage_applique = EXCLUDED.pourcentage_applique,
        quantite_proposee_oz = EXCLUDED.quantite_proposee_oz,
        prix_once_fcfa = EXCLUDED.prix_once_fcfa,
        ajustee_manuellement = false;

    IF v_existait THEN v_maj := v_maj + 1; ELSE v_creees := v_creees + 1; END IF;
  END LOOP;

  -- Reliquat d'arrondi replacé sur la plus grosse ligne, dans la limite de son
  -- assiette : la somme des parts doit faire la cible, sans la dépasser.
  IF v_plan.mode_repartition = 'quantite_cible' AND v_total_eligible > 0 THEN
    SELECT v_plan.quantite_cible_oz - COALESCE(sum(quantite_proposee_oz), 0) INTO v_reste
    FROM snp_plans_achat_lignes WHERE plan_id = p_plan_id AND statut <> 'annulee';

    IF v_reste <> 0 THEN
      SELECT id INTO v_plus_grosse FROM snp_plans_achat_lignes
      WHERE plan_id = p_plan_id AND statut <> 'annulee' AND NOT ajustee_manuellement
        AND quantite_proposee_oz + v_reste BETWEEN 0 AND production_eligible_oz
      ORDER BY quantite_proposee_oz DESC LIMIT 1;

      IF v_plus_grosse IS NOT NULL THEN
        UPDATE snp_plans_achat_lignes
        SET quantite_proposee_oz = GREATEST(0, quantite_proposee_oz + v_reste)
        WHERE id = v_plus_grosse;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_creees, v_maj, v_preservees;
END $fn$;
