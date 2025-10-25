export const DEMO_MODE = true;

export interface Batch {
  batch_id: string;
  date_received: string;
  supplier: string;
  gross_weight_g: number;
  purity_pct: number;
  status: 'Received' | 'In Process' | 'Shipped' | 'Refined';
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
  segment: 'Jeweler' | 'Trader' | 'Bank' | 'Industrial';
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

// Generate dates for the last 14 days
const generateDates = (days: number): string[] => {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

// Demo Batches
export const demoBatches: Batch[] = [
  {
    batch_id: 'BTH-2025-001',
    date_received: '2025-10-15',
    supplier: 'Siguiri Mining Co.',
    gross_weight_g: 1250.5,
    purity_pct: 92.5,
    status: 'Refined',
  },
  {
    batch_id: 'BTH-2025-002',
    date_received: '2025-10-18',
    supplier: 'Kankan Gold Ltd.',
    gross_weight_g: 980.3,
    purity_pct: 88.2,
    status: 'In Process',
  },
  {
    batch_id: 'BTH-2025-003',
    date_received: '2025-10-20',
    supplier: 'Dinguiraye Resources',
    gross_weight_g: 1500.8,
    purity_pct: 94.1,
    status: 'Shipped',
  },
  {
    batch_id: 'BTH-2025-004',
    date_received: '2025-10-22',
    supplier: 'Mandiana Gold Corp.',
    gross_weight_g: 750.2,
    purity_pct: 90.3,
    status: 'Received',
  },
  {
    batch_id: 'BTH-2025-005',
    date_received: '2025-10-24',
    supplier: 'Kouroussa Mining',
    gross_weight_g: 1100.0,
    purity_pct: 91.8,
    status: 'Received',
  },
];

// Demo Shipments
export const demoShipments: Shipment[] = [
  {
    shipment_id: 'SHP-2025-001',
    batch_id: 'BTH-2025-001',
    carrier: 'Securitas Transport',
    origin: 'Conakry Airport',
    destination: 'Dubai Refinery',
    ship_date: '2025-10-16',
    status: 'Delivered',
  },
  {
    shipment_id: 'SHP-2025-002',
    batch_id: 'BTH-2025-002',
    carrier: 'Brinks International',
    origin: 'Conakry Airport',
    destination: 'Swiss Refinery',
    ship_date: '2025-10-19',
    status: 'In Transit',
  },
  {
    shipment_id: 'SHP-2025-003',
    batch_id: 'BTH-2025-003',
    carrier: 'Securitas Transport',
    origin: 'Bamako Airport',
    destination: 'London Refinery',
    ship_date: '2025-10-21',
    status: 'In Transit',
  },
  {
    shipment_id: 'SHP-2025-004',
    batch_id: 'BTH-2025-004',
    carrier: 'DHL Secure',
    origin: 'Abidjan Airport',
    destination: 'Dubai Refinery',
    ship_date: '2025-10-23',
    status: 'Pending',
  },
  {
    shipment_id: 'SHP-2025-005',
    batch_id: 'BTH-2025-005',
    carrier: 'Brinks International',
    origin: 'Conakry Airport',
    destination: 'Swiss Refinery',
    ship_date: '2025-10-25',
    status: 'Pending',
  },
];

// Demo Refining
export const demoRefining: Refining[] = [
  {
    refining_id: 'REF-2025-001',
    batch_id: 'BTH-2025-001',
    refinery: 'Dubai Gold Refinery',
    start_date: '2025-10-17',
    end_date: '2025-10-19',
    fine_weight_g: 1156.0,
    assay_pct: 99.95,
    yield_pct: 99.82,
    status: 'Completed',
  },
  {
    refining_id: 'REF-2025-002',
    batch_id: 'BTH-2025-002',
    refinery: 'Swiss Gold Refinery AG',
    start_date: '2025-10-20',
    end_date: null,
    fine_weight_g: 864.5,
    assay_pct: 99.99,
    yield_pct: 99.95,
    status: 'Processing',
  },
  {
    refining_id: 'REF-2025-003',
    batch_id: 'BTH-2025-003',
    refinery: 'London Bullion',
    start_date: '2025-10-22',
    end_date: null,
    fine_weight_g: 0,
    assay_pct: 0,
    yield_pct: 0,
    status: 'Queued',
  },
  {
    refining_id: 'REF-2025-004',
    batch_id: 'BTH-2025-004',
    refinery: 'Dubai Gold Refinery',
    start_date: '2025-10-24',
    end_date: null,
    fine_weight_g: 0,
    assay_pct: 0,
    yield_pct: 0,
    status: 'Queued',
  },
  {
    refining_id: 'REF-2025-005',
    batch_id: 'BTH-2025-005',
    refinery: 'Swiss Gold Refinery AG',
    start_date: '2025-10-25',
    end_date: null,
    fine_weight_g: 0,
    assay_pct: 0,
    yield_pct: 0,
    status: 'Queued',
  },
];

// Demo Customers
export const demoCustomers: Customer[] = [
  {
    customer_id: 'CUST-001',
    name: 'Dubai Gold Traders LLC',
    country: 'UAE',
    contact_email: 'contact@dubaigoldtraders.ae',
    segment: 'Trader',
  },
  {
    customer_id: 'CUST-002',
    name: 'Swiss Jewelry House',
    country: 'Switzerland',
    contact_email: 'sales@swissjewelry.ch',
    segment: 'Jeweler',
  },
  {
    customer_id: 'CUST-003',
    name: 'Standard Bank of Africa',
    country: 'South Africa',
    contact_email: 'commodities@standardbank.co.za',
    segment: 'Bank',
  },
  {
    customer_id: 'CUST-004',
    name: 'London Bullion Markets',
    country: 'United Kingdom',
    contact_email: 'trading@londonbullion.co.uk',
    segment: 'Trader',
  },
  {
    customer_id: 'CUST-005',
    name: 'Tanishq Jewellers',
    country: 'India',
    contact_email: 'procurement@tanishq.co.in',
    segment: 'Jeweler',
  },
  {
    customer_id: 'CUST-006',
    name: 'Industrial Gold Solutions',
    country: 'Germany',
    contact_email: 'orders@indgoldsol.de',
    segment: 'Industrial',
  },
  {
    customer_id: 'CUST-007',
    name: 'Cartier SA',
    country: 'France',
    contact_email: 'supply@cartier.fr',
    segment: 'Jeweler',
  },
  {
    customer_id: 'CUST-008',
    name: 'HSBC Precious Metals',
    country: 'Hong Kong',
    contact_email: 'metals@hsbc.com.hk',
    segment: 'Bank',
  },
  {
    customer_id: 'CUST-009',
    name: 'Shanghai Gold Exchange',
    country: 'China',
    contact_email: 'international@sge.com.cn',
    segment: 'Trader',
  },
  {
    customer_id: 'CUST-010',
    name: 'Electronics Components Ltd',
    country: 'Singapore',
    contact_email: 'purchasing@electronics.sg',
    segment: 'Industrial',
  },
];

// Demo Sales
export const demoSales: Sale[] = [
  {
    sale_id: 'SALE-2025-001',
    date: '2025-10-20',
    customer_id: 'CUST-001',
    fine_weight_oz: 37.15,
    price_per_oz_usd: 2650.00,
    fx_code: 'AED',
    fx_rate_to_usd: 3.6725,
    amount_usd: 98447.50,
    amount_fx: 361503.64,
  },
  {
    sale_id: 'SALE-2025-002',
    date: '2025-10-21',
    customer_id: 'CUST-002',
    fine_weight_oz: 25.80,
    price_per_oz_usd: 2655.00,
    fx_code: 'CHF',
    fx_rate_to_usd: 0.8850,
    amount_usd: 68499.00,
    amount_fx: 60621.62,
  },
  {
    sale_id: 'SALE-2025-003',
    date: '2025-10-21',
    customer_id: 'CUST-003',
    fine_weight_oz: 50.00,
    price_per_oz_usd: 2648.00,
    fx_code: 'ZAR',
    fx_rate_to_usd: 18.25,
    amount_usd: 132400.00,
    amount_fx: 2416300.00,
  },
  {
    sale_id: 'SALE-2025-004',
    date: '2025-10-22',
    customer_id: 'CUST-004',
    fine_weight_oz: 32.50,
    price_per_oz_usd: 2652.00,
    fx_code: 'GBP',
    fx_rate_to_usd: 0.7750,
    amount_usd: 86190.00,
    amount_fx: 66797.25,
  },
  {
    sale_id: 'SALE-2025-005',
    date: '2025-10-22',
    customer_id: 'CUST-005',
    fine_weight_oz: 40.20,
    price_per_oz_usd: 2660.00,
    fx_code: 'INR',
    fx_rate_to_usd: 83.50,
    amount_usd: 106932.00,
    amount_fx: 8928822.00,
  },
  {
    sale_id: 'SALE-2025-006',
    date: '2025-10-23',
    customer_id: 'CUST-006',
    fine_weight_oz: 15.75,
    price_per_oz_usd: 2658.00,
    fx_code: 'EUR',
    fx_rate_to_usd: 0.9250,
    amount_usd: 41863.50,
    amount_fx: 38723.74,
  },
  {
    sale_id: 'SALE-2025-007',
    date: '2025-10-23',
    customer_id: 'CUST-007',
    fine_weight_oz: 28.40,
    price_per_oz_usd: 2662.00,
    fx_code: 'EUR',
    fx_rate_to_usd: 0.9250,
    amount_usd: 75600.80,
    amount_fx: 69930.74,
  },
  {
    sale_id: 'SALE-2025-008',
    date: '2025-10-24',
    customer_id: 'CUST-008',
    fine_weight_oz: 60.00,
    price_per_oz_usd: 2665.00,
    fx_code: 'HKD',
    fx_rate_to_usd: 7.8000,
    amount_usd: 159900.00,
    amount_fx: 1247220.00,
  },
  {
    sale_id: 'SALE-2025-009',
    date: '2025-10-24',
    customer_id: 'CUST-009',
    fine_weight_oz: 45.30,
    price_per_oz_usd: 2668.00,
    fx_code: 'CNY',
    fx_rate_to_usd: 7.1500,
    amount_usd: 120860.40,
    amount_fx: 864151.86,
  },
  {
    sale_id: 'SALE-2025-010',
    date: '2025-10-25',
    customer_id: 'CUST-010',
    fine_weight_oz: 12.50,
    price_per_oz_usd: 2670.00,
    fx_code: 'SGD',
    fx_rate_to_usd: 1.3200,
    amount_usd: 33375.00,
    amount_fx: 44055.00,
  },
];

// Demo Gold Prices (last 14 days)
const goldPriceDates = generateDates(14);
export const demoGoldPrices: GoldPrice[] = goldPriceDates.map((date, index) => ({
  as_of: date,
  price_per_oz_usd: 2620 + (index * 3) + (Math.random() * 10 - 5), // Trending up with noise
}));

// Demo FX Rates (last 14 days, 4 currencies)
const fxCurrencies = ['EUR', 'XOF', 'GHS', 'GNF'];
const fxBasesRates = {
  EUR: 0.9250,
  XOF: 615.50,
  GHS: 15.80,
  GNF: 8600.00,
};

export const demoFxRates: FxRate[] = goldPriceDates.flatMap(date =>
  fxCurrencies.map(code => ({
    as_of: date,
    code,
    rate_to_usd: fxBasesRates[code as keyof typeof fxBasesRates] * (1 + (Math.random() * 0.02 - 0.01)),
  }))
);

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
