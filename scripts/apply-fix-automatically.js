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
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  }
);

console.log('🚀 APPLICATION AUTOMATIQUE DE LA CORRECTION\n');
console.log('━'.repeat(60));

async function step1_addCompanyType() {
  console.log('\n📝 ÉTAPE 1: Vérification de company_type...');

  const { data: sample } = await supabase
    .from('mining_companies')
    .select('*')
    .limit(1)
    .single();

  if (sample && !sample.hasOwnProperty('company_type')) {
    console.log('⚠️  La colonne company_type doit être ajoutée manuellement dans Supabase SQL Editor');
    console.log('\n📋 Copiez et exécutez ce SQL dans Supabase Dashboard > SQL Editor:\n');
    console.log('ALTER TABLE mining_companies');
    console.log('ADD COLUMN company_type text DEFAULT \'standard\';');
    console.log('\nCREATE INDEX idx_mining_companies_type ON mining_companies(company_type);');
    console.log('\n❌ Arrêt: veuillez d\'abord ajouter la colonne, puis relancez ce script.\n');
    return false;
  }

  console.log('✓ Colonne company_type présente');
  return true;
}

async function step2_configureSONASP() {
  console.log('\n📝 ÉTAPE 2: Configuration de SONASP...');

  const { data: existing, error: searchError } = await supabase
    .from('mining_companies')
    .select('*')
    .or('name.ilike.%SONASP%,abbreviation.eq.SONASP')
    .maybeSingle();

  if (existing) {
    console.log(`✓ SONASP existe (ID: ${existing.id})`);

    if (existing.company_type !== 'sonasp') {
      const { error } = await supabase
        .from('mining_companies')
        .update({
          company_type: 'sonasp',
          abbreviation: 'SONASP',
          is_active: true
        })
        .eq('id', existing.id);

      if (error) {
        console.log(`❌ Erreur mise à jour: ${error.message}`);
        return null;
      }
      console.log('✓ Type mis à jour vers "sonasp"');
    }

    return existing.id;
  }

  console.log('📝 Création de SONASP...');

  const { data: newSonasp, error: createError } = await supabase
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

  if (createError) {
    console.log(`❌ Erreur création: ${createError.message}`);
    return null;
  }

  console.log(`✓ SONASP créée (ID: ${newSonasp.id})`);
  return newSonasp.id;
}

async function step3_addAcheteurId() {
  console.log('\n📝 ÉTAPE 3: Vérification de acheteur_id...');

  const { data: sample } = await supabase
    .from('snp_artisan_ventes_or')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (!sample || !sample.hasOwnProperty('acheteur_id')) {
    console.log('⚠️  La colonne acheteur_id doit être ajoutée manuellement');
    console.log('\n📋 Copiez et exécutez ce SQL dans Supabase Dashboard > SQL Editor:\n');
    console.log('ALTER TABLE snp_artisan_ventes_or');
    console.log('ADD COLUMN acheteur_id uuid REFERENCES mining_companies(id);');
    console.log('\nCREATE INDEX idx_ventes_or_acheteur ON snp_artisan_ventes_or(acheteur_id);');
    console.log('\n❌ Arrêt: veuillez d\'abord ajouter la colonne, puis relancez ce script.\n');
    return false;
  }

  console.log('✓ Colonne acheteur_id présente');
  return true;
}

async function step4_linkVentesToSONASP(sonaspId) {
  console.log('\n📝 ÉTAPE 4: Liaison des ventes à SONASP...');

  const { data: ventesWithoutBuyer } = await supabase
    .from('snp_artisan_ventes_or')
    .select('id')
    .is('acheteur_id', null);

  if (!ventesWithoutBuyer || ventesWithoutBuyer.length === 0) {
    console.log('✓ Aucune vente à lier (toutes ont déjà un acheteur)');
    return;
  }

  const ids = ventesWithoutBuyer.map(v => v.id);

  const { error } = await supabase
    .from('snp_artisan_ventes_or')
    .update({ acheteur_id: sonaspId })
    .in('id', ids);

  if (error) {
    console.log(`❌ Erreur liaison: ${error.message}`);
    return;
  }

  console.log(`✓ ${ids.length} vente(s) liée(s) à SONASP`);
}

async function step5_summary() {
  console.log('\n📊 RÉSUMÉ FINAL\n');
  console.log('━'.repeat(60));

  const { data: sonasp } = await supabase
    .from('mining_companies')
    .select('*')
    .eq('company_type', 'sonasp')
    .maybeSingle();

  if (sonasp) {
    console.log(`✓ SONASP configurée:`);
    console.log(`  - Nom: ${sonasp.name}`);
    console.log(`  - ID: ${sonasp.id}`);
    console.log(`  - Type: ${sonasp.company_type}`);
    console.log(`  - Statut: ${sonasp.is_active ? 'Actif' : 'Inactif'}`);
  }

  const { count: venteCount } = await supabase
    .from('snp_artisan_ventes_or')
    .select('*', { count: 'exact', head: true })
    .eq('acheteur_id', sonasp?.id);

  console.log(`\n✓ Ventes liées à SONASP: ${venteCount || 0}`);

  console.log('\n━'.repeat(60));
  console.log('\n✅ CONFIGURATION TERMINÉE AVEC SUCCÈS!\n');
}

async function main() {
  try {
    const hasCompanyType = await step1_addCompanyType();
    if (!hasCompanyType) return;

    const sonaspId = await step2_configureSONASP();
    if (!sonaspId) {
      console.log('\n❌ Impossible de configurer SONASP\n');
      return;
    }

    const hasAcheteurId = await step3_addAcheteurId();
    if (!hasAcheteurId) return;

    await step4_linkVentesToSONASP(sonaspId);

    await step5_summary();

  } catch (err) {
    console.error('\n❌ ERREUR:', err.message);
    console.error(err);
    process.exit(1);
  }
}

main();
