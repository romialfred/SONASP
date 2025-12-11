import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function seedMiningCompanies() {
  console.log('\n🚀 Seed des Mining Companies\n');

  const companiesToInsert = [
    {
      name: 'Kourousa',
      abbreviation: 'KGM',
      code: 'KGM',
      country: 'Guinea',
      region: 'Kankan',
      is_active: true
    },
    {
      name: 'Dugbe',
      abbreviation: 'DGB',
      code: 'DGB',
      country: 'Liberia',
      region: 'River Cess',
      is_active: true
    },
    {
      name: 'Yanfolila',
      abbreviation: 'YAN',
      code: 'YAN',
      country: 'Mali',
      region: 'Sikasso',
      is_active: true
    }
  ];

  // Check existing first
  const { data: existing } = await supabase
    .from('mining_companies')
    .select('abbreviation');

  const existingAbbrs = new Set(existing?.map(c => c.abbreviation) || []);

  for (const company of companiesToInsert) {
    if (existingAbbrs.has(company.abbreviation)) {
      console.log(`⏭️  ${company.name} (${company.abbreviation}) existe déjà`);
      continue;
    }

    const { data, error } = await supabase
      .from('mining_companies')
      .insert(company)
      .select()
      .single();

    if (error) {
      console.log(`❌ Erreur insertion ${company.name}:`, error.message);
    } else {
      console.log(`✅ ${company.name} (${company.abbreviation}) inséré avec succès`);
      console.log(`   ID: ${data.id}`);
    }
  }

  // Verify results
  console.log('\n📊 Vérification:\n');
  const { data: allCompanies } = await supabase
    .from('mining_companies')
    .select('*')
    .order('name');

  if (allCompanies && allCompanies.length > 0) {
    console.log('✅ Mining Companies dans la DB:');
    allCompanies.forEach(c => {
      console.log(`   - ${c.name} (${c.abbreviation}) - ${c.country}`);
      console.log(`     ID: ${c.id}`);
    });
  } else {
    console.log('❌ Aucune mining company trouvée!');
  }

  // Check inventory
  console.log('\n📦 Vérification de l\'inventaire:\n');
  const { data: inv } = await supabase
    .from('gold_inventory')
    .select('id, quantity_available_oz, freight_shipment_id')
    .gt('quantity_available_oz', 0)
    .limit(5);

  if (inv && inv.length > 0) {
    console.log(`✅ ${inv.length} entrée(s) d'inventaire avec stock`);
    inv.forEach(i => {
      console.log(`   - ${i.quantity_available_oz} oz | freight_shipment_id: ${i.freight_shipment_id || 'NULL'}`);
    });
  } else {
    console.log('⚠️  Aucun inventaire avec stock disponible');
  }

  console.log('\n✅ Seed terminé!\n');
}

seedMiningCompanies().catch(console.error);
