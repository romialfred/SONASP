import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testTitleColumn() {
  console.log('🔍 Testing if title column exists...\n');
  
  // Try to insert a test record with title
  const { data: userData } = await supabase.auth.getUser();
  
  const testData = {
    mine_id: '00000000-0000-0000-0000-000000000000',
    mine_name: 'Test Mine',
    title: 'Test License Request',
    request_date: new Date().toISOString().split('T')[0],
    planned_quantity_oz: 100,
    status: 'DRAFT',
    priority: 'NORMAL'
  };
  
  console.log('📤 Attempting to insert test record with title field...');
  
  const { data, error } = await supabase
    .from('license_requests')
    .insert(testData)
    .select()
    .single();
  
  if (error) {
    console.error('❌ Insert failed:', error.message);
    console.log('\n📋 Error details:', {
      code: error.code,
      hint: error.hint,
      details: error.details
    });
    
    if (error.message.includes('column') && error.message.includes('title')) {
      console.log('\n❌ TITLE COLUMN DOES NOT EXIST!');
      console.log('✅ ANSWER: YES, you MUST apply migrations!');
    } else if (error.message.includes('violates row-level security')) {
      console.log('\n⚠️  RLS Policy blocking (expected behavior)');
      console.log('✅ TITLE COLUMN EXISTS (RLS prevented insert, not schema)');
      console.log('📋 ANSWER: Migrations already applied ✅');
    }
    
    // Clean up if it was inserted despite error
    if (data?.id) {
      await supabase.from('license_requests').delete().eq('id', data.id);
    }
  } else if (data) {
    console.log('✅ Test record inserted successfully!');
    console.log('✅ TITLE COLUMN EXISTS and works correctly');
    console.log('\n📋 Record created:', {
      id: data.id,
      request_number: data.request_number,
      title: data.title,
      mine_name: data.mine_name
    });
    
    // Clean up test record
    console.log('\n🧹 Cleaning up test record...');
    await supabase.from('license_requests').delete().eq('id', data.id);
    console.log('✅ Test record deleted');
    
    console.log('\n📋 ANSWER: Migrations already applied ✅');
  }
}

testTitleColumn().catch(console.error);
