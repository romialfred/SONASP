-- ============================================================================
-- Portail Mine — rattachement autoritatif et fermeture des contournements RLS
--
-- Cette migration est additive : elle ne modifie aucune donnée métier.
-- Elle ferme quatre chemins identifiés pendant l'audit d'intégration :
--   1. auto-modification de user_profiles.mining_company_id ;
--   2. qualification « agent SONASP » fondée sur la seule absence de société ;
--   3. lecture inter-sociétés via les RPC financiers SECURITY DEFINER ;
--   4. lecture inter-sociétés via snp_analyse_synthese.
-- ============================================================================


-- ------------------------------------------------------- Profil autoritatif --

CREATE OR REPLACE FUNCTION public.protect_user_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_is_service_role boolean := COALESCE(auth.role() = 'service_role', false);
  v_is_admin boolean := false;
BEGIN
  IF v_is_service_role THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_is_admin := public.is_admin_user(auth.uid());
  EXCEPTION WHEN undefined_function THEN
    v_is_admin := false;
  END;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modification du rôle interdite (élévation de privilège).';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Modification de is_active interdite.';
  END IF;
  IF NEW.site_ids IS DISTINCT FROM OLD.site_ids THEN
    RAISE EXCEPTION 'Modification des sites autorisés interdite.';
  END IF;
  IF NEW.mining_company_id IS DISTINCT FROM OLD.mining_company_id THEN
    RAISE EXCEPTION 'Modification du rattachement à la société minière interdite.';
  END IF;

  RETURN NEW;
END;
$fn$;

-- Les profils sont provisionnés par les fonctions d'administration ou les
-- déclencheurs serveur, jamais par un navigateur authentifié.
REVOKE INSERT ON TABLE public.user_profiles FROM authenticated;


-- ----------------------------------------------------- Population SONASP ----

CREATE OR REPLACE FUNCTION public.snp_est_agent_sonasp()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active
      AND mining_company_id IS NULL
      AND role IN ('owner', 'admin', 'management', 'factory', 'airport', 'refinery')
  ) AND public.snp_mfa_satisfaite();
$fn$;

COMMENT ON FUNCTION public.snp_est_agent_sonasp() IS
  'Vrai uniquement pour un profil interne actif, sans société minière et portant un rôle SONASP explicite.';

REVOKE ALL ON FUNCTION public.snp_est_agent_sonasp() FROM public;
GRANT EXECUTE ON FUNCTION public.snp_est_agent_sonasp() TO authenticated;


-- ----------------------------------------------------- Situation financière --

