#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function diagnoseSignatories() {
  console.log('🔍 DIAGNOSTIC DES SIGNATAIRES\n');
  console.log('=' .repeat(80));

  // 1. Vérifier les expéditions KGM
  console.log('\n📦 STEP 1: Expéditions KGM trouvées\n');
  const { data: preps, error: prepsError } = await supabase
    .from('shipping_preparations')
    .select('id, expedition_lot_number, status, created_at')
    .ilike('expedition_lot_number', '%KGM%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (prepsError) {
    console.error('❌ Erreur:', prepsError);
  } else {
    console.table(preps);
  }

  // 2. Pour chaque expédition, compter les signataires
  console.log('\n📊 STEP 2: Nombre de signataires par expédition\n');
  if (preps && preps.length > 0) {
    for (const prep of preps) {
      const { data: sigs, error: sigsError, count } = await supabase
        .from('shipping_signatories')
        .select('*', { count: 'exact' })
        .eq('shipping_preparation_id', prep.id);

      if (sigsError) {
        console.error(`❌ Erreur pour ${prep.expedition_lot_number}:`, sigsError);
      } else {
        console.log(`\n${prep.expedition_lot_number} (ID: ${prep.id}):`);
        console.log(`  Signataires trouvés: ${count || 0}`);
        if (sigs && sigs.length > 0) {
          console.log('  Détails:');
          sigs.forEach((sig, idx) => {
            console.log(`    ${idx + 1}. Name: "${sig.name || sig.full_name || 'N/A'}"`);
            console.log(`       Title: "${sig.title || sig.position || 'N/A'}"`);
            console.log(`       Order: ${sig.order_index}`);
            console.log(`       All fields:`, Object.keys(sig));
          });
        }
      }
    }
  }

  // 3. Vérifier la structure de la table
  console.log('\n🗂️  STEP 3: Structure de la table shipping_signatories\n');
  const { data: columns, error: colsError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'shipping_signatories'
        ORDER BY ordinal_position;
      `
    });

  if (colsError) {
    console.error('❌ Erreur:', colsError);
    console.log('ℹ️  Si exec_sql n\'existe pas, vérifier manuellement dans Supabase SQL Editor');
  } else {
    console.table(columns);
  }

  // 4. Tous les signataires existants
  console.log('\n👥 STEP 4: Tous les signataires dans la base (10 derniers)\n');
  const { data: allSigs, error: allSigsError } = await supabase
    .from('shipping_signatories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (allSigsError) {
    console.error('❌ Erreur:', allSigsError);
  } else {
    console.table(allSigs);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Diagnostic terminé\n');
}

diagnoseSignatories().catch(console.error);
