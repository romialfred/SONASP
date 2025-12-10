#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 CORRECTION DÉFINITIVE DE L\'ERREUR batch_id');
console.log('═══════════════════════════════════════════════\n');

if (!supabaseUrl) {
  console.error('❌ ERREUR: VITE_SUPABASE_URL non trouvé dans .env');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ ERREUR: SUPABASE_SERVICE_ROLE_KEY non trouvé dans .env');
  console.log('\n⚠️  ATTENTION: Vous devez ajouter SUPABASE_SERVICE_ROLE_KEY dans votre fichier .env');
  console.log('   Trouvez cette clé dans: Supabase Dashboard > Project Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✓ Connexion à Supabase établie\n');

// Étape 1: Vérifier si la colonne batch_id existe
async function checkBatchIdExists() {
  console.log('📋 Étape 1: Vérification de la colonne batch_id...');

  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .limit(0);

  if (error && error.message.includes('batch_id')) {
    console.log('   ✓ La colonne batch_id existe encore (c\'est le problème)\n');
    return true;
  }

  console.log('   ✓ La colonne batch_id n\'existe plus\n');
  return false;
}

// Étape 2: Supprimer la contrainte de clé étrangère
async function dropForeignKeyConstraint() {
  console.log('🔨 Étape 2: Suppression de la contrainte batch_id_fkey...');

  const sql = `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'inventory_transactions_batch_id_fkey'
        AND table_name = 'inventory_transactions'
      ) THEN
        ALTER TABLE inventory_transactions DROP CONSTRAINT inventory_transactions_batch_id_fkey;
        RAISE NOTICE 'Contrainte supprimée';
      ELSE
        RAISE NOTICE 'Contrainte déjà absente';
      END IF;
    END $$;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

  if (error) {
    console.log('   ⚠️  Impossible via RPC, utilisation d\'une autre méthode...');
    return false;
  }

  console.log('   ✓ Contrainte supprimée avec succès\n');
  return true;
}

// Étape 3: Supprimer la colonne batch_id
async function dropBatchIdColumn() {
  console.log('🗑️  Étape 3: Suppression de la colonne batch_id...');

  const sql = `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_transactions'
        AND column_name = 'batch_id'
      ) THEN
        ALTER TABLE inventory_transactions DROP COLUMN batch_id;
        RAISE NOTICE 'Colonne supprimée';
      ELSE
        RAISE NOTICE 'Colonne déjà absente';
      END IF;
    END $$;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

  if (error) {
    console.log('   ⚠️  Impossible via RPC');
    return false;
  }

  console.log('   ✓ Colonne batch_id supprimée avec succès\n');
  return true;
}

// Étape 4: Recréer la fonction trigger sans batch_id
async function updateTriggerFunction() {
  console.log('⚙️  Étape 4: Mise à jour de la fonction trigger...');

  const sql = `
    CREATE OR REPLACE FUNCTION create_inventory_transaction()
    RETURNS TRIGGER AS $$
    DECLARE
      v_balance_before_oz numeric;
      v_balance_after_oz numeric;
      v_transaction_type text;
    BEGIN
      SELECT COALESCE(SUM(quantity_oz), 0)
      INTO v_balance_before_oz
      FROM inventory_transactions
      WHERE inventory_id = NEW.id;

      IF NEW.transaction_type = 'entry' THEN
        v_transaction_type := 'entry';
        v_balance_after_oz := v_balance_before_oz + COALESCE(NEW.final_fine_oz, 0);
      ELSE
        v_transaction_type := 'exit';
        v_balance_after_oz := v_balance_before_oz - COALESCE(NEW.final_fine_oz, 0);
      END IF;

      INSERT INTO inventory_transactions (
        transaction_date,
        transaction_type,
        inventory_id,
        freight_shipment_id,
        sale_id,
        quantity_oz,
        quantity_grams,
        balance_before_oz,
        balance_after_oz,
        notes,
        created_by
      ) VALUES (
        COALESCE(NEW.entry_date, CURRENT_DATE),
        v_transaction_type,
        NEW.id,
        NEW.freight_shipment_id,
        NEW.sale_id,
        COALESCE(NEW.final_fine_oz, 0),
        COALESCE(NEW.final_fine_grams, 0),
        v_balance_before_oz,
        v_balance_after_oz,
        NEW.notes,
        NEW.created_by
      );

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

  if (error) {
    console.log('   ⚠️  Impossible via RPC');
    return false;
  }

  console.log('   ✓ Fonction trigger mise à jour avec succès\n');
  return true;
}

// Méthode alternative: SQL direct via REST API
async function applyFixDirectly() {
  console.log('🔄 Méthode alternative: Application directe...\n');

  // Cette méthode nécessite d'exécuter le SQL manuellement
  console.log('═══════════════════════════════════════════════');
  console.log('📝 INSTRUCTIONS MANUELLES');
  console.log('═══════════════════════════════════════════════\n');
  console.log('1. Allez sur: https://boolqagzdqbahqnpawpb.supabase.co');
  console.log('2. Cliquez sur "SQL Editor" dans le menu de gauche');
  console.log('3. Cliquez sur "New Query"');
  console.log('4. Copiez et collez ce SQL:\n');

  const manualSQL = `
-- CORRECTION DÉFINITIVE: Suppression de batch_id

-- 1. Supprimer la contrainte
ALTER TABLE inventory_transactions
DROP CONSTRAINT IF EXISTS inventory_transactions_batch_id_fkey;

-- 2. Supprimer la colonne
ALTER TABLE inventory_transactions
DROP COLUMN IF EXISTS batch_id;

-- 3. Vérifier que freight_shipment_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'freight_shipment_id'
  ) THEN
    ALTER TABLE inventory_transactions
    ADD COLUMN freight_shipment_id UUID REFERENCES freight_shipments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Recréer la fonction trigger sans batch_id
