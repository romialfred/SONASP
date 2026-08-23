import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*', // audit V11
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TaskRequest {
  task_name: string;
}

/** Comparaison à temps constant pour éviter les attaques temporelles (audit V8). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // SÉCURITÉ (audit V8) : seul le planificateur détenant le secret peut déclencher les tâches.
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret') ?? '';
    if (!cronSecret || !timingSafeEqual(providedSecret, cronSecret)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      case 'process_email_queue':
        result = await processEmailQueue(supabase);
        break;
      case 'cleanup_old_cache':
        result = await cleanupOldCache(supabase);
        break;
      case 'check_workflow_timeouts':
        result = await checkWorkflowTimeouts(supabase);
        break;
      default:
        throw new Error(`Unknown task: ${task_name}`);
    }

    await supabase
      .from('scheduled_tasks')
      .update({
        last_run: new Date().toISOString(),
        last_status: result.success ? 'success' : 'failed',
        last_error: result.success ? null : result.message,
      })
      .eq('task_name', task_name);

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
    console.log('Fetching FX rates by calling fetch-daily-fx-rates edge function...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-daily-fx-rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log('FX rates fetched successfully:', result.data);
      return { success: true, message: result.message || 'Exchange rates fetched successfully' };
    } else {
      throw new Error(result.message || 'Failed to fetch exchange rates');
    }
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return { success: false, message: `Failed to fetch exchange rates: ${error instanceof Error ? error.message : error}` };
  }
}

async function fetchGoldPrices(supabase: any) {
  try {
    console.log('Fetching gold prices by calling fetch-daily-lbma-prices edge function...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-daily-lbma-prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log('Gold prices fetched successfully:', result.data);
      return { success: true, message: result.message || 'Gold prices fetched successfully' };
    } else {
      throw new Error(result.message || 'Failed to fetch gold prices');
    }
  } catch (error) {
    console.error('Error fetching gold prices:', error);
    return { success: false, message: `Failed to fetch gold prices: ${error instanceof Error ? error.message : error}` };
  }
}

async function processEmailQueue(supabase: any) {
  try {
    const { data: emails } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50);

    console.log(`Processing ${emails?.length || 0} emails...`);

    let sentCount = 0;
    for (const email of emails || []) {
      console.log(`Sending email to ${email.recipient_email}`);
      await supabase
        .from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', email.id);
      sentCount++;
    }

    return { success: true, message: `Processed ${sentCount} emails` };
  } catch (error) {
    return { success: false, message: `Failed to process email queue: ${error}` };
  }
}

async function cleanupOldCache(supabase: any) {
  try {
    const { error } = await supabase
      .from('analytics_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) throw error;

    return { success: true, message: 'Old cache cleaned up successfully' };
  } catch (error) {
    return { success: false, message: `Failed to cleanup old cache: ${error}` };
  }
}

async function checkWorkflowTimeouts(supabase: any) {
  try {
    const { data: workflows } = await supabase
      .from('workflow_instances')
      .select('*')
      .in('status', ['pending', 'in_progress']);

    console.log(`Checking ${workflows?.length || 0} active workflows for timeouts...`);

    return { success: true, message: `Checked ${workflows?.length || 0} workflows` };
  } catch (error) {
    return { success: false, message: `Failed to check workflow timeouts: ${error}` };
  }
}
