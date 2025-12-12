import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== ANALYSE COMPLÈTE VENTES & PAIEMENTS ===\n');

// 1. Vérifier les ENUM de statut
console.log('1. ENUMS DE STATUT');
console.log('==================');

const { data: enums, error: enumError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      t.typname as enum_name,
      e.enumlabel as enum_value,
      e.enumsortorder
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN ('sale_status', 'payment_status', 'approval_status')
    ORDER BY t.typname, e.enumsortorder;
  `
});

if (enumError) {
  console.error('Erreur enum:', enumError);
} else {
  const grouped = {};
  enums.forEach(e => {
    if (!grouped[e.enum_name]) grouped[e.enum_name] = [];
    grouped[e.enum_name].push(e.enum_value);
  });
  console.log(JSON.stringify(grouped, null, 2));
}

// 2. Vérifier la structure de la table gold_sales
console.log('\n2. STRUCTURE TABLE gold_sales');
console.log('==============================');

const { data: salesCols } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      column_name,
      data_type,
      column_default,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'gold_sales'
    AND column_name IN ('status', 'approval_status', 'payment_status')
    ORDER BY ordinal_position;
  `
});

console.log(JSON.stringify(salesCols, null, 2));

// 3. Vérifier la structure de la table payments
console.log('\n3. STRUCTURE TABLE payments');
console.log('===========================');

const { data: paymentCols } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      column_name,
      data_type,
      column_default,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'payments'
    AND column_name LIKE '%status%'
    ORDER BY ordinal_position;
  `
});

console.log(JSON.stringify(paymentCols, null, 2));

// 4. Lister tous les TRIGGERS sur gold_sales et payments
console.log('\n4. TRIGGERS sur gold_sales et payments');
console.log('======================================');

const { data: triggers } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      t.tgname as trigger_name,
      c.relname as table_name,
      p.proname as function_name,
      CASE
        WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
        WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
      END as timing,
      CASE
        WHEN t.tgtype & 4 = 4 THEN 'INSERT'
        WHEN t.tgtype & 8 = 8 THEN 'DELETE'
        WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
        ELSE 'OTHER'
      END as event
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname IN ('gold_sales', 'payments')
    AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname;
  `
});

console.log(JSON.stringify(triggers, null, 2));

// 5. Récupérer le CODE des fonctions de trigger
console.log('\n5. CODE DES FONCTIONS DE TRIGGER');
console.log('=================================');

if (triggers && triggers.length > 0) {
  const functionNames = [...new Set(triggers.map(t => t.function_name))];

  for (const funcName of functionNames) {
    const { data: funcCode } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = '${funcName}'
        AND n.nspname = 'public';
      `
    });

    if (funcCode && funcCode[0]) {
      console.log(`\n--- ${funcName} ---`);
      console.log(funcCode[0].definition);
      console.log('\n');
    }
  }
}

// 6. Vérifier les VUES
console.log('\n6. VUES liées aux ventes');
console.log('========================');

const { data: views } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      table_name,
      view_definition
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND (table_name LIKE '%sale%' OR table_name LIKE '%payment%')
    ORDER BY table_name;
  `
});

if (views && views.length > 0) {
  views.forEach(v => {
    console.log(`\nVue: ${v.table_name}`);
    console.log(v.view_definition);
  });
} else {
  console.log('Aucune vue trouvée');
}

// 7. Vérifier les CONTRAINTES
console.log('\n7. CONTRAINTES sur gold_sales et payments');
console.log('=========================================');

const { data: constraints } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      cc.check_clause
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_name IN ('gold_sales', 'payments')
    AND tc.constraint_type IN ('CHECK', 'FOREIGN KEY')
    ORDER BY tc.table_name, tc.constraint_name;
  `
});

console.log(JSON.stringify(constraints, null, 2));

console.log('\n=== ANALYSE TERMINÉE ===');
