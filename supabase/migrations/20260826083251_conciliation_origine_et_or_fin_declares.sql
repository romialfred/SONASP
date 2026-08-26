-- Trois defauts de la procedure d'ouverture, decouverts en jouant le parcours
-- complet depuis l'ecran.
--
-- 1. LA SOCIETE D'ORIGINE VENAIT DU PROFIL DE L'ACTEUR
-- Les acteurs nationaux — proprietaire, direction, administration — n'ont pas
-- de societe miniere rattachee. Un dossier ouvert par eux portait donc
-- mining_company_id = NULL, et la validation, qui teste
-- « IF ... AND mining_company_id IS NOT NULL », ecartait alors les trois
-- ecritures fiscales sans le dire. L'ecran aurait annonce des taxes ajustees
-- que le grand livre n'aurait jamais recues.
-- L'origine appartient a la vente, pas a celui qui la traite : seller_type
-- 'mining_company' designe la societe par seller_id, seller_type 'sonasp'
-- designe la SONASP elle-meme.
--
-- 2. L'OR FIN DECLARE N'ETAIT PAS REPRIS
-- Le dossier gardait le prix et le chiffre d'affaires declares, mais laissait
-- or_fin_initial_g vide. L'ecran de comparaison ne pouvait donc rien opposer au
-- resultat de l'acheteur sur la quantite — ce qui est pourtant l'objet meme de
-- la conciliation. La vente exprime la quantite en onces troy ; la conversion
-- est exacte, 1 oz troy = 31,1034768 g.
--
-- 3. LE CLOISONNEMENT REPOSAIT SUR UN EFFET DE BORD
-- Tant que la societe venait du profil, une societe miniere ne pouvait ouvrir
-- un dossier que sous sa propre banniere. En prenant l'origine sur la vente, ce
-- garde-fou disparaitrait : il faut donc le poser explicitement, sans quoi une
-- mine pourrait ouvrir un dossier sur la vente d'une autre.

CREATE OR REPLACE FUNCTION public.snp_conciliation_ouvrir(
  p_sale_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  -- 1 once troy = 31,1034768 grammes. Valeur exacte, non arrondie.
  c_grammes_par_once constant numeric := 31.1034768;

  v_actor public.user_profiles%ROWTYPE;
  v_vente public.sales%ROWTYPE;
  v_reservation jsonb;
  v_conciliation public.snp_conciliations%ROWTYPE;
  v_societe uuid;
  v_or_fin numeric;
  v_reponse jsonb;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.snp_actor_has_capability('reconciliation.create') THEN
    RAISE EXCEPTION 'Vous n''êtes pas habilité à ouvrir une conciliation.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.user_profiles WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil actif introuvable.' USING ERRCODE = '42501';
  END IF;

  v_reservation := public.snp_conciliation_reserver(
    p_idempotency_key, 'ouvrir', p_sale_id,
    jsonb_build_object('sale_id', p_sale_id), 'reconciliation.create'
  );
  IF (v_reservation ->> 'rejoue')::boolean THEN
    RETURN coalesce(v_reservation -> 'reponse', jsonb_build_object('rejoue', true));
  END IF;

  SELECT * INTO v_vente FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.snp_conciliations
    WHERE sale_id = p_sale_id AND statut <> 'annulee'
  ) THEN
    RAISE EXCEPTION
      'Cette vente porte déjà une conciliation en cours ou close.'
      USING ERRCODE = '23505';
  END IF;

  -- L'origine se lit sur la vente.
  v_societe := CASE
    WHEN v_vente.seller_type = 'mining_company' THEN v_vente.seller_id
    WHEN v_vente.seller_type = 'sonasp' THEN (
      SELECT id FROM public.mining_companies WHERE upper(coalesce(code, '')) = 'SONASP' LIMIT 1
    )
    ELSE NULL
  END;

  IF v_societe IS NULL THEN
    RAISE EXCEPTION
      'L''origine de la vente % est indéterminée : la conciliation ne pourrait pas imputer ses ajustements fiscaux.',
      v_vente.sale_number
      USING ERRCODE = '22023';
  END IF;

  -- Une société minière ne concilie que ses propres ventes. Auparavant, cette
  -- limite tenait au fait que la société venait du profil ; elle est désormais
  -- posée pour elle-même.
  IF v_actor.mining_company_id IS NOT NULL
     AND v_actor.mining_company_id <> v_societe THEN
    RAISE EXCEPTION 'Cette vente ne relève pas de votre société.'
      USING ERRCODE = '42501';
  END IF;

  -- La vente exprime la quantité en onces troy d'or fin.
  v_or_fin := CASE
    WHEN v_vente.quantity_oz IS NULL THEN NULL
    ELSE round(v_vente.quantity_oz * c_grammes_par_once, 4)
  END;

  INSERT INTO public.snp_conciliations (
    sale_id, mining_company_id, customer_id,
    or_fin_initial_g, prix_initial, devise_initiale, ca_initial,
    created_by, soumis_par
  ) VALUES (
    v_vente.id, v_societe, v_vente.customer_id,
    v_or_fin, v_vente.london_am_rate, coalesce(v_vente.currency, 'USD'),
    v_vente.gross_proceeds, v_actor.id, v_actor.id
  ) RETURNING * INTO v_conciliation;

  v_reponse := jsonb_build_object(
    'id', v_conciliation.id,
    'reference', v_conciliation.reference,
    'statut', v_conciliation.statut,
    'sale_id', v_conciliation.sale_id
  );
  PERFORM public.snp_conciliation_completer(p_idempotency_key, v_reponse);
  RETURN v_reponse;
