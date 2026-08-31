-- Un seul workflow de réponse : portail Mine -> achat -> facture -> audit.
BEGIN;
DO $preflight$ BEGIN
 IF to_regprocedure('public.snp_repondre_demande(uuid,text,text)') IS NULL
   OR to_regprocedure('public.snp_societe_compte_mine()') IS NULL THEN
   RAISE EXCEPTION 'Socle des demandes et portail Mine requis.';
 END IF;
END $preflight$;

-- Sérialiser la réservation d'un numéro jusqu'à la fin de la transaction.
-- Le format existant est conservé ; aucune référence historique n'est réécrite.
CREATE OR REPLACE FUNCTION public.snp_numero_suivant(
 p_prefixe text,p_annee integer,p_table regclass,p_colonne text
) RETURNS text LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public','pg_temp' AS $num$
DECLARE v_rang integer; v_motif text:=p_prefixe||'-'||p_annee||'-';
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_table::text||':'||p_colonne||':'||v_motif,0));
 EXECUTE format(
   'SELECT COALESCE(max(substring(%I from ''[0-9]+$'')::int),0)+1 FROM %s WHERE %I LIKE $1',
   p_colonne,p_table,p_colonne) INTO v_rang USING v_motif||'%';
 RETURN v_motif||lpad(v_rang::text,4,'0');
END;
$num$;

