/*
  ═══════════════════════════════════════════════════════════════════════════
  🗑️  DELETE ALL LICENSE DATA - WITH PROPER FK HANDLING
  ═══════════════════════════════════════════════════════════════════════════

  This script safely deletes all license-related data while respecting
  foreign key constraints.

  CAUTION: This will delete ALL license data!
*/

DO $$
DECLARE
  v_licenses_count INT := 0;
  v_requests_count INT := 0;
  v_transactions_count INT := 0;
  v_events_count INT := 0;
  v_documents_count INT := 0;
  v_batches_updated INT := 0;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🗑️  DELETING ALL LICENSE DATA';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Count existing data before deletion
  SELECT COUNT(*) INTO v_licenses_count FROM licenses;
  SELECT COUNT(*) INTO v_requests_count FROM license_requests;
  SELECT COUNT(*) INTO v_transactions_count FROM license_quota_transactions;
  SELECT COUNT(*) INTO v_events_count FROM license_events;
  SELECT COUNT(*) INTO v_documents_count FROM license_request_documents;

  RAISE NOTICE '📊 CURRENT DATA:';
  RAISE NOTICE '  Licenses: %', v_licenses_count;
  RAISE NOTICE '  License Requests: %', v_requests_count;
  RAISE NOTICE '  Quota Transactions: %', v_transactions_count;
  RAISE NOTICE '  Events: %', v_events_count;
  RAISE NOTICE '  Documents: %', v_documents_count;
  RAISE NOTICE '';

  -- Step 1: Remove license references from batches
  RAISE NOTICE '🔨 Step 1: Removing license references from batches...';
  UPDATE batches SET license_id = NULL WHERE license_id IS NOT NULL;
  GET DIAGNOSTICS v_batches_updated = ROW_COUNT;
  RAISE NOTICE '  ✓ Updated % batches (set license_id to NULL)', v_batches_updated;
  RAISE NOTICE '';

  -- Step 2: Delete license request documents
  RAISE NOTICE '🔨 Step 2: Deleting license request documents...';
  DELETE FROM license_request_documents;
  RAISE NOTICE '  ✓ Deleted % documents', v_documents_count;
  RAISE NOTICE '';

  -- Step 3: Delete license quota transactions
  RAISE NOTICE '🔨 Step 3: Deleting quota transactions...';
  DELETE FROM license_quota_transactions;
  RAISE NOTICE '  ✓ Deleted % transactions', v_transactions_count;
  RAISE NOTICE '';

  -- Step 4: Delete license events
  RAISE NOTICE '🔨 Step 4: Deleting license events...';
  DELETE FROM license_events;
  RAISE NOTICE '  ✓ Deleted % events', v_events_count;
  RAISE NOTICE '';

  -- Step 5: Delete license requests
  RAISE NOTICE '🔨 Step 5: Deleting license requests...';
  DELETE FROM license_requests;
  RAISE NOTICE '  ✓ Deleted % requests', v_requests_count;
  RAISE NOTICE '';

  -- Step 6: Delete licenses
  RAISE NOTICE '🔨 Step 6: Deleting licenses...';
  DELETE FROM licenses;
  RAISE NOTICE '  ✓ Deleted % licenses', v_licenses_count;
  RAISE NOTICE '';

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ DELETION COMPLETE!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 SUMMARY:';
  RAISE NOTICE '  Total items deleted: %',
    v_licenses_count + v_requests_count + v_transactions_count +
    v_events_count + v_documents_count;
  RAISE NOTICE '  Batches updated: % (license_id set to NULL)', v_batches_updated;
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NEXT STEP:';
  RAISE NOTICE '   Run migration 20 to add fresh sample data!';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- Verify deletion
DO $$
DECLARE
  v_remaining INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 VERIFICATION:';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO v_remaining FROM licenses;
  RAISE NOTICE '  Licenses remaining: %', v_remaining;

  SELECT COUNT(*) INTO v_remaining FROM license_requests;
  RAISE NOTICE '  Requests remaining: %', v_remaining;

  SELECT COUNT(*) INTO v_remaining FROM license_quota_transactions;
  RAISE NOTICE '  Transactions remaining: %', v_remaining;

  SELECT COUNT(*) INTO v_remaining FROM license_events;
  RAISE NOTICE '  Events remaining: %', v_remaining;

  SELECT COUNT(*) INTO v_remaining FROM license_request_documents;
  RAISE NOTICE '  Documents remaining: %', v_remaining;

  RAISE NOTICE '';

  -- Check batches with license_id
  SELECT COUNT(*) INTO v_remaining FROM batches WHERE license_id IS NOT NULL;
  RAISE NOTICE '  Batches with license_id: %', v_remaining;
  RAISE NOTICE '';

  IF v_remaining = 0 THEN
    RAISE NOTICE '✅ ALL LICENSE DATA DELETED SUCCESSFULLY!';
    RAISE NOTICE '   Ready to run migration 20!';
  ELSE
    RAISE NOTICE '⚠️  Some batches still reference licenses!';
  END IF;

  RAISE NOTICE '';
END $$;
