-- Fail the entire import on inconsistent quantities, links or protected accounts.
CREATE FUNCTION pg_temp.seed_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'SEED VALIDATION FAILED: %',label; END IF;
  INSERT INTO seed_results VALUES('check',1,jsonb_build_object('assertion',label));
END $$;

SELECT pg_temp.seed_assert((SELECT count(*)=108 FROM daily_production WHERE id::text LIKE 'd8302026-%'),'108 productions');
SELECT pg_temp.seed_assert((SELECT count(*)=108 FROM snp_achats_mines WHERE id::text LIKE 'd8302026-%'),'108 achats');
SELECT pg_temp.seed_assert((SELECT count(*)=36 FROM sales WHERE id::text LIKE 'd8302026-%'),'36 ventes export');
SELECT pg_temp.seed_assert((SELECT count(*)=72 FROM shipping_preparations WHERE id::text LIKE 'd8302026-%'),'72 expéditions');
SELECT pg_temp.seed_assert((SELECT count(*)=36 FROM snp_conciliations WHERE sale_id::text LIKE 'd8302026-%'),'36 conciliations');
SELECT pg_temp.seed_assert((SELECT count(*)=12 FROM snp_conciliations WHERE sale_id::text LIKE 'd8302026-%' AND statut='validee'),'12 conciliations validées');
SELECT pg_temp.seed_assert((SELECT count(*)=34 FROM reserve_allocations WHERE id::text LIKE 'd8302026-%'),'34 affectations');
SELECT pg_temp.seed_assert((SELECT count(*)=27 FROM reserve_allocations WHERE id::text LIKE 'd8302026-%' AND status='ACTIVE'),'27 affectations actives');
SELECT pg_temp.seed_assert((SELECT count(*)=216 FROM snp_artisan_ventes_or WHERE id::text LIKE 'd8302026-%'),'216 ventes artisanales');
SELECT pg_temp.seed_assert((SELECT count(*)=180 FROM snp_artisan_factures_definitives WHERE id::text LIKE 'd8302026-%' AND certification_dgi_status='pending'),'180 factures non certifiées');
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
  WHERE a.id::text LIKE 'd8302026-%' AND a.email LIKE 'test3y-actor-%@example.invalid'
    AND a.banned_until='infinity'::timestamptz AND a.encrypted_password IS NULL AND NOT p.is_active
),'acteurs historiques sans mot de passe et interdits de connexion');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM snp_notifications_livraisons l JOIN snp_notifications n ON n.id=l.notification_id
  WHERE n.emise_par IN(SELECT pg_temp.seed_id('actor',i) FROM generate_series(1,7) i)
    AND l.canal IN('courriel','sms') AND l.statut='en_attente'
),'aucun courriel ni SMS de test à envoyer');
SELECT pg_temp.seed_assert(NOT EXISTS(
  SELECT 1 FROM snp_workflow_notification_outbox WHERE status IN('pending','processing')
    AND (aggregate_id::text LIKE 'd8302026-%' OR payload->>'actor_id' LIKE 'd8302026-%')
),'aucune notification externe différée pour ce lot');

INSERT INTO seed_results SELECT 'reserve_by_status',count(*),jsonb_build_object('status',status,'fine_g',sum(fine_weight_grams))
FROM reserve_allocations WHERE id::text LIKE 'd8302026-%' GROUP BY status;
INSERT INTO seed_results SELECT 'conciliation_by_status',count(*),jsonb_build_object('status',statut)
FROM snp_conciliations WHERE sale_id::text LIKE 'd8302026-%' GROUP BY statut;
