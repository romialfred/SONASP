import assert from 'node:assert/strict';
import test from 'node:test';

import {
  databaseRelationNames,
  directSupabaseRelations,
} from './check-database-type-coverage.mjs';

test('extrait les tables et les vues du type Database', () => {
  const relations = databaseRelationNames(`
    export type Database = {
      public: {
        Tables: { customers: { Row: { id: string } } }
        Views: { active_customers: { Row: { id: string | null } } }
      }
    }
  `);

  assert.deepEqual([...relations].sort(), ['active_customers', 'customers']);
});

test('détecte uniquement les appels directs et typés à supabase.from', () => {
  const references = directSupabaseRelations(`
    supabase.from('customers').select('*');
    supabase.storage.from('documents').download('file.pdf');
    (supabase as any).from('legacy_relation').select('*');
  `);

  assert.deepEqual(references.map(({ relation }) => relation), ['customers']);
});
