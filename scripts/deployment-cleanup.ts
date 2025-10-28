#!/usr/bin/env tsx

/**
 * Deployment Cleanup Script
 *
 * This script should be run BEFORE each deployment to:
 * 1. Invalidate all active user sessions
 * 2. Force all users to re-authenticate
 * 3. Clean up expired sessions from database
 *
 * Usage:
 *   npm run deploy:cleanup
 *   or
 *   npx tsx scripts/deployment-cleanup.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing Supabase configuration');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function cleanupSessions() {
  console.log('🚀 Starting deployment cleanup...\n');

  try {
    // Step 1: Clean up expired sessions
    console.log('📊 Cleaning up expired sessions...');
    const { data: expiredSessions, error: expiredError } = await supabase
      .from('user_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (expiredError) {
      console.error('❌ Error cleaning expired sessions:', expiredError.message);
    } else {
      console.log(`✅ Cleaned up ${expiredSessions?.length || 0} expired sessions`);
    }

    // Step 2: Invalidate ALL active sessions
    console.log('\n🔒 Invalidating all active sessions...');
    const { data: allSessions, error: invalidateError } = await supabase
      .from('user_sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
      .select();

    if (invalidateError) {
      console.error('❌ Error invalidating sessions:', invalidateError.message);
      throw invalidateError;
    }

    console.log(`✅ Invalidated ${allSessions?.length || 0} active sessions`);

    // Step 3: Get count of active users (who will need to re-authenticate)
    const { count: userCount, error: countError } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (!countError && userCount !== null) {
      console.log(`\n👥 ${userCount} users will need to re-authenticate after deployment`);
    }

    console.log('\n✅ Deployment cleanup completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Expired sessions cleaned: ${expiredSessions?.length || 0}`);
    console.log(`   - Active sessions invalidated: ${allSessions?.length || 0}`);
    console.log(`   - Total users affected: ${userCount || 0}`);
    console.log('\n🎉 All users will be logged out and required to sign in again.');
    console.log('   This ensures everyone is using the latest version of the application.\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run cleanup
cleanupSessions();
