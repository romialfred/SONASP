-- ---------------------------------------------------------------------------
-- Les plans mensuels des mois écoulés
--
-- Les achats de janvier à juillet 2026 existaient sans le plan qui les avait
-- décidés : l'écran « Plans mensuels » ne montrait qu'un brouillon d'août, et le
-- module ne pouvait pas se valider sur un mois complet.
--
-- Chaque mois reçoit donc son plan, reconstitué depuis ce qui a réellement été
-- acheté : cible nationale égale au total du mois, une ligne par mine à la
-- quantité effectivement traitée, prix moyen pondéré. Les demandes adressées aux
-- mines suivent, approuvées, et les achats qui en découlent leur sont rattachés.
--
-- Les mois clos le sont ; juillet reste en exécution, ses achats étant validés
-- mais non réglés. Un seul plan vivant par mois : l'index
-- `idx_snp_plans_achat_mois_vivant` l'impose, et août appartient à l'utilisateur.
--
-- Rejouable : le bloc efface ses propres écritures avant de les reposer, et ne
-- touche à aucune donnée qu'il n'a pas produite.
-- ---------------------------------------------------------------------------

DO $seed$
DECLARE
  v_agent uuid;
  v_periode record;
  v_ligne record;
  v_plan_id uuid;
  v_ligne_id uuid;
  v_numero text;
  v_cible numeric;
  v_prix numeric;
  v_statut text;
