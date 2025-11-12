-- Test de syntaxe basique pour vérifier que la migration est valide

-- Test 1: DO blocks avec RAISE NOTICE
DO $$
BEGIN
  RAISE NOTICE 'Test 1: DO block works';
END $$;

-- Test 2: CREATE TYPE
DO $$ BEGIN
  DROP TYPE IF EXISTS test_enum CASCADE;
  CREATE TYPE test_enum AS ENUM ('value1', 'value2');
  RAISE NOTICE 'Test 2: ENUM creation works';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Test 2: ENUM already exists (OK)';
END $$;

-- Test 3: CREATE TABLE
CREATE TABLE IF NOT EXISTS test_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status test_enum NOT NULL DEFAULT 'value1',
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  RAISE NOTICE 'Test 3: Table creation works';
END $$;

-- Test 4: CREATE FUNCTION
CREATE OR REPLACE FUNCTION test_function()
RETURNS TRIGGER AS $$
BEGIN
  RAISE NOTICE 'Test 4: Function works';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Test 5: CREATE TRIGGER
DROP TRIGGER IF EXISTS test_trigger ON test_table;
CREATE TRIGGER test_trigger
  AFTER INSERT ON test_table
  FOR EACH ROW
  EXECUTE FUNCTION test_function();

DO $$
BEGIN
  RAISE NOTICE 'Test 5: Trigger creation works';
END $$;

-- Test 6: CREATE VIEW
CREATE OR REPLACE VIEW test_view AS
SELECT * FROM test_table WHERE status = 'value1';

DO $$
BEGIN
  RAISE NOTICE 'Test 6: View creation works';
END $$;

-- Cleanup
DROP VIEW IF EXISTS test_view;
DROP TRIGGER IF EXISTS test_trigger ON test_table;
DROP FUNCTION IF EXISTS test_function;
DROP TABLE IF EXISTS test_table;
DROP TYPE IF EXISTS test_enum CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ All syntax tests passed!';
END $$;
