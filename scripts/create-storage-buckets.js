/**
 * Create Supabase Storage Buckets
 *
 * This script creates the required storage buckets using the Supabase Admin API.
 * Run this script with: node scripts/create-storage-buckets.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const bucketsConfig = [
  {
    id: 'documents',
    name: 'documents',
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
  },
  {
    id: 'reports',
    name: 'reports',
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ]
  },
  {
    id: 'payment-proofs',
    name: 'payment-proofs',
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ]
  }
];

async function createStorageBuckets() {
  console.log('🚀 Starting storage bucket creation...\n');

  // Get existing buckets
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('❌ Error listing buckets:', listError);
    return;
  }

  console.log('📋 Existing buckets:', existingBuckets.map(b => b.name).join(', ') || 'None');
  console.log('');

  // Create each bucket
  for (const config of bucketsConfig) {
    const exists = existingBuckets.some(b => b.name === config.name);

    if (exists) {
      console.log(`✓ Bucket '${config.name}' already exists`);

      // Try to update bucket settings
      const { error: updateError } = await supabase.storage.updateBucket(config.id, {
        public: config.public,
        fileSizeLimit: config.fileSizeLimit,
        allowedMimeTypes: config.allowedMimeTypes
      });

      if (updateError) {
        console.log(`  ⚠ Could not update bucket settings: ${updateError.message}`);
      } else {
        console.log(`  ✓ Updated bucket settings`);
      }
    } else {
      console.log(`⏳ Creating bucket '${config.name}'...`);

      const { data, error } = await supabase.storage.createBucket(config.id, {
        public: config.public,
        fileSizeLimit: config.fileSizeLimit,
        allowedMimeTypes: config.allowedMimeTypes
      });

      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✓ Created successfully`);
      }
    }
    console.log('');
  }

  // Final verification
  const { data: finalBuckets } = await supabase.storage.listBuckets();
  const createdBuckets = finalBuckets.filter(b =>
    ['documents', 'reports', 'payment-proofs'].includes(b.name)
  );

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Summary:');
  console.log(`   ${createdBuckets.length}/3 buckets ready`);
  console.log('');
  createdBuckets.forEach(bucket => {
    console.log(`   ✓ ${bucket.name}`);
    console.log(`     - Public: ${bucket.public}`);
    console.log(`     - Size Limit: ${(bucket.file_size_limit / 1024 / 1024).toFixed(0)}MB`);
    console.log('');
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (createdBuckets.length === 3) {
    console.log('🎉 All storage buckets are ready!');
    console.log('   You can now upload documents in the application.');
  } else {
    console.log('⚠ Some buckets are missing. Please check the errors above.');
  }
}

// Run the script
createStorageBuckets()
  .then(() => {
    console.log('\n✓ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
