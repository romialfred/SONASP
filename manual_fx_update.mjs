#!/usr/bin/env node

/**
 * Script de Mise à Jour Manuelle des Taux de Change FX
 *
 * Ce script force une mise à jour immédiate des taux de change
 * en appelant directement la fonction Edge Supabase.
 *
 * Usage:
 *   node manual_fx_update.mjs
 *
 * Prérequis:
 *   - Les edge functions doivent être déployées
 *   - Le fichier .env doit contenir les variables Supabase
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Charger les variables d'environnement
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Erreur: Variables d\'environnement manquantes');
  console.error('   Vérifiez que .env contient VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('🔄 Mise à jour manuelle des taux de change FX...\n');

// Fonction pour appeler l'edge function
async function updateFxRates() {
  try {
    console.log('📡 Appel de la fonction fetch-daily-fx-rates...');

    const url = `${SUPABASE_URL}/functions/v1/fetch-daily-fx-rates`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 404) {
        console.error('\n❌ ERREUR: La fonction fetch-daily-fx-rates N\'EST PAS DÉPLOYÉE!');
        console.error('\n📋 Pour déployer la fonction:');
        console.error('   1. Installer Supabase CLI: npm install -g supabase');
        console.error('   2. Se connecter: supabase login');
        console.error('   3. Lier le projet: supabase link --project-ref boolqagzdqbahqnpawpb');
        console.error('   4. Déployer: supabase functions deploy fetch-daily-fx-rates');
        console.error('\n📄 Consultez URGENT_FX_RATES_UPDATE_FIX.md pour plus de détails\n');
        return false;
      }

      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log('\n✅ Taux de change mis à jour avec succès!\n');
      console.log('📊 Données récupérées:');
      console.log(`   📅 Date: ${result.data?.date || 'N/A'}`);

      if (result.data?.rates) {
        console.log('\n💱 Taux:');
        Object.entries(result.data.rates).forEach(([pair, rate]) => {
          console.log(`   ${pair}: ${typeof rate === 'number' ? rate.toFixed(6) : rate}`);
        });
      }

      if (result.data?.monthly_aggregates_created) {
        console.log('\n📈 Agrégations mensuelles créées');
      }

      console.log(`\n💬 Message: ${result.message}\n`);
      return true;
    } else {
      console.log(`\n⚠️  ${result.message}`);

      if (result.reason === 'weekend') {
        console.log('📅 Les marchés de change sont fermés le weekend.');
        console.log('   Les taux seront mis à jour le prochain jour ouvrable.\n');
      }

      return false;
    }
  } catch (error) {
    console.error('\n❌ Erreur lors de la mise à jour:', error.message);
    return false;
  }
}

// Fonction pour vérifier les derniers taux dans la base de données
async function checkLatestRates() {
  try {
    console.log('🔍 Vérification des derniers taux dans la base de données...\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase
      .from('fx_rates_daily')
      .select('rate_date, currency_pair, rate, source:fx_rate_sources(name)')
      .order('rate_date', { ascending: false })
      .order('currency_pair', { ascending: true })
      .limit(8);

    if (error) {
      console.error('❌ Erreur lors de la lecture:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  Aucun taux de change trouvé dans la base de données.\n');
      return;
    }

    console.log('📊 Derniers taux enregistrés:\n');

    const groupedByDate = data.reduce((acc, item) => {
      if (!acc[item.rate_date]) {
        acc[item.rate_date] = [];
      }
      acc[item.rate_date].push(item);
      return acc;
    }, {});

    Object.entries(groupedByDate).slice(0, 2).forEach(([date, rates]) => {
      console.log(`   📅 ${date}:`);
      rates.forEach(({ currency_pair, rate }) => {
        console.log(`      ${currency_pair}: ${rate}`);
      });
      console.log('');
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Exécution principale
async function main() {
  const updated = await updateFxRates();

  if (updated) {
    console.log('⏳ Attente de 2 secondes...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  await checkLatestRates();

  console.log('✨ Terminé!\n');
}

main().catch(console.error);
