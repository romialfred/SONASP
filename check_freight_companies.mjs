import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function listAllFreightCompanies() {
  console.log('📋 Liste de toutes les compagnies de fret...\n');
  
  const { data: companies, error } = await supabase
    .from('freight_companies')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }
  
  if (!companies || companies.length === 0) {
    console.log('ℹ️ Aucune compagnie trouvée');
    return;
  }
  
  console.log('Total:', companies.length, 'compagnie(s)\n');
  
  companies.forEach((c, idx) => {
    console.log((idx + 1) + '. ' + c.name);
    console.log('   ID:', c.id);
    console.log('   Code:', c.code || 'N/A');
    console.log('   Email:', c.contact_email || 'N/A');
    console.log('   Téléphone:', c.contact_phone || 'N/A');
    console.log('   Actif:', c.is_active ? 'Oui' : 'Non');
    console.log('---');
  });
}

listAllFreightCompanies().catch(console.error);