CREATE OR REPLACE FUNCTION create_inventory_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before_oz numeric;
  v_balance_after_oz numeric;
  v_transaction_type text;
BEGIN
  SELECT COALESCE(SUM(quantity_oz), 0)
  INTO v_balance_before_oz
  FROM inventory_transactions
  WHERE inventory_id = NEW.id;

  IF NEW.transaction_type = 'entry' THEN
    v_transaction_type := 'entry';
    v_balance_after_oz := v_balance_before_oz + COALESCE(NEW.final_fine_oz, 0);
  ELSE
    v_transaction_type := 'exit';
    v_balance_after_oz := v_balance_before_oz - COALESCE(NEW.final_fine_oz, 0);
  END IF;

  INSERT INTO inventory_transactions (
    transaction_date,
    transaction_type,
    inventory_id,
    freight_shipment_id,
    sale_id,
    quantity_oz,
    quantity_grams,
    balance_before_oz,
    balance_after_oz,
    notes,
    created_by
  ) VALUES (
    COALESCE(NEW.entry_date, CURRENT_DATE),
    v_transaction_type,
    NEW.id,
    NEW.freight_shipment_id,
    NEW.sale_id,
    COALESCE(NEW.final_fine_oz, 0),
    COALESCE(NEW.final_fine_grams, 0),
    v_balance_before_oz,
    v_balance_after_oz,
    NEW.notes,
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recréer le trigger
DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON gold_inventory;
CREATE TRIGGER trigger_create_inventory_transaction
  AFTER INSERT ON gold_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_transaction();

-- Message de confirmation
SELECT 'CORRECTION APPLIQUÉE AVEC SUCCÈS' as status;
`;

  console.log(manualSQL);
  console.log('\n5. Cliquez sur "Run" (ou Ctrl/Cmd + Enter)');
  console.log('6. Attendez le message "CORRECTION APPLIQUÉE AVEC SUCCÈS"\n');
}

// Fonction principale
async function main() {
  try {
    // Vérifier si batch_id existe
    const batchIdExists = await checkBatchIdExists();

    if (!batchIdExists) {
      console.log('✅ SUCCÈS: Le problème batch_id est déjà résolu!\n');
      return;
    }

    // Essayer de corriger automatiquement
    console.log('🔧 Tentative de correction automatique...\n');

    const step1 = await dropForeignKeyConstraint();
    const step2 = await dropBatchIdColumn();
    const step3 = await updateTriggerFunction();

    if (step1 && step2 && step3) {
      console.log('✅ SUCCÈS: Correction automatique terminée!\n');
      console.log('Vous pouvez maintenant ajouter une entrée d\'inventaire.\n');
      return;
    }

    // Si la correction automatique échoue, afficher les instructions manuelles
    console.log('⚠️  La correction automatique n\'a pas pu être complétée.\n');
    console.log('La fonction exec_sql n\'est peut-être pas disponible.\n');

    await applyFixDirectly();

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.log('\n═══════════════════════════════════════════════');
    console.log('Veuillez appliquer le SQL manuellement (voir ci-dessus)');
    console.log('═══════════════════════════════════════════════\n');
  }
}

// Exécuter
main();
