-- SONASP / TEST3Y-20260830. Development only, explicitly requested by the owner.
-- Execute inside ONE transaction. The runner chooses ROLLBACK (default) or COMMIT.
-- No existing row is deleted; no RLS, trigger, account permission or external integration is disabled.
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SET LOCAL search_path=public,extensions,pg_temp;
SELECT pg_advisory_xact_lock(hashtext('SONASP:TEST3Y-20260830'));

CREATE FUNCTION pg_temp.seed_id(kind text, n integer DEFAULT 0) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT ('d8302026'||substr(md5('TEST3Y-20260830:'||kind||':'||n),9))::uuid $$;

CREATE FUNCTION pg_temp.seed_actor(n integer) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Privileged development import context, never a browser token or an existing user's identity.
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',pg_temp.seed_id('actor',n),'role','service_role')::text,true);
END $$;

CREATE FUNCTION pg_temp.seed_put(tab text, kind text, n integer, payload jsonb) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE cols text; vals text; row_id uuid:=pg_temp.seed_id(kind,n);
BEGIN
  IF tab <> ALL(ARRAY['mining_companies','sites','refineries','customers','transport_companies',
    'snp_ministries','snp_organizations','daily_production','production_forecasts','snp_plans_achat',
    'snp_plans_achat_lignes','snp_demandes_achat','snp_achats_mines','snp_factures_achat',
    'snp_factures_achat_lignes','snp_reglements_achat','snp_requisitions','snp_contrats',
    'shipping_preparations','shipping_production_items','shipping_ingots','freight_shipments',
    'freight_shipment_productions','snp_analyses_teneur','snp_analyses_resultats',
    'assay_certificates','assay_certificate_data','sales','sales_line_items','snp_ventes_lots',
    'payments','gold_inventory','refining_records','reserve_allocations',
    'artisanal_sites','artisanal_site_assignments','artisanal_site_productions','snp_artisans_miniers',
    'snp_artisan_ventes_or','snp_artisan_factures_definitives','snp_artisan_paiements',
    'snp_artisan_moyens_paiement','snp_comptoir_ventes_sonasp','snp_calculs_fiscaux',
    'export_licenses','annual_budgets','monthly_budgets','quarterly_forecasts','snp_regles_fiscales']) THEN
    RAISE EXCEPTION 'Table outside development import scope: %',tab;
  END IF;
  payload:=payload||jsonb_build_object('id',row_id);
  SELECT string_agg(format('%I',key),',' ORDER BY key),
         string_agg(format('r.%I',key),',' ORDER BY key)
    INTO cols,vals FROM jsonb_object_keys(payload) key;
  EXECUTE format('INSERT INTO public.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r',tab,cols,vals,tab)
    USING payload;
  RETURN row_id;
END $$;

CREATE TEMP TABLE seed_results(section text, count bigint, details jsonb) ON COMMIT DROP;
CREATE TEMP TABLE seed_months(month_no integer PRIMARY KEY, business_date date, gold_usd numeric, usd_xof numeric) ON COMMIT DROP;

DO $seed$
DECLARE
  tag constant text:='TEST3Y-20260830';
  i integer; m integer; y integer; channel integer; k integer; ref text; d date; p numeric; fx numeric;
  raw_g numeric; purity numeric; fine_g numeric; oz numeric; amount numeric;
  actor uuid:=pg_temp.seed_id('actor',1); mine uuid; site uuid; ignored uuid; sonasp uuid;
