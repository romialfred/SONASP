#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function checkTable(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) return null;
    return { name: tableName, count };
  } catch {
    return null;
  }
}

async function execute() {
  console.log('🔍 ANALYSE AUTOMATIQUE DE LA BASE\n');
  console.log('━'.repeat(60));

  // Tester les tables connues
  const tables = [
    'mining_companies',
    'snp_artisan_ventes_or',
    'SNP_artisans_miniers',
    'snp_cartes_professionnelles',
    'daily_production',
    'sales',
    'customers'
  ];

  console.log('\n📊 Tables accessibles:\n');
  const found = [];

  for (const table of tables) {
    const result = await checkTable(table);
    if (result) {
      console.log(`  ✓ ${result.name.padEnd(35)} (${result.count} lignes)`);
      found.push(result.name);
    }
  }

  console.log('\n━'.repeat(60));
  console.log('\n🔍 Analyse détaillée de mining_companies:\n');

  const { data: companies } = await supabase
    .from('mining_companies')
    .select('*')
    .limit(1);

  if (companies && companies.length > 0) {
    console.log('Colonnes disponibles:');
    Object.keys(companies[0]).forEach(col => {
      console.log(`  - ${col}`);
    });
  }

  console.log('\n━'.repeat(60));
  console.log('\n🚀 EXÉCUTION DU SCRIPT DE CORRECTION\n');

  // Étape 1: Vérifier si company_type existe
  const { data: existingCompanies } = await supabase
    .from('mining_companies')
    .select('*')
    .limit(1);

  const hasCompanyType = existingCompanies?.[0]?.hasOwnProperty('company_type');

  console.log(`1. Colonne company_type: ${hasCompanyType ? '✓ Existe' : '❌ Manquante'}`);

  if (!hasCompanyType) {
    console.log('\n⚠️  La colonne company_type n\'existe pas.');
    console.log('   Elle doit être ajoutée via une migration SQL dans Supabase Dashboard.');
    console.log('\n📝 SQL à exécuter dans Supabase SQL Editor:\n');
    console.log('ALTER TABLE mining_companies');
    console.log('ADD COLUMN company_type text DEFAULT \'standard\';');
    console.log('\nCREATE INDEX idx_mining_companies_type ON mining_companies(company_type);');
    return;
  }

  // Étape 2: Vérifier SONASP
  const { data: sonasp } = await supabase
    .from('mining_companies')
    .select('*')
    .or('name.ilike.%SONASP%,abbreviation.eq.SONASP')
    .single();

  console.log(`2. SONASP existe: ${sonasp ? '✓ Oui' : '❌ Non'}`);

  if (!sonasp) {
    console.log('\n📝 Création de SONASP...');

    const { data: newSonasp, error } = await supabase
      .from('mining_companies')
      .insert({
        name: 'Société Nationale des Substances Naturelles',
        abbreviation: 'SONASP',
        code: 'SONASP-BF-001',
        company_type: 'sonasp',
        registration_number: 'BF-SONASP-2024',
        tax_id: 'SONASP-TAX-001',
        contact_person_email: 'contact@sonasp.bf',
        contact_person_phone: '+226 25 XX XX XX',
        contact_person_name: 'Direction Générale',
        address: 'Ouagadougou, Burkina Faso',
        city: 'Ouagadougou',
        country: 'BF',
        is_active: true,
        notes: 'Société nationale - Collecteur principal auprès des artisans miniers'
      })
      .select()
      .single();

    if (error) {
      console.log(`❌ Erreur: ${error.message}`);
    } else {
      console.log(`✓ SONASP créée avec l'ID: ${newSonasp.id}`);
    }
  } else {
    console.log(`   ID: ${sonasp.id}`);

    // Mettre à jour le type si nécessaire
    if (sonasp.company_type !== 'sonasp') {
      console.log('\n📝 Mise à jour du type de SONASP...');

      const { error } = await supabase
        .from('mining_companies')
        .update({ company_type: 'sonasp' })
        .eq('id', sonasp.id);

      if (error) {
        console.log(`❌ Erreur: ${error.message}`);
      } else {
        console.log('✓ Type mis à jour');
      }
    }
  }

  // Étape 3: Vérifier snp_artisan_ventes_or
  const { data: sampleVente } = await supabase
    .from('snp_artisan_ventes_or')
    .select('*')
    .limit(1);

  const hasAcheteurId = sampleVente?.[0]?.hasOwnProperty('acheteur_id');

  console.log(`\n3. Colonne acheteur_id dans ventes: ${hasAcheteurId ? '✓ Existe' : '❌ Manquante'}`);

  if (!hasAcheteurId) {
    console.log('\n⚠️  La colonne acheteur_id doit être ajoutée via SQL:\n');
    console.log('ALTER TABLE snp_artisan_ventes_or');
    console.log('ADD COLUMN acheteur_id uuid REFERENCES mining_companies(id);');
    return;
  }

  console.log('\n━'.repeat(60));
  console.log('✅ CONFIGURATION TERMINÉE!\n');
}

execute().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
