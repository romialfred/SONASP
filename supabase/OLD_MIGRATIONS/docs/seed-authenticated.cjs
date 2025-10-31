const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://boolqagzdqbahqnpawpb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE'
);

async function seedData() {
  try {
    console.log('Starting data seeding...');

    // First, log in as management user
    console.log('\nLogging in as management user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'management@goldshipper.com',
      password: 'Management123!'
    });

    if (authError) {
      console.error('Login error:', authError);
      console.log('\nAttempting with demo@example.com...');

      const { data: authData2, error: authError2 } = await supabase.auth.signInWithPassword({
        email: 'demo@example.com',
        password: 'demo123'
      });

      if (authError2) {
        console.error('Second login error:', authError2);
        throw new Error('Could not log in. Please ensure a management user exists.');
      }
      console.log('✓ Logged in as demo@example.com');
    } else {
      console.log('✓ Logged in as management user');
    }

    // 1. Create customers
    console.log('\n1. Creating customers...');
    const customers = [
      { name: 'Dubai Gold Exchange', email: 'contact@dubaigold.ae', phone: '+971-4-555-0001', country: 'United Arab Emirates', contact_person: 'Ahmed Al-Mansouri' },
      { name: 'Swiss Precious Metals SA', email: 'info@swissprecious.ch', phone: '+41-22-555-0002', country: 'Switzerland', contact_person: 'Jean-Pierre Dubois' },
      { name: 'London Bullion Ltd', email: 'sales@londonbullion.co.uk', phone: '+44-20-555-0003', country: 'United Kingdom', contact_person: 'James Henderson' },
      { name: 'Singapore Metals Trading', email: 'contact@singaporemetals.sg', phone: '+65-6555-0004', country: 'Singapore', contact_person: 'Li Wei Chen' },
      { name: 'Hong Kong Gold Group', email: 'info@hkgoldgroup.hk', phone: '+852-2555-0005', country: 'Hong Kong', contact_person: 'Wong Kar Wai' },
    ];

    const insertedCustomers = [];
    for (const customer of customers) {
      const { data, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single();

      if (error) {
        console.log(`Warning: Could not insert customer ${customer.name}:`, error.message);
      } else {
        insertedCustomers.push(data);
        console.log(`  ✓ ${customer.name}`);
      }
    }
    console.log(`✓ Created ${insertedCustomers.length} customers`);

    // 2. Create batches
    console.log('\n2. Creating batches...');
    const batches = [];
    for (let i = 1; i <= 10; i++) {
      const daysAgo = i * 10;
      const weightGrams = 3000 + Math.floor(Math.random() * 3000);
      const weightOz = (weightGrams / 31.1035).toFixed(2);
      const fineness = 99.5 + Math.random() * 0.4;
      const finalFineGrams = weightGrams * 0.98 * (fineness / 100);
      const finalFineOz = (finalFineGrams / 31.1035).toFixed(4);

      batches.push({
        batch_number: `BT-2024-${String(100 + i).padStart(3, '0')}`,
        status: 'sold',
        weight_grams: weightGrams,
        weight_oz: parseFloat(weightOz),
        metal_type: 'gold',
        purity_percentage: 95 + Math.random() * 3,
        origin_country: i % 3 === 0 ? 'Guinea' : i % 3 === 1 ? 'Mali' : 'Côte d\'Ivoire',
        shipped_date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        received_at_airport_date: new Date(Date.now() - (daysAgo - 2) * 24 * 60 * 60 * 1000).toISOString(),
        received_at_refinery_date: new Date(Date.now() - (daysAgo - 4) * 24 * 60 * 60 * 1000).toISOString(),
        pre_melting_weight_grams: weightGrams,
        post_melting_weight_grams: weightGrams * 0.99,
        fineness_percentage: fineness,
        metal_retained_percentage: 99.0,
        final_fine_weight_grams: finalFineGrams,
        final_fine_weight_oz: parseFloat(finalFineOz),
        comments: 'Seed data'
      });
    }

    const insertedBatches = [];
    for (const batch of batches) {
      const { data, error } = await supabase
        .from('batches')
        .insert(batch)
        .select()
        .single();

      if (error) {
        console.log(`Warning: Could not insert batch ${batch.batch_number}:`, error.message);
      } else {
        insertedBatches.push(data);
        console.log(`  ✓ ${batch.batch_number}`);
      }
    }
    console.log(`✓ Created ${insertedBatches.length} batches`);

    // 3. Create sales
    console.log('\n3. Creating sales...');
    const insertedSales = [];

    for (let i = 0; i < Math.min(insertedBatches.length, insertedCustomers.length); i++) {
      const batch = insertedBatches[i];
      const customer = insertedCustomers[i % insertedCustomers.length];
      const londonAmRate = 2000 + Math.random() * 100;
      const totalAmount = batch.final_fine_weight_oz * londonAmRate;
      const netProceeds = totalAmount * 0.97;

      const sale = {
        sale_number: `SL-2024-${String(100 + i).padStart(3, '0')}`,
        customer_id: customer.id,
        sale_date: new Date(Date.now() - (i * 10) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        london_am_rate: londonAmRate,
        total_amount: totalAmount,
        freight_cost: 500,
        other_costs: 250,
        gross_proceeds: totalAmount - 750,
        net_smelted_royalty_percentage: 3.0,
        net_smelted_royalty_amount: totalAmount * 0.03,
        net_proceeds: netProceeds,
        currency: 'USD',
        status: 'approved',
        notes: 'Seed data sale'
      };

      const { data, error } = await supabase
        .from('sales')
        .insert(sale)
        .select()
        .single();

      if (error) {
        console.log(`Warning: Could not insert sale ${sale.sale_number}:`, error.message);
      } else {
        insertedSales.push(data);
        console.log(`  ✓ ${sale.sale_number}`);

        // Create line item
        const lineItem = {
          sale_id: data.id,
          batch_id: batch.id,
          metal_type: 'gold',
          quantity_grams: batch.final_fine_weight_grams,
          quantity_oz: batch.final_fine_weight_oz,
          unit_price: londonAmRate,
          fineness_percentage: batch.fineness_percentage,
          fine_weight_oz: batch.final_fine_weight_oz,
          line_total: totalAmount
        };

        await supabase.from('sales_line_items').insert(lineItem);
      }
    }
    console.log(`✓ Created ${insertedSales.length} sales`);

    // 4. Create payments
    console.log('\n4. Creating payments...');
    const insertedPayments = [];

    for (let i = 0; i < insertedSales.length; i++) {
      const sale = insertedSales[i];
      const customer = insertedCustomers[i % insertedCustomers.length];
      const daysAgo = i * 10;

      const paymentStatuses = ['completed', 'approved', 'verified', 'under_review', 'pending'];
      const paymentMethods = ['wire_transfer', 'swift', 'bank_transfer'];

      const expectedDate = new Date(Date.now() - (daysAgo - 7) * 24 * 60 * 60 * 1000);
      const dueDate = new Date(Date.now() - (daysAgo - 14) * 24 * 60 * 60 * 1000);
      const actualDate = i % 3 === 0 ? new Date(Date.now() - (daysAgo - 10) * 24 * 60 * 60 * 1000) : null;

      const payment = {
        sale_id: sale.id,
        customer_id: customer.id,
        invoice_number: `INV-2024-${String(1000 + i).padStart(4, '0')}`,
        expected_date: expectedDate.toISOString().split('T')[0],
        actual_date: actualDate ? actualDate.toISOString().split('T')[0] : null,
        due_date: dueDate.toISOString().split('T')[0],
        amount: sale.net_proceeds,
        currency: 'USD',
        fx_rate: 1.0,
        bank_name: ['Bank of America', 'HSBC International', 'Citibank'][i % 3],
        account_number: `ACC-${String(100000 + i).padStart(10, '0')}`,
        reference_number: `REF-2024-${String(100000 + i).padStart(6, '0')}`,
        transaction_id: actualDate ? `TXN-${String(200000 + i).padStart(10, '0')}` : null,
        payment_method: paymentMethods[i % 3],
        proof_url: actualDate ? `https://example.com/proof-${i}` : null,
        notes: `Payment for ${sale.sale_number}`,
        status: paymentStatuses[i % 5]
      };

      const { data, error } = await supabase
        .from('payments')
        .insert(payment)
        .select()
        .single();

      if (error) {
        console.log(`Warning: Could not insert payment for ${sale.sale_number}:`, error.message);
      } else {
        insertedPayments.push(data);
        console.log(`  ✓ ${payment.invoice_number}`);
      }
    }
    console.log(`✓ Created ${insertedPayments.length} payments`);

    console.log('\n✅ Data seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`- Customers: ${insertedCustomers.length}`);
    console.log(`- Batches: ${insertedBatches.length}`);
    console.log(`- Sales: ${insertedSales.length}`);
    console.log(`- Payments: ${insertedPayments.length}`);

    await supabase.auth.signOut();

  } catch (error) {
    console.error('\n❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
