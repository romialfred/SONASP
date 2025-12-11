import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFxRates() {
  console.log('=== FX Rate Sources ===');
  const { data: sources, error: sourcesError } = await supabase
    .from('fx_rate_sources')
    .select('*')
    .order('name');

  if (sourcesError) {
    console.error('Error fetching sources:', sourcesError);
  } else {
    console.log(JSON.stringify(sources, null, 2));
  }

  console.log('\n=== Latest FX Rates (Last 15) ===');
  const { data: latestRates, error: ratesError } = await supabase
    .from('fx_rates_daily')
    .select('rate_date, currency_pair, rate, fx_rate_sources(name, code)')
    .order('rate_date', { ascending: false })
    .limit(15);

  if (ratesError) {
    console.error('Error fetching rates:', ratesError);
  } else {
    console.log(JSON.stringify(latestRates, null, 2));
  }

  console.log('\n=== Currency Pairs in DB ===');
  const { data: pairs, error: pairsError } = await supabase
    .from('fx_rates_daily')
    .select('currency_pair')
    .order('currency_pair');

  if (pairsError) {
    console.error('Error fetching pairs:', pairsError);
  } else {
    const uniquePairs = [...new Set(pairs.map(p => p.currency_pair))];
    console.log(uniquePairs);
  }

  console.log('\n=== Date Range ===');
  const { data: dateRange, error: dateError } = await supabase
    .from('fx_rates_daily')
    .select('rate_date')
    .order('rate_date', { ascending: false })
    .limit(1);

  if (dateError) {
    console.error('Error fetching date range:', dateError);
  } else {
    console.log('Latest date:', dateRange[0]?.rate_date);
  }

  const { data: oldestDate, error: oldError } = await supabase
    .from('fx_rates_daily')
    .select('rate_date')
    .order('rate_date', { ascending: true })
    .limit(1);

  if (oldError) {
    console.error('Error fetching oldest date:', oldError);
  } else {
    console.log('Oldest date:', oldestDate[0]?.rate_date);
  }
}

checkFxRates().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
