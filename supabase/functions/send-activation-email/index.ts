import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SendActivationEmailRequest {
  user_id: string;
  email: string;
  full_name: string;
  token: string;
  temporary_password: string;
  token_type: 'activation' | 'password_reset';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const requestData: SendActivationEmailRequest = await req.json();
    const { user_id, email, full_name, token, temporary_password, token_type } = requestData;

    if (!user_id || !email || !full_name || !token || !temporary_password) {
      throw new Error('Missing required fields');
    }

    // Construct activation URL
    const activationUrl = `${supabaseUrl.replace('.supabase.co', '')}/activate-account?token=${token}`;

    // Email subject and body based on token type
    const isActivation = token_type === 'activation';
    const subject = isActivation
      ? 'Activate Your Gold Shipper Account'
      : 'Reset Your Gold Shipper Password';

    const emailBody = isActivation
      ? generateActivationEmailHTML(full_name, activationUrl, temporary_password)
      : generatePasswordResetEmailHTML(full_name, activationUrl, temporary_password);

    console.log('[send-activation-email] Preparing to send email to:', email);
    console.log('[send-activation-email] Activation URL:', activationUrl);

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.warn('[send-activation-email] RESEND_API_KEY not configured - email will not be sent');
      console.log('[send-activation-email] Temporary Password (for testing):', temporary_password);

      // Log to audit trail even if email not sent
      await supabaseAdmin
        .from('audit_trail')
        .insert({
          user_id: user_id,
          action: isActivation ? 'account_activation_email_queued' : 'password_reset_email_queued',
          details: {
            email: email,
            token_expiry: '24 hours',
            status: 'email_service_not_configured',
          },
          performed_by: user_id,
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email service not configured. Credentials returned for manual delivery.',
          activation_url: activationUrl,
          temporary_password: temporary_password,
          email_sent: false,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Send email using Resend API
    console.log('[send-activation-email] Sending email via Resend...');

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Gold Shipper <noreply@goldshipper.app>',
        to: [email],
        subject: subject,
        html: emailBody,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('[send-activation-email] Resend API error:', emailResult);
      throw new Error(`Failed to send email: ${emailResult.message || 'Unknown error'}`);
    }

    console.log('[send-activation-email] Email sent successfully via Resend:', emailResult.id);

    // Log the email in the database for audit purposes
    await supabaseAdmin
      .from('audit_trail')
      .insert({
        user_id: user_id,
        action: isActivation ? 'account_activation_email_sent' : 'password_reset_email_sent',
        details: {
          email: email,
          token_expiry: '24 hours',
          resend_email_id: emailResult.id,
          status: 'sent',
        },
        performed_by: user_id,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `${isActivation ? 'Activation' : 'Password reset'} email sent successfully to ${email}`,
        email_sent: true,
        resend_email_id: emailResult.id,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error sending activation email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

function generateActivationEmailHTML(
  fullName: string,
  activationUrl: string,
  temporaryPassword: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activate Your Account</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 3px solid #B8860B;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #B8860B;
    }
    h1 {
      color: #B8860B;
      font-size: 24px;
    }
    .credentials {
      background-color: #f8f9fa;
      border-left: 4px solid #B8860B;
      padding: 15px;
      margin: 20px 0;
    }
    .credentials strong {
      color: #B8860B;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #B8860B;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .security-note {
      font-size: 14px;
      color: #666;
      padding: 15px;
      background-color: #e8f4f8;
      border-radius: 5px;
      margin-top: 20px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏆 Gold Shipper</div>
    </div>

    <h1>Welcome ${fullName}!</h1>

    <p>Your Gold Shipper account has been created. To activate your account and set up your secure access, please follow these steps:</p>

    <div class="credentials">
      <p><strong>Your Temporary Password:</strong></p>
      <p style="font-family: monospace; font-size: 16px; letter-spacing: 1px;">${temporaryPassword}</p>
    </div>

    <div style="text-align: center;">
      <a href="${activationUrl}" class="button">Activate Your Account</a>
    </div>

    <div class="warning">
      <strong>⚠️ Important:</strong> This activation link expires in 24 hours. You must complete the activation process before the link expires.
    </div>

    <h2 style="color: #B8860B; font-size: 18px;">Activation Steps:</h2>
    <ol>
      <li><strong>Click the activation link above</strong></li>
      <li><strong>Enter your temporary password</strong> (shown above)</li>
      <li><strong>Create your new secure password</strong> that meets these requirements:
        <ul>
          <li>Minimum 12 characters</li>
          <li>At least one uppercase letter</li>
          <li>At least one lowercase letter</li>
          <li>At least one number</li>
          <li>At least one special character</li>
        </ul>
      </li>
      <li><strong>Set up Two-Factor Authentication (2FA)</strong> using Microsoft Authenticator</li>
      <li><strong>Accept privacy policies</strong> (GDPR, Privacy Policy, Cookies)</li>
    </ol>

    <div class="security-note">
      <strong>🔒 Security Notice:</strong><br>
      • This email contains sensitive information. Do not forward it to anyone.<br>
      • Two-Factor Authentication (2FA) is mandatory for your account security.<br>
      • Only Microsoft Authenticator is authorized for 2FA setup.<br>
      • Your account will not be activated until all steps are completed.
    </div>

    <p>If you didn't request this account or believe this email was sent in error, please contact your administrator immediately.</p>

    <div class="footer">
      <p><strong>Gold Shipper</strong> - Secure Gold Trading Platform</p>
      <p>This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function generatePasswordResetEmailHTML(
  fullName: string,
  resetUrl: string,
  temporaryPassword: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 3px solid #B8860B;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #B8860B;
    }
    h1 {
      color: #B8860B;
      font-size: 24px;
    }
    .credentials {
      background-color: #f8f9fa;
      border-left: 4px solid #B8860B;
      padding: 15px;
      margin: 20px 0;
    }
    .credentials strong {
      color: #B8860B;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #B8860B;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      margin: 20px 0;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .security-note {
      font-size: 14px;
      color: #666;
      padding: 15px;
      background-color: #e8f4f8;
      border-radius: 5px;
      margin-top: 20px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏆 Gold Shipper</div>
    </div>

    <h1>Password Reset Request</h1>

    <p>Hello ${fullName},</p>

    <p>Your administrator has reset your Gold Shipper account password. To regain access, please use the temporary password below and follow the reset process.</p>

    <div class="credentials">
      <p><strong>Your Temporary Password:</strong></p>
      <p style="font-family: monospace; font-size: 16px; letter-spacing: 1px;">${temporaryPassword}</p>
    </div>

    <div style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Your Password</a>
    </div>

    <div class="warning">
      <strong>⚠️ Important:</strong> This password reset link expires in 24 hours. You must complete the process before the link expires.
    </div>

    <h2 style="color: #B8860B; font-size: 18px;">Password Reset Steps:</h2>
    <ol>
      <li><strong>Click the reset link above</strong></li>
      <li><strong>Enter your temporary password</strong> (shown above)</li>
      <li><strong>Create your new secure password</strong> that meets these requirements:
        <ul>
          <li>Minimum 12 characters</li>
          <li>At least one uppercase letter</li>
          <li>At least one lowercase letter</li>
          <li>At least one number</li>
          <li>At least one special character</li>
          <li>Must be different from your last 5 passwords</li>
        </ul>
      </li>
    </ol>

    <div class="security-note">
      <strong>🔒 Security Notice:</strong><br>
      • This email contains sensitive information. Do not forward it to anyone.<br>
      • Your temporary password is only valid for one use.<br>
      • If you didn't request a password reset, contact your administrator immediately.
    </div>

    <div class="footer">
      <p><strong>Gold Shipper</strong> - Secure Gold Trading Platform</p>
      <p>This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;
}