END;
$function$;

-- ---------------------------------------------------------------------------
-- La validation ne doit plus ecarter une imputation fiscale en silence
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_conciliation_valider(
  p_conciliation_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_conciliation public.snp_conciliations%ROWTYPE;
  v_reservation jsonb;
  v_ecart_commercial numeric;
  v_taxe record;
  v_regle public.snp_regles_fiscales%ROWTYPE;
  v_calcul_id uuid;
  v_montant_initial numeric;
  v_montant_final numeric;
  v_ecart_taxe numeric;
  v_ecart_or_fin numeric;
  v_taxes_traitees text[] := ARRAY[]::text[];
  v_taxes_sans_regle text[] := ARRAY[]::text[];
  v_reponse jsonb;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.snp_actor_has_capability('reconciliation.approve') THEN
    RAISE EXCEPTION 'Vous n''êtes pas habilité à valider une conciliation.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.user_profiles WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil actif introuvable.' USING ERRCODE = '42501';
  END IF;

  v_reservation := public.snp_conciliation_reserver(
    p_idempotency_key, 'valider', p_conciliation_id,
    jsonb_build_object('conciliation_id', p_conciliation_id), 'reconciliation.approve'
  );
  IF (v_reservation ->> 'rejoue')::boolean THEN
    RETURN coalesce(v_reservation -> 'reponse', jsonb_build_object('rejoue', true));
  END IF;

  SELECT * INTO v_conciliation
  FROM public.snp_conciliations WHERE id = p_conciliation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conciliation introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF v_conciliation.statut NOT IN ('analyse_recue', 'calculee', 'en_attente_validation', 'ecart_a_verifier') THEN
    RAISE EXCEPTION
      'Le dossier % n''est pas en état d''être validé (statut %).',
      v_conciliation.reference, v_conciliation.statut
      USING ERRCODE = '22023';
  END IF;
  IF v_conciliation.ca_final IS NULL THEN
    RAISE EXCEPTION 'Le résultat de l''acheteur doit être enregistré avant validation.'
      USING ERRCODE = '22023';
  END IF;
  IF v_conciliation.soumis_par IS NOT NULL AND v_conciliation.soumis_par = v_actor.id THEN
    RAISE EXCEPTION
      'La validation revient à un autre acteur que celui qui a préparé le dossier.'
      USING ERRCODE = '42501';
  END IF;

  -- Sans société d'origine, les ajustements fiscaux n'ont personne à qui
  -- s'imputer. On refuse plutôt que de valider un dossier amputé.
  IF v_conciliation.mining_company_id IS NULL THEN
    RAISE EXCEPTION
      'Le dossier % ne porte aucune société d''origine : ses ajustements fiscaux ne pourraient être imputés à personne.',
      v_conciliation.reference
      USING ERRCODE = '22023';
  END IF;

  v_ecart_commercial := round(coalesce(v_conciliation.ca_final, 0) - coalesce(v_conciliation.ca_initial, 0), 2);

  IF v_ecart_commercial <> 0 AND v_conciliation.customer_id IS NOT NULL THEN
    INSERT INTO public.snp_grand_livre_commercial (
      contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
      type_mouvement, source_type, source_id, sale_id, conciliation_id,
      idempotency_key, created_by
    ) VALUES (
      'customer', v_conciliation.customer_id, v_conciliation.mining_company_id,
      CASE WHEN v_ecart_commercial > 0 THEN 'credit' ELSE 'debit' END,
      abs(v_ecart_commercial),
      'ajustement_conciliation', 'conciliation', v_conciliation.id,
      v_conciliation.sale_id, v_conciliation.id,
      'concil-' || v_conciliation.id::text || '-commercial', v_actor.id
    );
  END IF;

  FOR v_taxe IN SELECT unnest(ARRAY['tva', 'royalties', 'fndl']) AS code LOOP
    SELECT * INTO v_regle
    FROM public.snp_resoudre_regle_fiscale(
      v_taxe.code,
      coalesce(v_conciliation.date_fixing, current_date),
      v_conciliation.prix_final
    );

    IF v_regle.id IS NULL THEN
      v_taxes_sans_regle := v_taxes_sans_regle || v_taxe.code;
      CONTINUE;
    END IF;

    v_montant_initial := round(coalesce(v_conciliation.ca_initial, 0) * coalesce(v_regle.taux, 0), 2);
    v_montant_final := round(coalesce(v_conciliation.ca_final, 0) * coalesce(v_regle.taux, 0), 2);
    v_ecart_taxe := round(v_montant_final - v_montant_initial, 2);

    INSERT INTO public.snp_calculs_fiscaux (
      regle_id, code_taxe, assiette_retenue, montant_assiette, taux_applique,
      formule, montant_obtenu, contexte_type, contexte_id, mining_company_id,
      calcule_par
    ) VALUES (
      v_regle.id, v_taxe.code, v_regle.assiette, v_conciliation.ca_final, v_regle.taux,
      format('%s x %s', v_conciliation.ca_final, v_regle.taux),
      v_montant_final, 'conciliation', v_conciliation.id,
      v_conciliation.mining_company_id, v_actor.id
    ) RETURNING id INTO v_calcul_id;

    IF v_ecart_taxe <> 0 THEN
      INSERT INTO public.snp_grand_livre_fiscal (
        mining_company_id, code_taxe, sens, montant, type_mouvement,
        statut_credit, sale_id, conciliation_id, regle_id, calcul_id,
        idempotency_key, created_by
      ) VALUES (
        v_conciliation.mining_company_id, v_taxe.code,
        CASE WHEN v_ecart_taxe > 0 THEN 'debit' ELSE 'credit' END,
        abs(v_ecart_taxe), 'ajustement_conciliation',
        CASE WHEN v_ecart_taxe < 0 THEN 'constate' ELSE NULL END,
        v_conciliation.sale_id, v_conciliation.id, v_regle.id, v_calcul_id,
        'concil-' || v_conciliation.id::text || '-' || v_taxe.code, v_actor.id
      );
    END IF;

    INSERT INTO public.snp_conciliations_ecarts (
      conciliation_id, parametre, code_taxe, valeur_initiale, valeur_definitive,
      ecart_absolu
    ) VALUES (
      v_conciliation.id, 'taxe', v_taxe.code, v_montant_initial, v_montant_final, v_ecart_taxe
    ) ON CONFLICT DO NOTHING;

    v_taxes_traitees := v_taxes_traitees || v_taxe.code;
  END LOOP;

  INSERT INTO public.snp_conciliations_ecarts (
    conciliation_id, parametre, valeur_initiale, valeur_definitive, ecart_absolu
  ) VALUES (
    v_conciliation.id, 'ca_ht', v_conciliation.ca_initial, v_conciliation.ca_final, v_ecart_commercial
  ) ON CONFLICT DO NOTHING;

  -- L'écart sur la quantité d'or fin, lorsque les deux côtés sont connus.
  IF v_conciliation.or_fin_initial_g IS NOT NULL
     AND v_conciliation.or_fin_final_g IS NOT NULL THEN
    v_ecart_or_fin := round(v_conciliation.or_fin_final_g - v_conciliation.or_fin_initial_g, 4);

    INSERT INTO public.snp_conciliations_ecarts (
      conciliation_id, parametre, valeur_initiale, valeur_definitive, ecart_absolu,
      ecart_relatif_pct, unite
    ) VALUES (
      v_conciliation.id, 'or_fin',
      v_conciliation.or_fin_initial_g, v_conciliation.or_fin_final_g,
      v_ecart_or_fin,
      CASE
        WHEN v_conciliation.or_fin_initial_g <> 0
          THEN round(v_ecart_or_fin / v_conciliation.or_fin_initial_g * 100, 4)
        ELSE NULL
      END,
      'g'
    ) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.snp_conciliations SET
    statut = 'validee',
    valide_par = v_actor.id,
    valide_le = now(),
    updated_by = v_actor.id
  WHERE id = p_conciliation_id
  RETURNING * INTO v_conciliation;

  v_reponse := jsonb_build_object(
    'id', v_conciliation.id,
    'reference', v_conciliation.reference,
    'statut', v_conciliation.statut,
    'ca_initial', v_conciliation.ca_initial,
    'ca_final', v_conciliation.ca_final,
    'ecart_commercial', v_ecart_commercial,
    'taxes_ajustees', to_jsonb(v_taxes_traitees),
    'taxes_sans_regle', to_jsonb(v_taxes_sans_regle)
  );
  PERFORM public.snp_conciliation_completer(p_idempotency_key, v_reponse);
  RETURN v_reponse;
END;
$function$;

REVOKE ALL ON FUNCTION public.snp_conciliation_ouvrir(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_conciliation_valider(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_conciliation_ouvrir(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.snp_conciliation_valider(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.snp_conciliation_ouvrir(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_conciliation_valider(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Rattrapage des dossiers deja ouverts
-- ---------------------------------------------------------------------------

UPDATE public.snp_conciliations c
SET mining_company_id = CASE
      WHEN s.seller_type = 'mining_company' THEN s.seller_id
      WHEN s.seller_type = 'sonasp' THEN (
        SELECT id FROM public.mining_companies WHERE upper(coalesce(code, '')) = 'SONASP' LIMIT 1
      )
      ELSE c.mining_company_id
    END,
    or_fin_initial_g = coalesce(c.or_fin_initial_g, round(s.quantity_oz * 31.1034768, 4))
FROM public.sales s
WHERE s.id = c.sale_id
  AND (c.mining_company_id IS NULL OR c.or_fin_initial_g IS NULL);

DO $$
DECLARE
  v_sans_societe integer;
  v_sans_or_fin integer;
BEGIN
  SELECT count(*) INTO v_sans_societe FROM public.snp_conciliations WHERE mining_company_id IS NULL;
  SELECT count(*) INTO v_sans_or_fin FROM public.snp_conciliations WHERE or_fin_initial_g IS NULL;

  RAISE NOTICE 'Rattrapage : % dossier(s) sans societe, % sans or fin declare.',
    v_sans_societe, v_sans_or_fin;

  IF v_sans_societe > 0 THEN
    RAISE EXCEPTION 'Postflight : % dossier(s) restent sans societe d''origine.', v_sans_societe;
  END IF;
  IF v_sans_or_fin > 0 THEN
    RAISE EXCEPTION 'Postflight : % dossier(s) restent sans or fin declare.', v_sans_or_fin;
  END IF;
END;
$$;
