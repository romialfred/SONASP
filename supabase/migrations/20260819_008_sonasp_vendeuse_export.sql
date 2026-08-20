-- ============================================================================
-- La SONASP, vendeuse des ventes hors du Burkina
--
-- `gold_sales_settings` n'habilitait que les mines auprès de leurs clients :
-- la SONASP n'ayant aucune ligne, la liste déroulante des clients serait restée
-- vide dès lors qu'elle devient la vendeuse de `sales`. On lui ouvre chaque
-- client actif, aux conditions par défaut déjà en vigueur pour les mines
-- (100 % du stock, méthode standard, frais d'affinage et de transport à la
-- charge du client).
--
-- Les habilitations des mines sont conservées : elles documentent l'historique
-- des ventes antérieures, où la mine figurait comme vendeur.
--
-- Retour arrière :
--   DELETE FROM gold_sales_settings s USING mining_companies m
--   WHERE m.id = s.mining_company_id AND upper(m.code) = 'SONASP';
-- ============================================================================

INSERT INTO gold_sales_settings (
  mining_company_id, customer_id, max_stock_percentage, sale_method,
  refining_fees_paid_by_customer, transport_fees_paid_by_customer, is_active
)
SELECT s.id, c.id, 100.00, 'standard', true, true, true
FROM mining_companies s
CROSS JOIN customers c
WHERE upper(s.code) = 'SONASP' AND c.is_active = true
ON CONFLICT DO NOTHING;
