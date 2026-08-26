-- Raccord entre deux travaux menes en parallele.
--
-- CONSTAT
-- Le referentiel fiscal distingue desormais le vendeur : la TVA porte un taux
-- pour les comptoirs d'achat et un autre pour les mines industrielles, et
-- snp_resoudre_regle_fiscale a recu un cinquieme parametre, p_profil_vendeur,
-- dont le defaut est 'tous'.
--
-- La validation de conciliation, ecrite sans connaitre ce changement, appelle
-- la resolution avec trois arguments. Elle beneficie donc du defaut 'tous' et
-- ne peut trouver que les regles portant ce profil. Une fois le bareme approuve,
-- la TVA — qui n'existe que sous 'comptoir' et 'mine_industrielle' — ne serait
-- jamais resolue : chaque dossier la signalerait comme non calculee.
--
-- Verifie avant correction : la resolution filtre bien
-- « profil_vendeur IN (coalesce(p_profil_vendeur,'tous'), 'tous') ».
--
-- CE QUI EST DEDUIT, ET CE QUI NE L'EST PAS
-- La vente porte seller_type. 'mining_company' designe sans ambiguite une mine
-- industrielle. 'sonasp' designe la societe nationale elle-meme, qui n'est ni un
-- comptoir ni une mine : aucun profil du referentiel ne lui correspond. On
-- transmet alors 'tous', ce qui limite la resolution aux regles universelles.
-- Si la TVA n'existe que par profil, elle sera signalee comme non calculee sur
-- l'ecran du dossier — resultat visible, et non un taux suppose.
-- Trancher le regime fiscal des ventes de la SONASP releve du metier.

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
  v_profil_vendeur text;
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

  IF v_conciliation.mining_company_id IS NULL THEN
    RAISE EXCEPTION
      'Le dossier % ne porte aucune société d''origine : ses ajustements fiscaux ne pourraient être imputés à personne.',
      v_conciliation.reference
      USING ERRCODE = '22023';
  END IF;

  -- Profil du vendeur, lu sur la vente.
  SELECT CASE s.seller_type
           WHEN 'mining_company' THEN 'mine_industrielle'
           ELSE 'tous'
         END
    INTO v_profil_vendeur
  FROM public.sales s WHERE s.id = v_conciliation.sale_id;
  v_profil_vendeur := coalesce(v_profil_vendeur, 'tous');

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
      v_conciliation.prix_final,
      'standard',
      v_profil_vendeur
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
    'profil_vendeur', v_profil_vendeur,
    'taxes_ajustees', to_jsonb(v_taxes_traitees),
    'taxes_sans_regle', to_jsonb(v_taxes_sans_regle)
  );
  PERFORM public.snp_conciliation_completer(p_idempotency_key, v_reponse);
  RETURN v_reponse;
END;
$function$;

REVOKE ALL ON FUNCTION public.snp_conciliation_valider(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_conciliation_valider(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.snp_conciliation_valider(uuid, uuid) TO authenticated;

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'snp_conciliation_valider';

  IF v_def NOT LIKE '%v_profil_vendeur%' THEN
    RAISE EXCEPTION 'Postflight : le profil vendeur n''est pas transmis a la resolution fiscale.';
  END IF;
END;
$$;
