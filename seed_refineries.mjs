import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const refineriesForRefineries = [
  {
    name: 'Rand Refinery Ltd - South Africa',
    location: 'Germiston',
    country: 'South Africa',
    email: 'info@randrefinery.com',
    phone: '+27 11 961 9000',
    contact_person: 'General Manager',
    capacity_grams_per_month: 500000,
    is_active: true
  },
  {
    name: 'Valcambi SA - Switzerland',
    location: 'Balerna',
    country: 'Switzerland',
    email: 'info@valcambi.com',
    phone: '+41 91 695 61 11',
    contact_person: 'Operations Manager',
    capacity_grams_per_month: 1000000,
    is_active: true
  },
  {
    name: 'Emirates Gold DMCC - UAE',
    location: 'Dubai',
    country: 'United Arab Emirates',
    email: 'info@emiratesgold.ae',
    phone: '+971 4 434 0100',
    contact_person: 'Refinery Manager',
    capacity_grams_per_month: 300000,
    is_active: true
  }
];

const refineriesForPlants = [
  {
    name: 'Rand Refinery Ltd - South Africa',
    city: 'Germiston',
    country: 'South Africa',
    is_active: true
  },
  {
    name: 'Valcambi SA - Switzerland',
    city: 'Balerna',
    country: 'Switzerland',
    is_active: true
  },
  {
    name: 'Emirates Gold DMCC - UAE',
    city: 'Dubai',
    country: 'United Arab Emirates',
    is_active: true
  }
];

async function seedRefineries() {
  console.log('🌱 Seeding refineries...\n');

  // Try refinery_plants first
  console.log('📦 Trying refinery_plants table...');
  const { data: plantsData, error: plantsError } = await supabase
    .from('refinery_plants')
    .insert(refineriesForPlants)
    .select();

  if (plantsError) {
    console.error('❌ Error with refinery_plants:', plantsError.message);
    console.error('   Details:', plantsError.details);
    console.error('   Hint:', plantsError.hint);
    console.error('   Code:', plantsError.code);
  } else {
    console.log(`✅ Successfully inserted ${plantsData.length} refineries into refinery_plants`);
    plantsData.forEach((ref, i) => {
      console.log(`   ${i + 1}. ${ref.name} (ID: ${ref.id})`);
    });
  }

  console.log('\n📦 Trying refineries table...');
  const { data: refData, error: refError } = await supabase
    .from('refineries')
    .insert(refineriesForRefineries)
    .select();

  if (refError) {
    console.error('❌ Error with refineries:', refError.message);
    console.error('   Details:', refError.details);
    console.error('   Hint:', refError.hint);
    console.error('   Code:', refError.code);
  } else {
    console.log(`✅ Successfully inserted ${refData.length} refineries into refineries`);
    refData.forEach((ref, i) => {
      console.log(`   ${i + 1}. ${ref.name} (ID: ${ref.id})`);
    });
  }
}

seedRefineries();
