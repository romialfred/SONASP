# ✅ Méthode Alternative: SANS Installation (Interface Web)

## 🎯 Vous N'avez PAS Besoin de CLI!

Vous pouvez déployer les fonctions **directement dans l'interface Supabase Dashboard** en copiant-collant le code.

**Aucune installation nécessaire. Tout se fait dans votre navigateur.**

---

## 🌐 Méthode 1: Via l'Interface Web (Le Plus Simple)

### Étape 1: Ouvrir Supabase Dashboard

Allez sur:
```
https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions
```

OU:
1. Connectez-vous à https://supabase.com/dashboard
2. Sélectionnez votre projet: **boolqagzdqbahqnpawpb**
3. Cliquez sur **Edge Functions** dans le menu de gauche

---

### Étape 2: Créer la Première Fonction

1. Cliquez sur **"New Edge Function"** ou **"Create a new function"**

2. Entrez le nom: `fetch-daily-fx-rates`

3. Dans l'éditeur de code qui apparaît, **SUPPRIMEZ TOUT** le code par défaut

4. **COPIEZ-COLLEZ** tout ce code:

```typescript
/**
 * Supabase Edge Function: Fetch Daily FX Rates
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const XOF_TO_EUR_PEG = 655.957;
const WEEKENDS = [0, 6];

function isTradingDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return !WEEKENDS.includes(dayOfWeek);
}

async function fetchFromECB(): Promise<{ eurUsd: number | null; usdXof: number | null }> {
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD');
    if (!response.ok) return { eurUsd: null, usdXof: null };
    const data = await response.json();
    if (data.rates && data.rates.USD) {
      const eurUsd = parseFloat(data.rates.USD.toFixed(6));
      const usdXof = parseFloat((XOF_TO_EUR_PEG / eurUsd).toFixed(2));
      return { eurUsd, usdXof };
    }
  } catch (error) {
    console.error('Frankfurter API error:', error);
  }
  return { eurUsd: null, usdXof: null };
}

async function fetchUsdGnf(): Promise<number | null> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) return await fetchUsdGnfFallback();
    const data = await response.json();
    if (data.result === 'success' && data.rates && data.rates.GNF) {
      return parseFloat(data.rates.GNF.toFixed(2));
    }
    return await fetchUsdGnfFallback();
  } catch (error) {
    console.error('USD/GNF API error:', error);
    return await fetchUsdGnfFallback();
  }
}

async function fetchUsdGnfFallback(): Promise<number | null> {
  try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    if (!response.ok) return null;
    const data = await response.json();
    if (data.usd && data.usd.gnf) {
      return parseFloat(data.usd.gnf.toFixed(2));
    }
  } catch (error) {
    console.error('Fallback USD/GNF API error:', error);
  }
  return null;
}

function calculateXofGnf(usdXof: number, usdGnf: number): number {
  return parseFloat((usdGnf / usdXof).toFixed(4));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (!isTradingDay(today)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Weekend: ${todayStr}`,
          reason: 'weekend',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: ecbSource } = await supabase
      .from('fx_rate_sources')
      .select('id')
      .eq('code', 'ECB')
      .maybeSingle();

    if (!ecbSource) {
      throw new Error('ECB source not found in database');
    }

    const ecbSourceId = ecbSource.id;

    const { data: existing } = await supabase
      .from('fx_rates_daily')
      .select('rate_date')
      .eq('rate_date', todayStr)
      .eq('source_id', ecbSourceId)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Rates already recorded for ${todayStr}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { eurUsd, usdXof } = await fetchFromECB();
    if (!eurUsd || !usdXof) {
      throw new Error('Unable to fetch EUR/USD or USD/XOF from ECB');
    }

    const usdGnf = await fetchUsdGnf();
    if (!usdGnf) {
      throw new Error('Unable to fetch USD/GNF from any source');
    }

    const xofGnf = calculateXofGnf(usdXof, usdGnf);

    const records = [
      {
        rate_date: todayStr,
        source_id: ecbSourceId,
        currency_pair: 'EUR/USD',
        rate: eurUsd,
        notes: 'Automated daily import from ECB',
      },
      {
        rate_date: todayStr,
        source_id: ecbSourceId,
        currency_pair: 'USD/XOF',
        rate: usdXof,
        notes: 'Calculated from EUR/USD using fixed XOF/EUR peg (655.957)',
      },
      {
        rate_date: todayStr,
        source_id: ecbSourceId,
        currency_pair: 'USD/GNF',
        rate: usdGnf,
        notes: 'Automated daily import from ExchangeRate-API',
      },
      {
        rate_date: todayStr,
        source_id: ecbSourceId,
        currency_pair: 'XOF/GNF',
        rate: xofGnf,
        notes: 'Cross rate calculated from USD/XOF and USD/GNF',
      },
    ];

    const { error: insertError } = await supabase
      .from('fx_rates_daily')
      .insert(records);

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let monthlyAggregatesCreated = false;

    if (tomorrow.getDate() === 1 || tomorrow.getMonth() !== today.getMonth()) {
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      const currencyPairs = ['EUR/USD', 'USD/XOF', 'USD/GNF', 'XOF/GNF'];

      for (const pair of currencyPairs) {
        const { data: monthlyData } = await supabase
          .from('fx_rates_daily')
          .select('*')
          .eq('source_id', ecbSourceId)
          .eq('currency_pair', pair)
          .gte('rate_date', startDate)
          .lt('rate_date', endDate)
          .order('rate_date', { ascending: true });

        if (monthlyData && monthlyData.length > 0) {
          const rates = monthlyData.map((d: any) => d.rate);
          const avgRate = rates.reduce((sum: number, r: number) => sum + r, 0) / rates.length;
          const variance = rates.reduce((sum: number, r: number) =>
            sum + Math.pow(r - avgRate, 2), 0) / rates.length;
          const volatility = Math.sqrt(variance);

          await supabase
            .from('fx_rates_monthly_aggregated')
            .upsert({
              year,
              month,
              source_id: ecbSourceId,
              currency_pair: pair,
              average_rate: parseFloat(avgRate.toFixed(6)),
              high_rate: Math.max(...rates),
              low_rate: Math.min(...rates),
              opening_rate: monthlyData[0].rate,
              closing_rate: monthlyData[monthlyData.length - 1].rate,
              total_days: monthlyData.length,
              volatility: parseFloat(volatility.toFixed(6)),
            }, {
              onConflict: 'year,month,source_id,currency_pair',
            });

          monthlyAggregatesCreated = true;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'FX rates recorded successfully',
        data: {
          date: todayStr,
          rates: {
            'EUR/USD': eurUsd,
            'USD/XOF': usdXof,
            'USD/GNF': usdGnf,
            'XOF/GNF': xofGnf,
          },
          monthly_aggregates_created: monthlyAggregatesCreated,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in fetch-daily-fx-rates:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

5. Cliquez sur **"Deploy"** ou **"Save"**

---

### Étape 3: Créer la Deuxième Fonction

1. Cliquez à nouveau sur **"New Edge Function"**

2. Entrez le nom: `scheduled-tasks`

3. **SUPPRIMEZ TOUT** le code par défaut

4. **COPIEZ-COLLEZ** ce code:

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TaskRequest {
  task_name: string;
  api_key?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { task_name }: TaskRequest = await req.json();

    if (!task_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: task_name' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Executing scheduled task: ${task_name}`);

    let result = { success: false, message: '' };

    switch (task_name) {
      case 'fetch_exchange_rates':
        result = await fetchExchangeRates(supabase);
        break;
      case 'fetch_gold_prices':
        result = await fetchGoldPrices(supabase);
        break;
      default:
        throw new Error(`Unknown task: ${task_name}`);
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.message,
        task_name,
        executed_at: new Date().toISOString(),
      }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error executing scheduled task:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to execute scheduled task',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function fetchExchangeRates(supabase: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-daily-fx-rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      return { success: true, message: result.message || 'Exchange rates fetched successfully' };
    } else {
      throw new Error(result.message || 'Failed to fetch exchange rates');
    }
  } catch (error) {
    return { success: false, message: `Failed to fetch exchange rates: ${error}` };
  }
}

async function fetchGoldPrices(supabase: any) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-daily-lbma-prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      return { success: true, message: result.message || 'Gold prices fetched successfully' };
    } else {
      throw new Error(result.message || 'Failed to fetch gold prices');
    }
  } catch (error) {
    return { success: false, message: `Failed to fetch gold prices: ${error}` };
  }
}
```

5. Cliquez sur **"Deploy"** ou **"Save"**

---

## ✅ C'EST TOUT!

Les fonctions sont déployées! Vous pouvez maintenant les tester.

---

## 🧪 Tester les Fonctions

### Dans l'Interface Supabase:

1. Allez dans **Edge Functions**
2. Cliquez sur `fetch-daily-fx-rates`
3. Cliquez sur **"Invoke"** ou **"Test"**
4. Cliquez sur **"Run"**

**Résultat attendu:**
```json
{
  "success": true,
  "message": "FX rates recorded successfully",
  "data": {
    "date": "2025-12-15",
    "rates": {
      "EUR/USD": 1.16340,
      "USD/XOF": 563.83,
      "USD/GNF": 8715.75,
      "XOF/GNF": 15.4581
    }
  }
}
```

---

## 📊 Configurer les Cron Jobs (Optionnel)

Pour que les fonctions s'exécutent automatiquement tous les jours:

1. Allez dans **Supabase Dashboard > SQL Editor**
2. Créez une nouvelle requête
3. **COPIEZ-COLLEZ** ce code SQL:

```sql
-- Activer l'extension pg_cron si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Tâche quotidienne: Récupérer les taux FX à 10h00 UTC (lundi-vendredi)
SELECT cron.schedule(
  'fetch-daily-fx-rates',
  '0 10 * * 1-5',
  $$
  SELECT
    net.http_post(
      url:='https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.c0u5g6tZgYQF_Rn-3TlFz7z5Z-8lH6M5yKcYXyDpT1I'
      ),
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

4. Cliquez sur **"Run"**

---

## ✨ Avantages de Cette Méthode

| ✅ Avantages | ❌ CLI (qui ne marche pas pour vous) |
|--------------|--------------------------------------|
| **Aucune installation** | Nécessite npm, Node.js, Supabase CLI |
| **Fonctionne dans le navigateur** | Problèmes de permissions |
| **Copier-coller simple** | Commandes complexes |
| **Pas d'erreurs de syntaxe** | Erreurs de frappe possibles |
| **Interface visuelle** | Ligne de commande |

---

## 🎯 Récapitulatif Visuel

```
1. Ouvrir Dashboard → Edge Functions
           ↓
2. New Edge Function → "fetch-daily-fx-rates"
           ↓
3. Copier-coller le code de la Fonction 1
           ↓
4. Deploy
           ↓
5. New Edge Function → "scheduled-tasks"
           ↓
6. Copier-coller le code de la Fonction 2
           ↓
7. Deploy
           ↓
8. Tester dans l'interface
           ↓
9. ✅ TERMINÉ!
```

---

## 🆘 Si Vous Avez des Questions

**Cette méthode ne nécessite AUCUNE commande terminal.**

Tout se fait dans votre navigateur web à l'adresse:
```
https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions
```

**C'est beaucoup plus simple que d'essayer d'installer le CLI!**

---

## 📁 Fichier Complet

Ce fichier contient:
- ✅ Les 2 fonctions complètes prêtes à copier-coller
- ✅ Instructions étape par étape avec interface web
- ✅ Code SQL pour les cron jobs
- ✅ Méthode de test

**Aucune installation nécessaire. Tout dans le navigateur.** 🎉
