import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  console.log('🔍 Checking license_requests table...\n');
  
  const { data, error } = await supabase
    .from('license_requests')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 TABLE DOES NOT EXIST or MIGRATIONS NOT APPLIED');
    console.log('✅ ANSWER: YES, you need to apply migrations!');
    process.exit(1);
  }
  
  if (data && data.length > 0) {
    const hasTitle = 'title' in data[0];
    console.log('✅ Table exists with', data.length, 'record(s)');
    console.log('📋 Columns:', Object.keys(data[0]).join(', '));
    console.log('\n' + (hasTitle ? '✅' : '❌') + ' Title column:', hasTitle ? 'EXISTS' : 'MISSING');
    console.log('\n📋 ANSWER:', hasTitle ? 'Migrations already applied ✅' : 'Need to apply migrations ⚠️');
  } else {
    console.log('✅ Table exists (empty)');
    console.log('📋 ANSWER: Migrations likely applied, table is just empty');
  }
}

check();
