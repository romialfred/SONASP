-- La separation des taches est aussi gravee dans une contrainte de table :
-- snp_conciliations_separation_check interdit valide_par = soumis_par. Modifier
-- la procedure ne suffisait donc pas — le test l'a montre avant que quiconque ne
-- s'en apercoive en production.
--
-- ON NE SUPPRIME PAS LA CONTRAINTE
-- La supprimer laisserait n'importe quel dossier s'auto-valider sans que rien ne
-- le distingue. On ajoute au contraire une colonne qui porte la derogation, et
-- la contrainte n'admet l'egalite que lorsque cette colonne est vraie. La base
-- continue donc de refuser l'auto-validation accidentelle, et chaque derogation
-- devient interrogeable :
--
--   SELECT reference, valide_le FROM public.snp_conciliations
--    WHERE validation_sans_second_regard;
--
-- Seule la procedure ecrit dans cette table, et elle ne met la colonne a vrai
-- que pour un acteur de role « owner ». Aucun autre chemin n'existe.

BEGIN;

ALTER TABLE public.snp_conciliations
  ADD COLUMN IF NOT EXISTS validation_sans_second_regard boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.snp_conciliations.validation_sans_second_regard IS
  'Vrai lorsque le dossier a ete prepare et valide par le meme acteur, ce que seul le proprietaire peut faire. Sert au controle a posteriori.';

ALTER TABLE public.snp_conciliations
  DROP CONSTRAINT IF EXISTS snp_conciliations_separation_check;

ALTER TABLE public.snp_conciliations
  ADD CONSTRAINT snp_conciliations_separation_check
  CHECK (
    valide_par IS NULL
    OR soumis_par IS NULL
    OR valide_par <> soumis_par
    OR validation_sans_second_regard
  );

-- ---------------------------------------------------------------------------
-- La procedure inscrit la derogation sur la ligne
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
  v_profil_vendeur text;
  v_sans_second_regard boolean := false;
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
    IF v_actor.role <> 'owner' THEN
      RAISE EXCEPTION
        'La validation revient à un autre acteur que celui qui a préparé le dossier.'
        USING ERRCODE = '42501';
    END IF;
    v_sans_second_regard := true;
  END IF;

  IF v_conciliation.mining_company_id IS NULL THEN
    RAISE EXCEPTION
      'Le dossier % ne porte aucune société d''origine : ses ajustements fiscaux ne pourraient être imputés à personne.',
      v_conciliation.reference
      USING ERRCODE = '22023';
  END IF;

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
    validation_sans_second_regard = v_sans_second_regard,
    updated_by = v_actor.id
  WHERE id = p_conciliation_id
  RETURNING * INTO v_conciliation;

  IF v_sans_second_regard THEN
    INSERT INTO public.audit_logs (user_id, user_email, action, module, details, status)
    VALUES (
      v_actor.id, v_actor.email, 'conciliation_validee_sans_second_regard', 'conciliation',
      format(
        'Le dossier %s a été préparé et validé par le même acteur, en qualité de propriétaire. Écart commercial : %s.',
        v_conciliation.reference, v_ecart_commercial
      ),
      'success'
    );
  END IF;

  v_reponse := jsonb_build_object(
    'id', v_conciliation.id,
    'reference', v_conciliation.reference,
    'statut', v_conciliation.statut,
    'ca_initial', v_conciliation.ca_initial,
    'ca_final', v_conciliation.ca_final,
    'ecart_commercial', v_ecart_commercial,
    'profil_vendeur', v_profil_vendeur,
    'sans_second_regard', v_sans_second_regard,
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
DECLARE v_def text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='snp_conciliations'
      AND column_name='validation_sans_second_regard'
  ) THEN
    RAISE EXCEPTION 'Postflight : la colonne de derogation est absente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
    WHERE c.relname='snp_conciliations' AND con.conname='snp_conciliations_separation_check'
      AND pg_get_constraintdef(con.oid) LIKE '%validation_sans_second_regard%'
  ) THEN
    RAISE EXCEPTION 'Postflight : la contrainte de separation n''a pas ete rearmee.';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'snp_conciliation_valider';
  IF v_def NOT LIKE '%v_actor.role <> ''owner''%' THEN
    RAISE EXCEPTION 'Postflight : la separation ne vise plus les autres roles.';
  END IF;
END;
$$;

COMMIT;
