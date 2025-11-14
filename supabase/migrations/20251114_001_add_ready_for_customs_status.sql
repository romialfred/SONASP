/*
  # Ajout du statut 'Ready for Customs' au workflow de production

  1. Modifications
    - Ajoute 'ready_for_customs' au type enum production_status
    - Met à jour toutes les productions existantes à 'prepared'
    - Ajoute des indexes pour les performances

  2. Workflow de statut mis à jour
    - prepared → ready_for_customs → shipped → refined → sold

  3. Sécurité
    - Les politiques RLS existantes sont maintenues
    - L'historique des changements est automatiquement enregistré via le trigger existant
*/

-- Ajouter le nouveau statut 'ready_for_customs' à l'enum production_status
DO $$
BEGIN
  -- Vérifier si le statut existe déjà
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'production_status'
    AND e.enumlabel = 'ready_for_customs'
  ) THEN
    -- Ajouter le nouveau statut entre 'prepared' et 'shipped'
    ALTER TYPE production_status ADD VALUE 'ready_for_customs' BEFORE 'shipped';
    RAISE NOTICE '✅ Statut ready_for_customs ajouté à production_status';
  ELSE
    RAISE NOTICE '✅ Statut ready_for_customs existe déjà';
  END IF;
END $$;

-- Mettre à jour toutes les productions existantes à 'prepared' si elles n'ont pas de statut
UPDATE daily_production
SET status = 'prepared'
WHERE status IS NULL;

-- Mettre à jour toutes les productions qui ont 'shipped' vers 'prepared'
-- SAUF celles qui sont déjà dans des expéditions (via shipping_production_items)
UPDATE daily_production
SET status = 'prepared'
WHERE status = 'shipped'
AND id NOT IN (
  SELECT DISTINCT daily_production_id
  FROM shipping_production_items
  WHERE daily_production_id IS NOT NULL
);

-- Créer un index pour les requêtes sur ready_for_customs
CREATE INDEX IF NOT EXISTS idx_daily_production_ready_for_customs
  ON daily_production(status)
  WHERE status = 'ready_for_customs';

-- Créer un index composé pour mining_company + status
CREATE INDEX IF NOT EXISTS idx_daily_production_company_ready
  ON daily_production(mining_company_id, status)
  WHERE status IN ('prepared', 'ready_for_customs');

-- Mise à jour du commentaire sur la colonne status
COMMENT ON COLUMN daily_production.status IS 'Workflow: prepared → ready_for_customs → shipped → refined → sold. Le statut ready_for_customs indique que la production est prête pour la douane et peut être incluse dans une expédition.';

-- Vérification
DO $$
DECLARE
  v_enum_values text;
  v_prepared_count integer;
  v_ready_count integer;
BEGIN
  -- Afficher toutes les valeurs de l'enum
  SELECT string_agg(e.enumlabel::text, ', ' ORDER BY e.enumsortorder)
  INTO v_enum_values
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'production_status';

  RAISE NOTICE '📋 Valeurs production_status: %', v_enum_values;

  -- Compter les productions par statut
  SELECT COUNT(*) INTO v_prepared_count
  FROM daily_production
  WHERE status = 'prepared';

  SELECT COUNT(*) INTO v_ready_count
  FROM daily_production
  WHERE status = 'ready_for_customs';

  RAISE NOTICE '📊 Productions prepared: %', v_prepared_count;
  RAISE NOTICE '📊 Productions ready_for_customs: %', v_ready_count;

  RAISE NOTICE '✅ Migration terminée avec succès';
END $$;
