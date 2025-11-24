import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger .env depuis le dossier du projet
dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('🔍 DIAGNOSTIC SHIPPING PREPARATIONS\n');

// 1. Vérifier les données brutes
const { data: rawData, error: rawError } = await supabase
  .from('shipping_preparations')
  .select('id, expedition_lot_number, mining_company_id, seal_number, total_boxes')
  .order('created_at', { ascending: false })
  .limit(5);

if (rawError) {
  console.error('❌ Erreur:', rawError);
  process.exit(1);
}

console.log('📊 DONNÉES BRUTES (5 dernières):');
console.table(rawData);

// 2. Vérifier avec la jointure
const { data: joinData, error: joinError } = await supabase
  .from('shipping_preparations')
  .select(`
    id,
    expedition_lot_number,
    mining_company_id,
    seal_number,
    total_boxes,
    mining_companies!shipping_preparations_mining_company_id_fkey(name)
  `)
  .order('created_at', { ascending: false })
  .limit(5);

if (joinError) {
  console.error('❌ Erreur jointure:', joinError);
} else {
  console.log('\n📊 DONNÉES AVEC JOINTURE:');
  joinData.forEach(prep => {
    console.log({
      expedition: prep.expedition_lot_number,
      mining_company_id: prep.mining_company_id,
      mining_company_name: prep.mining_companies?.name,
      seal_number: prep.seal_number,
      total_boxes: prep.total_boxes
    });
  });
}

// 3. Vérifier les mining companies
const { data: companies, error: compError } = await supabase
  .from('mining_companies')
  .select('id, name')
  .limit(5);

if (!compError) {
  console.log('\n📊 MINING COMPANIES DISPONIBLES:');
  console.table(companies);
}

// 4. Vérifier les production items pour compter les boxes
console.log('\n📊 COMPTAGE DES BOXES PAR EXPÉDITION:');
const { data: boxes, error: boxError } = await supabase
  .from('shipping_production_items')
  .select('shipping_preparation_id')
  .order('shipping_preparation_id');

if (!boxError && boxes) {
  const counts = {};
  boxes.forEach(item => {
    counts[item.shipping_preparation_id] = (counts[item.shipping_preparation_id] || 0) + 1;
  });
  
  console.log('Boxes par préparation:');
  Object.entries(counts).slice(0, 5).forEach(([id, count]) => {
    console.log(`  ${id}: ${count} boxes`);
  });
}

console.log('\n✅ Diagnostic terminé');