CREATE OR REPLACE FUNCTION public.snp_balance_agee(
  p_date date DEFAULT CURRENT_DATE,
  p_mining_company_id uuid DEFAULT NULL
)
RETURNS TABLE (
  mining_company_id uuid, societe text, devise text,
  non_echu numeric, j1_30 numeric, j31_60 numeric, j61_90 numeric,
  j91_180 numeric, plus_180 numeric, total numeric,
  nb_factures int, plus_ancienne date, anciennete_moyenne numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  WITH ouvertes AS (
    SELECT f.mining_company_id, mc.name AS societe, f.devise, f.date_echeance,
           public.snp_facture_reste_du(f.id) AS reste,
           GREATEST(0, p_date - f.date_echeance) AS jours
    FROM public.snp_factures_achat f
    JOIN public.mining_companies mc ON mc.id = f.mining_company_id
    WHERE f.statut NOT IN ('annulee', 'brouillon')
      AND (p_mining_company_id IS NULL OR f.mining_company_id = p_mining_company_id)
      AND (public.snp_est_agent_sonasp()
           OR f.mining_company_id = public.snp_societe_utilisateur())
      AND public.snp_facture_reste_du(f.id) > 0.005
  )
  SELECT
    o.mining_company_id, o.societe, o.devise,
    round(sum(o.reste) FILTER (WHERE o.date_echeance >= p_date), 2),
    round(sum(o.reste) FILTER (WHERE o.jours BETWEEN 1 AND 30), 2),
    round(sum(o.reste) FILTER (WHERE o.jours BETWEEN 31 AND 60), 2),
    round(sum(o.reste) FILTER (WHERE o.jours BETWEEN 61 AND 90), 2),
    round(sum(o.reste) FILTER (WHERE o.jours BETWEEN 91 AND 180), 2),
    round(sum(o.reste) FILTER (WHERE o.jours > 180), 2),
    round(sum(o.reste), 2),
    count(*)::int, min(o.date_echeance), round(avg(o.jours), 1)
  FROM ouvertes o
  GROUP BY o.mining_company_id, o.societe, o.devise
  ORDER BY 10 DESC;
$fn$;


CREATE OR REPLACE FUNCTION public.snp_releve_societe(
  p_mining_company_id uuid,
  p_debut date DEFAULT NULL,
  p_fin date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  ligne_date date, type_operation text, reference text, libelle text,
  debit numeric, credit numeric, solde numeric, statut text, piece_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  WITH autorisation AS (
    SELECT public.snp_est_agent_sonasp()
        OR p_mining_company_id = public.snp_societe_utilisateur() AS accordee
  ), mouvements AS (
    SELECT f.date_emission AS d, 'facture' AS t, f.numero_facture AS r,
           'Facture d''achat — ' || round(f.quantite_oz, 2) || ' oz' AS l,
           0::numeric AS deb, public.snp_facture_net_exigible(f.id) AS cred,
           f.statut AS s, f.id AS pid, 1 AS ordre
    FROM public.snp_factures_achat f, autorisation a
    WHERE a.accordee AND f.mining_company_id = p_mining_company_id AND f.statut <> 'annulee'
    UNION ALL
    SELECT r.date_reglement, 'reglement', r.reference_reglement,
           'Règlement ' || r.mode_reglement, r.montant_fcfa, 0::numeric,
           r.statut, r.id, 2
    FROM public.snp_reglements_achat r, autorisation a
    WHERE a.accordee AND r.mining_company_id = p_mining_company_id AND r.statut <> 'annule'
    UNION ALL
    SELECT av.date_avoir, 'avoir', av.numero_avoir, 'Avoir — ' || av.motif,
           av.montant_fcfa, 0::numeric, av.statut, av.id, 3
    FROM public.snp_avoirs_achat av, autorisation a
    WHERE a.accordee AND av.mining_company_id = p_mining_company_id AND av.statut = 'applique'
  )
  SELECT d, t, r, l, round(deb, 2), round(cred, 2),
         round(sum(cred - deb) OVER (ORDER BY d, ordre, r
                                     ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2),
         s, pid
  FROM mouvements
  WHERE (p_debut IS NULL OR d >= p_debut) AND d <= p_fin
  ORDER BY d, ordre, r;
$fn$;


CREATE OR REPLACE FUNCTION public.snp_situation_societe(p_mining_company_id uuid)
RETURNS TABLE (
  facture_total numeric, facture_payee numeric, reste_du numeric,
  dette_echue numeric, nb_factures int, nb_ouvertes int, nb_echues int,
  plus_ancienne_echeance date, anciennete_moyenne numeric,
  reglements_total numeric, non_affecte numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  WITH autorisation AS (
    SELECT public.snp_est_agent_sonasp()
        OR p_mining_company_id = public.snp_societe_utilisateur() AS accordee
  ), f AS (
    SELECT facture.id, facture.date_echeance,
           public.snp_facture_net_exigible(facture.id) AS net,
           public.snp_facture_paye(facture.id) AS paye,
           public.snp_facture_reste_du(facture.id) AS reste
    FROM public.snp_factures_achat facture, autorisation a
    WHERE a.accordee
      AND facture.mining_company_id = p_mining_company_id
      AND facture.statut NOT IN ('annulee', 'brouillon')
  ), r AS (
    SELECT COALESCE(sum(reglement.montant_fcfa), 0) AS total,
           COALESCE(sum(reglement.montant_fcfa - reglement.montant_affecte_fcfa), 0) AS libre
    FROM public.snp_reglements_achat reglement, autorisation a
    WHERE a.accordee
      AND reglement.mining_company_id = p_mining_company_id
      AND reglement.statut NOT IN ('annule', 'rejete')
  )
  SELECT
    round(COALESCE(sum(f.net), 0), 2),
    round(COALESCE(sum(f.paye), 0), 2),
    round(COALESCE(sum(f.reste), 0), 2),
    round(COALESCE(sum(f.reste) FILTER (WHERE f.date_echeance < CURRENT_DATE), 0), 2),
    count(*)::int,
    count(*) FILTER (WHERE f.reste > 0.005)::int,
    count(*) FILTER (WHERE f.reste > 0.005 AND f.date_echeance < CURRENT_DATE)::int,
    min(f.date_echeance) FILTER (WHERE f.reste > 0.005),
    round(avg(GREATEST(0, CURRENT_DATE - f.date_echeance)) FILTER (WHERE f.reste > 0.005), 1),
    (SELECT round(total, 2) FROM r),
    (SELECT round(libre, 2) FROM r)
  FROM f;
$fn$;


-- --------------------------------------------------------- Analyses teneur --

CREATE OR REPLACE FUNCTION public.snp_analyse_synthese(p_analyse_id uuid)
RETURNS TABLE (
  rang integer, origine text, laboratoire text, laboratoire_independant boolean,
  teneur_pct numeric, ecart_a_la_declaration numeric, certificat_reference text,
  date_analyse date, analyste text, observations text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT r.rang, r.origine, r.laboratoire, r.laboratoire_independant, r.teneur_pct,
         round(r.teneur_pct - a.teneur_declaree_pct, 3),
         r.certificat_reference, r.date_analyse, r.analyste, r.observations
  FROM public.snp_analyses_resultats r
  JOIN public.snp_analyses_teneur a ON a.id = r.analyse_id
  WHERE r.analyse_id = p_analyse_id
    AND (public.snp_est_agent_sonasp()
         OR a.mining_company_id = public.snp_societe_utilisateur())
  ORDER BY r.rang;
$fn$;

REVOKE ALL ON FUNCTION public.snp_balance_agee(date, uuid) FROM public;
REVOKE ALL ON FUNCTION public.snp_releve_societe(uuid, date, date) FROM public;
REVOKE ALL ON FUNCTION public.snp_situation_societe(uuid) FROM public;
REVOKE ALL ON FUNCTION public.snp_analyse_synthese(uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.snp_balance_agee(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_releve_societe(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_situation_societe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_analyse_synthese(uuid) TO authenticated;
