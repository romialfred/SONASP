-- Test rapide de la syntaxe
-- Copier dans Supabase SQL Editor pour tester

DO $$
BEGIN
  RAISE NOTICE 'Test 1: Bloc DO simple - OK';
END $$;

DO $$ BEGIN RAISE NOTICE 'Test 2: Bloc DO inline - OK'; END $$;

SELECT 'Test 3: SELECT simple - OK' as test;

-- Si tous les tests passent, la migration devrait fonctionner
RAISE NOTICE 'Si vous voyez cette erreur: RAISE doit être dans un bloc DO $$';
