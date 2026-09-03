CREATE TEMP TABLE seed_documents(bucket text, path text, title text, reference text, business_date date, payload jsonb) ON COMMIT DROP;
DO $workflows$
DECLARE
  tag constant text:='HIST-2024-2026';
  mon record; legacy_sale record; source_stock record;
  m integer; channel integer; k integer; d date; p numeric; fx numeric; ref text;
  raw_g numeric; purity numeric; fine_g numeric; oz numeric; measured_g numeric; measured_purity numeric;
  final_fine numeric; fixing numeric; amount numeric; taxable numeric; tax_amount numeric;
  remaining numeric; take_oz numeric;
  mine uuid; shipping uuid; sale uuid; allocation uuid; conciliation uuid; sonasp uuid; payment uuid;
  actor uuid:=pg_temp.seed_id('actor',1); result jsonb; r public.snp_regles_fiscales%ROWTYPE;
  code text; tax_no integer; end_date date; path text; target text; stage integer;
  legacy_no integer:=0; lot_no integer;
  repaired_sales uuid[]:=ARRAY[]::uuid[];
BEGIN
  IF EXISTS(SELECT 1 FROM seed_results WHERE section='already_present') THEN RETURN; END IF;
  IF to_regprocedure('public.snp_conciliation_impacts_fiscaux(uuid,numeric,numeric,numeric,date)') IS NULL
     OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='inventory_transactions_one_entry_uidx') THEN
    RAISE EXCEPTION 'Conciliation evidence/fiscal and single-entry inventory corrections must be deployed before this chapter.';
  END IF;
  PERFORM pg_temp.seed_actor(1);
  SELECT company.id INTO sonasp FROM mining_companies company WHERE upper(company.code)='SONASP';
  -- Historical scenario rules fill uncovered dates only, never change an existing rule.
  tax_no:=0;
  FOREACH code IN ARRAY ARRAY['tva','royalties','fndl'] LOOP
    tax_no:=tax_no+1;
    SELECT min(date_effet) INTO end_date FROM snp_regles_fiscales WHERE code_taxe=code AND statut='approuvee' AND profil_vendeur='tous';
    IF end_date IS NULL OR end_date>date '2024-01-01' THEN
      PERFORM pg_temp.seed_put('snp_regles_fiscales','tax-rule',tax_no,jsonb_build_object('code_taxe',code,
        'libelle','Barème historique synthétique '||upper(code),'assiette','ca_ht','mode_calcul','taux',
        'taux',CASE code WHEN 'tva' THEN 0 WHEN 'royalties' THEN 0.03 ELSE 0.01 END,
        'date_effet','2024-01-01','date_fin',coalesce(end_date,date '2026-09-04'),'statut','approuvee',
        'cree_par',actor,'approuve_par',pg_temp.seed_id('actor',2),'approuve_le',now(),
        'reference_reglementaire','SCN-FISC-'||upper(code)||'-2024','commentaire',tag||' - Scénario synthétique, sans valeur réglementaire.'));
    END IF;
  END LOOP;

  -- Reconstitute a complete physical chain for the historical export-sale gaps
  -- already registered by the platform.  The guard remains enabled: each gap
  -- is resolved only after purchase, production, shipment, refining and stock
  -- provenance are all present and quantitatively sufficient.
  FOR mon IN SELECT * FROM seed_months ORDER BY month_no LOOP
    m:=mon.month_no; d:=mon.business_date; p:=mon.gold_usd; fx:=mon.usd_xof;
    channel:=3; k:=m*3+channel; mine:=pg_temp.seed_id('mine',channel);
    shipping:=pg_temp.seed_id('shipping',k);
    ref:='OP-'||to_char(d,'YYYYMM')||'-03';
    SELECT bullion_grams,estimated_fineness_pct,pure_gold_grams
      INTO raw_g,purity,fine_g FROM daily_production WHERE id=pg_temp.seed_id('production',k);
    SELECT quantite_oz INTO oz FROM snp_achats_mines WHERE id=pg_temp.seed_id('purchase',k);
    oz:=round(oz::numeric,4); final_fine:=(oz+0.000001)*31.1034768;
    PERFORM pg_temp.seed_put('shipping_preparations','shipping',k,jsonb_build_object(
      'daily_production_id',pg_temp.seed_id('production',k),'expedition_lot_number',ref||'-EXP',
      'mining_company_id',mine,'refinery_id',pg_temp.seed_id('refinery',1),
      'shipped_to_company','Raffinerie Aurifère du Sahel','shipped_to_country','Burkina Faso',
      'prepared_at',(d+5)::timestamptz,'shipped_at',(d+6)::timestamptz,
      'total_net_weight_grams',raw_g,'total_gross_weight_grams',raw_g+250,
      'total_weight_oz',oz,'total_boxes',1,'status','waiting_for_customs_approval',
      'notes',tag||' - Chaîne physique de régularisation historique.','created_by',actor));
    PERFORM pg_temp.seed_put('shipping_production_items','shipping-item',k,jsonb_build_object(
      'shipping_preparation_id',shipping,'daily_production_id',pg_temp.seed_id('production',k),
      'ingot_box_number',ref,'net_weight_grams',raw_g,'gross_weight_grams',raw_g+250,
      'fineness_pct',purity,'pure_gold_grams',fine_g,'seal_number_1','SC-'||to_char(d,'YYYYMM')||'-'||lpad(k::text,4,'0')));
    PERFORM pg_temp.seed_actor(2);
    PERFORM snp_transition_shipping_preparation(shipping,'waiting_for_customs_approval','approved_by_customs');
    PERFORM pg_temp.seed_actor(1);
    PERFORM snp_transition_shipping_preparation(shipping,'approved_by_customs','ready_for_expedition');
    PERFORM pg_temp.seed_put('freight_shipments','freight',k,jsonb_build_object(
      'reference_number',ref||'-FRET','shipment_date',(d+6)::timestamptz,
      'destination_refinery_id',pg_temp.seed_id('refinery',1),'gold_price_usd_per_oz',p,'exchange_rate',fx,
      'total_bullion_grams',raw_g,'total_pure_gold_grams',final_fine,'total_pure_gold_oz',oz,
      'total_value_usd',round(oz*p,2),'total_value_local',round(oz*p*fx,2),'production_count',1,
      'status','pending','mining_company_id',mine,'shipping_preparation_id',shipping,
      'expedition_number',ref||'-EXP','notes',tag||' - Traçabilité physique historique.','created_by',actor));
    PERFORM pg_temp.seed_put('freight_shipment_productions','freight-item',k,jsonb_build_object(
      'freight_shipment_id',pg_temp.seed_id('freight',k),'production_id',pg_temp.seed_id('production',k),
      'production_date',(d+2)::timestamptz,'bar_reference',ref,'bullion_grams',raw_g,
      'estimated_fineness_pct',purity,'pure_gold_grams',final_fine,'pure_gold_oz',oz,'added_by',actor));
    PERFORM pg_temp.seed_actor(2);
    PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'pending','approved',
      pg_temp.seed_id('freight-transition',k*10+1),tag||' - Autorisation douanière historique.');
    PERFORM pg_temp.seed_actor(1);
    PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'approved','shipped_to_refinery',
      pg_temp.seed_id('freight-transition',k*10+2),tag||' - Départ vers la raffinerie.');
    PERFORM pg_temp.seed_actor(5);
    PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'shipped_to_refinery','received_at_refinery',
      pg_temp.seed_id('freight-transition',k*10+3),tag||' - Réception à la raffinerie.');
    PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'received_at_refinery','processing',
      pg_temp.seed_id('freight-transition',k*10+4),tag||' - Traitement en raffinerie.');
    PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'processing','processed',
      pg_temp.seed_id('freight-transition',k*10+5),tag||' - Traitement terminé.');
    PERFORM pg_temp.seed_actor(1);
    PERFORM pg_temp.seed_put('refining_records','refining',k,jsonb_build_object(
      'pre_melting_weight_grams',raw_g,'post_melting_weight_grams',final_fine/0.9999,
      'fineness_percentage',99.99,'metal_retained_percentage',100,'final_fine_grams',final_fine,
      'final_fine_ounces',oz,'processing_notes',tag||' - Raffinage de traçabilité historique.',
      'processed_at',(d+11)::timestamptz,'processed_by',actor,
      'approved_by',pg_temp.seed_id('actor',2),'approved_at',now()));
    PERFORM pg_temp.seed_put('gold_inventory','inventory',k,jsonb_build_object(
      'entry_date',d+12,'refining_record_id',pg_temp.seed_id('refining',k),
      'freight_shipment_id',pg_temp.seed_id('freight',k),'mining_company_id',mine,
      'refinery_id',pg_temp.seed_id('refinery',1),'weight_before_melting_grams',raw_g,
      'weight_after_melting_grams',final_fine/0.9999,'fineness_percentage',99.99,
      'metal_retained_percentage',100,'final_fine_grams',final_fine,'final_fine_oz',oz,
      'quantity_available_oz',0,'transaction_type','entry','certificate_number',ref||'-CERT',
      'notes',tag||' - Stock physique rapprochable.','created_by',actor));
    UPDATE gold_inventory SET quantity_available_oz=final_fine_oz
      WHERE id=pg_temp.seed_id('inventory',k);
    UPDATE freight_shipments SET status='in_stock'
      WHERE id=pg_temp.seed_id('freight',k) AND status='processed';
  END LOOP;

  FOR legacy_sale IN
    SELECT gap.sale_id,sale.sale_number,sale.quantity_oz,sale.status::text AS sale_status
    FROM snp_export_sale_physical_backing_gaps gap
    JOIN sales sale ON sale.id=gap.sale_id
    WHERE gap.resolution='blocked'
    ORDER BY sale.sale_number,sale.id
  LOOP
    legacy_no:=legacy_no+1; lot_no:=0; remaining:=legacy_sale.quantity_oz;
    FOR source_stock IN
      SELECT least(
        inventory.quantity_available_oz,
        allocation.quantite_oz-coalesce((
          SELECT sum(lot.quantite_oz) FROM snp_ventes_lots lot
          WHERE lot.achat_mine_id=allocation.achat_id AND lot.released_at IS NULL
        ),0)
      ) AS available_oz,allocation.achat_id
      FROM gold_inventory inventory
      JOIN freight_shipments freight ON freight.id=inventory.freight_shipment_id AND freight.status='in_stock'
      JOIN freight_shipment_productions shipped ON shipped.freight_shipment_id=freight.id
      JOIN snp_achats_productions allocation ON allocation.production_id=shipped.production_id
      JOIN daily_production production ON production.id=allocation.production_id
      WHERE inventory.id::text LIKE 'd8302026-%'
        AND production.mining_company_id=pg_temp.seed_id('mine',3)
        AND inventory.quantity_available_oz>0.000001
      ORDER BY production.production_date,inventory.id
    LOOP
      take_oz:=floor(least(remaining,source_stock.available_oz)*10000)/10000;
      CONTINUE WHEN take_oz<=0.000001;
      lot_no:=lot_no+1;
      PERFORM pg_temp.seed_put('snp_ventes_lots','legacy-export-lot',legacy_no*100+lot_no,jsonb_build_object(
        'sale_id',legacy_sale.sale_id,'source_type','achat_mine','achat_mine_id',source_stock.achat_id,
        'quantite_oz',take_oz,'created_by',actor));
      remaining:=remaining-take_oz;
      EXIT WHEN remaining<=0.000001;
    END LOOP;
    IF remaining>0.000001 THEN
      RAISE EXCEPTION 'Stock physique insuffisant pour rapprocher % : manque % oz.',legacy_sale.sale_number,remaining;
    END IF;
    PERFORM snp_ensure_export_sale_physical_backing(legacy_sale.sale_id);
    repaired_sales:=array_append(repaired_sales,legacy_sale.sale_id);
  END LOOP;
  FOREACH sale IN ARRAY repaired_sales LOOP
    SELECT status::text INTO target FROM sales WHERE id=sale;
    IF target IN ('payment_received','completed','sold','paid') THEN
      PERFORM snp_mark_export_sale_physical_backing_sold(sale);
    END IF;
  END LOOP;
  FOR mon IN SELECT * FROM seed_months ORDER BY month_no LOOP
    m:=mon.month_no; d:=mon.business_date; p:=mon.gold_usd; fx:=mon.usd_xof;
    FOR channel IN 1..2 LOOP
      PERFORM pg_temp.seed_actor(1);
      k:=m*3+channel; mine:=pg_temp.seed_id('mine',channel); shipping:=pg_temp.seed_id('shipping',k);
      ref:='OP-'||to_char(d,'YYYYMM')||'-'||lpad(channel::text,2,'0');
      SELECT bullion_grams,estimated_fineness_pct,pure_gold_grams INTO raw_g,purity,fine_g FROM daily_production WHERE id=pg_temp.seed_id('production',k);
      SELECT quantite_oz INTO oz FROM snp_achats_mines WHERE id=pg_temp.seed_id('purchase',k);
      measured_g:=raw_g-5-(m%4);
      measured_purity:=purity+CASE m%3 WHEN 0 THEN -0.15 WHEN 1 THEN 0 ELSE 0.1 END;
      final_fine:=round(measured_g*measured_purity/100,4);
      fixing:=p+CASE m%3 WHEN 0 THEN -5 WHEN 1 THEN 0 ELSE 8 END;
      PERFORM pg_temp.seed_put('shipping_preparations','shipping',k,jsonb_build_object(
        'daily_production_id',pg_temp.seed_id('production',k),'expedition_lot_number',ref||'-EXP',
        'mining_company_id',mine,'refinery_id',pg_temp.seed_id('refinery',channel),
        'shipped_to_company',(ARRAY['Raffinerie Aurifère du Sahel','Raffinerie Métaux Précieux Atlantique'])[channel],
        'shipped_to_country',(ARRAY['Burkina Faso','Côte d''Ivoire'])[channel],
        'prepared_at',(d+5)::timestamptz,'shipped_at',(d+6)::timestamptz,'total_net_weight_grams',raw_g,
        'total_gross_weight_grams',raw_g+250,'total_weight_oz',fine_g/31.1034768,'total_boxes',1,
        'status','waiting_for_customs_approval','notes',tag,'created_by',actor));
      PERFORM pg_temp.seed_put('shipping_production_items','shipping-item',k,jsonb_build_object(
        'shipping_preparation_id',shipping,'daily_production_id',pg_temp.seed_id('production',k),
        'ingot_box_number',ref,'net_weight_grams',raw_g,'gross_weight_grams',raw_g+250,
        'fineness_pct',purity,'pure_gold_grams',fine_g,'seal_number_1','SC-'||to_char(d,'YYYYMM')||'-'||lpad(k::text,4,'0')));
      PERFORM pg_temp.seed_actor(2);
      PERFORM snp_transition_shipping_preparation(
        shipping,'waiting_for_customs_approval','approved_by_customs');
      PERFORM pg_temp.seed_actor(1);
      PERFORM snp_transition_shipping_preparation(
        shipping,'approved_by_customs','ready_for_expedition');
      PERFORM pg_temp.seed_put('freight_shipments','freight',k,jsonb_build_object('reference_number',ref||'-FRET',
        'shipment_date',(d+6)::timestamptz,'destination_refinery_id',pg_temp.seed_id('refinery',channel),
        'gold_price_usd_per_oz',p,'exchange_rate',fx,'total_bullion_grams',raw_g,'total_pure_gold_grams',fine_g,
        'total_pure_gold_oz',fine_g/31.1034768,'total_value_usd',round(oz*p,2),'total_value_local',round(oz*p*fx,2),
        'production_count',1,'status','pending',
        'mining_company_id',mine,'shipping_preparation_id',shipping,'expedition_number',ref||'-EXP','notes',tag,'created_by',actor));
      PERFORM pg_temp.seed_put('freight_shipment_productions','freight-item',k,jsonb_build_object(
        'freight_shipment_id',pg_temp.seed_id('freight',k),'production_id',pg_temp.seed_id('production',k),
        'production_date',(d+2)::timestamptz,'bar_reference',ref,'bullion_grams',raw_g,'estimated_fineness_pct',purity,
        'pure_gold_grams',fine_g,'pure_gold_oz',fine_g/31.1034768,'added_by',actor));
      PERFORM pg_temp.seed_actor(2);
      PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'pending','approved',
        pg_temp.seed_id('freight-transition',k*10+1),tag||' - Autorisation douanière historique.');
      PERFORM pg_temp.seed_actor(1);
      PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'approved','shipped_to_refinery',
        pg_temp.seed_id('freight-transition',k*10+2),tag||' - Départ vers la raffinerie.');
      PERFORM pg_temp.seed_actor(5);
      PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'shipped_to_refinery','received_at_refinery',
        pg_temp.seed_id('freight-transition',k*10+3),tag||' - Réception à la raffinerie.');
      PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'received_at_refinery','processing',
        pg_temp.seed_id('freight-transition',k*10+4),tag||' - Traitement en raffinerie.');
      PERFORM snp_transition_freight_shipment(pg_temp.seed_id('freight',k),'processing','processed',
        pg_temp.seed_id('freight-transition',k*10+5),tag||' - Traitement terminé.');
      PERFORM pg_temp.seed_actor(1);
      PERFORM pg_temp.seed_put('snp_analyses_teneur','mine-assay',k,jsonb_build_object('reference',ref||'-MINE',
        'mining_company_id',mine,'achat_id',pg_temp.seed_id('purchase',k),'shipping_preparation_id',shipping,
        'numero_echantillon','ECH-'||to_char(d,'YYYYMM')||'-'||lpad(k::text,4,'0'),'date_prelevement',d+3,'masse_echantillon_g',10,
        'masse_lot_oz',raw_g/31.1034768,'methode_echantillonnage','Prélèvement composite selon protocole interne',
        'teneur_declaree_pct',purity,'declaree_par','Laboratoire de la mine','date_declaration',d+3,
        'teneur_retenue_pct',purity,'statut','analysee','observations',tag,'created_by',actor));
      PERFORM pg_temp.seed_put('snp_analyses_resultats','mine-assay-result',k,jsonb_build_object(
        'analyse_id',pg_temp.seed_id('mine-assay',k),'rang',1,'origine','analyse_initiale',
        'laboratoire','Laboratoire de la mine','teneur_pct',purity,'argent_pct',2,
        'certificat_reference',ref||'-MINE','date_analyse',d+3,'observations',tag,'enregistre_par',actor));
      path:=shipping::text||'/historique-2024-2026-analyse.pdf';
      INSERT INTO seed_documents VALUES('assay-certificates',path,'Analyse de raffinerie',ref||'-CERT',d+9,
        jsonb_build_object('poids_total_g',measured_g,'teneur_pct',measured_purity,'or_fin_g',final_fine,'expedition',ref||'-EXP'));
      PERFORM pg_temp.seed_put('assay_certificates','certificate',k,jsonb_build_object('certificate_number',ref||'-CERT',
        'certificate_date',d+9,'issuing_laboratory','Laboratoire de la raffinerie',
        'file_path',path,'file_name','analyse-raffinerie.pdf','mime_type','application/pdf',
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
      PERFORM pg_temp.seed_put('refining_records','refining',k,jsonb_build_object(
        'pre_melting_weight_grams',raw_g,'post_melting_weight_grams',((round(oz::numeric,4)+0.000001)*31.1034768)/0.9999,
        'fineness_percentage',99.99,'metal_retained_percentage',100,
        'final_fine_grams',(round(oz::numeric,4)+0.000001)*31.1034768,
        'final_fine_ounces',round(oz::numeric,4)+0.000001,
        'processing_notes',tag||' - Raffinage historique synthétique.',
        'processed_at',(d+11)::timestamptz,'processed_by',actor,
        'approved_by',pg_temp.seed_id('actor',2),'approved_at',now()));
      PERFORM pg_temp.seed_put('gold_inventory','inventory',k,jsonb_build_object(
        'entry_date',d+12,'refining_record_id',pg_temp.seed_id('refining',k),
        'freight_shipment_id',pg_temp.seed_id('freight',k),'mining_company_id',mine,
        'refinery_id',pg_temp.seed_id('refinery',channel),
        'weight_before_melting_grams',raw_g,
        'weight_after_melting_grams',((round(oz::numeric,4)+0.000001)*31.1034768)/0.9999,
        'fineness_percentage',99.99,'metal_retained_percentage',100,
        'final_fine_grams',(round(oz::numeric,4)+0.000001)*31.1034768,
        'final_fine_oz',round(oz::numeric,4)+0.000001,
        'quantity_available_oz',0,
        'transaction_type','entry','certificate_number',ref||'-CERT','notes',tag,'created_by',actor));
      UPDATE gold_inventory SET quantity_available_oz=final_fine_oz
        WHERE id=pg_temp.seed_id('inventory',k);
      UPDATE freight_shipments SET status='in_stock'
        WHERE id=pg_temp.seed_id('freight',k) AND status='processed';
      IF channel=1 THEN
        sale:=pg_temp.seed_id('export-sale',m); amount:=round(oz*p,2);
        PERFORM pg_temp.seed_put('sales','export-sale',m,jsonb_build_object('sale_number','SL-'||to_char(d,'YYYY')||'-'||lpad((8000+m)::text,4,'0'),
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
        PERFORM snp_ensure_export_sale_physical_backing(sale);
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
          teneur_initiale_pct=round(oz*31.1034768/raw_g*100,4),deductions_contractuelles=0
          WHERE id=conciliation;
        IF m%3<>0 THEN
          PERFORM snp_conciliation_enregistrer_analyse(conciliation,'certificat_acheteur',pg_temp.seed_id('certificate',k),
            measured_g,measured_purity,fixing,d+10,pg_temp.seed_id('conciliation-analysis',m));
          UPDATE snp_conciliations SET devise_finale=upper(devise_initiale)
            WHERE id=conciliation AND devise_finale IS NULL;
        END IF;
        IF m%3=2 THEN
          PERFORM pg_temp.seed_actor(2);
          PERFORM snp_conciliation_valider(conciliation,pg_temp.seed_id('conciliation-validate',m));
        END IF;
        -- Historical financial states are imported under the same guarded marker
        -- used by the payment RPC. The live RPC rejects payment dates older than
        -- 30 days, so a controlled import is required for 2024-2025 history.
        IF m%6<>0 THEN
          PERFORM pg_temp.seed_actor(1);
          SELECT final_proceeds INTO amount FROM sales WHERE id=sale;
          payment:=pg_temp.seed_id('international-payment',m);
          PERFORM set_config('sonasp.payment_4h_rpc','1',true);
          PERFORM pg_temp.seed_put('payments','international-payment',m,jsonb_build_object(
            'sale_id',sale,'customer_id',pg_temp.seed_id('customer',1+m%2),
            'expected_date',d+20,'actual_date',CASE WHEN m%6=1 THEN NULL ELSE d+12 END,
            'amount',round(amount*CASE WHEN m%6=1 THEN 1 ELSE 0.40 END,2),'currency','USD','fx_rate',1,
            'bank_name',CASE WHEN 1+m%2=1 THEN 'Banque Helvétique de Commerce' ELSE 'Emirates Trade Bank' END,
            'account_number','CUST-'||lpad((1+m%2)::text,10,'0'),
            'reference_number','PAY-'||to_char(d,'YYYY')||'-'||lpad((8000+m)::text,4,'0'),
            'transaction_id','TRX-'||to_char(d,'YYYYMM')||'-'||lpad(m::text,4,'0'),
            'notes',tag||' - Paiement synthétique modifiable selon son état.',
            'status',(ARRAY['pending','processing','rejected','cancelled','failed'])[m%6],
            'created_by',actor,'created_at',(d+11)::timestamptz,
            'is_virtual',m%6=1,'payment_type',CASE WHEN m%6=1 THEN 'virtual' ELSE 'actual' END,
            'customer_bank_id',CASE WHEN m%6=1 THEN NULL ELSE pg_temp.seed_id('customer-bank',1+m%2) END,
            'seller_bank_id',CASE WHEN m%6=1 THEN NULL ELSE pg_temp.seed_id('sonasp-bank',1) END,
            'payment_currency','USD','receiving_currency','USD',
            'received_amount',CASE WHEN m%6=1 THEN NULL ELSE round(amount*0.40,2) END,
            'version',CASE WHEN m%6=1 THEN 0 ELSE 1 END,
            'executed_by',CASE WHEN m%6=1 THEN NULL ELSE actor END,
            'executed_at',CASE WHEN m%6=1 THEN NULL ELSE (d+12)::timestamptz END,
            'rejected_by',CASE WHEN m%6=3 THEN pg_temp.seed_id('actor',2) ELSE NULL END,
            'rejected_at',CASE WHEN m%6=3 THEN (d+13)::timestamptz ELSE NULL END,
            'rejection_reason',CASE WHEN m%6=3 THEN 'Référence bancaire non conforme au scénario.' ELSE NULL END,
            'cancelled_by',CASE WHEN m%6=4 THEN actor ELSE NULL END,
            'cancelled_at',CASE WHEN m%6=4 THEN (d+13)::timestamptz ELSE NULL END,
            'cancellation_reason',CASE WHEN m%6=4 THEN 'Ordre annulé avant rapprochement bancaire.' ELSE NULL END,
            'fx_rate_date',CASE WHEN m%6=1 THEN NULL ELSE d+12 END,
            'fx_rate_source',CASE WHEN m%6=1 THEN NULL ELSE 'parity' END,
            'execution_reference_key',CASE WHEN m%6=1 THEN NULL ELSE pg_temp.seed_id('sonasp-bank',1)::text||':pay-'||to_char(d,'YYYY')||'-'||lpad((8000+m)::text,4,'0') END));
          UPDATE sales SET
            status=CASE WHEN m%6 IN(1,2) THEN 'virtual_payment'::sale_status ELSE 'waiting_for_payment'::sale_status END,
            payment_amount=CASE WHEN m%6=2 THEN round(amount*0.40,2) ELSE 0 END,
            payment_date=CASE WHEN m%6=2 THEN d+12 ELSE NULL END,
            payment_method=CASE WHEN m%6=2 THEN 'bank_transfer' ELSE NULL END
          WHERE id=sale;
          PERFORM set_config('sonasp.payment_4h_rpc','0',true);
        END IF;
      ELSE
        -- This is a DIFFERENT production lot from the export sale: gold cannot be sold and reserved twice.
        allocation:=pg_temp.seed_id('reserve',m);
          PERFORM pg_temp.seed_put('reserve_allocations','reserve',m,jsonb_build_object(
            'reference','RN-'||to_char(d,'YYYY')||'-'||lpad((8000+m)::text,4,'0'),'created_by',actor));
          PERFORM snp_save_reserve_allocation(allocation,jsonb_build_object('allocation_date',d+15,
            'reason',tag||' - Constitution de réserve synthétique','allocation_nature','CONSTITUTION_RESERVE',
            'decision_reference','DEC-RN-'||to_char(d,'YYYY')||'-'||lpad((8000+m)::text,4,'0'),
            'decision_date',d+13,'decision_authority','Direction générale habilitée',
            'decision_comment',tag,'depository_organization_id',pg_temp.seed_id('depository',1+m%2),
            'deposit_type','reserve_vault','planned_transfer_date',d+17,'planned_deposit_reference',ref||'-DEPOT',
            'control_results',jsonb_build_object('purity',true,'weight',true,'certificates',true,'eligibility',true,'sale_conflict',true,'availability',true)),
            ARRAY[pg_temp.seed_id('inventory',k)]);
          UPDATE reserve_allocations SET valuation_source='Référentiels or et change du scénario historique' WHERE id=allocation;
          path:=allocation::text||'/format-validated/'||to_char(d,'YYYY/MM')||'/decision-affectation.pdf';
          INSERT INTO seed_documents VALUES('reserve-documents',path,'Décision d’affectation',ref||'-DEC',d+13,
            jsonb_build_object('affectation',ref||'-RES','poids_fin_g',final_fine,'lot',ref||'-CERT'));
          PERFORM snp_register_reserve_document_gateway(allocation,'decision_allocation','decision-affectation.pdf',path,'application/pdf',1024,actor);
          FOR stage IN 1..CASE WHEN m<18 OR m=31 THEN 9 WHEN m BETWEEN 19 AND 27 THEN m-18 ELSE 0 END LOOP
            target:=(ARRAY['SUBMITTED','UNDER_REVIEW','VALIDATED_LEVEL_1','VALIDATED_LEVEL_2','TRANSFER_AUTHORIZED',
              'IN_TRANSIT','RECEIVED','RECONCILIATION_PENDING','RECONCILED'])[stage];
            PERFORM pg_temp.seed_actor((ARRAY[1,2,2,3,4,4,5,5,6])[stage]);
            PERFORM snp_transition_reserve_allocation(allocation,target,tag||' - Transition historique ; date métier '||(d+15));
          END LOOP;
          IF m<18 OR m=31 THEN
            PERFORM pg_temp.seed_actor(7);
            PERFORM snp_activate_reserve_allocation(allocation,pg_temp.seed_id('reserve-activation',m),tag||' - Activation historique contrôlée.');
          ELSIF m=28 THEN
            PERFORM pg_temp.seed_actor(2);
            PERFORM snp_transition_reserve_allocation(allocation,'SUBMITTED',tag||' - Soumission historique.');
            PERFORM pg_temp.seed_actor(3);
            PERFORM snp_transition_reserve_allocation(allocation,'REJECTED',tag||' - Rejet motivé pour couverture de scénario.');
          ELSIF m=29 THEN
            PERFORM pg_temp.seed_actor(2);
            PERFORM snp_transition_reserve_allocation(allocation,'CANCELLED',tag||' - Annulation motivée pour couverture de scénario.');
          ELSIF m=30 THEN
            PERFORM pg_temp.seed_actor(2);
            PERFORM snp_transition_reserve_allocation(allocation,'SUBMITTED',tag||' - Soumission historique.');
            PERFORM pg_temp.seed_actor(3);
            PERFORM snp_transition_reserve_allocation(allocation,'UNDER_REVIEW',tag||' - Revue historique.');
            PERFORM pg_temp.seed_actor(4);
            PERFORM snp_transition_reserve_allocation(allocation,'DISCREPANCY_REVIEW',tag||' - Écart de poids soumis à examen.');
          END IF;
      END IF;
    END LOOP;
  END LOOP;
  INSERT INTO seed_results VALUES('workflows',32,jsonb_build_object(
    'shipments',96,'freight_in_stock',96,'refining_records',96,'inventory_entries',96,
    'assays',64,'conciliations',32,'reserve_allocations',32,
    'historical_export_gaps_repaired',legacy_no));
END $workflows$;
