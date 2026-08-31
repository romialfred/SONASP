DO $artisanal$
DECLARE
  tag constant text:='TEST3Y-20260830'; mon record; m integer; n integer; k integer; artisan_no integer;
  actor uuid:=pg_temp.seed_id('actor',1); artisan uuid; sale uuid; invoice uuid; ref text; quantity numeric; amount numeric;
  scoped_org uuid; d date; y integer;
BEGIN
  IF EXISTS(SELECT 1 FROM seed_results WHERE section='already_present') THEN RETURN; END IF;
  PERFORM pg_temp.seed_actor(1);
  FOR n IN 1..3 LOOP
    PERFORM pg_temp.seed_put('artisanal_sites','artisan-site',n,jsonb_build_object('code','TEST3Y-SITE-'||n,
      'name','TEST - Site artisanal '||n,'status','active','region','Centre','province','Kadiogo','locality','Localité fictive '||n,
      'area_hectares',20+n*5,'exploitation_type',CASE WHEN n=3 THEN 'semi_mecanisee' ELSE 'artisanale' END,
      'authorized_miners',20,'active_miners',8,'latitude',12.3+n*0.01,'longitude',-1.5,'notes',tag,'created_by',actor));
  END LOOP;
  FOR n IN 1..24 LOOP
    PERFORM pg_temp.seed_put('snp_artisans_miniers','artisan',n,jsonb_build_object('type_personne','physique',
      'type_artisan','exploitant','nom','TEST ARTISAN '||lpad(n::text,2,'0'),'prenoms','Développement',
      'telephone','00000000','email','test3y-artisan-'||n||'@example.invalid','nationalite','Burkinabè',
      'numero_carte','TEST3Y-CARTE-'||n,'type_piece_identite','Autre','numero_piece_identite','TEST-NON-OFFICIEL-'||n,
      'commune','Ouagadougou','region','Centre','observations',tag,'created_by',actor,
      'artisanal_site_id',pg_temp.seed_id('artisan-site',1+(n-1)%3)));
    PERFORM pg_temp.seed_put('snp_artisan_moyens_paiement','artisan-method',n,jsonb_build_object(
      'artisan_id',pg_temp.seed_id('artisan',n),'type','virement_bancaire','titulaire','TEST ARTISAN '||n,
      'banque','TEST - Banque fictive','numero_compte','TEST-NON-BANCAIRE-'||n,'libelle','Coordonnées fictives - non vérifiées',
      'observations',tag,'created_by',actor));
  END LOOP;
  FOR mon IN SELECT * FROM seed_months ORDER BY month_no LOOP
    m:=mon.month_no; d:=mon.business_date;
    FOR n IN 1..6 LOOP
      k:=m*6+n; artisan_no:=1+(k-1)%24; artisan:=pg_temp.seed_id('artisan',artisan_no);
      sale:=pg_temp.seed_id('artisan-sale',k); invoice:=pg_temp.seed_id('artisan-invoice',k);
      ref:='TEST3Y-ART-'||to_char(d,'YYYYMM')||'-'||n;
      quantity:=120+15*n+(m%8)*12;
      -- National purchases only. The deployed profile constraint cannot yet create
      -- a Comptoir actor; never give a national actor a forged Comptoir identity.
      scoped_org:=NULL;
      PERFORM pg_temp.seed_put('snp_artisan_ventes_or','artisan-sale',k,jsonb_build_object('artisan_id',artisan,
        'date_vente',d+n+1,'quantite_grammes',quantity,'type_or',(ARRAY['pepites','lingot','poudre'])[1+n%3],
        'purete_karat',22,'prix_kg_fcfa',round(mon.gold_usd*mon.usd_xof/31.1034768*1000*0.9167,2),
        'montant_brut_fcfa',1,'montant_total_fcfa',1,'tva_taux',0,'taxe_dev_comm_taux',1,
        'reference_vente',ref,'numero_recu',ref,'statut',CASE WHEN n=4 THEN 'en_attente' ELSE 'validee' END,
        'statut_validation',CASE WHEN n=4 THEN 'en_attente' ELSE 'validee' END,
        'comptoir_organization_id',scoped_org,'acheteur_comptoir_organization_id',scoped_org,
        'observations',tag||' - Acquisition fictive ; certification et règlement non réalisés.','created_by',actor));
      IF n<>4 THEN
        SELECT montant_brut_fcfa INTO amount FROM snp_artisan_ventes_or WHERE id=sale;
        PERFORM pg_temp.seed_put('snp_artisan_factures_definitives','artisan-invoice',k,jsonb_build_object(
          'numero_facture',ref||'-FACT','vente_or_id',sale,'artisan_id',artisan,'montant_brut',amount,
          'montant_taxe_tva',0,'montant_taxe_retenue_source',0,'montant_autres_taxes',round(amount*0.01,2),
          'montant_total_taxes',round(amount*0.01,2),'montant_net_a_payer',amount,
          'taux_tva',0,'taux_retenue_source',0,'date_emission',(d+n+2)::timestamptz,'date_echeance',(d+27)::timestamptz,
          'statut','emise','certification_dgi_status','pending','notes',tag||' - Facture de test NON certifiée DGI.',
          'comptoir_organization_id',scoped_org,'emise_par',actor));
        UPDATE snp_artisan_ventes_or SET facture_definitive_id=invoice,statut_paiement='facture_emise' WHERE id=sale;
      END IF;
    END LOOP;
    actor:=pg_temp.seed_id('actor',1);
    PERFORM pg_temp.seed_actor(1);
    IF m%3=0 THEN
      PERFORM pg_temp.seed_put('snp_requisitions','requisition',m,jsonb_build_object('reference','TEST3Y-REQ-'||to_char(d,'YYYYMM'),
        'objet','TEST - Préparer une réquisition trimestrielle','mining_company_id',pg_temp.seed_id('mine',3),
        'type_requisition','partielle','quantite_oz',100,'periode_debut',d,'periode_fin',d+27,
        'regime_juridique','a_qualifier','statut','brouillon','observations',tag||' - Aucun acte exécutoire simulé.','created_by',actor));
    END IF;
  END LOOP;
  FOR y IN 2023..2026 LOOP
    FOR n IN 1..3 LOOP
      PERFORM pg_temp.seed_put('snp_contrats','contract',(y-2023)*3+n,jsonb_build_object(
        'numero_contrat','TEST3Y-CTR-'||y||'-'||n,'intitule','TEST - Contrat annuel pédagogique '||y,
        'partenaire_type','mine_industrielle','mining_company_id',pg_temp.seed_id('mine',n),
        'date_debut',make_date(y,1,1),'date_fin',make_date(y,12,31),'quantite_totale',4000,
        'statut','brouillon','observations',tag||' - Contrat fictif non signé.','created_by',actor));
    END LOOP;
  END LOOP;
  INSERT INTO seed_results VALUES('artisanal',216,jsonb_build_object('artisans',24,'sites',3,'invoices_pending_dgi',180,
    'payment_methods_unverified',24,'requisitions_draft',12,'contracts_draft',12,
    'note','No fabricated DGI certification or bank execution.'));
END $artisanal$;
