-- Procedures transactionnelles de conciliation.
--
-- OBJET
-- Ouvrir un dossier, y rattacher le resultat de l'acheteur, puis le valider en
-- une seule transaction produisant l'ajustement commercial, les ajustements
-- fiscaux et la trace d'audit. Un echec sur l'un annule l'ensemble : aucun etat
-- partiellement valide n'est possible.
--
-- IDEMPOTENCE
-- Le motif reserve/complete deja employe par les paiements est repris, avec son
-- journal d'operations propre. Une seconde validation ne produit ni deuxieme
-- ecriture, ni deuxieme facture : elle retourne la reponse conservee.
--
-- FISCALITE
-- Le referentiel est vide : aucun bareme n'a ete livre, faute de validation
-- juridique. La validation n'invente donc aucun taux. Elle recalcule les seules
-- taxes pour lesquelles une regle approuvee existe a la date de l'operation, et
-- signale dans sa reponse celles qu'elle n'a pas pu traiter. Le dossier reste
-- valide commercialement ; sa fiscalite sera completee lorsque les baremes
-- seront saisis.
--
-- RETOUR ARRIERE
--   DROP FUNCTION public.snp_conciliation_valider(uuid, uuid);
--   DROP FUNCTION public.snp_conciliation_enregistrer_analyse(uuid, text, uuid, numeric, numeric, numeric, date, text);
--   DROP FUNCTION public.snp_conciliation_ouvrir(uuid, uuid);
--   DROP FUNCTION public.snp_conciliation_reserver(uuid, text, uuid, jsonb);
--   DROP TABLE public.snp_conciliations_operation_ledger;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Journal d'idempotence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.snp_conciliations_operation_ledger (
  idempotency_key uuid PRIMARY KEY,
  operation text NOT NULL,
  aggregate_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  capability_code text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,

  CONSTRAINT snp_col_operation_check
    CHECK (operation IN ('ouvrir', 'enregistrer_analyse', 'valider', 'cloturer'))
);

