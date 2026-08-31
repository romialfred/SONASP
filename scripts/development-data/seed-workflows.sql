CREATE TEMP TABLE seed_documents(bucket text, path text, title text, reference text, business_date date, payload jsonb) ON COMMIT DROP;
DO $workflows$
DECLARE
  tag constant text:='TEST3Y-20260830';
  mon record; m integer; channel integer; k integer; d date; p numeric; fx numeric; ref text;
  raw_g numeric; purity numeric; fine_g numeric; oz numeric; measured_g numeric; measured_purity numeric;
  final_fine numeric; fixing numeric; amount numeric; taxable numeric; tax_amount numeric;
  mine uuid; shipping uuid; sale uuid; allocation uuid; conciliation uuid; sonasp uuid;
  actor uuid:=pg_temp.seed_id('actor',1); result jsonb; r public.snp_regles_fiscales%ROWTYPE;
  code text; tax_no integer; end_date date; path text; target text; stage integer;
BEGIN
  IF EXISTS(SELECT 1 FROM seed_results WHERE section='already_present') THEN RETURN; END IF;
  IF to_regprocedure('public.snp_conciliation_impacts_fiscaux(uuid,numeric,numeric,numeric,date)') IS NULL
     OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='inventory_transactions_one_entry_uidx') THEN
    RAISE EXCEPTION 'Conciliation evidence/fiscal and single-entry inventory corrections must be deployed before this chapter.';
  END IF;
  PERFORM pg_temp.seed_actor(1);
  SELECT company.id INTO sonasp FROM mining_companies company WHERE upper(company.code)='SONASP';
  -- Historical demonstration rules fill uncovered dates only, never change an existing rule.
  tax_no:=0;
  FOREACH code IN ARRAY ARRAY['tva','royalties','fndl'] LOOP
    tax_no:=tax_no+1;
    SELECT min(date_effet) INTO end_date FROM snp_regles_fiscales WHERE code_taxe=code AND statut='approuvee' AND profil_vendeur='tous';
    IF end_date IS NULL OR end_date>date '2023-09-01' THEN
      PERFORM pg_temp.seed_put('snp_regles_fiscales','tax-rule',tax_no,jsonb_build_object('code_taxe',code,
        'libelle','TEST - Barème historique '||code,'assiette','ca_ht','mode_calcul','taux',
        'taux',CASE code WHEN 'tva' THEN 0 WHEN 'royalties' THEN 0.03 ELSE 0.01 END,
        'date_effet','2023-09-01','date_fin',coalesce(end_date,date '2026-09-01'),'statut','approuvee',
        'cree_par',actor,'approuve_par',pg_temp.seed_id('actor',2),'approuve_le',now(),
        'reference_reglementaire','TEST - Sans valeur réglementaire','commentaire',tag||' - Scénario fictif, pas un barème officiel.'));
    END IF;
  END LOOP;
  FOR mon IN SELECT * FROM seed_months ORDER BY month_no LOOP
    m:=mon.month_no; d:=mon.business_date; p:=mon.gold_usd; fx:=mon.usd_xof;
    FOR channel IN 1..2 LOOP
      PERFORM pg_temp.seed_actor(1);
      k:=m*3+channel; mine:=pg_temp.seed_id('mine',channel); shipping:=pg_temp.seed_id('shipping',k);
      ref:='TEST3Y-'||to_char(d,'YYYYMM')||'-'||channel;
      SELECT bullion_grams,estimated_fineness_pct,pure_gold_grams INTO raw_g,purity,fine_g FROM daily_production WHERE id=pg_temp.seed_id('production',k);
      SELECT quantite_oz INTO oz FROM snp_achats_mines WHERE id=pg_temp.seed_id('purchase',k);
      measured_g:=raw_g-5-(m%4);
      measured_purity:=purity+CASE m%3 WHEN 0 THEN -0.15 WHEN 1 THEN 0 ELSE 0.1 END;
      final_fine:=round(measured_g*measured_purity/100,4);
      fixing:=p+CASE m%3 WHEN 0 THEN -5 WHEN 1 THEN 0 ELSE 8 END;
      PERFORM pg_temp.seed_put('shipping_preparations','shipping',k,jsonb_build_object(
        'daily_production_id',pg_temp.seed_id('production',k),'expedition_lot_number',ref||'-EXP',
        'mining_company_id',mine,'refinery_id',pg_temp.seed_id('refinery',channel),
        'shipped_to_company','TEST - Raffinerie pédagogique '||channel,'shipped_to_country','Burkina Faso',
        'prepared_at',(d+5)::timestamptz,'shipped_at',(d+6)::timestamptz,'total_net_weight_grams',raw_g,
        'total_gross_weight_grams',raw_g+250,'total_weight_oz',fine_g/31.1034768,'total_boxes',1,
        'status','ready_for_expedition','notes',tag,'created_by',actor));
      PERFORM pg_temp.seed_put('shipping_production_items','shipping-item',k,jsonb_build_object(
        'shipping_preparation_id',shipping,'daily_production_id',pg_temp.seed_id('production',k),
        'ingot_box_number',ref,'net_weight_grams',raw_g,'gross_weight_grams',raw_g+250,
        'fineness_pct',purity,'pure_gold_grams',fine_g,'seal_number_1','TEST-SEAL-'||k));
      PERFORM pg_temp.seed_put('freight_shipments','freight',k,jsonb_build_object('reference_number',ref||'-FRET',
        'shipment_date',(d+6)::timestamptz,'destination_refinery_id',pg_temp.seed_id('refinery',channel),
        'gold_price_usd_per_oz',p,'exchange_rate',fx,'total_bullion_grams',raw_g,'total_pure_gold_grams',fine_g,
        'total_pure_gold_oz',fine_g/31.1034768,'total_value_usd',round(oz*p,2),'total_value_local',round(oz*p*fx,2),
        'production_count',1,'status',CASE WHEN channel=2 THEN 'in_stock' ELSE 'received_at_refinery' END,
        'shipped_at',(d+6)::timestamptz,'received_at',(d+8)::timestamptz,'received_by',pg_temp.seed_id('actor',5),
        'mining_company_id',mine,'shipping_preparation_id',shipping,'expedition_number',ref||'-EXP','notes',tag,'created_by',actor));
      PERFORM pg_temp.seed_put('freight_shipment_productions','freight-item',k,jsonb_build_object(
        'freight_shipment_id',pg_temp.seed_id('freight',k),'production_id',pg_temp.seed_id('production',k),
        'production_date',(d+2)::timestamptz,'bar_reference',ref,'bullion_grams',raw_g,'estimated_fineness_pct',purity,
        'pure_gold_grams',fine_g,'pure_gold_oz',fine_g/31.1034768,'added_by',actor));
      PERFORM pg_temp.seed_put('snp_analyses_teneur','mine-assay',k,jsonb_build_object('reference',ref||'-MINE',
        'mining_company_id',mine,'achat_id',pg_temp.seed_id('purchase',k),'shipping_preparation_id',shipping,
        'numero_echantillon','TEST-SAMPLE-'||k,'date_prelevement',d+3,'masse_echantillon_g',10,
        'masse_lot_oz',raw_g/31.1034768,'methode_echantillonnage','Scénario de test - prélèvement composite',
        'teneur_declaree_pct',purity,'declaree_par','TEST - Laboratoire mine','date_declaration',d+3,
        'teneur_retenue_pct',purity,'statut','analysee','observations',tag,'created_by',actor));
      PERFORM pg_temp.seed_put('snp_analyses_resultats','mine-assay-result',k,jsonb_build_object(
        'analyse_id',pg_temp.seed_id('mine-assay',k),'rang',1,'origine','analyse_initiale',
        'laboratoire','TEST - Laboratoire mine','teneur_pct',purity,'argent_pct',2,
        'certificat_reference',ref||'-MINE','date_analyse',d+3,'observations',tag,'enregistre_par',actor));
      path:=shipping::text||'/test3y-20260830-analyse.pdf';
      INSERT INTO seed_documents VALUES('assay-certificates',path,'Analyse de raffinerie - TEST',ref||'-CERT',d+9,
        jsonb_build_object('poids_total_g',measured_g,'teneur_pct',measured_purity,'or_fin_g',final_fine,'expedition',ref||'-EXP'));
      PERFORM pg_temp.seed_put('assay_certificates','certificate',k,jsonb_build_object('certificate_number',ref||'-CERT',
        'certificate_date',d+9,'issuing_laboratory','TEST - Laboratoire de raffinerie',
        'file_path',path,'file_name','test3y-20260830-analyse.pdf','mime_type','application/pdf',
        'shipping_preparation_id',shipping,'parsing_status','completed','approval_status','approved',
        'approval_notes',tag||' - Pièce synthétique de recette, sans valeur officielle.',
        'approved_by',pg_temp.seed_id('actor',2),'approved_at',now(),'uploaded_by',actor,
        'purity_percent',measured_purity,'gold_content_percent',measured_purity,'sample_weight_grams',10));
      PERFORM pg_temp.seed_put('assay_certificate_data','certificate-data',k,jsonb_build_object(
        'certificate_id',pg_temp.seed_id('certificate',k),'shipping_preparation_id',shipping,
        'certificate_number',ref||'-CERT','certificate_date',d+9,'total_weight_g',measured_g,
        'gold_purity_percentage',measured_purity,'sample_weight_g',10,'is_verified',true,
        'verification_notes',tag||' - Mesures de scénario, aucun laboratoire réel.'));
      UPDATE assay_certificates SET parsing_status='completed',parsed_at=now()
        WHERE id=pg_temp.seed_id('certificate',k);
      PERFORM pg_temp.seed_actor(2);
      UPDATE assay_certificates SET approval_status='approved',
        approval_notes=tag||' - Contrôle du scénario synthétique, sans valeur officielle.'
        WHERE id=pg_temp.seed_id('certificate',k);
      PERFORM pg_temp.seed_actor(1);
      IF channel=1 THEN
        sale:=pg_temp.seed_id('export-sale',m); amount:=round(oz*p,2);
        PERFORM pg_temp.seed_put('sales','export-sale',m,jsonb_build_object('sale_number',ref||'-VENTE',
          'customer_id',pg_temp.seed_id('customer',1+m%2),'seller_type','sonasp','seller_id',sonasp,
          'sale_date',d+7,'shipping_preparation_id',shipping,'quantity_oz',oz,'london_am_rate',p,
          'final_price_per_oz',fixing,'spot_value_date',d+10,'pricing_mechanism','spot','mechanism_type','spot',
          'gross_proceeds',amount,'net_proceeds',amount,'royalty_amount',0,'final_proceeds',amount,'total_amount',amount,
          'status','waiting_for_payment','currency','USD','internal_notes',tag,'created_by',actor,
          'metadata',jsonb_build_object('development_fixture',tag,'historical_import',true)));
        PERFORM pg_temp.seed_put('sales_line_items','export-line',m,jsonb_build_object('sale_id',sale,'line_number',1,
          'quantity_grams',raw_g,'quantity_oz',raw_g/31.1034768,'fine_weight_oz',oz,'fineness_percentage',purity,
          'unit_price',p,'line_total',amount,'notes',tag));
        PERFORM pg_temp.seed_put('snp_ventes_lots','export-lot',m,jsonb_build_object('sale_id',sale,'source_type','achat_mine',
          'achat_mine_id',pg_temp.seed_id('purchase',k),'quantite_oz',oz,'created_by',actor));
        -- Do not invent a bank execution or bypass the customer-confirmation RPC.
        -- The historical sale remains unpaid; no artificial payment row is inserted.
        tax_no:=0;
        FOREACH code IN ARRAY ARRAY['tva','royalties','fndl','retenue_source','taxe_communale'] LOOP
          tax_no:=tax_no+1;
          SELECT * INTO r FROM snp_resoudre_regle_fiscale(code,d+7,p,'standard','tous');
          IF r.id IS NOT NULL THEN
            taxable:=CASE r.assiette WHEN 'quantite_or_fin' THEN oz*31.1034768 ELSE amount END;
            tax_amount:=CASE r.mode_calcul WHEN 'exoneration' THEN 0 WHEN 'forfait' THEN r.montant_forfaitaire ELSE round(taxable*r.taux,2) END;
            PERFORM pg_temp.seed_put('snp_calculs_fiscaux','initial-tax',m*5+tax_no,jsonb_build_object('regle_id',r.id,
              'code_taxe',code,'assiette_retenue',r.assiette,'montant_assiette',taxable,'taux_applique',r.taux,
              'formule',tag||' - Base fiscale initiale du scénario','montant_obtenu',tax_amount,'devise','USD',
              'contexte_type','vente','contexte_id',sale,'mining_company_id',sonasp,'calcule_par',actor,'regle_provisoire',true));
          END IF;
        END LOOP;
        result:=snp_conciliation_ouvrir(sale,pg_temp.seed_id('conciliation-open',m));
        conciliation:=(result->>'id')::uuid;
        UPDATE snp_conciliations SET observations=tag||' - '||ref,poids_initial_g=raw_g,
          teneur_initiale_pct=round(oz*31.1034768/raw_g*100,4) WHERE id=conciliation;
        IF m%3<>0 THEN
          PERFORM snp_conciliation_enregistrer_analyse(conciliation,'certificat_acheteur',pg_temp.seed_id('certificate',k),
            measured_g,measured_purity,fixing,d+10,pg_temp.seed_id('conciliation-analysis',m));
        END IF;
        IF m%3=2 THEN
          PERFORM pg_temp.seed_actor(2);
          PERFORM snp_conciliation_valider(conciliation,pg_temp.seed_id('conciliation-validate',m));
        END IF;
      ELSE
        -- This is a DIFFERENT production lot from the export sale: gold cannot be sold and reserved twice.
        PERFORM pg_temp.seed_put('refining_records','refining',m,jsonb_build_object('pre_melting_weight_grams',raw_g,
          'post_melting_weight_grams',final_fine/0.9999,'fineness_percentage',99.99,'metal_retained_percentage',100,
          'final_fine_grams',final_fine,'final_fine_ounces',final_fine/31.1034768,
          'processing_notes',tag,'processed_at',(d+11)::timestamptz,'processed_by',actor,'approved_by',pg_temp.seed_id('actor',2),'approved_at',now()));
        PERFORM pg_temp.seed_put('gold_inventory','inventory',m,jsonb_build_object('entry_date',d+12,
          'refining_record_id',pg_temp.seed_id('refining',m),'freight_shipment_id',pg_temp.seed_id('freight',k),
          'mining_company_id',mine,'refinery_id',pg_temp.seed_id('refinery',2),
          'weight_before_melting_grams',raw_g,'weight_after_melting_grams',final_fine/0.9999,
          'fineness_percentage',99.99,'metal_retained_percentage',100,'final_fine_grams',final_fine,
          'final_fine_oz',final_fine/31.1034768,'quantity_available_oz',final_fine/31.1034768,
          'transaction_type','entry','certificate_number',ref||'-CERT','notes',tag,'created_by',actor));
        IF m<34 THEN
          allocation:=pg_temp.seed_id('reserve',m);
          PERFORM pg_temp.seed_put('reserve_allocations','reserve',m,jsonb_build_object('reference',ref||'-RES','created_by',actor));
          PERFORM snp_save_reserve_allocation(allocation,jsonb_build_object('allocation_date',d+15,
            'reason',tag||' - Constitution de réserve fictive','allocation_nature','CONSTITUTION_RESERVE',
            'decision_reference',ref||'-DEC','decision_date',d+13,'decision_authority','TEST - Autorité fictive',
            'decision_comment',tag,'depository_organization_id',pg_temp.seed_id('depository',1+m%2),
            'deposit_type','reserve_vault','planned_transfer_date',d+17,'planned_deposit_reference',ref||'-DEPOT',
            'control_results',jsonb_build_object('purity',true,'weight',true,'certificates',true,'eligibility',true,'sale_conflict',true,'availability',true)),
            ARRAY[pg_temp.seed_id('inventory',m)]);
          UPDATE reserve_allocations SET valuation_source='TEST3Y - Valorisation indicative de recette' WHERE id=allocation;
          path:=allocation::text||'/format-validated/2026/08/test3y-20260830-decision.pdf';
          INSERT INTO seed_documents VALUES('reserve-documents',path,'Décision d’affectation - TEST',ref||'-DEC',d+13,
            jsonb_build_object('affectation',ref||'-RES','poids_fin_g',final_fine,'lot',ref||'-CERT'));
          PERFORM snp_register_reserve_document_gateway(allocation,'decision_allocation','test3y-20260830-decision.pdf',path,'application/pdf',1024,actor);
          FOR stage IN 1..CASE WHEN m<27 THEN 10 ELSE (m-27) END LOOP
            target:=(ARRAY['SUBMITTED','UNDER_REVIEW','VALIDATED_LEVEL_1','VALIDATED_LEVEL_2','TRANSFER_AUTHORIZED',
              'IN_TRANSIT','RECEIVED','RECONCILIATION_PENDING','RECONCILED','ACTIVE'])[stage];
            PERFORM pg_temp.seed_actor((ARRAY[1,2,2,3,4,4,5,5,6,7])[stage]);
            PERFORM snp_transition_reserve_allocation(allocation,target,tag||' - Transition de recette ; date métier '||(d+15));
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  INSERT INTO seed_results VALUES('workflows',36,jsonb_build_object('shipments',72,'assays',72,'conciliations',36,'inventory',36,'reserve_allocations',34));
END $workflows$;
