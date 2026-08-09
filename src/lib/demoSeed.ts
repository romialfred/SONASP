export const DEMO_MODE = false;

export interface Batch {
  batch_id: string;
  date_received: string;
  supplier: string;
  gross_weight_g: number;
  purity_pct: number;
  status: 'Received' | 'In Process' | 'Shipped' | 'Refined' | 'shipped' | 'airport_received' | 'refinery_received' | 'refined' | 'sold';
  received_weight_g?: number;
  received_weight_oz?: number;
  refined_weight_g?: number;
  fineness_pct?: number;
  created_at: string;
  refined_at?: string;
}

export interface Shipment {
  shipment_id: string;
  batch_id: string;
  carrier: string;
  origin: string;
  destination: string;
  ship_date: string;
  status: 'Pending' | 'In Transit' | 'Delivered';
}

export interface Refining {
  refining_id: string;
  batch_id: string;
  refinery: string;
  start_date: string;
  end_date: string | null;
  fine_weight_g: number;
  assay_pct: number;
  yield_pct: number;
  status: 'Queued' | 'Processing' | 'Completed';
}

export interface Customer {
  customer_id: string;
  name: string;
  country: string;
  contact_email: string;
  segment: 'Jeweler' | 'Trader' | 'Bank' | 'Industrial' | 'Refiner' | 'Exchange' | 'Vault' | 'Market';
}

export interface Sale {
  sale_id: string;
  date: string;
  customer_id: string;
  fine_weight_oz: number;
  price_per_oz_usd: number;
  fx_code: string;
  fx_rate_to_usd: number;
  amount_usd: number;
  amount_fx: number;
}

export interface GoldPrice {
  as_of: string;
  price_per_oz_usd: number;
}

export interface FxRate {
  as_of: string;
  code: string;
  rate_to_usd: number;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
  status: 'active' | 'disabled';
  full_name: string;
}

// Generate dates for a given range
const generateDates = (days: number, startDate?: Date): string[] => {
  const dates: string[] = [];
  const start = startDate || new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(start);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

// Generate random date within range
const randomDateInRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const randomTime = start + Math.random() * (end - start);
  return new Date(randomTime).toISOString().split('T')[0];
};

// Suppliers
const suppliers = [
  'Siguiri Mining Co.',
  'Kankan Gold Ltd.',
  'Dinguiraye Resources',
  'Mandiana Gold Corp.',
  'Kouroussa Mining',
  'Bamako Gold Traders',
  'Abidjan Mining Group',
  'West African Gold Co.',
  'Sahel Resources Ltd.',
  'Guinea Gold Mining',
];

// Generate 10 months of batches (100 batches)
const generateBatches = (): Batch[] => {
  const batches: Batch[] = [];
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-10-31');

  for (let i = 0; i < 100; i++) {
    const createdDate = randomDateInRange('2025-01-01', '2025-10-31');
    const created = new Date(createdDate);
    const weight = 500 + Math.random() * 2500; // 500-3000g
    const variance = (Math.random() * 4) - 2; // -2% to +2%
    const receivedWeight = weight * (1 + variance / 100);

    // Determine status based on age
    let status: Batch['status'];
    const monthsOld = (new Date().getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsOld > 8) {
      status = 'sold';
    } else if (monthsOld > 6) {
      status = 'refined';
    } else if (monthsOld > 4) {
      status = 'refinery_received';
    } else if (monthsOld > 2) {
      status = 'airport_received';
    } else {
      const statuses: Batch['status'][] = ['shipped', 'airport_received', 'refinery_received', 'refined', 'sold'];
      status = statuses[Math.floor(Math.random() * statuses.length)];
    }

    const batch: Batch = {
      batch_id: `BTH-2025-${String(i + 1).padStart(3, '0')}`,
      date_received: createdDate,
      supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
      gross_weight_g: weight,
      purity_pct: 88 + Math.random() * 7, // 88-95%
      status,
      created_at: createdDate,
    };

    // Add received weight for appropriate statuses
    if (['airport_received', 'refinery_received', 'refined', 'sold'].includes(status)) {
      batch.received_weight_g = receivedWeight;
      batch.received_weight_oz = receivedWeight / 31.1034768;
    }

    // Add refining data for refined/sold batches
    if (['refined', 'sold'].includes(status)) {
      const refinedDate = new Date(created);
      refinedDate.setDate(refinedDate.getDate() + 5);
      batch.refined_weight_g = receivedWeight * 0.97; // 3% loss
      batch.fineness_pct = 99.5 + Math.random() * 0.5; // 99.5-100%
      batch.refined_at = refinedDate.toISOString().split('T')[0];
    }

    batches.push(batch);
  }

  return batches;
};