ALTER TABLE public.snp_conciliations_operation_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_col_aucune_ecriture_directe ON public.snp_conciliations_operation_ledger;
CREATE POLICY snp_col_aucune_ecriture_directe
  ON public.snp_conciliations_operation_ledger AS RESTRICTIVE
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
REVOKE INSERT, UPDATE, DELETE ON public.snp_conciliations_operation_ledger FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.snp_conciliation_reserver(
  p_idempotency_key uuid,
  p_operation text,
  p_aggregate_id uuid,
  p_request jsonb,
  p_capability text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_hash text := encode(extensions.digest(convert_to(p_request::text, 'UTF8'), 'sha256'), 'hex');
  v_row public.snp_conciliations_operation_ledger%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_idempotency_key IS NULL OR p_aggregate_id IS NULL THEN
    RAISE EXCEPTION 'Acteur, agrégat et clé idempotente sont obligatoires.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.snp_conciliations_operation_ledger (
    idempotency_key, operation, aggregate_id, request_fingerprint,
    actor_id, capability_code
  ) VALUES (
    p_idempotency_key, p_operation, p_aggregate_id, v_hash, v_actor, p_capability
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF FOUND THEN
    RETURN jsonb_build_object('rejoue', false);
  END IF;

  SELECT * INTO v_row
  FROM public.snp_conciliations_operation_ledger
  WHERE idempotency_key = p_idempotency_key;

  -- Une meme cle ne peut pas servir a deux requetes differentes.
  IF v_row.request_fingerprint IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION 'Cette clé idempotente a déjà servi à une autre requête.'
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('rejoue', true, 'reponse', v_row.response);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_conciliation_completer(
  p_idempotency_key uuid,
  p_response jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  UPDATE public.snp_conciliations_operation_ledger
     SET response = p_response, completed_at = now()
   WHERE idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation idempotente introuvable.' USING ERRCODE = 'P0002';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_conciliation_reserver(uuid, text, uuid, jsonb, text) FROM public;
REVOKE ALL ON FUNCTION public.snp_conciliation_completer(uuid, jsonb) FROM public;

-- ---------------------------------------------------------------------------
-- 2. Ouverture d'un dossier
-- ---------------------------------------------------------------------------
-- Rien de ce qui est deja connu n'est ressaisi : les valeurs provisoires sont
-- reprises de la vente, le contrat et la societe deduits.

CREATE OR REPLACE FUNCTION public.snp_conciliation_ouvrir(
  p_sale_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_vente public.sales%ROWTYPE;
  v_reservation jsonb;
  v_conciliation public.snp_conciliations%ROWTYPE;
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

  INSERT INTO public.snp_conciliations (
    sale_id, mining_company_id, customer_id,
    poids_initial_g, or_fin_initial_g, prix_initial, devise_initiale,
    ca_initial, created_by, soumis_par
  ) VALUES (
    v_vente.id,
    v_actor.mining_company_id,
    v_vente.customer_id,
    NULL,
    NULL,
    v_vente.london_am_rate,
    coalesce(v_vente.currency, 'USD'),
    v_vente.gross_proceeds,
    v_actor.id,
    v_actor.id
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
$fn$;

REVOKE ALL ON FUNCTION public.snp_conciliation_ouvrir(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_conciliation_ouvrir(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Enregistrement du resultat de l'acheteur
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_conciliation_enregistrer_analyse(
  p_conciliation_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_poids_final_g numeric,
  p_teneur_finale_pct numeric,
  p_prix_final numeric,
  p_date_fixing date,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_conciliation public.snp_conciliations%ROWTYPE;
  v_reservation jsonb;
  v_or_fin numeric;
  v_ca numeric;
  v_reponse jsonb;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.snp_actor_has_capability('reconciliation.edit') THEN
    RAISE EXCEPTION 'Vous n''êtes pas habilité à saisir un résultat d''analyse.'
      USING ERRCODE = '42501';
  END IF;
  IF p_source_type NOT IN ('certificat_acheteur', 'analyse_teneur') THEN
    RAISE EXCEPTION 'Source d''analyse inconnue.' USING ERRCODE = '22023';
  END IF;
  IF p_poids_final_g IS NULL OR p_poids_final_g <= 0
     OR p_teneur_finale_pct IS NULL OR p_teneur_finale_pct <= 0 OR p_teneur_finale_pct > 100
     OR p_prix_final IS NULL OR p_prix_final <= 0 THEN
    RAISE EXCEPTION 'Poids, teneur et prix définitifs sont invalides.' USING ERRCODE = '22023';
  END IF;

  v_reservation := public.snp_conciliation_reserver(
    p_idempotency_key, 'enregistrer_analyse', p_conciliation_id,
    jsonb_build_object(
      'source_type', p_source_type, 'source_id', p_source_id,
      'poids', p_poids_final_g, 'teneur', p_teneur_finale_pct, 'prix', p_prix_final
    ),
    'reconciliation.edit'
  );
  IF (v_reservation ->> 'rejoue')::boolean THEN
    RETURN coalesce(v_reservation -> 'reponse', jsonb_build_object('rejoue', true));
  END IF;

  SELECT * INTO v_conciliation
  FROM public.snp_conciliations WHERE id = p_conciliation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conciliation introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF v_conciliation.statut NOT IN ('en_attente_analyse', 'analyse_recue', 'contestee') THEN
    RAISE EXCEPTION
      'Le dossier % n''attend plus de résultat d''analyse (statut %).',
      v_conciliation.reference, v_conciliation.statut
      USING ERRCODE = '22023';
  END IF;

  -- L'or fin se deduit du poids et de la teneur ; l'unite interne est le gramme.
  v_or_fin := round(p_poids_final_g * p_teneur_finale_pct / 100.0, 4);
  -- Le prix est exprime par once troy : la conversion emploie le facteur exact
  -- deja retenu ailleurs dans la plateforme.
  v_ca := round(v_or_fin / 31.1034768 * p_prix_final, 2);

  UPDATE public.snp_conciliations SET
    source_analyse_type = p_source_type,
    assay_certificate_id = CASE WHEN p_source_type = 'certificat_acheteur' THEN p_source_id ELSE NULL END,
    analyse_teneur_id = CASE WHEN p_source_type = 'analyse_teneur' THEN p_source_id ELSE NULL END,
    poids_final_g = p_poids_final_g,
    teneur_finale_pct = p_teneur_finale_pct,
    or_fin_final_g = v_or_fin,
    prix_final = p_prix_final,
    date_fixing = p_date_fixing,
    ca_final = v_ca,
    statut = 'analyse_recue',
    updated_by = auth.uid()
  WHERE id = p_conciliation_id
  RETURNING * INTO v_conciliation;

  v_reponse := jsonb_build_object(
    'id', v_conciliation.id,
    'reference', v_conciliation.reference,
    'statut', v_conciliation.statut,
    'or_fin_final_g', v_or_fin,
    'ca_final', v_ca
  );
  PERFORM public.snp_conciliation_completer(p_idempotency_key, v_reponse);
  RETURN v_reponse;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_conciliation_enregistrer_analyse(uuid, text, uuid, numeric, numeric, numeric, date, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_conciliation_enregistrer_analyse(uuid, text, uuid, numeric, numeric, numeric, date, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Validation
-- ---------------------------------------------------------------------------
-- En une transaction : l'ajustement commercial, les ajustements fiscaux, le
-- changement d'etat et l'audit. Un echec sur l'un annule l'ensemble.

CREATE OR REPLACE FUNCTION public.snp_conciliation_valider(
  p_conciliation_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
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
  -- Separation des taches : nul ne valide ce qu'il a soumis.
  IF v_conciliation.soumis_par IS NOT NULL AND v_conciliation.soumis_par = v_actor.id THEN
    RAISE EXCEPTION
      'La validation revient à un autre acteur que celui qui a préparé le dossier.'
      USING ERRCODE = '42501';
  END IF;

  -- Ajustement commercial : ce qui separe la valeur definitive de la valeur
  -- deja facturee.
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

  -- Ajustements fiscaux : uniquement pour les taxes dont une regle approuvee
  -- existe a la date consideree. Aucun taux n'est suppose.
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

    IF v_ecart_taxe <> 0 AND v_conciliation.mining_company_id IS NOT NULL THEN
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
$fn$;

REVOKE ALL ON FUNCTION public.snp_conciliation_valider(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_conciliation_valider(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Postflight
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_manquantes text := '';
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.snp_conciliation_ouvrir(uuid, uuid)',
    'public.snp_conciliation_enregistrer_analyse(uuid, text, uuid, numeric, numeric, numeric, date, uuid)',
    'public.snp_conciliation_valider(uuid, uuid)'
  ] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      v_manquantes := v_manquantes || v_fn || ' ';
    END IF;
  END LOOP;

  IF v_manquantes <> '' THEN
    RAISE EXCEPTION 'Postflight : procédures absentes : %', v_manquantes;
  END IF;

  IF to_regclass('public.snp_conciliations_operation_ledger') IS NULL THEN
    RAISE EXCEPTION 'Postflight : le journal d''idempotence est absent.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