CREATE OR REPLACE FUNCTION public.snp_repondre_demande(
  p_demande_id uuid,
  p_decision text,
  p_motif text DEFAULT NULL::text
)
RETURNS TABLE(r_demande_id uuid, r_achat_id uuid, r_facture_id uuid, r_numero_facture text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'storage', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_d snp_demandes_achat%ROWTYPE;
  v_societe uuid;
  v_achat uuid;
  v_facture uuid;
  v_numero text;
  v_brut numeric; v_tva numeric; v_tdc numeric; v_ttc numeric;
  v_regle_tva snp_regles_fiscales%ROWTYPE;
  v_regle_tdc snp_regles_fiscales%ROWTYPE;
  v_taux_tva numeric; v_taux_tdc numeric;
  v_echeance date;
BEGIN
  -- Vérifier la session et la capacité avant toute lecture ou transition.
  PERFORM public.snp_require_active_session();
  IF public.snp_societe_utilisateur() IS NOT NULL THEN
    PERFORM public.snp_require_capability('mine.operate');
  ELSE
    PERFORM public.snp_require_capability('sonasp.approve');
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approuvee', 'rejetee', 'modification_demandee') THEN
    RAISE EXCEPTION 'Décision inconnue : %.', p_decision;
  END IF;

  SELECT * INTO v_d FROM snp_demandes_achat d WHERE d.id = p_demande_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable.'; END IF;

  -- Isolation : une mine ne répond que pour elle-même.
  v_societe := snp_societe_utilisateur();
  IF v_societe IS NOT NULL AND v_societe <> v_d.mining_company_id THEN
    RAISE EXCEPTION 'Cette demande ne concerne pas votre société.';
  END IF;
  IF v_societe IS NULL AND NOT snp_peut_valider() THEN
    RAISE EXCEPTION 'Vous n''êtes pas habilité à répondre à cette demande.';
  END IF;

  IF v_d.statut <> 'soumise' THEN
    RAISE EXCEPTION 'Cette demande est % : elle n''attend plus de réponse.', v_d.statut;
  END IF;

  IF p_decision IN ('rejetee', 'modification_demandee')
     AND (p_motif IS NULL OR length(trim(p_motif)) < 5) THEN
    RAISE EXCEPTION 'Un refus ou une demande de modification doit être motivé.';
  END IF;

  UPDATE snp_demandes_achat d
  SET statut = p_decision,
      motif_rejet = CASE WHEN p_decision = 'rejetee' THEN p_motif END,
      motif_modification = CASE WHEN p_decision = 'modification_demandee' THEN p_motif END,
      date_reponse = now(), repondu_par = auth.uid()
  WHERE d.id = p_demande_id;

  INSERT INTO snp_demandes_achat_historique
    (demande_id, action, statut_avant, statut_apres, motif, acteur_id, acteur_role)
  VALUES (p_demande_id, 'reponse', 'soumise', p_decision, p_motif, auth.uid(), snp_role_utilisateur());

  IF v_d.ligne_id IS NOT NULL THEN
    UPDATE snp_plans_achat_lignes l
    SET statut = CASE WHEN p_decision = 'approuvee' THEN 'approuvee'
                      WHEN p_decision = 'rejetee' THEN 'rejetee' ELSE l.statut END
    WHERE l.id = v_d.ligne_id;
  END IF;

  IF p_decision <> 'approuvee' THEN
    RETURN QUERY SELECT p_demande_id, NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Idempotence : l'index unique sur snp_achats_mines.demande_id garantit
  -- qu'une seconde approbation ne produit pas une seconde transaction.
  SELECT a.id INTO v_achat FROM snp_achats_mines a WHERE a.demande_id = p_demande_id;
  IF v_achat IS NOT NULL THEN
    SELECT f.id, f.numero_facture INTO v_facture, v_numero
    FROM snp_factures_achat f WHERE f.achat_id = v_achat AND f.statut <> 'annulee';
    RETURN QUERY SELECT p_demande_id, v_achat, v_facture, v_numero;
    RETURN;
  END IF;

  -- Les taux viennent du référentiel, pour le profil du vendeur : une mine.
  SELECT * INTO v_regle_tva
  FROM snp_resoudre_regle_fiscale('tva', CURRENT_DATE, NULL, 'standard', 'mine_industrielle');
  SELECT * INTO v_regle_tdc
  FROM snp_resoudre_regle_fiscale('taxe_communale', CURRENT_DATE, NULL, 'standard', 'mine_industrielle');

  IF v_regle_tva.id IS NULL OR v_regle_tdc.id IS NULL THEN
    RAISE EXCEPTION
      'Aucune règle fiscale en vigueur pour %. Renseignez le barème avant d''approuver cette demande.',
      trim(BOTH ', ' FROM
        coalesce(CASE WHEN v_regle_tva.id IS NULL THEN 'la TVA, ' END, '')
        || coalesce(CASE WHEN v_regle_tdc.id IS NULL THEN 'la taxe de développement communal' END, ''))
      USING ERRCODE = '22023';
  END IF;

  -- Le référentiel stocke une fraction ; les colonnes portent un pourcentage.
  v_taux_tva := round(coalesce(v_regle_tva.taux, 0) * 100, 4);
  v_taux_tdc := round(coalesce(v_regle_tdc.taux, 0) * 100, 4);

  v_brut := round(v_d.quantite_demandee_oz * v_d.prix_once_fcfa, 2);
  v_tva := round(v_brut * coalesce(v_regle_tva.taux, 0), 2);
  v_tdc := round(v_brut * coalesce(v_regle_tdc.taux, 0), 2);
  v_ttc := v_brut + v_tva + v_tdc;

  INSERT INTO snp_achats_mines (
    numero_achat, mining_company_id, demande_id, periode_debut, periode_fin, date_achat,
    quantite_oz, quantite_grammes, prix_once_fcfa, cours_once_usd, taux_usd_xof,
    montant_brut_fcfa, tva_taux, tva_montant_fcfa,
    taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_total_fcfa,
    statut, observations, created_by)
  VALUES (
    public.snp_numero_suivant('ACH', extract(year FROM CURRENT_DATE)::int,
      'public.snp_achats_mines', 'numero_achat'),
    v_d.mining_company_id, p_demande_id, v_d.periode_debut, v_d.periode_fin, CURRENT_DATE,
    v_d.quantite_demandee_oz, round(v_d.quantite_demandee_oz * 31.1034768, 3),
    v_d.prix_once_fcfa, v_d.cours_reference_usd, v_d.taux_usd_xof,
    v_brut, v_taux_tva, v_tva, v_taux_tdc, v_tdc, v_ttc,
    'validee', 'Issu de la demande ' || v_d.numero_demande || '.', auth.uid())
  RETURNING id INTO v_achat;

  v_echeance := CURRENT_DATE + CASE v_d.conditions_paiement
    WHEN 'differe_30j' THEN 30 WHEN 'differe_60j' THEN 60
    WHEN 'differe_90j' THEN 90 WHEN 'echelonne' THEN 30 ELSE 0 END;

  v_numero := snp_numero_suivant('FA', extract(year FROM CURRENT_DATE)::int,
                                 'snp_factures_achat', 'numero_facture');

  INSERT INTO snp_factures_achat (
    numero_facture, achat_id, demande_id, mining_company_id,
    date_emission, periode_debut, periode_fin,
    quantite_oz, titre_pct, prix_once_fcfa,
    montant_ht_fcfa, tva_taux, tva_montant_fcfa,
    taxe_dev_comm_taux, taxe_dev_comm_montant_fcfa, montant_ttc_fcfa,
    devise, conditions_paiement, date_echeance,
    statut, statut_certification, created_by)
  VALUES (
    v_numero, v_achat, p_demande_id, v_d.mining_company_id,
    CURRENT_DATE, v_d.periode_debut, v_d.periode_fin,
    v_d.quantite_demandee_oz, v_d.titre_pct, v_d.prix_once_fcfa,
    v_brut, v_taux_tva, v_tva, v_taux_tdc, v_tdc, v_ttc,
    v_d.devise, v_d.conditions_paiement, v_echeance,
    'emise', 'en_attente', auth.uid())
  RETURNING id INTO v_facture;

  INSERT INTO snp_factures_achat_lignes
    (facture_id, rang, designation, quantite, unite, titre_pct, prix_unitaire_fcfa, montant_ht_fcfa)
  VALUES (
    v_facture, 1,
    'Or doré — production du ' || to_char(v_d.periode_debut, 'DD/MM/YYYY')
      || ' au ' || to_char(v_d.periode_fin, 'DD/MM/YYYY'),
    v_d.quantite_demandee_oz, v_d.unite, v_d.titre_pct, v_d.prix_once_fcfa, v_brut);

  RETURN QUERY SELECT p_demande_id, v_achat, v_facture, v_numero;
END $function$;
REVOKE ALL ON FUNCTION public.snp_repondre_demande(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_repondre_demande(uuid,text,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.snp_portail_mine_repondre_demande(
 p_demande_id uuid,p_decision text,p_motif text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
DECLARE v_company uuid:=public.snp_societe_compte_mine(); v_status text;
BEGIN
 IF p_decision IS NULL OR p_decision NOT IN('approuver','rejeter','clarification') THEN
   RAISE EXCEPTION 'Décision invalide.' USING ERRCODE='22023';
 END IF;
 SELECT statut INTO v_status FROM public.snp_demandes_achat
 WHERE id=p_demande_id AND mining_company_id=v_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Demande inaccessible dans votre périmètre.' USING ERRCODE='42501'; END IF;
 IF v_status<>'soumise' THEN RAISE EXCEPTION 'Cette demande n’attend pas de réponse.' USING ERRCODE='22023'; END IF;
 PERFORM public.snp_repondre_demande(p_demande_id,
   CASE p_decision WHEN 'approuver' THEN 'approuvee' WHEN 'rejeter' THEN 'rejetee' ELSE 'modification_demandee' END,p_motif);
END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_portail_mine_repondre_demande(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_repondre_demande(uuid,text,text) TO authenticated;
DO $postflight$ BEGIN
 IF NOT has_function_privilege('authenticated','public.snp_portail_mine_repondre_demande(uuid,text,text)','EXECUTE')
 OR has_function_privilege('anon','public.snp_portail_mine_repondre_demande(uuid,text,text)','EXECUTE')
 OR pg_get_functiondef('public.snp_repondre_demande(uuid,text,text)'::regprocedure) NOT LIKE '%snp_require_active_session%'
 OR pg_get_functiondef('public.snp_repondre_demande(uuid,text,text)'::regprocedure) NOT LIKE '%snp_resoudre_regle_fiscale%' THEN
   RAISE EXCEPTION 'Contrat de réponse Mine incomplet.';
 END IF;
END $postflight$;
NOTIFY pgrst,'reload schema';
COMMIT;
