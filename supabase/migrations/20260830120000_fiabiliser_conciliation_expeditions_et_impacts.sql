-- Preuves d'expédition, masse totale distincte de l'or fin et simulation fiscale.
-- Aucun rattrapage des données métier historiques ni réécriture des paiements.
BEGIN;

-- Définition autonome : ce helper n'est pas encore présent dans toutes les
-- bases publiées. Owner actif reste national ; les autres acteurs restent bornés.
CREATE OR REPLACE FUNCTION public.snp_can_read_reconciliation_scope(p_mining_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT CASE WHEN coalesce(auth.role(),'')='service_role' THEN true ELSE coalesce((
   SELECT CASE WHEN p.role='owner' THEN true
     WHEN NOT public.snp_actor_has_capability('reconciliation.read') THEN false
     WHEN p.role='mine' THEN p.mining_company_id IS NOT NULL AND p.mining_company_id=p_mining_company_id
     WHEN p.role IN ('admin','management','manager') THEN true ELSE false END
   FROM public.user_profiles p WHERE p.id=auth.uid() AND p.is_active AND public.snp_session_est_active()
 ),false) END;
$fn$;
REVOKE ALL ON FUNCTION public.snp_can_read_reconciliation_scope(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_can_read_reconciliation_scope(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.snp_guard_conciliation_shipped_lot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE sp public.shipping_preparations%ROWTYPE;
BEGIN
  SELECT p.* INTO sp FROM public.sales s JOIN public.shipping_preparations p ON p.id=s.shipping_preparation_id WHERE s.id=NEW.sale_id AND s.status::text NOT IN ('cancelled','canceled','rejected');
  IF NOT FOUND OR sp.shipped_at IS NULL OR sp.refinery_id IS NULL THEN
    RAISE EXCEPTION 'La conciliation exige une vente liée à un lot effectivement expédié à une raffinerie.' USING ERRCODE='23514';
  END IF;
  IF NOT public.snp_can_read_reconciliation_scope(NEW.mining_company_id) THEN
    RAISE EXCEPTION 'Dossier hors de votre périmètre.' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.poids_initial_g:=sp.total_net_weight_grams;
    NEW.teneur_initiale_pct:=CASE WHEN sp.total_net_weight_grams>0 AND NEW.or_fin_initial_g BETWEEN 0 AND sp.total_net_weight_grams THEN round(NEW.or_fin_initial_g/sp.total_net_weight_grams*100,4) END;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.snp_guard_conciliation_shipped_lot() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS snp_conciliation_shipped_lot_guard ON public.snp_conciliations;
CREATE TRIGGER snp_conciliation_shipped_lot_guard BEFORE INSERT OR UPDATE OF sale_id, source_analyse_type, assay_certificate_id, analyse_teneur_id ON public.snp_conciliations FOR EACH ROW EXECUTE FUNCTION public.snp_guard_conciliation_shipped_lot();

CREATE OR REPLACE FUNCTION "public"."snp_guard_conciliation_analysis_source"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_certificate public.assay_certificates%ROWTYPE;
  v_analysis public.snp_analyses_teneur%ROWTYPE;
  v_shipping public.shipping_preparations%ROWTYPE;
  v_verified_data public.assay_certificate_data%ROWTYPE;
  v_expected_weight numeric;
  v_expected_purity numeric;
  v_expected_price numeric;
  v_expected_date date;
BEGIN
  IF TG_OP='UPDATE' AND OLD.statut IN ('validee','facture_definitive_generee','cloturee')
     AND NEW.statut IN ('validee','facture_definitive_generee','cloturee')
     AND NEW.assay_certificate_id IS NOT DISTINCT FROM OLD.assay_certificate_id
     AND NEW.analyse_teneur_id IS NOT DISTINCT FROM OLD.analyse_teneur_id
     AND NEW.poids_final_g IS NOT DISTINCT FROM OLD.poids_final_g
     AND NEW.teneur_finale_pct IS NOT DISTINCT FROM OLD.teneur_finale_pct
     AND NEW.prix_final IS NOT DISTINCT FROM OLD.prix_final
     AND NEW.date_fixing IS NOT DISTINCT FROM OLD.date_fixing THEN RETURN NEW; END IF;
  IF NEW.assay_certificate_id IS NULL AND NEW.analyse_teneur_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.source_analyse_type NOT IN('certificat_acheteur','analyse_teneur')
     OR (NEW.source_analyse_type='certificat_acheteur' AND (NEW.assay_certificate_id IS NULL OR NEW.analyse_teneur_id IS NOT NULL))
     OR (NEW.source_analyse_type='analyse_teneur' AND (NEW.analyse_teneur_id IS NULL OR NEW.assay_certificate_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'La source d’analyse est incohérente.' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id=NEW.sale_id;
  IF NOT FOUND OR v_sale.shipping_preparation_id IS NULL THEN
    RAISE EXCEPTION 'La vente doit être reliée à une expédition avant analyse.' USING ERRCODE='23503';
  END IF;
  SELECT * INTO v_shipping FROM public.shipping_preparations WHERE id=v_sale.shipping_preparation_id;

  IF NEW.source_analyse_type='certificat_acheteur' THEN
    SELECT * INTO v_certificate FROM public.assay_certificates WHERE id=NEW.assay_certificate_id;
    IF NOT FOUND OR v_certificate.shipping_preparation_id IS DISTINCT FROM v_sale.shipping_preparation_id
       OR v_certificate.approval_status IS DISTINCT FROM 'approved'
       OR v_certificate.approved_by IS NULL OR v_certificate.approved_at IS NULL THEN
      RAISE EXCEPTION 'Le certificat doit être approuvé et appartenir à l’expédition de la vente.' USING ERRCODE='42501';
    END IF;
    SELECT * INTO v_verified_data FROM public.assay_certificate_data data
    WHERE data.certificate_id=v_certificate.id
      AND data.shipping_preparation_id=v_sale.shipping_preparation_id
      AND data.is_verified
    ORDER BY data.updated_at DESC LIMIT 1;
    v_expected_purity:=coalesce(
      v_certificate.purity_percent,
      v_certificate.gold_content_percent,
      v_verified_data.gold_purity_percentage,
      CASE WHEN v_certificate.fineness>100 THEN v_certificate.fineness/10 ELSE v_certificate.fineness END,
      CASE WHEN v_verified_data.fineness>100 THEN v_verified_data.fineness/10 ELSE v_verified_data.fineness END
    );
    v_expected_weight:=v_verified_data.total_weight_g;
  ELSE
    SELECT * INTO v_analysis FROM public.snp_analyses_teneur WHERE id=NEW.analyse_teneur_id;
    IF NOT FOUND OR v_analysis.shipping_preparation_id IS DISTINCT FROM v_sale.shipping_preparation_id
       OR v_analysis.statut IS DISTINCT FROM 'tranchee'
       OR v_analysis.teneur_retenue_pct IS NULL THEN
      RAISE EXCEPTION 'L’analyse de teneur doit être tranchée et appartenir à l’expédition de la vente.' USING ERRCODE='42501';
    END IF;
    v_expected_purity:=v_analysis.teneur_retenue_pct;
    v_expected_weight:=CASE WHEN v_analysis.masse_lot_oz > 0 THEN v_analysis.masse_lot_oz*31.1034768 ELSE NULL END;
  END IF;

  IF v_expected_purity IS NULL OR abs(NEW.teneur_finale_pct-v_expected_purity)>0.01 THEN
    RAISE EXCEPTION 'La teneur finale ne correspond pas à la source approuvée.' USING ERRCODE='23514';
  END IF;
  IF v_expected_weight IS NULL OR v_expected_weight <= 0 OR abs(NEW.poids_final_g-v_expected_weight)>0.01 THEN
    RAISE EXCEPTION 'Le poids final est hors de la tolérance de la source approuvée.' USING ERRCODE='23514';
  END IF;

  v_expected_price:=coalesce(v_sale.final_price_per_oz,v_sale.london_am_rate);
  v_expected_date:=coalesce(v_sale.spot_value_date,v_sale.forward_value_date,v_sale.spot_pricing_date::date,v_sale.sale_date);
  IF v_expected_price IS NULL THEN
    SELECT coalesce(price.spot_price,price.london_pm_rate,price.london_am_rate,price.average_price)
    INTO v_expected_price FROM public.gold_prices_daily price
    WHERE price.price_date=NEW.date_fixing AND upper(coalesce(price.currency,'USD'))='USD'
    ORDER BY price.updated_at DESC NULLS LAST LIMIT 1;
    v_expected_date:=NEW.date_fixing;
  END IF;
  IF NEW.date_fixing IS NULL OR v_expected_date IS DISTINCT FROM NEW.date_fixing
     OR v_expected_price IS NULL OR abs(NEW.prix_final-v_expected_price)>0.01 THEN
    RAISE EXCEPTION 'Le fixing ne correspond pas au prix contractuel ou au cours de référence.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Lecture seule : même projection fiscale utilisée par la validation. Une base
-- historique absente n'est jamais reconstruite au taux du jour ni déclarée payée.
CREATE OR REPLACE FUNCTION public.snp_conciliation_impacts_fiscaux(
  p_conciliation_id uuid, p_ca_final numeric DEFAULT NULL,
  p_or_fin_final_g numeric DEFAULT NULL, p_prix_final numeric DEFAULT NULL,
  p_date_fixing date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE
  c public.snp_conciliations%ROWTYPE; s public.sales%ROWTYPE;
  r public.snp_regles_fiscales%ROWTYPE; code text; profil text; v_devise text;
  initial numeric; definitif numeric; assiette numeric; verse numeric;
  ca numeric; or_fin numeric; prix numeric; fixing date; etat text;
  resultat jsonb:='[]'::jsonb;
BEGIN
  SELECT * INTO c FROM public.snp_conciliations WHERE id=p_conciliation_id;
  IF NOT FOUND OR NOT public.snp_can_read_reconciliation_scope(c.mining_company_id) THEN
    RAISE EXCEPTION 'Dossier introuvable ou accès refusé.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM public.sales WHERE id=c.sale_id;
  ca:=coalesce(p_ca_final,c.ca_final); or_fin:=coalesce(p_or_fin_final_g,c.or_fin_final_g);
  prix:=coalesce(p_prix_final,c.prix_final); fixing:=coalesce(p_date_fixing,c.date_fixing);
  IF ca<0 OR or_fin<=0 OR prix<=0 OR ca::text IN ('NaN','Infinity','-Infinity')
     OR or_fin::text IN ('NaN','Infinity','-Infinity') OR prix::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Valeurs de simulation invalides.' USING ERRCODE='22023';
  END IF;
  profil:=CASE WHEN s.seller_type='mining_company' THEN 'mine_industrielle' ELSE 'tous' END;
  v_devise:=coalesce(c.devise_finale,c.devise_initiale,s.currency);
  FOREACH code IN ARRAY ARRAY['tva','royalties','fndl','retenue_source','taxe_communale'] LOOP
    initial:=NULL; definitif:=NULL; assiette:=NULL; verse:=NULL; etat:='calculable';
    SELECT * INTO r FROM public.snp_resoudre_regle_fiscale(code,fixing,prix,'standard',profil);
    SELECT f.montant_obtenu INTO initial FROM public.snp_calculs_fiscaux f
      WHERE f.contexte_type='vente' AND f.contexte_id=c.sale_id AND f.code_taxe=code AND f.devise=v_devise
      ORDER BY f.calcule_le DESC,f.id DESC LIMIT 1;
    IF initial IS NULL THEN
      SELECT sum(CASE WHEN g.sens='debit' THEN g.montant ELSE -g.montant END) INTO initial
      FROM public.snp_grand_livre_fiscal g WHERE g.sale_id=c.sale_id AND g.code_taxe=code
        AND g.devise=v_devise AND g.type_mouvement='taxe_provisoire';
    END IF;
    SELECT sum(CASE WHEN g.sens='credit' THEN g.montant ELSE -g.montant END) INTO verse
      FROM public.snp_grand_livre_fiscal g WHERE g.sale_id=c.sale_id AND g.code_taxe=code
        AND g.devise=v_devise AND g.type_mouvement='reversement';
    IF r.id IS NULL THEN etat:='regle_absente';
    ELSIF v_devise IS DISTINCT FROM coalesce(c.devise_initiale,s.currency)
       OR (r.devise_seuil IS NOT NULL AND r.mode_calcul IN ('forfait','tranche') AND r.devise_seuil IS DISTINCT FROM v_devise) THEN etat:='conversion_requise';
    ELSE
      assiette:=CASE r.assiette
        WHEN 'ca_ht' THEN ca WHEN 'montant_brut' THEN ca
        WHEN 'produit_net' THEN CASE WHEN c.deductions_contractuelles IS NOT NULL THEN greatest(0,ca-c.deductions_contractuelles) END
        WHEN 'quantite_or_fin' THEN or_fin END;
      definitif:=CASE r.mode_calcul WHEN 'exoneration' THEN 0 WHEN 'forfait' THEN r.montant_forfaitaire ELSE round(assiette*r.taux,2) END;
      IF definitif IS NULL THEN etat:='assiette_incomplete';
      ELSIF initial IS NULL THEN etat:='base_initiale_absente'; END IF;
    END IF;
    resultat:=resultat||jsonb_build_array(jsonb_build_object(
      'code_taxe',code,'regle_id',r.id,'assiette',r.assiette,'montant_assiette',assiette,
      'taux',r.taux,'mode_calcul',r.mode_calcul,'devise',v_devise,'initial',initial,
      'definitif',definitif,'ecart',CASE WHEN etat='calculable' THEN round(definitif-initial,2) END,
      'versements',verse,'etat',etat));
  END LOOP;
  RETURN resultat;
END $fn$;
REVOKE ALL ON FUNCTION public.snp_conciliation_impacts_fiscaux(uuid,numeric,numeric,numeric,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_conciliation_impacts_fiscaux(uuid,numeric,numeric,numeric,date) TO authenticated;

CREATE OR REPLACE FUNCTION "public"."snp_conciliation_reserver"("p_idempotency_key" "uuid", "p_operation" "text", "p_aggregate_id" "uuid", "p_request" "jsonb", "p_capability" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
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

  IF v_row.actor_id IS DISTINCT FROM v_actor OR v_row.operation IS DISTINCT FROM p_operation
     OR v_row.aggregate_id IS DISTINCT FROM p_aggregate_id
     OR v_row.capability_code IS DISTINCT FROM p_capability THEN
    RAISE EXCEPTION 'Cette clé idempotente appartient à un autre acteur ou une autre opération.' USING ERRCODE='42501';
  END IF;

  IF v_row.request_fingerprint IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION 'Cette clé idempotente a déjà servi à une autre requête.'
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('rejoue', true, 'reponse', v_row.response);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."snp_conciliation_valider"("p_conciliation_id" "uuid", "p_idempotency_key" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
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
  v_fx public.fx_rates_daily%ROWTYPE;
  v_devise text;
  v_taux_change numeric;
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

  IF NOT public.snp_can_read_reconciliation_scope(v_conciliation.mining_company_id) THEN
    RAISE EXCEPTION 'Dossier hors de votre périmètre.' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.sales s JOIN public.shipping_preparations sp ON sp.id=s.shipping_preparation_id WHERE s.id=v_conciliation.sale_id AND sp.shipped_at IS NOT NULL AND sp.refinery_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Expédition vers une raffinerie requise.' USING ERRCODE='23514';
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

  IF v_conciliation.assay_certificate_id IS NULL AND v_conciliation.analyse_teneur_id IS NULL THEN
    RAISE EXCEPTION 'Une preuve d’analyse rattachée est requise avant validation.' USING ERRCODE='23514';
  END IF;

  IF v_conciliation.soumis_par IS NOT NULL AND v_conciliation.soumis_par = v_actor.id THEN
    RAISE EXCEPTION 'La validation revient à un autre acteur que celui qui a préparé le dossier, y compris pour Owner.' USING ERRCODE='42501';
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

  v_devise:=coalesce(v_conciliation.devise_finale,v_conciliation.devise_initiale);
  IF v_conciliation.ca_initial IS NULL OR v_conciliation.ca_initial<0
     OR v_conciliation.ca_initial::text IN('NaN','Infinity','-Infinity')
     OR v_conciliation.ca_final<0 OR v_conciliation.ca_final::text IN('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Montants initial et final documentés et valides requis avant régularisation.' USING ERRCODE='23514';
  END IF;
  IF v_devise IS NULL OR v_conciliation.devise_initiale IS DISTINCT FROM v_devise THEN
    RAISE EXCEPTION 'Les montants initial et final doivent être exprimés dans la même devise contractuelle.' USING ERRCODE='23514';
  END IF;
  v_ecart_commercial := round(v_conciliation.ca_final - v_conciliation.ca_initial, 2);

  IF v_devise='XOF' THEN v_taux_change:=1;
  ELSE
    SELECT * INTO v_fx FROM public.fx_rates_daily f
    WHERE f.rate_date=v_conciliation.date_fixing
      AND f.currency_pair IN(v_devise||'/XOF','XOF/'||v_devise)
      AND f.rate>0 AND f.rate::text NOT IN('NaN','Infinity','-Infinity')
    ORDER BY (f.currency_pair=v_devise||'/XOF') DESC,f.updated_at DESC,f.id LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Taux de conversion %/XOF absent à la date du fixing. Complétez le référentiel de change.',v_devise USING ERRCODE='23514'; END IF;
    v_taux_change:=CASE WHEN v_fx.currency_pair=v_devise||'/XOF' THEN v_fx.rate ELSE 1/v_fx.rate END;
  END IF;

  IF v_ecart_commercial <> 0 AND v_conciliation.customer_id IS NOT NULL THEN
    INSERT INTO public.snp_grand_livre_commercial (
      contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
      type_mouvement, source_type, source_id, sale_id, conciliation_id,
      idempotency_key, created_by, devise, montant_xof, taux_change, source_taux, taux_horodate
    ) VALUES (
      'customer', v_conciliation.customer_id, v_conciliation.mining_company_id,
      CASE WHEN v_ecart_commercial > 0 THEN 'credit' ELSE 'debit' END,
      abs(v_ecart_commercial),
      'ajustement_conciliation', 'conciliation', v_conciliation.id,
      v_conciliation.sale_id, v_conciliation.id,
      'concil-' || v_conciliation.id::text || '-commercial', v_actor.id, v_devise,
      round(abs(v_ecart_commercial)*v_taux_change,2),v_taux_change,
      CASE WHEN v_devise='XOF' THEN 'Parité XOF' ELSE 'fx_rates_daily:'||v_fx.id::text END,
      CASE WHEN v_devise='XOF' THEN clock_timestamp() ELSE v_fx.rate_date::timestamp AT TIME ZONE 'UTC' END
    );
  END IF;

  FOR v_taxe IN SELECT * FROM jsonb_to_recordset(public.snp_conciliation_impacts_fiscaux(p_conciliation_id))
    AS impact(code_taxe text,regle_id uuid,initial numeric,definitif numeric,ecart numeric,etat text,montant_assiette numeric,devise text) LOOP
    IF v_taxe.etat='regle_absente' AND v_taxe.initial IS NULL THEN
      v_taxes_sans_regle:=v_taxes_sans_regle||v_taxe.code_taxe; CONTINUE;
    END IF;
    IF v_taxe.etat<>'calculable' THEN
      RAISE EXCEPTION 'Fiscalité % incomplète (%). Complétez la base historique et la règle avant validation.',v_taxe.code_taxe,v_taxe.etat USING ERRCODE='23514';
    END IF;
    SELECT * INTO v_regle FROM public.snp_regles_fiscales WHERE id=v_taxe.regle_id;
    v_montant_initial:=v_taxe.initial; v_montant_final:=v_taxe.definitif; v_ecart_taxe:=v_taxe.ecart;

    INSERT INTO public.snp_calculs_fiscaux (
      regle_id, code_taxe, assiette_retenue, montant_assiette, taux_applique,
      formule, montant_obtenu, contexte_type, contexte_id, mining_company_id,
      calcule_par, devise
    ) VALUES (
      v_regle.id, v_taxe.code_taxe, v_regle.assiette, v_taxe.montant_assiette, v_regle.taux,
      format('%s : assiette %s ; taux %s', v_regle.mode_calcul, v_taxe.montant_assiette, v_regle.taux),
      v_montant_final, 'conciliation', v_conciliation.id,
      v_conciliation.mining_company_id, v_actor.id, v_taxe.devise
    ) RETURNING id INTO v_calcul_id;

    IF v_ecart_taxe <> 0 THEN
      INSERT INTO public.snp_grand_livre_fiscal (
        mining_company_id, code_taxe, sens, montant, type_mouvement,
        statut_credit, sale_id, conciliation_id, regle_id, calcul_id,
        idempotency_key, created_by, devise
      ) VALUES (
        v_conciliation.mining_company_id, v_taxe.code_taxe,
        CASE WHEN v_ecart_taxe > 0 THEN 'debit' ELSE 'credit' END,
        abs(v_ecart_taxe), 'ajustement_conciliation',
        CASE WHEN v_ecart_taxe < 0 THEN 'constate' ELSE NULL END,
        v_conciliation.sale_id, v_conciliation.id, v_regle.id, v_calcul_id,
        'concil-' || v_conciliation.id::text || '-' || v_taxe.code_taxe, v_actor.id, v_taxe.devise
      );
    END IF;

    INSERT INTO public.snp_conciliations_ecarts (
      conciliation_id, parametre, code_taxe, valeur_initiale, valeur_definitive,
      ecart_absolu, unite
    ) VALUES (
      v_conciliation.id, 'taxe', v_taxe.code_taxe, v_montant_initial, v_montant_final, v_ecart_taxe, v_taxe.devise
    ) ON CONFLICT DO NOTHING;

    v_taxes_traitees := v_taxes_traitees || v_taxe.code_taxe;
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
$$;

CREATE OR REPLACE FUNCTION "public"."snp_conciliation_ouvrir"("p_sale_id" "uuid", "p_idempotency_key" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
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
  IF v_actor.role NOT IN ('owner','admin','management','manager') AND v_actor.mining_company_id IS NOT NULL
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
$$;

CREATE OR REPLACE FUNCTION "public"."snp_conciliation_enregistrer_analyse"("p_conciliation_id" "uuid", "p_source_type" "text", "p_source_id" "uuid", "p_poids_final_g" numeric, "p_teneur_finale_pct" numeric, "p_prix_final" numeric, "p_date_fixing" "date", "p_idempotency_key" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
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
      'poids', p_poids_final_g, 'teneur', p_teneur_finale_pct, 'prix', p_prix_final, 'date_fixing', p_date_fixing
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
  IF NOT public.snp_can_read_reconciliation_scope(v_conciliation.mining_company_id) THEN RAISE EXCEPTION 'Dossier hors de votre périmètre.' USING ERRCODE='42501'; END IF;
  IF v_conciliation.statut NOT IN ('en_attente_analyse', 'analyse_recue', 'contestee') THEN
    RAISE EXCEPTION
      'Le dossier % n''attend plus de résultat d''analyse (statut %).',
      v_conciliation.reference, v_conciliation.statut
      USING ERRCODE = '22023';
  END IF;

  v_or_fin := round(p_poids_final_g * p_teneur_finale_pct / 100.0, 4);
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
$$;

DROP POLICY IF EXISTS snp_conciliations_lecture ON public.snp_conciliations;
CREATE POLICY snp_conciliations_lecture
  ON public.snp_conciliations FOR SELECT TO authenticated
  USING (public.snp_can_read_reconciliation_scope(mining_company_id));

DROP POLICY IF EXISTS snp_conciliations_versions_lecture ON public.snp_conciliations_versions;
CREATE POLICY snp_conciliations_versions_lecture
  ON public.snp_conciliations_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.snp_conciliations c
    WHERE c.id = conciliation_id
      AND public.snp_can_read_reconciliation_scope(c.mining_company_id)
  ));

DROP POLICY IF EXISTS snp_conciliations_ecarts_lecture ON public.snp_conciliations_ecarts;
CREATE POLICY snp_conciliations_ecarts_lecture
  ON public.snp_conciliations_ecarts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.snp_conciliations c
    WHERE c.id = conciliation_id
      AND public.snp_can_read_reconciliation_scope(c.mining_company_id)
  ));

DROP POLICY IF EXISTS snp_glc_lecture ON public.snp_grand_livre_commercial;
CREATE POLICY snp_glc_lecture
  ON public.snp_grand_livre_commercial FOR SELECT TO authenticated
  USING (public.snp_can_read_reconciliation_scope(mining_company_id));

DROP POLICY IF EXISTS snp_glf_lecture ON public.snp_grand_livre_fiscal;
CREATE POLICY snp_glf_lecture
  ON public.snp_grand_livre_fiscal FOR SELECT TO authenticated
  USING (public.snp_can_read_reconciliation_scope(mining_company_id));

DROP POLICY IF EXISTS snp_calculs_fiscaux_lecture ON public.snp_calculs_fiscaux;
CREATE POLICY snp_calculs_fiscaux_lecture
  ON public.snp_calculs_fiscaux FOR SELECT TO authenticated
  USING (public.snp_can_read_reconciliation_scope(mining_company_id));

COMMIT;
NOTIFY pgrst, 'reload schema';
