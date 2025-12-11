import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSalesStatus() {
  console.log('=== VÉRIFICATION STRUCTURE SALES ===\n');

  // Test 1: Récupérer une vente existante
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, sale_number, status, created_at')
    .limit(5);

  if (salesError) {
    console.error('Erreur récupération sales:', salesError);
  } else {
    console.log('Ventes existantes:', sales);
  }

  // Test 2: Essayer différents status
  const testStatuses = [
    'draft',
    'pending_management_approval',
    'pending_customer_approval',
    'pending_payment',
    'approved',
    'completed',
    'cancelled'
  ];

  console.log('\nTest des status possibles:');
  for (const status of testStatuses) {
    const { data, error } = await supabase
      .from('sales')
      .select('id')
      .eq('status', status)
      .limit(1);

    if (!error) {
      console.log(`✓ Status "${status}" existe`);
    } else {
      console.log(`✗ Status "${status}" invalide:`, error.message);
    }
  }
}

checkSalesStatus().catch(console.error);
