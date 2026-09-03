-- Fail the entire import on inconsistent quantities, links or protected accounts.
CREATE FUNCTION pg_temp.seed_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'SEED VALIDATION FAILED: %',label; END IF;
  INSERT INTO seed_results VALUES('check',1,jsonb_build_object('assertion',label));
END $$;

SELECT pg_temp.seed_assert((SELECT count(*)=96 FROM daily_production WHERE id::text LIKE 'd8302026-%'),'96 productions réelles de janvier 2024 à août 2026');
SELECT pg_temp.seed_assert((SELECT count(*)=108 FROM production_forecasts WHERE id::text LIKE 'd8302026-%'),'108 prévisions mensuelles de 2024 à 2026');
SELECT pg_temp.seed_assert((SELECT count(*)=9 FROM annual_budgets WHERE id::text LIKE 'd8302026-%'),'9 budgets annuels');
SELECT pg_temp.seed_assert((SELECT count(*)=108 FROM monthly_budgets WHERE id::text LIKE 'd8302026-%'),'108 budgets mensuels');
SELECT pg_temp.seed_assert((SELECT count(*)=108 FROM quarterly_forecasts WHERE id::text LIKE 'd8302026-%'),'108 prévisions trimestrielles ventilées par mois');
SELECT pg_temp.seed_assert((SELECT count(*)=96 FROM snp_achats_mines WHERE id::text LIKE 'd8302026-%'),'96 achats aux mines');
SELECT pg_temp.seed_assert((SELECT count(*)=32 FROM sales WHERE id::text LIKE 'd8302026-%'),'32 ventes export');
SELECT pg_temp.seed_assert((SELECT count(*)=96 FROM shipping_preparations WHERE id::text LIKE 'd8302026-%'),'96 expéditions, dont 32 chaînes de régularisation physique');
SELECT pg_temp.seed_assert((SELECT count(*)=96 FROM freight_shipments WHERE id::text LIKE 'd8302026-%' AND status='in_stock'),'96 frets réceptionnés, traités et entrés en stock');
SELECT pg_temp.seed_assert((SELECT count(*)=96 FROM refining_records WHERE id::text LIKE 'd8302026-%'),'96 opérations de raffinage');
SELECT pg_temp.seed_assert((SELECT count(*)=96 FROM gold_inventory WHERE id::text LIKE 'd8302026-%'),'96 entrées de stock physique');
SELECT pg_temp.seed_assert((SELECT count(*)=32 FROM snp_conciliations WHERE sale_id::text LIKE 'd8302026-%'),'32 conciliations');
SELECT pg_temp.seed_assert((SELECT count(*)=10 FROM snp_conciliations WHERE sale_id::text LIKE 'd8302026-%' AND statut='validee'),'10 conciliations validées');
SELECT pg_temp.seed_assert((SELECT count(*)=32 FROM reserve_allocations WHERE id::text LIKE 'd8302026-%'),'32 affectations à la réserve');
SELECT pg_temp.seed_assert((SELECT count(*)=19 FROM reserve_allocations WHERE id::text LIKE 'd8302026-%' AND status='ACTIVE'),'19 affectations actives');
SELECT pg_temp.seed_assert((SELECT count(DISTINCT status)=14 FROM reserve_allocations WHERE id::text LIKE 'd8302026-%'),'14 statuts de réserve couverts');
SELECT pg_temp.seed_assert((SELECT count(*)=26 FROM payments WHERE id::text LIKE 'd8302026-%'),'26 paiements internationaux');
SELECT pg_temp.seed_assert((SELECT count(*)=6 FROM payments WHERE id::text LIKE 'd8302026-%' AND status='pending'),'6 paiements internationaux modifiables en attente');
SELECT pg_temp.seed_assert((SELECT count(*)=192 FROM snp_artisan_ventes_or WHERE id::text LIKE 'd8302026-%'),'192 ventes artisanales');
SELECT pg_temp.seed_assert((SELECT count(*)=160 FROM snp_artisan_factures_definitives WHERE id::text LIKE 'd8302026-%' AND certification_dgi_status='pending'),'160 factures non certifiées');
SELECT pg_temp.seed_assert((SELECT count(*)=11 FROM snp_requisitions WHERE id::text LIKE 'd8302026-%' AND statut='brouillon'),'11 réquisitions modifiables');
SELECT pg_temp.seed_assert((SELECT count(*)=9 FROM snp_contrats WHERE id::text LIKE 'd8302026-%' AND statut='brouillon'),'9 contrats modifiables');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM snp_export_sale_physical_backing_gaps WHERE resolution='blocked'
),'ventes export historiques rapprochées du stock physique');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM snp_achats_mines a LEFT JOIN snp_achats_productions ap ON ap.achat_id=a.id
  WHERE a.id::text LIKE 'd8302026-%' GROUP BY a.id HAVING abs(a.quantite_oz-coalesce(sum(ap.quantite_oz),0))>0.0001
),'achats entièrement couverts par leurs productions');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM snp_achats_productions ap JOIN daily_production p ON p.id=ap.production_id
  JOIN snp_achats_mines a ON a.id=ap.achat_id
  WHERE a.id::text LIKE 'd8302026-%' AND a.mining_company_id IS DISTINCT FROM p.mining_company_id
),'périmètres mine des achats conservés');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM snp_conciliations c JOIN sales s ON s.id=c.sale_id
  JOIN assay_certificates ac ON ac.id=c.assay_certificate_id
  WHERE s.id::text LIKE 'd8302026-%' AND (ac.shipping_preparation_id IS DISTINCT FROM s.shipping_preparation_id OR ac.approval_status<>'approved')
),'analyses rattachées à la bonne expédition');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM snp_conciliations WHERE sale_id::text LIKE 'd8302026-%'
    AND valide_par IS NOT NULL AND (valide_par=created_by OR valide_par=soumis_par OR validation_sans_second_regard)
),'aucune auto-approbation de conciliation');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM gold_inventory WHERE id::text LIKE 'd8302026-%' AND (
    abs(final_fine_grams-final_fine_oz*31.1034768)>0.001 OR
    abs(final_fine_oz-quantity_available_oz-coalesce(quantity_allocated_oz,0)-coalesce(quantity_sold_oz,0)-quantity_national_reserve_oz)>0.000001
  )
),'conservation de l’or fin et conversion once/gramme');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM gold_inventory i LEFT JOIN inventory_transactions t ON t.inventory_id=i.id AND t.transaction_type='entry'
  WHERE i.id::text LIKE 'd8302026-%' GROUP BY i.id HAVING count(t.id)<>1
),'une seule écriture d’entrée par lot de stock');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM reserve_allocation_items i JOIN reserve_allocations a ON a.id=i.allocation_id
  JOIN gold_inventory g ON g.id=i.inventory_id
  WHERE a.id::text LIKE 'd8302026-%' AND a.status='ACTIVE' AND i.released_at IS NULL
    AND abs(g.quantity_national_reserve_oz*31.1034768-i.fine_weight_grams)>0.001
),'réserve active égale au prélèvement sur stock');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM reserve_allocation_approvals ap JOIN reserve_allocations a ON a.id=ap.allocation_id
  WHERE a.id::text LIKE 'd8302026-%' AND ap.actor_id=a.created_by
),'validations de réserve distinctes de l’auteur');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM seed_profile_baseline b FULL JOIN user_profiles p ON p.id=b.id
  WHERE b.id IS NOT NULL AND (p.id IS NULL OR to_jsonb(p) IS DISTINCT FROM b.payload)
),'profils existants inchangés');
SELECT pg_temp.seed_assert((SELECT count(*)=7 FROM auth.users a JOIN user_profiles p ON p.id=a.id
  WHERE a.id::text LIKE 'd8302026-%' AND a.email LIKE 'history-actor-%@example.invalid'
    AND a.banned_until='infinity'::timestamptz AND a.encrypted_password IS NULL AND NOT p.is_active
),'acteurs historiques sans mot de passe et interdits de connexion');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM snp_notifications_livraisons l JOIN snp_notifications n ON n.id=l.notification_id
  WHERE n.emise_par IN(SELECT pg_temp.seed_id('actor',i) FROM generate_series(1,7) i)
    AND l.canal IN('courriel','sms') AND l.statut='en_attente'
),'aucun courriel ni SMS de développement à envoyer');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM snp_workflow_notification_outbox WHERE status IN('pending','processing')
    AND (aggregate_id::text LIKE 'd8302026-%' OR payload->>'actor_id' LIKE 'd8302026-%')
),'aucune notification externe différée pour ce lot');

SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM daily_production WHERE id::text LIKE 'd8302026-%'
    AND (production_date < date '2024-01-01' OR production_date > date '2026-09-03')
),'productions exécutées limitées à 2024, 2025 et à la période écoulée de 2026');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM production_forecasts WHERE id::text LIKE 'd8302026-%'
    AND extract(year FROM forecast_date)::integer NOT IN (2024,2025,2026)
),'prévisions limitées aux années 2024, 2025 et 2026');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM sales WHERE id::text LIKE 'd8302026-%'
    AND (sale_number ILIKE '%test%' OR sale_number ILIKE '%demo%')
),'références de ventes sans libellé technique');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM reserve_allocations WHERE id::text LIKE 'd8302026-%'
    AND (reference ILIKE '%test%' OR reference ILIKE '%demo%')
),'références de réserve sans libellé technique');

INSERT INTO seed_results SELECT 'reserve_by_status',count(*),jsonb_build_object('status',status,'fine_g',sum(fine_weight_grams))
FROM reserve_allocations WHERE id::text LIKE 'd8302026-%' GROUP BY status;
INSERT INTO seed_results SELECT 'conciliation_by_status',count(*),jsonb_build_object('status',statut)
FROM snp_conciliations WHERE sale_id::text LIKE 'd8302026-%' GROUP BY statut;
