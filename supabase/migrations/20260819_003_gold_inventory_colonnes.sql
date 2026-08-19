-- ============================================================================
-- Suivi des stocks : colonnes manquantes sur `gold_inventory`
--
-- Le formulaire d'entrée collectait la teneur en argent et la raffinerie, puis
-- les abandonnait à l'enregistrement. La société minière, elle, n'était jamais
-- posée : le stock ne pouvait pas être ventilé par mine, et l'écran national
-- devait la reconstituer par une chaîne de jointures
-- (`gold_inventory` → `freight_shipments` → `freight_shipment_productions` →
-- `daily_production`), qui se rompait dès qu'un maillon manquait.
--
-- Migration additive et idempotente : `IF NOT EXISTS` sur chaque colonne. Aucune
-- donnée existante n'est modifiée.
--
-- Retour arrière :
--   ALTER TABLE gold_inventory
--     DROP COLUMN IF EXISTS silver_percentage,
--     DROP COLUMN IF EXISTS refinery_id,
--     DROP COLUMN IF EXISTS mining_company_id;
--   (Ne supprimer `mining_company_id` que si elle n'existait pas auparavant :
--    d'autres requêtes du service s'y appuient déjà.)
-- ============================================================================

ALTER TABLE gold_inventory
  ADD COLUMN IF NOT EXISTS silver_percentage numeric(6, 3);

COMMENT ON COLUMN gold_inventory.silver_percentage IS
  'Teneur en argent relevée à l''essai, en pourcentage.';

ALTER TABLE gold_inventory
  ADD COLUMN IF NOT EXISTS refinery_id uuid REFERENCES refineries(id);

COMMENT ON COLUMN gold_inventory.refinery_id IS
  'Raffinerie ayant réalisé l''essai du lot.';

ALTER TABLE gold_inventory
  ADD COLUMN IF NOT EXISTS mining_company_id uuid REFERENCES mining_companies(id);

COMMENT ON COLUMN gold_inventory.mining_company_id IS
  'Société minière au nom de laquelle le stock est détenu. Alimentée depuis '
  'l''expédition réceptionnée.';

-- La ventilation nationale par mine lit cette colonne sur l'ensemble du stock.
CREATE INDEX IF NOT EXISTS idx_gold_inventory_mining_company
  ON gold_inventory (mining_company_id);

-- ----------------------------------------------------------------------------
-- Rattrapage : rattacher les entrées déjà en base à leur société minière, par
-- l'expédition dont elles sont issues. Les lignes sans expédition rattachée
-- restent sans société — l'écran les regroupe sous « Sans société rattachée »
-- plutôt que de les écarter du total.
-- ----------------------------------------------------------------------------
UPDATE gold_inventory AS stock
SET mining_company_id = fret.mining_company_id
FROM freight_shipments AS fret
WHERE stock.freight_shipment_id = fret.id
  AND stock.mining_company_id IS NULL
  AND fret.mining_company_id IS NOT NULL;
