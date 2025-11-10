/*
  # Cleanup Shipping Preparation System (OPTIONAL - RUN ONLY IF NEEDED)

  This migration drops all shipping preparation related objects.
  Use this ONLY if you need to completely reset the shipping preparation system.

  WARNING: This will delete all data in these tables!
*/

-- Drop all policies first
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view shipping preparations" ON shipping_preparations;
  DROP POLICY IF EXISTS "Users can create shipping preparations" ON shipping_preparations;
  DROP POLICY IF EXISTS "Users can update shipping preparations" ON shipping_preparations;
  DROP POLICY IF EXISTS "Users can delete shipping preparations" ON shipping_preparations;

  DROP POLICY IF EXISTS "Users can view signatories" ON shipping_signatories;
  DROP POLICY IF EXISTS "Users can create signatories" ON shipping_signatories;
  DROP POLICY IF EXISTS "Users can update signatories" ON shipping_signatories;
  DROP POLICY IF EXISTS "Users can delete signatories" ON shipping_signatories;

  DROP POLICY IF EXISTS "Users can view ingots" ON shipping_ingots;
  DROP POLICY IF EXISTS "Users can create ingots" ON shipping_ingots;
  DROP POLICY IF EXISTS "Users can update ingots" ON shipping_ingots;
  DROP POLICY IF EXISTS "Users can delete ingots" ON shipping_ingots;
END $$;

-- Drop trigger
DROP TRIGGER IF EXISTS shipping_preparations_updated_at ON shipping_preparations;

-- Drop function
DROP FUNCTION IF EXISTS update_shipping_preparations_updated_at();

-- Drop tables (cascade will drop foreign keys)
DROP TABLE IF EXISTS shipping_ingots CASCADE;
DROP TABLE IF EXISTS shipping_signatories CASCADE;
DROP TABLE IF EXISTS shipping_preparations CASCADE;
