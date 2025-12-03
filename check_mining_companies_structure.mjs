import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://boolqagzdqbahqnpawpb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStructure() {
  console.log('🔍 Checking mining_companies structure...\n');

  const { data, error } = await supabase
    .from('mining_companies')
    .select('*')
    .limit(3);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Sample data:');
  console.log(JSON.stringify(data, null, 2));

  if (data && data.length > 0) {
    console.log('\n📋 Columns:', Object.keys(data[0]));
  }
}

checkStructure();