BEGIN
  IF EXISTS(SELECT 1 FROM mining_companies WHERE id=pg_temp.seed_id('mine',1)) THEN
    INSERT INTO seed_results VALUES('already_present',1,jsonb_build_object('batch',tag));
    RETURN;
  END IF;
  IF current_setting('sonasp.seed_project',true) IS DISTINCT FROM 'yyverzuhkdonjjuficor-development-confirmed' THEN
    RAISE EXCEPTION 'Explicit development target confirmation required.';
  END IF;

  -- Fictional historical actors: no password, no invitation, no Auth identity/session.
  -- Authentication is banned; the profiles are disabled at the end of the import.
  FOR i IN 1..7 LOOP
    INSERT INTO auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,banned_until)
    VALUES(pg_temp.seed_id('actor',i),'authenticated','authenticated',
      'test3y-actor-'||i||'@example.invalid',NULL,
      jsonb_build_object('development_fixture',tag),jsonb_build_object('full_name','TEST - Acteur historique '||i),'infinity');
    INSERT INTO user_profiles(id,email,full_name,role,is_active)
    VALUES(pg_temp.seed_id('actor',i),'test3y-actor-'||i||'@example.invalid','TEST - Acteur historique '||i,'management',true);
  END LOOP;
  PERFORM pg_temp.seed_actor(1);
  SELECT id INTO sonasp FROM mining_companies WHERE upper(code)='SONASP';
  IF sonasp IS NULL THEN RAISE EXCEPTION 'Canonical SONASP institution missing; no replacement inferred.'; END IF;

  PERFORM pg_temp.seed_put('snp_ministries','ministry',1,jsonb_build_object('code','TEST3Y-FIN','name','TEST - Tutelle des finances'));
  PERFORM pg_temp.seed_put('snp_ministries','ministry',2,jsonb_build_object('code','TEST3Y-MIN','name','TEST - Tutelle des mines'));
  FOR i IN 1..3 LOOP
    mine:=pg_temp.seed_id('mine',i); site:=pg_temp.seed_id('site',i);
    PERFORM pg_temp.seed_put('mining_companies','mine',i,jsonb_build_object('code','TEST3Y-MINE-'||i,
      'name','TEST - Mine pédagogique '||i,'country','Burkina Faso','city','Ouagadougou',
      'company_type','production_mine','default_currency','XOF','notes',tag,'created_by',actor));
    PERFORM pg_temp.seed_put('sites','site',i,jsonb_build_object('name','TEST - Site industriel '||i,
      'site_type','factory','country','BF','address','Site fictif de développement'));
    PERFORM pg_temp.seed_put('snp_organizations','org-mine',i,jsonb_build_object('code','TEST3Y-ORG-MINE-'||i,
      'name','TEST - Organisation mine '||i,'organization_type','mine','mining_company_id',mine,
      'supervising_ministry_id',pg_temp.seed_id('ministry',2),'notes',tag,'created_by',actor));
  END LOOP;
  FOR i IN 1..2 LOOP
    PERFORM pg_temp.seed_put('refineries','refinery',i,jsonb_build_object('name','TEST - Raffinerie pédagogique '||i,
      'location','Site de recette '||i,'country','Burkina Faso','email','test3y-refinery-'||i||'@example.invalid','phone','00000000'));
    PERFORM pg_temp.seed_put('customers','customer',i,jsonb_build_object('name','TEST - Acheteur international '||i,
      'country','Suisse','email','test3y-buyer-'||i||'@example.invalid'));
    PERFORM pg_temp.seed_put('snp_organizations','depository',i,jsonb_build_object('code','TEST3Y-DEPOT-'||i,
      'name','TEST - Dépositaire de réserve '||i,'short_name','TEST Dépôt '||i,'organization_type','public_institution',
      'organization_subtype','reserve_depository','supervising_ministry_id',pg_temp.seed_id('ministry',1),
      'address','Ouagadougou - dépôt fictif','scope_metadata',jsonb_build_object('can_hold_gold_reserve',true,'development_fixture',tag),
      'notes',tag,'created_by',actor));
    PERFORM pg_temp.seed_put('snp_organizations','comptoir',i,jsonb_build_object('code','TEST3Y-COMPTOIR-'||i,
      'name','TEST - Comptoir pédagogique '||i,'organization_type','comptoir',
      'supervising_ministry_id',pg_temp.seed_id('ministry',2),'notes',tag,'created_by',actor));
  END LOOP;
  FOR i IN 1..3 LOOP
    PERFORM pg_temp.seed_put('snp_organizations','institution',i,jsonb_build_object('code','TEST3Y-INST-'||i,
      'name',CASE i WHEN 1 THEN 'TEST - DGI / Perception spécialisée' WHEN 2 THEN 'TEST - DGMG' ELSE 'TEST - BUMIGEM' END,
      'organization_type',CASE i WHEN 1 THEN 'dgi' WHEN 2 THEN 'dgmg' ELSE 'public_institution' END,
      'supervising_ministry_id',pg_temp.seed_id('ministry',CASE WHEN i=1 THEN 1 ELSE 2 END),'notes',tag,'created_by',actor));
  END LOOP;

  -- Gap filling only: never replace a price/rate already in the database.
  FOR d IN SELECT generate_series(date '2023-09-01',date '2026-08-30',interval '1 day')::date LOOP
    p:=round((1850+(d-date '2023-09-01')*1.15+70*sin((d-date '2023-09-01')/37.0))::numeric,2);
    fx:=round((605+18*sin((d-date '2023-09-01')/51.0))::numeric,4);
    INSERT INTO gold_prices_daily(id,price_date,london_am_rate,london_pm_rate,spot_price,average_price,high_price,low_price,source,currency,notes)
    SELECT pg_temp.seed_id('gold-price',d-date '2023-09-01'),d,p,p+2,p+1,p+1,p+8,p-8,'TEST3Y synthetic','USD',tag||' - Cours synthétique, pas une cotation historique officielle.'
    WHERE NOT EXISTS(SELECT 1 FROM gold_prices_daily WHERE price_date=d AND currency='USD');
    INSERT INTO fx_rates_daily(id,rate_date,currency_pair,rate,notes)
    SELECT pg_temp.seed_id('usd-xof',d-date '2023-09-01'),d,'USD/XOF',fx,tag||' - Change synthétique.'
    WHERE NOT EXISTS(SELECT 1 FROM fx_rates_daily WHERE rate_date=d AND currency_pair='USD/XOF');
    INSERT INTO fx_rates_daily(id,rate_date,currency_pair,rate,notes)
    SELECT pg_temp.seed_id('eur-xof',d-date '2023-09-01'),d,'EUR/XOF',655.957,tag||' - Paramètre de scénario.'
    WHERE NOT EXISTS(SELECT 1 FROM fx_rates_daily WHERE rate_date=d AND currency_pair='EUR/XOF');
  END LOOP;

  FOR m IN 0..35 LOOP
    d:=(date '2023-09-01'+make_interval(months=>m))::date;
    SELECT coalesce(spot_price,london_pm_rate,london_am_rate) INTO p FROM gold_prices_daily WHERE price_date=d AND currency='USD' ORDER BY updated_at DESC NULLS LAST LIMIT 1;
    SELECT rate INTO fx FROM fx_rates_daily WHERE rate_date=d AND currency_pair='USD/XOF' ORDER BY updated_at DESC NULLS LAST LIMIT 1;
    INSERT INTO seed_months VALUES(m,d,p,fx);
    PERFORM pg_temp.seed_put('snp_plans_achat','plan',m,jsonb_build_object('numero_plan','TEST3Y-PLAN-'||to_char(d,'YYYY-MM'),
      'annee',extract(year FROM d),'mois',extract(month FROM d),'mode_repartition','quantite_cible',
      'quantite_cible_oz',1,'prix_once_global_fcfa',round(p*fx,2),'statut','brouillon','observations',tag,'created_by',actor));
    FOR channel IN 1..3 LOOP
      k:=m*3+channel; mine:=pg_temp.seed_id('mine',channel); site:=pg_temp.seed_id('site',channel);
      raw_g:=10000+500*channel+200*(m%6); purity:=94+channel/10.0;
      fine_g:=raw_g*purity/100; oz:=floor(fine_g/31.1034768*10000)/10000;
      amount:=round(oz*round(p*fx,2),2); ref:='TEST3Y-'||to_char(d,'YYYYMM')||'-'||channel;
      PERFORM pg_temp.seed_put('daily_production','production',k,jsonb_build_object('production_date',d+2,
        'bullion_grams',raw_g,'estimated_fineness_pct',purity,'estimated_gold_pct',purity,'estimated_silver_pct',2,
        'pure_gold_grams',fine_g,'estimated_oz',fine_g/31.1034768,'silver_content_grams',raw_g*0.02,
        'bar_reference',ref,'notes',tag||' - Production historique synthétique.','site_id',site::text,
        'mining_company_id',mine,'created_by',actor,'status',CASE WHEN channel<3 THEN 'ready_for_customs' ELSE 'prepared' END));
      PERFORM pg_temp.seed_put('production_forecasts','forecast',k,jsonb_build_object('forecast_date',d,
        'period_type','monthly','forecast_oz',round(oz*1.05,4),'budget_oz',round(oz*1.1,4),
        'site_id',site::text,'mining_company_id',mine,'notes',tag,'created_by',actor));
      PERFORM pg_temp.seed_put('snp_plans_achat_lignes','plan-line',k,jsonb_build_object('plan_id',pg_temp.seed_id('plan',m),
        'mining_company_id',mine,'periode_debut',d,'periode_fin',d+27,'production_declaree_oz',oz,
        'production_validee_oz',oz,'production_eligible_oz',oz,'titre_moyen_pct',purity,
        'quantite_proposee_oz',oz,'prix_once_fcfa',round(p*fx,2),'cours_reference_usd',p,'taux_usd_xof',fx,
        'montant_estime_fcfa',amount,'observations',tag,'statut','approuvee'));
      PERFORM pg_temp.seed_put('snp_demandes_achat','request',k,jsonb_build_object('numero_demande',ref||'-DA',
        'plan_id',pg_temp.seed_id('plan',m),'ligne_id',pg_temp.seed_id('plan-line',k),'mining_company_id',mine,
        'periode_debut',d,'periode_fin',d+27,'production_reference_oz',oz,'quantite_demandee_oz',oz,
        'titre_pct',purity,'prix_once_fcfa',round(p*fx,2),'cours_reference_usd',p,'taux_usd_xof',fx,
        'montant_estime_fcfa',amount,'date_limite_reponse',d+4,'date_soumission',(d+2)::timestamptz,
        'date_reponse',(d+3)::timestamptz,'statut','approuvee','observations',tag,'created_by',actor));
      PERFORM pg_temp.seed_put('snp_achats_mines','purchase',k,jsonb_build_object('numero_achat',ref||'-ACH',
        'mining_company_id',mine,'periode_debut',d,'periode_fin',d+27,'date_achat',d+4,'quantite_oz',oz,
        'quantite_grammes',round(oz*31.1034768,3),'prix_once_fcfa',round(p*fx,2),'cours_once_usd',p,'taux_usd_xof',fx,
        'montant_brut_fcfa',amount,'tva_taux',0,'tva_montant_fcfa',0,'taxe_dev_comm_taux',0,'taxe_dev_comm_montant_fcfa',0,
        'montant_total_fcfa',amount,'statut','validee','demande_id',pg_temp.seed_id('request',k),
        'observations',tag||' - Import historique de test, fiscalité de facture à contrôler.','created_by',actor));
      PERFORM pg_temp.seed_put('snp_factures_achat','purchase-invoice',k,jsonb_build_object('numero_facture',ref||'-FA',
        'achat_id',pg_temp.seed_id('purchase',k),'demande_id',pg_temp.seed_id('request',k),'mining_company_id',mine,
        'date_emission',d+5,'periode_debut',d,'periode_fin',d+27,'quantite_oz',oz,'prix_once_fcfa',round(p*fx,2),
        'montant_ht_fcfa',amount,'tva_taux',0,'tva_montant_fcfa',0,'taxe_dev_comm_taux',0,'taxe_dev_comm_montant_fcfa',0,
        'montant_ttc_fcfa',amount,'date_echeance',d+26,'statut','brouillon','statut_certification','en_attente',
        'observations',tag||' - Brouillon non certifié, aucun règlement réalisé.','created_by',actor));
      IF channel=3 THEN
        PERFORM pg_temp.seed_put('snp_reglements_achat','purchase-payment',k,jsonb_build_object('reference_reglement',ref||'-REG',
          'mining_company_id',mine,'date_reglement',d+6,'montant_fcfa',amount,'statut','brouillon',
          'observations',tag||' - Ordre de paiement fictif non exécuté.','created_by',actor));
      END IF;
    END LOOP;
    UPDATE snp_plans_achat SET quantite_cible_oz=(SELECT sum(quantite_proposee_oz) FROM snp_plans_achat_lignes WHERE plan_id=pg_temp.seed_id('plan',m)),
      quantite_repartie_oz=(SELECT sum(quantite_proposee_oz) FROM snp_plans_achat_lignes WHERE plan_id=pg_temp.seed_id('plan',m)),
      montant_previsionnel_fcfa=(SELECT sum(montant_estime_fcfa) FROM snp_plans_achat_lignes WHERE plan_id=pg_temp.seed_id('plan',m)),
      statut='en_execution' WHERE id=pg_temp.seed_id('plan',m);
  END LOOP;
  INSERT INTO seed_results VALUES('foundation',108,jsonb_build_object('batch',tag,'months',36,'from','2023-09-01','to','2026-08-30'));
END $seed$;

-- Workflow-specific chapters are concatenated here by the runner.