// Demo Customers - 10 diverse customers
export const demoCustomers: Customer[] = [
  {
    customer_id: 'CUST-001',
    name: 'HSBC Precious Metals',
    country: 'United Kingdom',
    contact_email: 'trading@hsbc.com',
    segment: 'Bank',
  },
  {
    customer_id: 'CUST-002',
    name: 'UBS Gold Trading',
    country: 'Switzerland',
    contact_email: 'gold@ubs.com',
    segment: 'Bank',
  },
  {
    customer_id: 'CUST-003',
    name: 'Dubai Gold & Commodities Exchange',
    country: 'UAE',
    contact_email: 'info@dgcx.ae',
    segment: 'Exchange',
  },
  {
    customer_id: 'CUST-004',
    name: 'Johnson Matthey',
    country: 'United Kingdom',
    contact_email: 'precious@matthey.com',
    segment: 'Refiner',
  },
  {
    customer_id: 'CUST-005',
    name: 'Singapore Precious Metals',
    country: 'Singapore',
    contact_email: 'trading@spmex.sg',
    segment: 'Trader',
  },
  {
    customer_id: 'CUST-006',
    name: 'Zurich Gold Vault',
    country: 'Switzerland',
    contact_email: 'secure@zurichgold.ch',
    segment: 'Vault',
  },
  {
    customer_id: 'CUST-007',
    name: 'Emirates Gold Trading LLC',
    country: 'UAE',
    contact_email: 'sales@emiratesgold.ae',
    segment: 'Trader',
  },
  {
    customer_id: 'CUST-008',
    name: 'London Bullion Market',
    country: 'United Kingdom',
    contact_email: 'info@lbma.org.uk',
    segment: 'Market',
  },
  {
    customer_id: 'CUST-009',
    name: 'Swiss Gold Refiners AG',
    country: 'Switzerland',
    contact_email: 'contact@swissgold.ch',
    segment: 'Refiner',
  },
  {
    customer_id: 'CUST-010',
    name: 'Asia Pacific Gold Corp',
    country: 'Singapore',
    contact_email: 'trading@apgold.sg',
    segment: 'Trader',
  },
];

// Generate batches
export const demoBatches: Batch[] = generateBatches();

// Generate sales for sold batches
const generateSales = (): Sale[] => {
  const sales: Sale[] = [];
  const soldBatches = demoBatches.filter(b => b.status === 'sold');

  soldBatches.forEach((batch, index) => {
    const customer = demoCustomers[Math.floor(Math.random() * demoCustomers.length)];
    const saleDate = new Date(batch.created_at);
    saleDate.setDate(saleDate.getDate() + 7);

    // Get gold price for that date (use base price with variation)
    const basePrice = 2650 + ((new Date(saleDate).getTime() - new Date('2025-01-01').getTime()) / (1000 * 60 * 60 * 24)) * 0.5;
    const price = basePrice + (Math.random() * 40 - 20); // +/- $20

    const fineWeightOz = batch.refined_weight_g ? batch.refined_weight_g / 31.1034768 : 0;
    const amountUsd = fineWeightOz * price;

    sales.push({
      sale_id: `SALE-2025-${String(index + 1).padStart(3, '0')}`,
      date: saleDate.toISOString().split('T')[0],
      customer_id: customer.customer_id,
      fine_weight_oz: fineWeightOz,
      price_per_oz_usd: price,
      fx_code: 'USD',
      fx_rate_to_usd: 1,
      amount_usd: amountUsd,
      amount_fx: amountUsd,
    });
  });

  return sales;
};

export const demoSales: Sale[] = generateSales();

