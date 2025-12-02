import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function deleteTurkishAirline() {
  console.log('🔍 Recherche de Turkish Airlines...');
  
  // First, find Turkish Airlines
  const { data: companies, error: searchError } = await supabase
    .from('freight_companies')
    .select('*')
    .or('name.ilike.%turkish%,name.ilike.%turk%');
  
  if (searchError) {
    console.error('❌ Erreur lors de la recherche:', searchError);
    return;
  }
  
  if (!companies || companies.length === 0) {
    console.log('ℹ️ Aucune compagnie Turkish Airlines trouvée');
    return;
  }
  
  console.log('📋 Compagnie(s) trouvée(s):');
  companies.forEach(c => {
    console.log('  - ID:', c.id);
    console.log('    Nom:', c.name);
    console.log('    Code:', c.code);
    console.log('    Contact:', c.contact_email || 'N/A');
  });
  
  // Delete Turkish Airlines
  const { error: deleteError } = await supabase
    .from('freight_companies')
    .delete()
    .or('name.ilike.%turkish%,name.ilike.%turk%');
  
  if (deleteError) {
    console.error('❌ Erreur lors de la suppression:', deleteError);
    return;
  }
  
  console.log('✅ Turkish Airlines supprimée avec succès!');
  
  // Verify deletion
  const { data: verification } = await supabase
    .from('freight_companies')
    .select('name')
    .or('name.ilike.%turkish%,name.ilike.%turk%');
  
  if (verification && verification.length === 0) {
    console.log('✅ Vérification: Aucune trace de Turkish Airlines');
  } else {
    console.log('⚠️ Attention: Des enregistrements existent encore');
  }
  
  // Show remaining companies
  const { data: remaining } = await supabase
    .from('freight_companies')
    .select('name')
    .order('name');
  
  console.log('\n📊 Compagnies restantes:', remaining?.length || 0);
  if (remaining) {
    remaining.forEach(c => console.log('  -', c.name));
  }
}

deleteTurkishAirline().catch(console.error);
