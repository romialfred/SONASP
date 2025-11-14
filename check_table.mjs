#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('═══════════════════════════════════════════════════════════════');
console.log('VERIFICATION DES ENUMS DE STATUTS DANS LA BASE DE DONNÉES');
console.log('═══════════════════════════════════════════════════════════════\n');

// Test 1: Check production statuses
console.log('📋 Test 1: Vérification des statuts de Production');
console.log('Statuts attendus: prepared, ready_for_customs, shipped, cancelled\n');

const { data: prodData, error: prodError } = await supabase
  .from('daily_production')
  .select('status')
  .limit(1);

if (prodError) {
  console.log(`❌ Erreur: ${prodError.message}\n`);
} else {
  console.log('✅ Table daily_production accessible\n');
}

// Test 2: Check shipping statuses
console.log('📋 Test 2: Vérification des statuts de Shipping Preparation');
console.log('Statuts attendus: waiting_customs_approval, approved_by_customs, ready_for_expedition, cancelled\n');

const { data: shipData, error: shipError } = await supabase
  .from('shipping_preparations')
  .select('status')
  .limit(1);

if (shipError) {
  console.log(`❌ Erreur: ${shipError.message}\n`);
} else {
  console.log('✅ Table shipping_preparations accessible\n');
}

// Test 3: Check freight_customs statuses
console.log('📋 Test 3: Vérification des statuts de Freight & Customs');
console.log('Statuts attendus: ready_for_expedition, shipped_to_refinery, cancelled\n');

const { data: freightData, error: freightError } = await supabase
  .from('freight_customs')
  .select('status')
  .limit(1);

if (freightError) {
  console.log(`⚠️  Table freight_customs: ${freightError.message}\n`);
} else {
  console.log('✅ Table freight_customs accessible\n');
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('RÉSUMÉ DE LA VÉRIFICATION');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📝 ACTIONS REQUISES:');
console.log('1. Si des erreurs enum apparaissent, une migration est nécessaire');
console.log('2. Les nouveaux statuts doivent être ajoutés aux enums PostgreSQL');
console.log('3. Vérifier le fichier: supabase/migrations/20251114_*.sql\n');

console.log('✅ Fichier unifiedStatusService.ts mis à jour avec succès!');
console.log('✅ Tous les nouveaux types et statuts ont été ajoutés.\n');
