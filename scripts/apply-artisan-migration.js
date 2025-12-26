import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function applyMigration() {
  console.log('=== APPLICATION DE LA MIGRATION ARTISAN MINIER ===\n');

  try {
    // Lire le fichier de migration
    const migrationPath = '/tmp/cc-agent/59164212/project/supabase/migrations/20251226120554_26122025_01_artisan_minier_migration.sql';
    console.log('Lecture du fichier de migration...');
    const sqlContent = readFileSync(migrationPath, 'utf8');

    // Découper le SQL en plusieurs statements
    // On ne peut pas exécuter tout d'un coup car Supabase client ne supporte pas les statements multiples
    console.log('Note: Cette migration doit être appliquée via le dashboard Supabase ou la CLI');
    console.log('Le client JavaScript ne supporte pas les transactions SQL complexes.\n');

    console.log('INSTRUCTIONS:');
    console.log('1. Connectez-vous à votre dashboard Supabase');
    console.log('2. Allez dans "SQL Editor"');
    console.log('3. Copiez et exécutez le contenu de:');
    console.log('   supabase/migrations/20251226120554_26122025_01_artisan_minier_migration.sql');
    console.log('\nOu utilisez la CLI Supabase:');
    console.log('   npx supabase db push\n');

    // Vérifier si les tables existent déjà
    console.log('Vérification des tables existantes...');
    const { data: tables, error } = await supabase
      .rpc('exec_sql', {
        sql: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'snp_%artisan%'"
      })
      .maybeSingle();

    if (error && error.code !== '42883') {
      // Essai alternatif
      const { data: artisans } = await supabase
        .from('snp_artisans_miniers')
        .select('id')
        .limit(1);

      if (artisans !== null) {
        console.log('✅ La table snp_artisans_miniers existe déjà!');
        console.log('Migration probablement déjà appliquée.\n');
        return true;
      }
    }

    console.log('⚠️  Les tables n\'existent pas encore.');
    console.log('Veuillez appliquer la migration manuellement.\n');
    return false;

  } catch (error) {
    console.error('Erreur:', error.message);
    return false;
  }
}

applyMigration()
  .then((success) => {
    if (success) {
      console.log('✅ Vérification terminée');
    } else {
      console.log('⚠️  Migration à appliquer manuellement');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
