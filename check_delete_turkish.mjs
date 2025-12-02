import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function findAndDeleteTurkish() {
  console.log('🔍 Recherche dans transport_companies...\n');
  
  // First, list all companies
  const { data: allCompanies, error: listError } = await supabase
    .from('transport_companies')
    .select('*')
    .order('name');
  
  if (listError) {
    console.error('❌ Erreur:', listError);
    return;
  }
  
  console.log('📋 Toutes les compagnies (' + (allCompanies?.length || 0) + '):');
  if (allCompanies) {
    allCompanies.forEach((c, idx) => {
      console.log((idx + 1) + '. ' + c.name + ' (ID: ' + c.id + ')');
    });
  }
  
  // Find Turkish
  const { data: turkish, error: searchError } = await supabase
    .from('transport_companies')
    .select('*')
    .or('name.ilike.%turkish%,name.ilike.%turk%');
  
  if (searchError) {
    console.error('❌ Erreur recherche Turkish:', searchError);
    return;
  }
  
  if (!turkish || turkish.length === 0) {
    console.log('\n❌ Turkish Airlines non trouvée dans transport_companies');
    return;
  }
  
  console.log('\n✅ Turkish Airlines trouvée:');
  turkish.forEach(t => {
    console.log('   ID:', t.id);
    console.log('   Nom:', t.name);
    console.log('   Type:', t.company_type || 'N/A');
  });
  
  // Delete
  console.log('\n🗑️ Suppression en cours...');
  const { error: deleteError } = await supabase
    .from('transport_companies')
    .delete()
    .or('name.ilike.%turkish%,name.ilike.%turk%');
  
  if (deleteError) {
    console.error('❌ Erreur suppression:', deleteError);
    return;
  }
  
  console.log('✅ Turkish Airlines supprimée avec succès!');
  
  // Verify
  const { data: remaining, error: verifyError } = await supabase
    .from('transport_companies')
    .select('name')
    .order('name');
  
  if (!verifyError && remaining) {
    console.log('\n📊 Compagnies restantes (' + remaining.length + '):');
    remaining.forEach((c, idx) => {
      console.log((idx + 1) + '. ' + c.name);
    });
  }
}

findAndDeleteTurkish().catch(console.error);
