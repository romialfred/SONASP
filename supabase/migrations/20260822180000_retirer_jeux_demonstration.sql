-- ============================================================================
-- Retrait des jeux de présentation 2026
--
-- Les migrations 20260820_007 et 20260820_017 ont inséré des écritures
-- fabriquées. La migration 20260820_008 en a ensuite remplacé les marqueurs
-- visibles par des libellés ordinaires. Cette opération rétablit la règle de
-- production : aucune donnée inventée ne doit alimenter les indicateurs.
--
-- Le périmètre est volontairement étroit : références DEMO explicites, douze
-- numéros de vente connus et lignes sans auteur créées le 20 août 2026. La
-- transaction s'arrête si un lot de vente réel s'appuie sur un achat de démo.
-- ============================================================================

-- Règlements de démonstration -----------------------------------------------
DELETE FROM public.snp_reglements_preuves
WHERE reglement_id IN (
  SELECT id FROM public.snp_reglements_achat WHERE reference_interne LIKE 'DEMO-%'
);

DELETE FROM public.snp_reglements_affectations
WHERE reglement_id IN (
  SELECT id FROM public.snp_reglements_achat WHERE reference_interne LIKE 'DEMO-%'
);

DELETE FROM public.snp_reglements_achat WHERE reference_interne LIKE 'DEMO-%';
DELETE FROM public.snp_factures_achat WHERE numero_facture LIKE 'FA-DEMO-%';
DELETE FROM public.snp_achats_mines WHERE numero_achat LIKE 'ACH-DEMO-%';
DELETE FROM public.stakeholder_bank_accounts WHERE notes = 'Jeu de démonstration';

-- Achats mensuels issus du jeu de présentation ------------------------------
CREATE TEMP TABLE snp_achats_demo_a_retirer ON COMMIT DROP AS
SELECT id
FROM public.snp_achats_mines
WHERE observations = 'Achat mensuel de la production déclarée sur la période.'
  AND created_by IS NULL
  AND created_at::date = DATE '2026-08-20';

-- Un achat déjà affecté à une vente ne peut pas être supprimé silencieusement.
-- Il est marqué pour revue ; les autres écritures de démonstration sont retirées.
UPDATE public.snp_achats_mines a
SET observations = 'DONNÉE DE DÉMONSTRATION À RETIRER — achat déjà affecté à une vente.'
WHERE a.id IN (SELECT id FROM snp_achats_demo_a_retirer)
  AND EXISTS (
    SELECT 1 FROM public.snp_ventes_lots l WHERE l.achat_mine_id = a.id
  );

DELETE FROM public.snp_analyses_teneur a
WHERE a.achat_id IN (SELECT id FROM snp_achats_demo_a_retirer)
  AND NOT EXISTS (
    SELECT 1 FROM public.snp_ventes_lots l WHERE l.achat_mine_id = a.achat_id
  );

DELETE FROM public.snp_achats_mines a
WHERE a.id IN (SELECT id FROM snp_achats_demo_a_retirer)
  AND NOT EXISTS (
    SELECT 1 FROM public.snp_ventes_lots l WHERE l.achat_mine_id = a.id
  );

-- Ventes de présentation ----------------------------------------------------
CREATE TEMP TABLE snp_ventes_demo_a_retirer ON COMMIT DROP AS
SELECT id
FROM public.sales
WHERE sale_number IN (
  'SL-2026-001', 'SL-2026-002', 'SL-2026-003', 'SL-2026-004',
  'SL-2026-005', 'SL-2026-006', 'SL-2026-007', 'SL-2026-008',
  'SL-2026-009', 'SL-2026-010', 'SL-2026-011', 'SL-2026-012'
)
  AND created_by IS NULL
  AND created_at::date = DATE '2026-08-20';

