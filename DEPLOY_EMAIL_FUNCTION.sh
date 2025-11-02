#!/bin/bash

echo "======================================"
echo "📧 Deploying Email Function to Supabase"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from project root directory"
  exit 1
fi

echo "✅ Project directory verified"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found. Installing..."
  npm install -g supabase
fi

echo "✅ Supabase CLI ready"
echo ""

# Deploy the function
echo "🚀 Deploying send-activation-email function..."
echo ""

npx supabase functions deploy send-activation-email

if [ $? -eq 0 ]; then
  echo ""
  echo "======================================"
  echo "✅ Deployment Successful!"
  echo "======================================"
  echo ""
  echo "Next steps:"
  echo "1. Make sure RESEND_API_KEY is configured in Supabase Vault"
  echo "2. Test by creating a user with your email"
  echo "3. Check your inbox for the email"
  echo ""
  echo "Links:"
  echo "- Supabase Vault: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/settings/vault"
  echo "- Edge Functions: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions"
  echo ""
else
  echo ""
  echo "======================================"
  echo "❌ Deployment Failed"
  echo "======================================"
  echo ""
  echo "Common issues:"
  echo "1. Not logged in to Supabase CLI"
  echo "   Fix: Run 'npx supabase login'"
  echo ""
  echo "2. Not linked to project"
  echo "   Fix: Run 'npx supabase link --project-ref boolqagzdqbahqnpawpb'"
  echo ""
  exit 1
fi
