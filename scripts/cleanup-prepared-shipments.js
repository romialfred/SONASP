import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗');
  process.exit(1);
}

console.log('🔑 Using Supabase URL:', supabaseUrl);
console.log('🔑 Credentials loaded successfully\n');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deleteDocumentFiles(preparationId) {
  try {
    console.log(`   📁 Fetching documents for preparation ${preparationId}...`);

    // Get all documents for this preparation
    const { data: documents, error: fetchError } = await supabase
      .from('shipping_documents')
      .select('file_name')
      .eq('shipping_preparation_id', preparationId);

    if (fetchError) {
      console.error(`   ⚠️ Error fetching documents: ${fetchError.message}`);
      return;
    }

    if (!documents || documents.length === 0) {
      console.log(`   ℹ️ No documents found for this preparation`);
      return;
    }

    console.log(`   📄 Found ${documents.length} document(s) to delete`);

    // Delete each file from storage
    for (const doc of documents) {
      const filePath = `${preparationId}/${doc.file_name}`;
      console.log(`      Deleting file: ${filePath}`);

      const { error: deleteError } = await supabase.storage
        .from('shipping-documents')
        .remove([filePath]);

      if (deleteError) {
        console.error(`      ⚠️ Error deleting file ${filePath}: ${deleteError.message}`);
      } else {
        console.log(`      ✅ Deleted file: ${filePath}`);
      }
    }

    // Try to delete the folder itself
    try {
      const { error: folderError } = await supabase.storage
        .from('shipping-documents')
        .remove([`${preparationId}/`]);

      if (!folderError) {
        console.log(`   ✅ Deleted folder: ${preparationId}/`);
      }
    } catch (e) {
      // Folder deletion might fail if not empty, that's okay
    }

  } catch (error) {
    console.error(`   ⚠️ Error in deleteDocumentFiles: ${error.message}`);
  }
}

async function cleanupPreparedShipments(dryRun = false) {
  if (dryRun) {
    console.log('👁️ DRY RUN MODE - No data will be deleted\n');
  }
  console.log('🚀 Starting cleanup of prepared shipments...\n');

  try {
    // Step 1: Get all preparations with status 'prepared'
    console.log('📋 Step 1: Fetching all preparations with status "prepared"...');
    const { data: preparations, error: prepError } = await supabase
      .from('shipping_preparations')
      .select('id, expedition_lot_number, status, created_at')
      .eq('status', 'prepared');

    if (prepError) {
      throw new Error(`Error fetching preparations: ${prepError.message}`);
    }

    if (!preparations || preparations.length === 0) {
      console.log('✅ No prepared shipments found. Nothing to clean up.\n');
      return;
    }

    console.log(`✅ Found ${preparations.length} prepared shipment(s) to delete:\n`);

    preparations.forEach((prep, index) => {
      console.log(`   ${index + 1}. ${prep.expedition_lot_number} (${prep.id})`);
    });
    console.log('');

    // Step 2: Delete related data for each preparation
    for (const prep of preparations) {
      console.log(`\n${dryRun ? '👁️' : '🗑️'} Processing preparation: ${prep.expedition_lot_number} (${prep.id})`);

      if (dryRun) {
        // Just show what would be deleted
        const { data: docs } = await supabase
          .from('shipping_documents')
          .select('id, title, file_name')
          .eq('shipping_preparation_id', prep.id);

        const { data: items } = await supabase
          .from('shipping_production_items')
          .select('id, ingot_box_number')
          .eq('shipping_preparation_id', prep.id);

        const { data: sigs } = await supabase
          .from('shipping_signatories')
          .select('id, position, name')
          .eq('shipping_preparation_id', prep.id);

        console.log(`   📄 Would delete ${docs?.length || 0} document(s)`);
        docs?.forEach(doc => console.log(`      - ${doc.title} (${doc.file_name})`));

        console.log(`   📦 Would delete ${items?.length || 0} production item(s)`);
        items?.forEach(item => console.log(`      - ${item.ingot_box_number}`));

        console.log(`   ✍️ Would delete ${sigs?.length || 0} signatory(ies)`);
        sigs?.forEach(sig => console.log(`      - ${sig.position}: ${sig.name}`));

        continue;
      }

      // Delete document files from storage
      await deleteDocumentFiles(prep.id);

      // Delete shipping_documents records
      console.log('   🗄️ Deleting shipping_documents records...');
      const { error: docsError } = await supabase
        .from('shipping_documents')
        .delete()
        .eq('shipping_preparation_id', prep.id);

      if (docsError) {
        console.error(`   ⚠️ Error deleting shipping_documents: ${docsError.message}`);
      } else {
        console.log('   ✅ Deleted shipping_documents records');
      }

      // Delete shipping_production_items
      console.log('   🗄️ Deleting shipping_production_items...');
      const { error: itemsError } = await supabase
        .from('shipping_production_items')
        .delete()
        .eq('shipping_preparation_id', prep.id);

      if (itemsError) {
        console.error(`   ⚠️ Error deleting shipping_production_items: ${itemsError.message}`);
      } else {
        console.log('   ✅ Deleted shipping_production_items');
      }

      // Delete shipping_signatories
      console.log('   🗄️ Deleting shipping_signatories...');
      const { error: sigsError } = await supabase
        .from('shipping_signatories')
        .delete()
        .eq('shipping_preparation_id', prep.id);

      if (sigsError) {
        console.error(`   ⚠️ Error deleting shipping_signatories: ${sigsError.message}`);
      } else {
        console.log('   ✅ Deleted shipping_signatories');
      }

      // Finally, delete the preparation itself
      console.log('   🗄️ Deleting shipping_preparation...');
      const { error: prepDelError } = await supabase
        .from('shipping_preparations')
        .delete()
        .eq('id', prep.id);

      if (prepDelError) {
        console.error(`   ⚠️ Error deleting shipping_preparation: ${prepDelError.message}`);
      } else {
        console.log('   ✅ Deleted shipping_preparation');
      }

      console.log(`   ✅ Completed ${dryRun ? 'preview' : 'cleanup'} for ${prep.expedition_lot_number}`);
    }

    if (dryRun) {
      console.log('\n\n👁️ Dry run completed successfully!');
      console.log(`📊 Summary: Would delete ${preparations.length} prepared shipment(s) and all related data.`);
      console.log('\n💡 To actually delete the data, run: npm run cleanup:prepared-shipments\n');
    } else {
      console.log('\n\n✅ Cleanup completed successfully!');
      console.log(`📊 Summary: Deleted ${preparations.length} prepared shipment(s) and all related data.\n`);
    }

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('--preview') || args.includes('-p');

// Run the cleanup
cleanupPreparedShipments(isDryRun);