DELETE FROM public.customer_accounts_receivable
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.payments
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sale_pricing_details
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sales_allocations
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sales_approvals
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sales_audit_trail
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sales_commissions
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sales_documents
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sales_line_items
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sales_notifications_log
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sales_payment_schedules
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.snp_ventes_lots
WHERE sale_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.approval_requests
WHERE entity_type IN ('sale', 'sales')
  AND entity_id IN (SELECT id FROM snp_ventes_demo_a_retirer);
DELETE FROM public.sales WHERE id IN (SELECT id FROM snp_ventes_demo_a_retirer);

-- Une affectation provenant elle-même d'une vente de présentation vient
-- d'être retirée : réessayer maintenant le nettoyage de ses achats sources.
DELETE FROM public.snp_analyses_teneur a
WHERE a.achat_id IN (SELECT id FROM snp_achats_demo_a_retirer)
  AND NOT EXISTS (
    SELECT 1 FROM public.snp_ventes_lots l WHERE l.achat_mine_id = a.achat_id
  );
DELETE FROM public.snp_achats_mines a
WHERE a.id IN (SELECT id FROM snp_achats_demo_a_retirer)
  AND NOT EXISTS (
    SELECT 1 FROM public.snp_ventes_lots l WHERE l.achat_mine_id = a.id
  );

-- Expéditions et productions de présentation -------------------------------
CREATE TEMP TABLE snp_expeditions_demo_a_retirer ON COMMIT DROP AS
SELECT id
FROM public.freight_shipments
WHERE reference_number IN (
  'EXP-BF-2026-003', 'EXP-BF-2026-004', 'EXP-BF-2026-005',
  'EXP-BF-2026-006', 'EXP-BF-2026-007'
)
  AND created_at::date = DATE '2026-08-20';

DELETE FROM public.freight_shipment_productions
WHERE freight_shipment_id IN (SELECT id FROM snp_expeditions_demo_a_retirer);
DELETE FROM public.freight_shipment_signatories
WHERE freight_shipment_id IN (SELECT id FROM snp_expeditions_demo_a_retirer);
DELETE FROM public.freight_shipments
WHERE id IN (SELECT id FROM snp_expeditions_demo_a_retirer);

CREATE TEMP TABLE snp_productions_demo_a_retirer ON COMMIT DROP AS
SELECT id
FROM public.daily_production
WHERE notes = 'Coulée hebdomadaire.'
  AND created_by IS NULL
  AND created_at::date = DATE '2026-08-20';

DELETE FROM public.production_documents
WHERE production_id IN (SELECT id FROM snp_productions_demo_a_retirer);
DELETE FROM public.production_status_history
WHERE production_id IN (SELECT id FROM snp_productions_demo_a_retirer);
DELETE FROM public.shipping_production_items
WHERE production_id IN (SELECT id FROM snp_productions_demo_a_retirer);
DELETE FROM public.daily_production
WHERE id IN (SELECT id FROM snp_productions_demo_a_retirer);

-- Référentiels calculés uniquement pour la présentation ---------------------
DELETE FROM public.quarterly_forecasts
WHERE notes = 'Prévision révisée à l’ouverture du trimestre.'
  AND created_at::date = DATE '2026-08-20';

DELETE FROM public.export_licenses
WHERE notes = 'Licence annuelle d’exportation.'
  AND license_number IN (
    'EXP-ESK-2026-0001', 'EXP-HGO-2026-0001',
    'EXP-SGO-2026-0001', 'EXP-BGO-2026-0001'
  )
  AND created_at::date = DATE '2026-08-20';

DELETE FROM public.gold_prices_daily
WHERE source = 'Référence interne'
  AND notes = 'Cours de référence retenu pour la valorisation interne.'
  AND created_at::date = DATE '2026-08-20';

DELETE FROM public.fx_rates_daily
WHERE notes = 'Taux de référence retenu pour la conversion interne.'
  AND created_at::date = DATE '2026-08-20';

-- Les budgets annuels/mensuels ne portaient aucun marqueur métier fiable.
-- Ils ne sont donc pas supprimés automatiquement : le rapport de préparation
-- demande leur rapprochement avec les décisions budgétaires signées.
