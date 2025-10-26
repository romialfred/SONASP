const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://boolqagzdqbahqnpawpb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE'
);

async function seedData() {
  try {
    console.log('Starting data seeding...');

    // 1. Create customers
    console.log('\n1. Creating customers...');
    const customers = [
      { name: 'Dubai Gold Exchange', email: 'contact@dubaigold.ae', phone: '+971-4-555-0001', country: 'United Arab Emirates', contact_person: 'Ahmed Al-Mansouri', address: 'Dubai Gold Souk, Dubai', tax_id: 'UAE-TAX-001' },
      { name: 'Swiss Precious Metals SA', email: 'info@swissprecious.ch', phone: '+41-22-555-0002', country: 'Switzerland', contact_person: 'Jean-Pierre Dubois', address: 'Rue du Rhône 45, Geneva', tax_id: 'CHE-123.456.789' },
      { name: 'London Bullion Ltd', email: 'sales@londonbullion.co.uk', phone: '+44-20-555-0003', country: 'United Kingdom', contact_person: 'James Henderson', address: '10 Hatton Garden, London', tax_id: 'GB-TAX-002' },
      { name: 'Singapore Metals Trading', email: 'contact@singaporemetals.sg', phone: '+65-6555-0004', country: 'Singapore', contact_person: 'Li Wei Chen', address: '1 Raffles Place, Singapore', tax_id: 'SG-TAX-003' },
      { name: 'Hong Kong Gold Group', email: 'info@hkgoldgroup.hk', phone: '+852-2555-0005', country: 'Hong Kong', contact_person: 'Wong Kar Wai', address: 'Central District, Hong Kong', tax_id: 'HK-TAX-004' },
    ];

    const { data: insertedCustomers, error: customerError } = await supabase
      .from('customers')
      .insert(customers)
      .select();

    if (customerError) {
      console.error('Customer insert error:', customerError);
      throw customerError;
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
        origin_site: 'Factory',
        destination: 'Dubai Refinery',
        shipped_date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        received_at_airport_date: new Date(Date.now() - (daysAgo - 2) * 24 * 60 * 60 * 1000).toISOString(),
        received_at_refinery_date: new Date(Date.now() - (daysAgo - 4) * 24 * 60 * 60 * 1000).toISOString(),
        pre_melting_weight_grams: weightGrams,
        post_melting_weight_grams: weightGrams * 0.99,
        fineness_percentage: fineness,
        metal_retained_percentage: 99.0,
        final_fine_weight_grams: finalFineGrams,
        final_fine_weight_oz: parseFloat(finalFineOz),
        comments: 'Automated seed data'
      });
    }

    const { data: insertedBatches, error: batchError } = await supabase
      .from('batches')
      .insert(batches)
      .select();

    if (batchError) {
      console.error('Batch insert error:', batchError);
      throw batchError;
    }
    console.log(`✓ Created ${insertedBatches.length} batches`);

    // 3. Create sales
    console.log('\n3. Creating sales...');
    const sales = [];
    const saleLineItems = [];

    for (let i = 0; i < insertedBatches.length; i++) {
      const batch = insertedBatches[i];
      const customer = insertedCustomers[i % insertedCustomers.length];
      const londonAmRate = 2000 + Math.random() * 100;
      const totalAmount = batch.final_fine_weight_oz * londonAmRate;
      const netProceeds = totalAmount * 0.97;

      const sale = {
        sale_number: `SL-2024-${String(100 + i).padStart(3, '0')}`,
        customer_id: customer.id,
        sale_date: new Date(Date.now() - (i * 10) * 24 * 60 * 60 * 1000).toISOString(),
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

      sales.push(sale);
    }

    const { data: insertedSales, error: salesError } = await supabase
      .from('sales')
      .insert(sales)
      .select();

    if (salesError) {
      console.error('Sales insert error:', salesError);
      throw salesError;
    }
    console.log(`✓ Created ${insertedSales.length} sales`);

    // 4. Create sale line items
    console.log('\n4. Creating sale line items...');
    for (let i = 0; i < insertedSales.length; i++) {
      const sale = insertedSales[i];
      const batch = insertedBatches[i];

      saleLineItems.push({
        sale_id: sale.id,
        batch_id: batch.id,
        metal_type: 'gold',
        quantity_grams: batch.final_fine_weight_grams,
        quantity_oz: batch.final_fine_weight_oz,
        unit_price: sale.london_am_rate,
        fineness_percentage: batch.fineness_percentage,
        fine_weight_oz: batch.final_fine_weight_oz,
        line_total: sale.total_amount
      });
    }

    const { data: insertedLineItems, error: lineItemError } = await supabase
      .from('sales_line_items')
      .insert(saleLineItems)
      .select();

    if (lineItemError) {
      console.error('Line items insert error:', lineItemError);
      throw lineItemError;
    }
    console.log(`✓ Created ${insertedLineItems.length} sale line items`);

    // 5. Create payments
    console.log('\n5. Creating payments...');
    const payments = [];

    for (let i = 0; i < insertedSales.length; i++) {
      const sale = insertedSales[i];
      const customer = insertedCustomers[i % insertedCustomers.length];
      const daysAgo = i * 10;

      const paymentStatuses = ['completed', 'approved', 'verified', 'under_review', 'pending'];
      const paymentMethods = ['wire_transfer', 'swift', 'bank_transfer'];

      const expectedDate = new Date(Date.now() - (daysAgo - 7) * 24 * 60 * 60 * 1000);
      const dueDate = new Date(Date.now() - (daysAgo - 14) * 24 * 60 * 60 * 1000);
      const actualDate = i % 3 === 0 ? new Date(Date.now() - (daysAgo - 10) * 24 * 60 * 60 * 1000) : null;

      payments.push({
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
      });
    }

    const { data: insertedPayments, error: paymentError } = await supabase
      .from('payments')
      .insert(payments)
      .select();

    if (paymentError) {
      console.error('Payment insert error:', paymentError);
      throw paymentError;
    }
    console.log(`✓ Created ${insertedPayments.length} payments`);

    console.log('\n✅ Data seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`- Customers: ${insertedCustomers.length}`);
    console.log(`- Batches: ${insertedBatches.length}`);
    console.log(`- Sales: ${insertedSales.length}`);
    console.log(`- Sale Line Items: ${insertedLineItems.length}`);
    console.log(`- Payments: ${insertedPayments.length}`);

  } catch (error) {
    console.error('\n❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
