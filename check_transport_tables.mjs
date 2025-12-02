import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTables() {
  console.log('🔍 Recherche des tables de transport/fret...\n');
  
  // Try transport_companies
  console.log('1. Vérification transport_companies:');
  const { data: transport, error: e1 } = await supabase
    .from('transport_companies')
    .select('*')
    .limit(10);
  
  if (!e1 && transport) {
    console.log('✅ Table trouvée:', transport.length, 'enregistrement(s)');
    transport.forEach(t => console.log('   -', t.name));
  } else {
    console.log('❌ Table non trouvée ou erreur:', e1?.message);
  }
  
  // Try freight_companies
  console.log('\n2. Vérification freight_companies:');
  const { data: freight, error: e2 } = await supabase
    .from('freight_companies')
    .select('*')
    .limit(10);
  
  if (!e2 && freight) {
    console.log('✅ Table trouvée:', freight.length, 'enregistrement(s)');
    freight.forEach(f => console.log('   -', f.name));
  } else {
    console.log('❌ Table non trouvée ou erreur:', e2?.message);
  }
  
  // Try stakeholders with freight type
  console.log('\n3. Vérification stakeholders (freight):');
  const { data: stakeholders, error: e3 } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('stakeholder_type', 'freight_company')
    .limit(10);
  
  if (!e3 && stakeholders) {
    console.log('✅ Table trouvée:', stakeholders.length, 'enregistrement(s)');
    stakeholders.forEach(s => console.log('   -', s.name));
  } else {
    console.log('❌ Pas de freight dans stakeholders ou erreur:', e3?.message);
  }
}

checkTables().catch(console.error);
