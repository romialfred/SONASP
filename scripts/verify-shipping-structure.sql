-- =====================================================
-- VERIFICATION: Structure de shipping_production_items
-- =====================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STRUCTURE DE shipping_production_items';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Afficher toutes les colonnes
  FOR rec IN
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = 'shipping_production_items'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  % : % %',
      RPAD(rec.column_name, 30),
      RPAD(rec.data_type, 20),
      CASE WHEN rec.is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';

END $$;
