import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStorage() {
  try {
    console.log('🚀 Setting up shipping documents storage...\n');

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      console.log('\n📌 Manual setup required:');
      console.log('   1. Go to: https://boolqagzdqbahqnpawpb.supabase.co');
      console.log('   2. Navigate to Storage');
      console.log('   3. Create a new bucket named: shipping-documents');
      console.log('   4. Set it as public bucket');
      console.log('   5. Configure RLS policies to allow authenticated users to upload/read');
      return;
    }

    const bucketExists = buckets?.some(b => b.name === 'shipping-documents');

    if (bucketExists) {
      console.log('✅ Bucket "shipping-documents" already exists');
    } else {
      console.log('📦 Creating "shipping-documents" bucket...');

      const { data, error } = await supabase.storage.createBucket('shipping-documents', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      });

      if (error) {
        console.error('❌ Error creating bucket:', error.message);
        console.log('\n📌 Manual setup required - see instructions above');
        return;
      }

      console.log('✅ Bucket "shipping-documents" created successfully');
    }

    console.log('\n🔐 Setting up storage policies...');
    console.log('   Note: Storage policies must be configured via Supabase Dashboard');
    console.log('\n📋 Required policies for "shipping-documents":');
    console.log('   1. SELECT: Allow authenticated users to read');
    console.log('      Policy: SELECT * FROM storage.objects WHERE bucket_id = \'shipping-documents\'');
    console.log('   2. INSERT: Allow authenticated users to upload');
    console.log('      Policy: WITH (auth.uid() IS NOT NULL)');
    console.log('   3. UPDATE: Allow users to update their own files');
    console.log('   4. DELETE: Allow users to delete their own files');

    console.log('\n✨ Storage setup complete!');
    console.log('📁 Bucket: shipping-documents');
    console.log('🌐 Public access: Enabled');
    console.log('📏 Max file size: 50MB');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

setupStorage();
