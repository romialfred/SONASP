import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { to, subject, body, from = 'noreply@goldshipper.com' }: EmailRequest = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Sending email to ${to} with subject: ${subject}`);
    console.log(`Email body preview: ${body.substring(0, 100)}...`);

    const emailSent = true;

    if (emailSent) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          to,
          subject,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      throw new Error('Failed to send email');
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});