// Generate 10 months of gold prices (daily, excluding weekends)
const generateGoldPrices = (): GoldPrice[] => {
  const prices: GoldPrice[] = [];
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-10-31');
  let currentDate = new Date(startDate);
  let basePrice = 2650;

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const variation = Math.random() * 100 - 50; // +/- $50
      const trend = ((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * 0.5; // $0.50 per day uptrend

      prices.push({
        as_of: currentDate.toISOString().split('T')[0],
        price_per_oz_usd: basePrice + variation + trend,
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return prices;
};

export const demoGoldPrices: GoldPrice[] = generateGoldPrices();

// Generate 10 months of FX rates (daily, excluding weekends)
const generateFxRates = (): FxRate[] => {
  const rates: FxRate[] = [];
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-10-31');
  const currencies = [
    { code: 'EUR', base: 0.9250 },
    { code: 'XOF', base: 605.50 },
    { code: 'GNF', base: 8600.00 },
    { code: 'CHF', base: 0.8850 },
  ];

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      currencies.forEach(currency => {
        const variation = (Math.random() * 0.04 - 0.02); // +/- 2%
        rates.push({
          as_of: currentDate.toISOString().split('T')[0],
          code: currency.code,
          rate_to_usd: currency.base * (1 + variation),
        });
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return rates;
};

export const demoFxRates: FxRate[] = generateFxRates();

// Demo Shipments
export const demoShipments: Shipment[] = demoBatches.slice(0, 20).map((batch, index) => ({
  shipment_id: `SHP-2025-${String(index + 1).padStart(3, '0')}`,
  batch_id: batch.batch_id,
  carrier: ['Securitas Transport', 'Brinks International', 'DHL Secure', 'G4S Logistics'][Math.floor(Math.random() * 4)],
  origin: ['Conakry Airport', 'Bamako Airport', 'Abidjan Airport'][Math.floor(Math.random() * 3)],
  destination: ['Dubai Refinery', 'Swiss Refinery', 'London Refinery'][Math.floor(Math.random() * 3)],
  ship_date: batch.date_received,
  status: batch.status === 'sold' || batch.status === 'refined' ? 'Delivered' :
          batch.status === 'shipped' ? 'Pending' : 'In Transit',
}));

// Demo Refining
export const demoRefining: Refining[] = demoBatches
  .filter(b => ['refined', 'sold'].includes(b.status))
  .slice(0, 30)
  .map((batch, index) => {
    const startDate = new Date(batch.date_received);
    startDate.setDate(startDate.getDate() + 2);
    const endDate = batch.refined_at ? new Date(batch.refined_at) : null;

    return {
      refining_id: `REF-2025-${String(index + 1).padStart(3, '0')}`,
      batch_id: batch.batch_id,
      refinery: ['Dubai Gold Refinery', 'Swiss Gold Refinery AG', 'London Bullion'][Math.floor(Math.random() * 3)],
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate ? endDate.toISOString().split('T')[0] : null,
      fine_weight_g: batch.refined_weight_g || 0,
      assay_pct: batch.fineness_pct || 0,
      yield_pct: 99.8 + Math.random() * 0.3,
      status: batch.status === 'sold' ? 'Completed' : 'Processing',
    };
  });

// Demo Users
export const demoUsers: User[] = [
  {
    id: 'user-001',
    email: 'admin@mansaresources.com',
    role: 'admin',
    status: 'active',
    full_name: 'John Administrator',
  },
  {
    id: 'user-002',
    email: 'analyst@mansaresources.com',
    role: 'analyst',
    status: 'active',
    full_name: 'Sarah Analyst',
  },
  {
    id: 'user-003',
    email: 'viewer@mansaresources.com',
    role: 'viewer',
    status: 'active',
    full_name: 'Mike Viewer',
  },
  {
    id: 'user-004',
    email: 'disabled@mansaresources.com',
    role: 'viewer',
    status: 'disabled',
    full_name: 'Former Employee',
  },
];

// Helper to get related data
export const getCustomerById = (id: string): Customer | undefined =>
  demoCustomers.find(c => c.customer_id === id);

export const getBatchById = (id: string): Batch | undefined =>
  demoBatches.find(b => b.batch_id === id);

export const getShipmentsByBatchId = (batchId: string): Shipment[] =>
  demoShipments.filter(s => s.batch_id === batchId);

export const getRefiningByBatchId = (batchId: string): Refining | undefined =>
  demoRefining.find(r => r.batch_id === batchId);