BEGIN
  -- Un auteur qui peut réellement se connecter : deux profils sur trois n'ont
  -- pas de compte `auth.users`, et une clé étrangère les refuse (A181).
  SELECT up.id INTO v_agent
  FROM user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE up.role IN ('owner', 'admin', 'manager')
  ORDER BY up.created_at
  LIMIT 1;

  FOR v_periode IN
    SELECT d::date AS debut,
           (d + interval '1 month - 1 day')::date AS fin,
           extract(year FROM d)::int AS annee,
           extract(month FROM d)::int AS mois
    FROM generate_series(date '2026-01-01', date '2026-07-01', interval '1 month') d
  LOOP
    v_numero := 'PA-' || to_char(v_periode.debut, 'YYYY-MM');

    SELECT COALESCE(sum(quantite_oz), 0),
           round(sum(montant_total_fcfa) / NULLIF(sum(quantite_oz), 0), 2)
    INTO v_cible, v_prix
    FROM snp_achats_mines
    WHERE statut <> 'annulee'
      AND periode_debut = v_periode.debut
      AND periode_fin = v_periode.fin;

    CONTINUE WHEN v_cible <= 0;

    DELETE FROM snp_demandes_achat
    WHERE numero_demande LIKE 'DA-' || to_char(v_periode.debut, 'YYYYMM') || '-%';

    DELETE FROM snp_plans_achat WHERE numero_plan = v_numero;

    -- Juillet vit encore : ses achats sont validés, aucun n'est réglé.
    v_statut := CASE WHEN v_periode.mois = 7 THEN 'en_execution' ELSE 'cloture' END;

    INSERT INTO snp_plans_achat (
      numero_plan, annee, mois, mode_repartition, quantite_cible_oz,
      prix_once_global_fcfa, devise, unite, statut, observations,
      date_soumission, date_validation, date_cloture, created_by, updated_by)
    VALUES (
      v_numero, v_periode.annee, v_periode.mois, 'quantite_cible', v_cible,
      v_prix, 'XOF', 'oz', v_statut,
      'Campagne mensuelle d''achat auprès des mines industrielles.',
      (v_periode.debut - 3)::timestamptz,
      (v_periode.debut - 1)::timestamptz,
      CASE WHEN v_statut = 'cloture' THEN (v_periode.fin + 12)::timestamptz END,
      v_agent, v_agent)
    RETURNING id INTO v_plan_id;

    FOR v_ligne IN
      SELECT a.mining_company_id,
             sum(a.quantite_oz) AS quantite,
             round(sum(a.montant_total_fcfa) / NULLIF(sum(a.quantite_oz), 0), 2) AS prix,
             COALESCE(p.declaree, 0) AS declaree,
             COALESCE(p.validee, 0) AS validee,
             p.titre
      FROM snp_achats_mines a
      LEFT JOIN (
        SELECT dp.mining_company_id,
               sum(dp.estimated_oz) AS declaree,
               COALESCE(sum(dp.estimated_oz) FILTER (WHERE dp.status = 'ready_for_customs'), 0) AS validee,
               round(avg(dp.estimated_fineness_pct), 2) AS titre
        FROM daily_production dp
        WHERE dp.production_date BETWEEN v_periode.debut AND v_periode.fin
          AND dp.status <> 'cancelled'
        GROUP BY dp.mining_company_id
      ) p ON p.mining_company_id = a.mining_company_id
      WHERE a.statut <> 'annulee'
        AND a.periode_debut = v_periode.debut
        AND a.periode_fin = v_periode.fin
      GROUP BY a.mining_company_id, p.declaree, p.validee, p.titre
    LOOP
      -- L'assiette du plan est celle du moment où il a été arrêté : rien
      -- n'était encore engagé sur le mois.
      INSERT INTO snp_plans_achat_lignes (
        plan_id, mining_company_id, periode_debut, periode_fin,
        production_declaree_oz, production_validee_oz, deja_engage_oz,
        production_eligible_oz, titre_moyen_pct, pourcentage_applique,
        quantite_proposee_oz, prix_once_fcfa, statut, ajustee_manuellement)
      VALUES (
        v_plan_id, v_ligne.mining_company_id, v_periode.debut, v_periode.fin,
        v_ligne.declaree, v_ligne.validee, 0,
        GREATEST(v_ligne.declaree, v_ligne.quantite), v_ligne.titre,
        LEAST(100, round(v_ligne.quantite * 100
              / GREATEST(v_ligne.declaree, v_ligne.quantite), 4)),
        v_ligne.quantite, v_ligne.prix, 'approuvee', false)
      RETURNING id INTO v_ligne_id;

      INSERT INTO snp_demandes_achat (
        numero_demande, plan_id, ligne_id, mining_company_id,
        periode_debut, periode_fin, production_reference_oz, quantite_demandee_oz,
        pourcentage_applique, unite, titre_pct, prix_once_fcfa, devise,
        montant_estime_fcfa, conditions_paiement, delai_reponse_jours,
        date_limite_reponse, statut, date_soumission, date_reponse,
        repondu_par, created_by, updated_by)
      SELECT
        'DA-' || to_char(v_periode.debut, 'YYYYMM') || '-' || mc.code,
        v_plan_id, v_ligne_id, v_ligne.mining_company_id,
        v_periode.debut, v_periode.fin, v_ligne.declaree, v_ligne.quantite,
        LEAST(100, round(v_ligne.quantite * 100
              / GREATEST(v_ligne.declaree, v_ligne.quantite), 4)),
        'oz', v_ligne.titre, v_ligne.prix, 'XOF',
        round(v_ligne.quantite * v_ligne.prix, 2), 'differe_30j', 7,
        (v_periode.debut + 6)::date, 'approuvee',
        (v_periode.debut - 1)::timestamptz,
        (v_periode.debut + 4)::timestamptz,
        v_agent, v_agent, v_agent
      FROM mining_companies mc
      WHERE mc.id = v_ligne.mining_company_id;
    END LOOP;

    -- L'achat de la campagne se rattache à la demande qui l'a produit. Les
    -- achats hors campagne, eux, gardent leur indépendance.
    UPDATE snp_achats_mines a
    SET demande_id = d.id
    FROM snp_demandes_achat d
    WHERE a.demande_id IS NULL
      AND a.periode_debut = v_periode.debut
      AND a.periode_fin = v_periode.fin
      AND a.numero_achat LIKE 'ACH-' || to_char(v_periode.debut, 'YYYYMM') || '-%'
      AND d.plan_id = v_plan_id
      AND d.mining_company_id = a.mining_company_id;
  END LOOP;
END $seed$;
