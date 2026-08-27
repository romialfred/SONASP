-- Corrections issues de la revue adversariale du dossier complet.
-- Vingt-quatre constats confirmes, dix causes racines. Ce fichier porte les
-- corrections serveur ; il REMPLACE la definition de snp_dossier_complet
-- (les fichiers 20260827074406 et 20260827081206 restent l'historique).
--
-- 1. LE LIEN VENTE-EXPEDITION N'AVAIT AUCUN ECRIVAIN PERENNE
--    Le rattrapage etait unique : toute vente future serait restee orpheline.
--    Un declencheur sur snp_conciliations pose desormais le lien des qu'une
--    conciliation relie une vente a un certificat porteur d'expedition -- sans
--    jamais violer la coherence de societe (verifiee avant d'ecrire).
-- 2. LE POINT FIXE EN DEUX PASSES NE CONVERGEAIT PAS
--    expedition -> certificat -> conciliation -> vente demande trois passes ;
--    achat decouvert tard -> requisition en demande une de plus. Quatre passes.
-- 3. LES AVANCES COMPTAIENT LES ENGAGEMENTS NON EXECUTES
--    Un engagement virtuel 'pending' au montant integral faisait croire la
--    vente payee. Recues = executees ou effectivement datees ; les engagements
--    sont exposes a part.
-- 4. L'ECART DE CONCILIATION S'APPLIQUAIT AVANT VALIDATION
--    ca_final est pose des l'analyse ; l'ecart n'entre aux comptes que valide.
-- 5. LES DEVISES ETAIENT MELANGEES
--    Les taxes du grand livre fiscal sont en XOF ; elles portent leur devise et
--    leur net. Les paiements sont convertis en devise de vente par le flux 4H :
--    la chaine l'affiche ainsi et garde la devise d'origine a part.
-- 6. DOUBLONS DE CHRONOLOGIE PAIEMENT
--    executed/cancelled n'est emis depuis les colonnes que si le journal de
--    workflow n'en porte pas deja la trace.
-- 7. IDENTIFIANTS DE DOCUMENTS DE FRET NON UNIQUES ; TIRAGES NON DETERMINISTES.
-- 8. LE DECLENCHEUR DE COHERENCE ETAIT CONTOURNABLE PAR UPDATE DE seller_id.

BEGIN;

-- ---------------------------------------------------------------------------
-- 8. Le declencheur se declenche aussi quand le vendeur change.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS snp_verifier_expedition_vente_trg ON public.sales;
CREATE TRIGGER snp_verifier_expedition_vente_trg
  BEFORE INSERT OR UPDATE OF shipping_preparation_id, seller_id, seller_type ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.snp_verifier_expedition_vente();

-- ---------------------------------------------------------------------------
-- 1. L'ecrivain perenne : la conciliation pose le lien vente-expedition.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_conciliation_pose_expedition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_sp uuid;
  v_societe uuid;
BEGIN
  IF NEW.assay_certificate_id IS NULL OR NEW.sale_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ac.shipping_preparation_id INTO v_sp
  FROM public.assay_certificates ac WHERE ac.id = NEW.assay_certificate_id;
  IF v_sp IS NULL THEN RETURN NEW; END IF;

  SELECT sp.mining_company_id INTO v_societe
  FROM public.shipping_preparations sp WHERE sp.id = v_sp;

  -- On ne pose le lien que s'il est coherent : jamais d'exception ici, une
  -- conciliation ne doit pas echouer parce que le lien ne peut pas s'ecrire.
  UPDATE public.sales s
  SET shipping_preparation_id = v_sp
  WHERE s.id = NEW.sale_id
    AND s.shipping_preparation_id IS NULL
    AND (s.seller_type <> 'mining_company' OR s.seller_id IS NULL
         OR v_societe IS NULL OR s.seller_id = v_societe);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS snp_conciliation_pose_expedition_trg ON public.snp_conciliations;
CREATE TRIGGER snp_conciliation_pose_expedition_trg
  AFTER INSERT OR UPDATE OF assay_certificate_id ON public.snp_conciliations
  FOR EACH ROW EXECUTE FUNCTION public.snp_conciliation_pose_expedition();

-- ---------------------------------------------------------------------------
-- 2 a 7. La fonction, corrigee. Definition complete : elle supersede les
-- fichiers 20260827074406 et 20260827081206.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snp_dossier_complet(p_type text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_sale_id uuid;
  v_conciliation_id uuid;
  v_requisition_id uuid;
  v_achat_id uuid;
  v_payment_anchor uuid;
  v_sp_ids uuid[] := '{}';
  v_production_ids uuid[] := '{}';
  v_freight_ids uuid[] := '{}';
  v_cert_ids uuid[] := '{}';
  v_achat_ids uuid[] := '{}';
  v_i integer;
  v_chaine jsonb;
  v_documents jsonb;
  v_chronologie jsonb;
  v_comptes jsonb;
  v_devise_vente text;
BEGIN
  -- -------------------------------------------------------------------------
  -- Ancre : l'entite doit etre visible de l'appelant, sinon rien.
  -- -------------------------------------------------------------------------
  IF p_type = 'vente' THEN
    SELECT id INTO v_sale_id FROM sales WHERE id = p_id;
  ELSIF p_type = 'paiement' THEN
    SELECT id, sale_id INTO v_payment_anchor, v_sale_id FROM payments WHERE id = p_id;
  ELSIF p_type = 'conciliation' THEN
    SELECT id, sale_id INTO v_conciliation_id, v_sale_id FROM snp_conciliations WHERE id = p_id;
  ELSIF p_type = 'expedition' THEN
    SELECT ARRAY[id] INTO v_sp_ids FROM shipping_preparations WHERE id = p_id;
  ELSIF p_type = 'production' THEN
    SELECT ARRAY[id] INTO v_production_ids FROM daily_production WHERE id = p_id;
  ELSIF p_type = 'analyse' THEN
    SELECT ARRAY[id] INTO v_cert_ids FROM assay_certificates WHERE id = p_id;
  ELSIF p_type = 'requisition' THEN
    SELECT id INTO v_requisition_id FROM snp_requisitions WHERE id = p_id;
  ELSIF p_type = 'achat' THEN
    SELECT id INTO v_achat_id FROM snp_achats_mines WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Type de dossier inconnu : %.', p_type USING ERRCODE = '22023';
  END IF;

  IF v_sale_id IS NULL AND v_conciliation_id IS NULL AND v_requisition_id IS NULL
     AND v_achat_id IS NULL AND v_payment_anchor IS NULL
     AND coalesce(array_length(v_sp_ids, 1), 0) = 0
     AND coalesce(array_length(v_production_ids, 1), 0) = 0
     AND coalesce(array_length(v_cert_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Dossier introuvable ou accès refusé.' USING ERRCODE = 'P0002';
  END IF;

  IF v_achat_id IS NOT NULL THEN v_achat_ids := ARRAY[v_achat_id]; END IF;

  -- Quatre passes : la chaine la plus longue -- expedition -> certificat ->
  -- conciliation -> vente -> achats -> requisition -- en demande autant.
  FOR v_i IN 1..4 LOOP
    -- Branche locale : requisition <-> achat, achat -> vente (lots).
    IF v_requisition_id IS NULL AND coalesce(array_length(v_achat_ids, 1), 0) > 0 THEN
      SELECT requisition_id INTO v_requisition_id FROM snp_achats_mines
      WHERE id = ANY(v_achat_ids) AND requisition_id IS NOT NULL LIMIT 1;
    END IF;
    IF v_requisition_id IS NOT NULL THEN
      SELECT coalesce(array_agg(DISTINCT a.id), '{}') || v_achat_ids INTO v_achat_ids
      FROM snp_achats_mines a WHERE a.requisition_id = v_requisition_id;
    END IF;
    IF v_sale_id IS NULL AND coalesce(array_length(v_achat_ids, 1), 0) > 0 THEN
      SELECT sale_id INTO v_sale_id FROM snp_ventes_lots
      WHERE achat_mine_id = ANY(v_achat_ids) AND released_at IS NULL
      ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Conciliation -> vente, certificat.
    IF v_conciliation_id IS NOT NULL THEN
      SELECT coalesce(v_sale_id, c.sale_id),
             CASE WHEN c.assay_certificate_id IS NOT NULL
               THEN (SELECT coalesce(array_agg(DISTINCT x), '{}')
                     FROM unnest(v_cert_ids || c.assay_certificate_id) x)
               ELSE v_cert_ids END
        INTO v_sale_id, v_cert_ids
      FROM snp_conciliations c WHERE c.id = v_conciliation_id;
    END IF;

    -- Vente -> expedition, conciliation, achats (lots).
    IF v_sale_id IS NOT NULL THEN
      SELECT CASE WHEN s.shipping_preparation_id IS NOT NULL
               THEN (SELECT coalesce(array_agg(DISTINCT x), '{}')
                     FROM unnest(v_sp_ids || s.shipping_preparation_id) x)
               ELSE v_sp_ids END
        INTO v_sp_ids
      FROM sales s WHERE s.id = v_sale_id;

      IF v_conciliation_id IS NULL THEN
        SELECT id INTO v_conciliation_id FROM snp_conciliations
        WHERE sale_id = v_sale_id AND statut <> 'annulee'
        ORDER BY created_at DESC LIMIT 1;
      END IF;

      SELECT (SELECT coalesce(array_agg(DISTINCT x), '{}')
              FROM unnest(v_achat_ids || coalesce(
                (SELECT array_agg(achat_mine_id) FROM snp_ventes_lots
                 WHERE sale_id = v_sale_id AND achat_mine_id IS NOT NULL), '{}')) x)
        INTO v_achat_ids;
    END IF;

    -- Certificat -> expedition, conciliation.
    IF coalesce(array_length(v_cert_ids, 1), 0) > 0 THEN
      SELECT (SELECT coalesce(array_agg(DISTINCT x), '{}')
              FROM unnest(v_sp_ids || coalesce(
                (SELECT array_agg(shipping_preparation_id) FROM assay_certificates
                 WHERE id = ANY(v_cert_ids) AND shipping_preparation_id IS NOT NULL), '{}')) x)
        INTO v_sp_ids;
      IF v_conciliation_id IS NULL THEN
        SELECT id INTO v_conciliation_id FROM snp_conciliations
        WHERE assay_certificate_id = ANY(v_cert_ids) AND statut <> 'annulee'
        ORDER BY created_at DESC LIMIT 1;
      END IF;
    END IF;

    -- Production -> expedition.
    IF coalesce(array_length(v_production_ids, 1), 0) > 0 THEN
      SELECT (SELECT coalesce(array_agg(DISTINCT x), '{}') FROM unnest(
        v_sp_ids
        || coalesce((SELECT array_agg(DISTINCT shipping_preparation_id)
                     FROM shipping_production_items
                     WHERE daily_production_id = ANY(v_production_ids)), '{}')
        || coalesce((SELECT array_agg(DISTINCT id) FROM shipping_preparations
                     WHERE daily_production_id = ANY(v_production_ids)), '{}')) x)
        INTO v_sp_ids;
    END IF;

    -- Expedition -> productions, fret, certificats, vente.
    IF coalesce(array_length(v_sp_ids, 1), 0) > 0 THEN
      SELECT (SELECT coalesce(array_agg(DISTINCT x), '{}') FROM unnest(
        v_production_ids
        || coalesce((SELECT array_agg(DISTINCT daily_production_id)
                     FROM shipping_production_items
                     WHERE shipping_preparation_id = ANY(v_sp_ids)), '{}')
        || coalesce((SELECT array_agg(DISTINCT daily_production_id)
                     FROM shipping_preparations
                     WHERE id = ANY(v_sp_ids) AND daily_production_id IS NOT NULL), '{}')) x)
        INTO v_production_ids;

      SELECT coalesce(array_agg(DISTINCT id), '{}') INTO v_freight_ids
      FROM freight_shipments
      WHERE shipping_preparation_id = ANY(v_sp_ids) AND deleted_at IS NULL;

      SELECT (SELECT coalesce(array_agg(DISTINCT x), '{}') FROM unnest(
        v_cert_ids
        || coalesce((SELECT array_agg(DISTINCT id) FROM assay_certificates
                     WHERE shipping_preparation_id = ANY(v_sp_ids)), '{}')) x)
        INTO v_cert_ids;

      IF v_sale_id IS NULL THEN
        SELECT id INTO v_sale_id FROM sales
        WHERE shipping_preparation_id = ANY(v_sp_ids)
        ORDER BY created_at DESC LIMIT 1;
      END IF;
    END IF;
  END LOOP;

  SELECT coalesce(s.currency, 'USD') INTO v_devise_vente FROM sales s WHERE s.id = v_sale_id;

  -- -------------------------------------------------------------------------
  -- La chaine : resume de chaque entite, dans l'ordre du workflow.
  -- -------------------------------------------------------------------------
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'productions', (SELECT jsonb_agg(jsonb_build_object(
        'id', dp.id, 'reference', dp.bar_reference, 'date', dp.production_date,
        'statut', dp.status, 'onces_estimees', dp.estimated_oz,
        'grammes_lingot', dp.bullion_grams) ORDER BY dp.production_date)
      FROM daily_production dp WHERE dp.id = ANY(v_production_ids)),
    'requisition', (SELECT jsonb_build_object(
        'id', r.id, 'reference', r.reference, 'statut', r.statut,
        'quantite_oz', r.quantite_oz, 'periode_debut', r.periode_debut,
        'periode_fin', r.periode_fin,
        'enlevements', (SELECT jsonb_agg(jsonb_build_object(
            'id', e.id, 'reference', e.reference, 'statut', e.statut,
            'date_prevue', e.date_prevue, 'date_reelle', e.date_reelle,
            'poids_net_g', e.poids_net_g) ORDER BY e.date_prevue)
          FROM snp_requisitions_enlevements e WHERE e.requisition_id = r.id))
      FROM snp_requisitions r WHERE r.id = v_requisition_id),
    'achats', (SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'reference', a.numero_achat, 'statut', a.statut,
        'date', a.date_achat, 'montant_total_fcfa', a.montant_total_fcfa,
        'quantite_oz', a.quantite_oz,
        'facture', (SELECT jsonb_build_object('id', f.id, 'reference', f.numero_facture,
            'statut', f.statut, 'date_emission', f.date_emission,
            'montant_ttc_fcfa', f.montant_ttc_fcfa)
          FROM snp_factures_achat f
          WHERE f.achat_id = a.id AND f.statut <> 'annulee'
          ORDER BY f.date_emission DESC LIMIT 1)) ORDER BY a.date_achat)
      FROM snp_achats_mines a WHERE a.id = ANY(v_achat_ids)),
    'expeditions', (SELECT jsonb_agg(jsonb_build_object(
        'id', sp.id, 'reference', sp.expedition_lot_number, 'statut', sp.status,
        'preparee_le', sp.prepared_at, 'expediee_le', sp.shipped_at,
        'poids_net_g', sp.total_net_weight_grams,
        'raffinerie', rf.name, 'raffinerie_id', sp.refinery_id) ORDER BY sp.created_at)
      FROM shipping_preparations sp
      LEFT JOIN refineries rf ON rf.id = sp.refinery_id
      WHERE sp.id = ANY(v_sp_ids)),
    'fret', (SELECT jsonb_agg(jsonb_build_object(
        'id', fs.id, 'reference', fs.reference_number, 'statut', fs.status,
        'date_expedition', fs.shipment_date, 'valeur_usd', fs.total_value_usd,
        'or_pur_g', fs.total_pure_gold_grams) ORDER BY fs.shipment_date)
      FROM freight_shipments fs WHERE fs.id = ANY(v_freight_ids)),
    'analyses', (SELECT jsonb_agg(jsonb_build_object(
        'id', ac.id, 'reference', ac.certificate_number, 'laboratoire', ac.issuing_laboratory,
        'date', ac.certificate_date, 'statut', ac.approval_status,
        'or_pct', ac.gold_content_percent, 'finesse', ac.fineness) ORDER BY ac.certificate_date)
      FROM assay_certificates ac WHERE ac.id = ANY(v_cert_ids)),
    'conciliation', (SELECT jsonb_build_object(
        'id', c.id, 'reference', c.reference, 'statut', c.statut,
        'ca_initial', c.ca_initial, 'ca_final', c.ca_final,
        'devise', coalesce(c.devise_finale, c.devise_initiale),
        'valide_le', c.valide_le,
        'sans_second_regard', c.validation_sans_second_regard)
      FROM snp_conciliations c WHERE c.id = v_conciliation_id),
    'vente', (SELECT jsonb_build_object(
        'id', s.id, 'reference', s.sale_number, 'statut', s.status,
        'date', s.sale_date, 'montant_brut', s.gross_proceeds,
        'montant_total', s.total_amount, 'devise', coalesce(s.currency, 'USD'),
        'client', cu.name)
      FROM sales s LEFT JOIN customers cu ON cu.id = s.customer_id
      WHERE s.id = v_sale_id),
    -- Les montants de paiement sont convertis en devise de vente par le flux
    -- d'execution ; la devise d'origine reste visible a part.
    'paiements', (SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'reference', p.reference_number, 'statut', p.status,
        'montant', p.amount, 'devise', v_devise_vente,
        'devise_origine', coalesce(p.payment_currency, p.currency),
        'date_prevue', p.expected_date, 'date_reelle', p.actual_date,
        'moyen', p.payment_method) ORDER BY p.created_at)
      FROM payments p WHERE p.sale_id = v_sale_id)
  )) INTO v_chaine;

  -- -------------------------------------------------------------------------
  -- Les documents, par etape. `source` + `chemin` : la signature reste au client.
  -- -------------------------------------------------------------------------
  SELECT coalesce(jsonb_agg(d ORDER BY (d ->> 'date') DESC NULLS LAST), '[]'::jsonb)
  INTO v_documents
  FROM (
    SELECT jsonb_build_object('etape', 'production', 'source', 'production_documents',
      'id', pd.id, 'nom', coalesce(pd.document_name, pd.file_name),
      'chemin', pd.file_path, 'type_mime', pd.file_type, 'taille', pd.file_size,
      'date', pd.created_at) AS d
    FROM production_documents pd WHERE pd.production_id = ANY(v_production_ids)
    UNION ALL
    SELECT jsonb_build_object('etape', 'enlevement', 'source', 'snp_requisitions_documents',
      'id', rd.id, 'nom', rd.intitule, 'chemin', rd.chemin, 'type_mime', rd.type_mime,
      'taille', rd.taille_octets, 'date', rd.created_at, 'categorie', rd.categorie)
    FROM snp_requisitions_documents rd
    WHERE rd.requisition_id = v_requisition_id AND rd.supprime_le IS NULL
    UNION ALL
    SELECT jsonb_build_object('etape', 'vente_locale', 'source', 'snp_factures_achat',
      'id', f.id, 'nom', 'Facture ' || f.numero_facture, 'chemin', NULL,
      'date', f.date_emission, 'reference', f.numero_facture)
    FROM snp_factures_achat f
    WHERE f.achat_id = ANY(v_achat_ids) AND f.statut <> 'annulee'
    UNION ALL
    SELECT jsonb_build_object('etape', 'expedition', 'source', 'shipping_documents',
      'id', sd.id, 'nom', coalesce(sd.title, sd.file_name), 'chemin', sd.document_url,
      'type_mime', sd.mime_type, 'taille', sd.file_size, 'date', sd.created_at)
    FROM shipping_documents sd WHERE sd.shipping_preparation_id = ANY(v_sp_ids)
    UNION ALL
    SELECT jsonb_build_object('etape', 'expedition', 'source', 'shipping_preparations',
      'id', sp.id, 'nom', 'Packing list', 'chemin', sp.packing_list_url,
      'date', sp.prepared_at)
    FROM shipping_preparations sp
    WHERE sp.id = ANY(v_sp_ids) AND sp.packing_list_url IS NOT NULL
    UNION ALL
    -- Identifiant unique par piece : un fret porte quatre PDF distincts.
    -- Ces chemins visent le bucket herite ferme par le lot 2K : le client les
    -- presente en reference, sans bouton d'ouverture.
    SELECT jsonb_build_object('etape', 'expedition', 'source', 'freight_shipments',
      'id', fs.id::text || ':' || fd.cle, 'nom', fd.nom, 'chemin', fd.chemin,
      'date', fs.created_at)
    FROM freight_shipments fs
    CROSS JOIN LATERAL (VALUES
      ('bullion', 'Bullion summary', fs.bullion_summary_pdf_path),
      ('douane', 'Facture douane', fs.customs_invoice_pdf_path),
      ('packing', 'Packing list fret', fs.packing_list_pdf_path),
      ('voiture', 'Lettre de voiture', fs.consignment_note_pdf_path)
    ) AS fd(cle, nom, chemin)
    WHERE fs.id = ANY(v_freight_ids) AND fd.chemin IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('etape', 'analyse', 'source', 'assay_certificates',
      'id', ac.id, 'nom', 'Certificat ' || coalesce(ac.certificate_number, ''),
      'chemin', ac.file_path, 'type_mime', ac.mime_type, 'taille', ac.file_size,
      'date', ac.created_at)
    FROM assay_certificates ac
    WHERE ac.id = ANY(v_cert_ids) AND ac.file_path IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('etape', 'vente', 'source', 'sales_documents',
      'id', sdoc.id, 'nom', coalesce(sdoc.document_name, sdoc.document_number),
      'chemin', sdoc.file_url, 'type_mime', sdoc.mime_type, 'taille', sdoc.file_size,
      'date', sdoc.created_at, 'type', sdoc.document_type, 'version', sdoc.version)
    FROM sales_documents sdoc
    WHERE sdoc.sale_id = v_sale_id AND sdoc.status IS DISTINCT FROM 'archived'
    UNION ALL
    SELECT jsonb_build_object('etape', 'paiement', 'source', 'snp_payment_proofs',
      'id', pp.id, 'nom', pp.file_name, 'chemin', pp.file_path,
      'type_mime', pp.mime_type, 'taille', pp.file_size, 'date', pp.created_at)
    FROM snp_payment_proofs pp WHERE pp.sale_id = v_sale_id
  ) docs(d);

  -- -------------------------------------------------------------------------
  -- La chronologie, par etape.
  -- -------------------------------------------------------------------------
  SELECT coalesce(jsonb_agg(e ORDER BY (e ->> 'date') ASC NULLS LAST), '[]'::jsonb)
  INTO v_chronologie
  FROM (
    SELECT jsonb_build_object('etape', 'production', 'date', dp.created_at,
      'titre', 'Production enregistrée',
      'detail', coalesce(dp.bar_reference, '') ) AS e
    FROM daily_production dp WHERE dp.id = ANY(v_production_ids)
    UNION ALL
    SELECT jsonb_build_object('etape', 'production', 'date', h.changed_at,
      'titre', 'Statut : ' || h.new_status,
      'detail', coalesce(h.notes, ''),
      'acteur', up.full_name)
    FROM production_status_history h
    LEFT JOIN user_profiles up ON up.id = h.changed_by
    WHERE h.production_id = ANY(v_production_ids)
    UNION ALL
    SELECT jsonb_build_object('etape', 'production', 'date', ush.changed_at,
      'titre', coalesce(ush.action_description, 'Statut : ' || ush.new_status),
      'detail', coalesce(ush.notes, ''),
      'acteur', up.full_name)
    FROM unified_status_history ush
    LEFT JOIN user_profiles up ON up.id = ush.changed_by
    WHERE ush.entity_type = 'production' AND ush.entity_id = ANY(v_production_ids)
    UNION ALL
    SELECT jsonb_build_object('etape', 'expedition', 'date', ush.changed_at,
      'titre', coalesce(ush.action_description, 'Statut : ' || ush.new_status),
      'detail', coalesce(ush.notes, ''),
      'acteur', up.full_name)
    FROM unified_status_history ush
    LEFT JOIN user_profiles up ON up.id = ush.changed_by
    WHERE ush.entity_type = 'shipping' AND ush.entity_id = ANY(v_sp_ids)
    UNION ALL
    SELECT jsonb_build_object('etape', 'paiement', 'date', wa.occurred_at,
      'titre', wa.action || coalesce(' : ' || wa.status_after, ''),
      'detail', coalesce(wa.reason, ''),
      'acteur', up.full_name)
    FROM snp_workflow_audit wa
    LEFT JOIN user_profiles up ON up.id = wa.actor_id
    WHERE wa.aggregate_type = 'international-payment'
      AND wa.aggregate_id IN (SELECT p2.id FROM payments p2 WHERE p2.sale_id = v_sale_id)
    UNION ALL
    SELECT jsonb_build_object('etape', 'enlevement', 'date', rh.survenu_le,
      'titre', 'Réquisition : ' || rh.statut_apres,
      'detail', coalesce(rh.motif, rh.commentaire, ''),
      'acteur', up.full_name)
    FROM snp_requisitions_historique rh
    LEFT JOIN user_profiles up ON up.id = rh.acteur_id
    WHERE rh.requisition_id = v_requisition_id
    UNION ALL
    SELECT jsonb_build_object('etape', 'enlevement', 'date', coalesce(e2.date_reelle, e2.date_prevue),
      'titre', 'Enlèvement ' || coalesce(e2.reference, '') || ' : ' || e2.statut,
      'detail', CASE WHEN e2.poids_net_g IS NOT NULL
        THEN 'Poids net ' || e2.poids_net_g || ' g' ELSE '' END)
    FROM snp_requisitions_enlevements e2 WHERE e2.requisition_id = v_requisition_id
    UNION ALL
    SELECT jsonb_build_object('etape', 'vente_locale', 'date', dh.created_at,
      'titre', 'Demande d''achat : ' || coalesce(dh.statut_apres, dh.action),
      'detail', coalesce(dh.motif, ''),
      'acteur', up.full_name)
    FROM snp_achats_mines am
    JOIN snp_demandes_achat_historique dh ON dh.demande_id = am.demande_id
    LEFT JOIN user_profiles up ON up.id = dh.acteur_id
    WHERE am.id = ANY(v_achat_ids) AND am.demande_id IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('etape', 'vente_locale', 'date', f.date_emission,
      'titre', 'Facture ' || f.numero_facture || ' émise',
      'detail', 'Montant TTC ' || f.montant_ttc_fcfa || ' FCFA')
    FROM snp_factures_achat f
    WHERE f.achat_id = ANY(v_achat_ids) AND f.statut <> 'annulee'
    UNION ALL
    SELECT jsonb_build_object('etape', 'expedition', 'date', ev.d, 'titre', ev.t,
      'detail', coalesce(sp.expedition_lot_number, ''))
    FROM shipping_preparations sp
    CROSS JOIN LATERAL (VALUES
      (sp.created_at, 'Expédition créée'),
      (sp.prepared_at, 'Expédition préparée'),
      (sp.shipped_at, 'Or expédié')
    ) AS ev(d, t)
    WHERE sp.id = ANY(v_sp_ids) AND ev.d IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('etape', 'expedition', 'date', ev.d, 'titre', ev.t,
      'detail', coalesce(fs.reference_number, ''))
    FROM freight_shipments fs
    CROSS JOIN LATERAL (VALUES
      (fs.approved_at, 'Fret approuvé'),
      (fs.shipped_at, 'Fret parti'),
      (fs.received_at, 'Reçu à destination'),
      (fs.processing_started_at, 'Traitement raffinerie commencé'),
      (fs.processed_at, 'Traitement raffinerie terminé'),
      (fs.stocked_at, 'Mis en stock')
    ) AS ev(d, t)
    WHERE fs.id = ANY(v_freight_ids) AND ev.d IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('etape', 'analyse', 'date', ev.d, 'titre', ev.t,
      'detail', coalesce(ac.certificate_number, ''),
      'acteur', up.full_name)
    FROM assay_certificates ac
    LEFT JOIN user_profiles up ON up.id = ac.approved_by
    CROSS JOIN LATERAL (VALUES
      (ac.created_at, 'Certificat téléversé'),
      (ac.parsed_at, 'Certificat analysé'),
      (ac.approved_at, 'Certificat ' || coalesce(ac.approval_status, 'traité'))
    ) AS ev(d, t)
    WHERE ac.id = ANY(v_cert_ids) AND ev.d IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('etape', 'analyse', 'date', ca.created_at,
      'titre', 'Revue du certificat : ' || ca.action,
      'detail', coalesce(ca.review_notes, ''),
      'acteur', up.full_name)
    FROM certificate_approvals ca
    LEFT JOIN user_profiles up ON up.id = ca.reviewed_by
    WHERE ca.certificate_id = ANY(v_cert_ids)
    UNION ALL
    SELECT jsonb_build_object('etape', 'conciliation', 'date', ev.d, 'titre', ev.t,
      'detail', c.reference)
    FROM snp_conciliations c
    CROSS JOIN LATERAL (VALUES
      (c.created_at, 'Dossier de conciliation ouvert'),
      (c.soumis_le, 'Analyse enregistrée'),
      (c.valide_le, CASE WHEN c.validation_sans_second_regard
         THEN 'Conciliation validée (sans second regard)'
         ELSE 'Conciliation validée' END)
    ) AS ev(d, t)
    WHERE c.id = v_conciliation_id AND ev.d IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('etape', 'vente', 'date', ev.d, 'titre', ev.t,
      'detail', s.sale_number)
    FROM sales s
    CROSS JOIN LATERAL (VALUES
      (s.created_at, 'Vente créée'),
      (s.management_approved_at, 'Approuvée par la direction'),
      (s.customer_approved_at, 'Acceptée par le client'),
      (s.completed_at, 'Vente conclue')
    ) AS ev(d, t)
    WHERE s.id = v_sale_id AND ev.d IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('etape', 'vente', 'date', sat.created_at,
      'titre', sat.action,
      'detail', coalesce(sat.change_reason, nullif(concat_ws(' : ', sat.field_changed,
        nullif(concat_ws(' -> ', sat.old_value, sat.new_value), '')), '')),
      'acteur', sat.actor_name)
    FROM sales_audit_trail sat WHERE sat.sale_id = v_sale_id
    UNION ALL
    SELECT jsonb_build_object('etape', 'vente', 'date', vea.created_at,
      'titre', vea.event_type,
      'detail', coalesce(vea.resulting_status, ''),
      'acteur', up.full_name)
    FROM snp_ventes_evenements_audit vea
    LEFT JOIN user_profiles up ON up.id = vea.actor_id
    WHERE vea.sale_id = v_sale_id
    UNION ALL
    -- Evenements poses par colonnes. L'execution et l'annulation ne sont emises
    -- ici que si le journal de workflow n'en porte pas deja la trace.
    SELECT jsonb_build_object('etape', 'paiement', 'date', ev.d, 'titre', ev.t,
      'detail', p.amount || ' ' || coalesce(v_devise_vente, 'USD'),
      'acteur', up.full_name)
    FROM payments p
    LEFT JOIN user_profiles up ON up.id = coalesce(p.executed_by, p.approved_by, p.created_by)
    CROSS JOIN LATERAL (VALUES
      (p.created_at, 'Paiement enregistré', false),
      (p.actual_date::timestamptz, 'Paiement reçu', false),
      (p.approved_at, 'Paiement approuvé', false),
      (p.executed_at, 'Paiement exécuté', true),
      (p.cancelled_at, 'Paiement annulé', true)
    ) AS ev(d, t, journalise)
    WHERE p.sale_id = v_sale_id AND ev.d IS NOT NULL
      AND (NOT ev.journalise OR NOT EXISTS (
        SELECT 1 FROM snp_workflow_audit wa2
        WHERE wa2.aggregate_type = 'international-payment' AND wa2.aggregate_id = p.id))
    UNION ALL
    SELECT jsonb_build_object('etape', 'comptes', 'date', gl.created_at,
      'titre', CASE gl.sens WHEN 'credit' THEN 'Crédit client' ELSE 'Débit client' END
        || ' — ' || gl.type_mouvement,
      'detail', gl.montant || ' (grand livre commercial)')
    FROM snp_grand_livre_commercial gl WHERE gl.sale_id = v_sale_id
    UNION ALL
    SELECT jsonb_build_object('etape', 'comptes', 'date', gf.created_at,
      'titre', upper(gf.code_taxe) || ' ' ||
        CASE gf.sens WHEN 'debit' THEN 'complément dû' ELSE 'trop-perçu' END,
      'detail', gf.montant || ' ' || gf.devise || ' (grand livre fiscal)')
    FROM snp_grand_livre_fiscal gf WHERE gf.sale_id = v_sale_id
    UNION ALL
    SELECT jsonb_build_object('etape', 'comptes', 'date', av.created_at,
      'titre', 'Avoir ' || av.reference || ' — ' || av.statut,
      'detail', av.montant_initial || ' ' || av.devise)
    FROM snp_avoirs_client av WHERE av.sale_id_origine = v_sale_id
  ) evts(e);

  -- -------------------------------------------------------------------------
  -- Le suivi des comptes : avances vs total, ecart de conciliation, taxes.
  -- -------------------------------------------------------------------------
  -- Les avances recues sont celles qui le sont vraiment : executees ou datees.
  -- Les engagements non annules restent visibles, a part. L'ecart de
  -- conciliation n'entre aux comptes qu'une fois la conciliation validee.
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'montant_vente', (SELECT s.total_amount FROM sales s WHERE s.id = v_sale_id),
    'devise', v_devise_vente,
    'avances_recues', (SELECT coalesce(sum(p.amount), 0) FROM payments p
      WHERE p.sale_id = v_sale_id
        AND coalesce(p.status, '') NOT IN ('cancelled', 'rejected', 'failed')
        AND (p.executed_at IS NOT NULL OR p.actual_date IS NOT NULL)),
    'engagements_en_attente', (SELECT coalesce(sum(p.amount), 0) FROM payments p
      WHERE p.sale_id = v_sale_id
        AND coalesce(p.status, '') NOT IN ('cancelled', 'rejected', 'failed')
        AND p.executed_at IS NULL AND p.actual_date IS NULL),
    'ecart_conciliation', (SELECT round(c.ca_final - c.ca_initial, 2)
      FROM snp_conciliations c
      WHERE c.id = v_conciliation_id AND c.ca_final IS NOT NULL
        AND c.statut IN ('validee', 'facture_definitive_generee', 'cloturee')),
    'taxes', (SELECT jsonb_agg(jsonb_build_object(
        'code', t.code_taxe, 'devise', t.devise,
        'complement_du', t.debits, 'trop_percu', t.credits,
        'net', coalesce(t.debits, 0) - coalesce(t.credits, 0)))
      FROM (SELECT gf.code_taxe, gf.devise,
              sum(gf.montant) FILTER (WHERE gf.sens = 'debit') AS debits,
              sum(gf.montant) FILTER (WHERE gf.sens = 'credit') AS credits
            FROM snp_grand_livre_fiscal gf
            WHERE gf.sale_id = v_sale_id GROUP BY gf.code_taxe, gf.devise) t),
    'avoirs', (SELECT jsonb_agg(jsonb_build_object(
        'reference', av.reference, 'montant', av.montant_initial,
        'devise', av.devise, 'statut', av.statut))
      FROM snp_avoirs_client av WHERE av.sale_id_origine = v_sale_id)
  )) INTO v_comptes;

  RETURN jsonb_build_object(
    'ancre', jsonb_build_object('type', p_type, 'id', p_id),
    'chaine', coalesce(v_chaine, '{}'::jsonb),
    'documents', v_documents,
    'chronologie', v_chronologie,
    'comptes', coalesce(v_comptes, '{}'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.snp_dossier_complet(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snp_dossier_complet(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.snp_dossier_complet(text, uuid) TO authenticated;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'snp_dossier_complet';

  IF v_def NOT LIKE '%FOR v_i IN 1..4%' THEN
    RAISE EXCEPTION 'Postflight : la resolution doit compter quatre passes.';
  END IF;
  IF v_def NOT LIKE '%engagements_en_attente%' THEN
    RAISE EXCEPTION 'Postflight : les engagements ne sont pas distingues des avances.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgname = 'snp_conciliation_pose_expedition_trg' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Postflight : l''ecrivain du lien vente-expedition est absent.';
  END IF;
END;
$$;

COMMIT;
