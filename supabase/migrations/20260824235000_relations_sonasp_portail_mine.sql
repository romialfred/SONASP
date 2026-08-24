-- Relations entre une société minière et la SONASP.
--
-- Une société peut proposer un contrat, répondre à une réquisition qui lui a
-- été notifiée et accuser un règlement. Elle ne peut ni émettre une
-- réquisition au nom de la SONASP, ni créer son propre règlement.

-- -------------------------------------------------------------------------
-- Contrats : proposition limitée à la société du compte authentifié
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_encadrer_proposition_contrat_mine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid;
BEGIN
  -- Les agents SONASP conservent le cycle contractuel existant.
  IF auth.role() = 'service_role' OR public.snp_est_agent_sonasp() THEN
    RETURN NEW;
  END IF;

  v_societe := public.snp_societe_compte_mine();
  NEW.mining_company_id := v_societe;
  NEW.partenaire_type := 'mine_industrielle';
  NEW.artisan_id := NULL;
  NEW.site_id := NULL;
  NEW.statut := 'soumis';
  NEW.motif_statut := NULL;
  NEW.date_soumission := now();
  NEW.date_signature := NULL;
  NEW.date_approbation := NULL;
  NEW.approuve_par := NULL;
  NEW.date_activation := NULL;
  NEW.date_cloture := NULL;
  NEW.created_by := auth.uid();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_snp_encadrer_proposition_contrat_mine ON public.snp_contrats;
CREATE TRIGGER trg_snp_encadrer_proposition_contrat_mine
  BEFORE INSERT ON public.snp_contrats
  FOR EACH ROW EXECUTE FUNCTION public.snp_encadrer_proposition_contrat_mine();

DROP POLICY IF EXISTS "Contrats lisibles par la SONASP ou le partenaire" ON public.snp_contrats;
CREATE POLICY "Contrats lisibles par la SONASP ou le partenaire" ON public.snp_contrats
  FOR SELECT USING (
    public.snp_est_agent_sonasp()
    OR (
      mining_company_id = public.snp_societe_utilisateur()
      AND (
        statut IN ('signe', 'actif', 'suspendu', 'echu', 'resilie', 'cloture')
        OR created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Propositions de contrat creees par la mine" ON public.snp_contrats;
CREATE POLICY "Propositions de contrat creees par la mine" ON public.snp_contrats
  FOR INSERT WITH CHECK (
    mining_company_id = public.snp_societe_compte_mine()
    AND partenaire_type = 'mine_industrielle'
    AND statut = 'soumis'
    AND created_by = auth.uid()
  );

REVOKE ALL ON FUNCTION public.snp_encadrer_proposition_contrat_mine() FROM public;

-- -------------------------------------------------------------------------
-- Réquisitions : réponse de la mine, rattachée au compte et historisée
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_portail_mine_repondre_requisition(
  p_requisition_id uuid,
  p_decision text,
  p_commentaire text
)
RETURNS public.snp_requisitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_societe uuid := public.snp_societe_compte_mine();
  v_requisition public.snp_requisitions%ROWTYPE;
  v_avant text;
  v_auteur text;
  v_commentaire text := trim(coalesce(p_commentaire, ''));
BEGIN
  IF p_decision NOT IN ('approuver', 'contester') THEN
    RAISE EXCEPTION 'La décision doit être « approuver » ou « contester ».';
  END IF;
  IF length(v_commentaire) < 5 THEN
    RAISE EXCEPTION 'Le commentaire doit contenir au moins cinq caractères.';
  END IF;

  SELECT * INTO v_requisition
  FROM public.snp_requisitions
  WHERE id = p_requisition_id
    AND mining_company_id = v_societe
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réquisition introuvable dans votre périmètre.' USING ERRCODE = '42501';
  END IF;
  IF v_requisition.statut NOT IN ('notifiee', 'accusee') THEN
    RAISE EXCEPTION 'Cette réquisition n''attend plus de réponse de la mine.';
  END IF;
  IF v_requisition.observations_recues_le IS NOT NULL
     OR v_requisition.contestation_recue_le IS NOT NULL
     OR v_requisition.accord_recu_le IS NOT NULL THEN
    RAISE EXCEPTION 'Une réponse a déjà été enregistrée pour cette réquisition.';
  END IF;

  SELECT coalesce(nullif(trim(full_name), ''), email, 'Société minière')
  INTO v_auteur
  FROM public.user_profiles
  WHERE id = auth.uid();

  v_avant := v_requisition.statut;

  UPDATE public.snp_requisitions
  SET
    accuse_reception_le = coalesce(accuse_reception_le, now()),
    accuse_reception_par = coalesce(accuse_reception_par, v_auteur),
    observations_mine = v_commentaire,
    observations_recues_le = now(),
    contestation_motif = CASE WHEN p_decision = 'contester' THEN v_commentaire ELSE NULL END,
    contestation_recue_le = CASE WHEN p_decision = 'contester' THEN now() ELSE NULL END,
    accord_mine = CASE
      WHEN p_decision = 'approuver' AND regime_juridique = 'accord_requis' THEN true
      ELSE NULL
    END,
    accord_recu_le = CASE
      WHEN p_decision = 'approuver' AND regime_juridique = 'accord_requis' THEN now()
      ELSE NULL
    END,
    statut = CASE WHEN p_decision = 'contester' THEN 'contestee' ELSE 'accusee' END,
    motif_statut = CASE WHEN p_decision = 'contester' THEN v_commentaire ELSE motif_statut END,
    updated_by = auth.uid()
  WHERE id = p_requisition_id
  RETURNING * INTO v_requisition;

  UPDATE public.snp_requisitions_notifications
  SET accuse_le = coalesce(accuse_le, now()),
      accuse_par = coalesce(accuse_par, v_auteur),
      preuve_reception = coalesce(preuve_reception, 'Réponse enregistrée sur le portail Mine')
  WHERE requisition_id = p_requisition_id
    AND accuse_le IS NULL;

  INSERT INTO public.snp_requisitions_historique
    (requisition_id, statut_avant, statut_apres, motif, commentaire, acteur_id)
  VALUES (
    p_requisition_id,
    v_avant,
    v_requisition.statut,
    CASE WHEN p_decision = 'contester' THEN v_commentaire ELSE NULL END,
    v_commentaire,
    auth.uid()
  );

  RETURN v_requisition;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_portail_mine_repondre_requisition(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_portail_mine_repondre_requisition(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.snp_portail_mine_repondre_requisition(uuid, text, text) IS
  'Enregistre l''approbation ou la contestation commentée de la mine destinataire, sans lui permettre de créer ni d''administrer une réquisition SONASP.';
