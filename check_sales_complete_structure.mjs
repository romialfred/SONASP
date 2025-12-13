import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n========================================');
console.log('AUDIT COMPLET MODULE SALES');
console.log('========================================\n');

// 1. Structure de la table sales
console.log('1. STRUCTURE TABLE SALES');
console.log('----------------------------------------');

const { data: columns, error: colError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'sales'
    ORDER BY ordinal_position;
  `
});

if (columns) {
  console.table(columns);
}

// 2. Enum sale_status
console.log('\n2. ENUM SALE_STATUS');
console.log('----------------------------------------');

const { data: enumValues, error: enumError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      unnest(enum_range(NULL::sale_status))::text as status_value
    ORDER BY status_value;
  `
});

if (enumValues) {
  console.log('Valeurs possibles:');
  enumValues.forEach(v => console.log(`  - ${v.status_value}`));
}

// 3. Triggers sur sales
console.log('\n3. TRIGGERS SUR TABLE SALES');
console.log('----------------------------------------');

const { data: triggers, error: trigError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      trigger_name,
      event_manipulation,
      action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'sales'
    ORDER BY trigger_name;
  `
});

if (triggers) {
  console.table(triggers);
}

// 4. Foreign keys
console.log('\n4. FOREIGN KEYS');
console.log('----------------------------------------');

const { data: fkeys, error: fkError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'sales'
      AND tc.constraint_type = 'FOREIGN KEY';
  `
});

if (fkeys) {
  console.table(fkeys);
}

// 5. Indexes
console.log('\n5. INDEXES');
console.log('----------------------------------------');

const { data: indexes, error: idxError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'sales'
    ORDER BY indexname;
  `
});

if (indexes) {
  indexes.forEach(idx => {
    console.log(`\n${idx.indexname}:`);
    console.log(`  ${idx.indexdef}`);
  });
}

// 6. RLS Policies
console.log('\n6. ROW LEVEL SECURITY POLICIES');
console.log('----------------------------------------');

const { data: policies, error: polError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      polname as policy_name,
      polcmd as command,
      polpermissive as permissive
    FROM pg_policy
    WHERE polrelid = 'sales'::regclass
    ORDER BY polname;
  `
});

if (policies) {
  console.table(policies);
}

// 7. Fonctions liées à sales
console.log('\n7. FONCTIONS LIÉES À SALES');
console.log('----------------------------------------');

const { data: functions, error: funcError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      proname as function_name,
      pg_get_function_result(oid) as return_type,
      prokind as kind
    FROM pg_proc
    WHERE proname LIKE '%sale%'
    ORDER BY proname;
  `
});

if (functions) {
  console.table(functions);
}

// 8. Statistiques
console.log('\n8. STATISTIQUES');
console.log('----------------------------------------');

const { data: stats } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      COUNT(*) as total_sales,
      COUNT(DISTINCT status) as distinct_statuses,
      COUNT(DISTINCT customer_id) as distinct_customers,
      COUNT(DISTINCT seller_id) as distinct_sellers,
      SUM(quantity_oz) as total_oz_sold,
      SUM(total_amount) as total_amount
    FROM sales;
  `
});

if (stats && stats.length > 0) {
  console.table(stats);
}

// 9. Distribution par statut
console.log('\n9. DISTRIBUTION PAR STATUT');
console.log('----------------------------------------');

const { data: statusDist } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      status,
      COUNT(*) as count
    FROM sales
    GROUP BY status
    ORDER BY count DESC;
  `
});

if (statusDist) {
  console.table(statusDist);
}

// 10. Historique des statuts
console.log('\n10. HISTORIQUE DES STATUTS (UNIFIED_STATUS_HISTORY)');
console.log('----------------------------------------');

const { data: history } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT
      entity_type,
      COUNT(*) as total_changes,
      COUNT(DISTINCT entity_id) as distinct_entities,
      MIN(changed_at) as first_change,
      MAX(changed_at) as last_change
    FROM unified_status_history
    WHERE entity_type = 'sales'
    GROUP BY entity_type;
  `
});

if (history && history.length > 0) {
  console.table(history);
} else {
  console.log('  Aucun historique trouvé pour entity_type = sales');
}

console.log('\n========================================');
console.log('AUDIT TERMINÉ');
console.log('========================================\n');
