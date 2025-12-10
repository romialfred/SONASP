import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('🔧 Application finale de la correction batch_id pour l\'inventaire...\n');
console.log('=' .repeat(80));

async function executeSQL(description, sql) {
  console.log(`\n📝 ${description}`);
  console.log('-'.repeat(80));

  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: sql
  });

  if (error) {
    if (error.message.includes('exec_sql') || error.message.includes('PGRST202')) {
      console.log('⚠️  La fonction RPC exec_sql n\'est pas disponible.');
      console.log('📋 Vous devez exécuter manuellement le script SQL dans Supabase Dashboard.');
      return false;
    }
    console.log(`❌ Erreur: ${error.message}`);
    console.log(`   Code: ${error.code}`);
    console.log(`   Details: ${error.details || 'N/A'}`);
    return false;
  }

  console.log('✅ Succès!');
  if (data) {
    console.log(`   Résultat:`, data);
  }
  return true;
}

async function main() {
  console.log('\n🎯 ÉTAPE 1: Suppression des anciens triggers\n');

  let success = await executeSQL(
    'Supprimer les triggers existants',
    `DROP TRIGGER IF EXISTS track_inventory_transaction ON gold_inventory CASCADE;
     DROP TRIGGER IF EXISTS trigger_create_inventory_transaction ON gold_inventory CASCADE;`
  );

  if (!success) {
    console.log('\n❌ Impossible d\'utiliser l\'API. Veuillez suivre ces étapes:\n');
    console.log('1. Ouvrez Supabase Dashboard → SQL Editor');
    console.log('2. Copiez le contenu du fichier FIX_INVENTORY_TRIGGER_BATCH_ID.sql');
    console.log('3. Exécutez-le dans l\'éditeur SQL');
    console.log('4. Rafraîchissez l\'application et testez l\'ajout d\'inventaire\n');
    process.exit(1);
  }

  console.log('\n🎯 ÉTAPE 2: Vérification de la structure des tables\n');

  // Vérifier si batch_id existe
  const { data: goldInvCols, error: goldError } = await supabase
    .from('gold_inventory')
    .select('*')
    .limit(0);

  const { data: transCols, error: transError } = await supabase
    .from('inventory_transactions')
    .select('*')
    .limit(0);

  if (!goldError && !transError) {
    console.log('✅ Tables accessibles');
  }

  console.log('\n🎯 ÉTAPE 3: Recréation de la fonction trigger\n');

  const functionSQL = `
CREATE OR REPLACE FUNCTION create_inventory_transaction()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $function$
DECLARE
  v_balance_before_oz NUMERIC DEFAULT 0;
  v_balance_after_oz NUMERIC DEFAULT 0;
  v_transaction_type TEXT;
  v_quantity_oz NUMERIC DEFAULT 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transaction_type = 'entry' THEN
      v_transaction_type := 'entry';
      v_quantity_oz := COALESCE(NEW.final_fine_oz, 0);
    ELSIF NEW.transaction_type = 'exit' THEN
      v_transaction_type := 'exit';
      v_quantity_oz := COALESCE(NEW.final_fine_oz, 0);
    ELSE
      RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(
      CASE
        WHEN transaction_type = 'entry' THEN quantity_oz
        WHEN transaction_type = 'exit' THEN -quantity_oz
        ELSE 0
      END
    ), 0)
    INTO v_balance_before_oz
    FROM inventory_transactions
    WHERE inventory_id = NEW.id;

    IF v_transaction_type = 'entry' THEN
      v_balance_after_oz := v_balance_before_oz + v_quantity_oz;
    ELSE
      v_balance_after_oz := v_balance_before_oz - v_quantity_oz;
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
      transaction_reference,
      notes,
      created_by
    ) VALUES (
      COALESCE(NEW.entry_date, CURRENT_DATE),
      v_transaction_type,
      NEW.id,
      NEW.freight_shipment_id,
      NEW.sale_id,
      v_quantity_oz,
      COALESCE(NEW.final_fine_grams, 0),
      v_balance_before_oz,
      v_balance_after_oz,
      NEW.certificate_number,
      NEW.notes,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$function$;`;

  success = await executeSQL('Créer la fonction trigger (sans batch_id)', functionSQL);

  if (!success) {
    console.log('\n⚠️  Méthode API non disponible. Instructions manuelles ci-dessus.\n');
    process.exit(1);
  }

  console.log('\n🎯 ÉTAPE 4: Recréation du trigger\n');

  success = await executeSQL(
    'Créer le trigger',
    `CREATE TRIGGER trigger_create_inventory_transaction
      AFTER INSERT ON gold_inventory
      FOR EACH ROW
      EXECUTE FUNCTION create_inventory_transaction();`
  );

  if (!success) {
    console.log('\n⚠️  Méthode API non disponible. Instructions manuelles ci-dessus.\n');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS!');
  console.log('='.repeat(80));
  console.log('\n📋 Résumé des changements:');
  console.log('  ✅ Triggers supprimés et recréés');
  console.log('  ✅ Fonction create_inventory_transaction() mise à jour');
  console.log('  ✅ Plus de référence à batch_id');
  console.log('  ✅ Utilise maintenant freight_shipment_id');
  console.log('\n🧪 Vous pouvez maintenant tester l\'ajout d\'une entrée d\'inventaire!');
  console.log('   L\'erreur "batch_id does not exist" ne devrait plus apparaître.\n');
}

main().catch(err => {
  console.error('\n❌ Erreur fatale:', err);
  process.exit(1);
});
