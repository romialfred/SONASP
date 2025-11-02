# 🚀 STEP 3: Deploy Edge Function - DETAILED GUIDE

## Overview

You need to deploy the updated `send-activation-email` Edge Function to Supabase so it can send real emails using the Resend API.

---

## Prerequisites

Before deploying:

✅ Step 1 completed: Resend account created + API key obtained
✅ Step 2 completed: API key added to Supabase Vault and exposed to Edge Functions

---

## Option A: Using Supabase Dashboard (EASIEST - Recommended)

### Method 1: Direct File Upload

1. **Go to Supabase Functions Dashboard**
   ```
   https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions
   ```

2. **Find the function**
   - Look for: `send-activation-email`
   - Click on it

3. **Update the function**
   - Click **"Edit Function"** button
   - Or click **"Deploy New Version"**

4. **Upload the updated file**
   - Click **"Upload File"** or **"Browse"**
   - Navigate to: `/tmp/cc-agent/59164212/project/supabase/functions/send-activation-email/index.ts`
   - Select the file
   - Click **"Upload"**

5. **Deploy**
   - Click **"Deploy"** button
   - Wait for deployment to complete (10-30 seconds)
   - You should see: ✅ "Deployment successful"

6. **Verify**
   - Go to **"Logs"** tab
   - Create a test user
   - Check logs for: `[send-activation-email] Email sent successfully via Resend`

---

## Option B: Using Supabase CLI (Advanced)

### B1. Install Supabase CLI

**If you don't have it installed:**

```bash
npm install -g supabase
```

**Verify installation:**
```bash
supabase --version
```

Expected output: `supabase version 1.x.x`

---

### B2. Login to Supabase

```bash
supabase login
```

**What happens:**
1. Browser opens automatically
2. You see: "Supabase CLI Authorization"
3. Click **"Authorize"**
4. You see: "You can now close this page"
5. Return to terminal
6. You see: "Logged in successfully"

**Troubleshooting:**
- If browser doesn't open: Copy the URL from terminal and paste in browser
- If already logged in: You'll see "Already logged in"

---

### B3. Link to Your Project

```bash
cd /tmp/cc-agent/59164212/project
supabase link --project-ref boolqagzdqbahqnpawpb
```

**What happens:**
1. CLI asks for your database password
2. Enter the password you use for Supabase dashboard
3. You see: "Linked to project boolqagzdqbahqnpawpb"

**Troubleshooting:**
- Wrong password: Try again with correct dashboard password
- Already linked: You'll see "Project is already linked"

---

### B4. Deploy the Function

```bash
npx supabase functions deploy send-activation-email
```

**OR use our automated script:**

```bash
chmod +x DEPLOY_EMAIL_FUNCTION.sh
./DEPLOY_EMAIL_FUNCTION.sh
```

**What happens:**
```
Deploying function send-activation-email...
Bundling function...
Uploading function...
✓ Deployed function send-activation-email
```

**Expected time:** 10-30 seconds

---

### B5. Verify Deployment

```bash
npx supabase functions list
```

**Expected output:**
```
NAME                     STATUS    VERSION
send-activation-email    ACTIVE    v1.x.x
```

---

## Option C: Manual Deployment via Supabase API (Expert)

If CLI doesn't work, you can deploy manually:

### C1. Get Your Access Token

1. Go to: https://supabase.com/dashboard/account/tokens
2. Click **"Generate new token"**
3. Name: `Deploy Edge Functions`
4. Copy the token

### C2. Package the Function

```bash
cd /tmp/cc-agent/59164212/project/supabase/functions/send-activation-email
zip -r function.zip index.ts
```

### C3. Deploy via API

```bash
curl -X POST \
  'https://api.supabase.com/v1/projects/boolqagzdqbahqnpawpb/functions/send-activation-email/deploy' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @function.zip
```

---

## Verification Steps

After deployment (any method):

### 1. Check Function Status

**Via Dashboard:**
- Go to: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions
- Status should show: ✅ **Active**
- Version should be updated

**Via CLI:**
```bash
npx supabase functions list
```

### 2. Check Logs

**Via Dashboard:**
1. Go to Functions page
2. Click **"send-activation-email"**
3. Click **"Logs"** tab
4. Should show recent deployment log

**Via CLI:**
```bash
npx supabase functions logs send-activation-email
```

### 3. Test the Function

**Create a test user:**
1. Refresh your Gold Shipper app
2. Go to: Administration → User Management
3. Click **"Create User"**
4. Fill form with YOUR real email
5. Click **"Create User"**

**Check results:**
- ✅ Success message: "Email sent to your@email.com"
- ✅ No credentials modal shown (if Resend configured)
- ✅ Email arrives in 30 seconds
- ✅ Console shows: `[send-activation-email] Email sent successfully`

### 4. Check Resend Dashboard

1. Go to: https://resend.com/emails
2. You should see your test email
3. Status: **Delivered**
4. Click to view email content

---

## Troubleshooting

### Error: "Supabase CLI not found"

**Solution:**
```bash
npm install -g supabase
```

---

### Error: "Not logged in"

**Solution:**
```bash
supabase login
```

Follow the browser authorization flow.

---

### Error: "Project not linked"

**Solution:**
```bash
cd /tmp/cc-agent/59164212/project
supabase link --project-ref boolqagzdqbahqnpawpb
```

Enter your Supabase dashboard password when prompted.

---

### Error: "Function not found"

**Solution:**
The function might not exist yet. Create it:

```bash
npx supabase functions new send-activation-email
```

Then copy the code from:
`/tmp/cc-agent/59164212/project/supabase/functions/send-activation-email/index.ts`

And deploy again.

---

### Error: "RESEND_API_KEY not configured" in logs

**This is expected!** It means:
- ✅ Function deployed successfully
- ❌ But Resend API key not added to Supabase Vault yet

**Solution:**
Go back to Step 2 and add the API key to Supabase Vault.

---

### Error: "Failed to send email: Invalid API key"

**Solution:**
1. Check API key in Supabase Vault
2. Make sure no extra spaces
3. Should start with `re_`
4. Generate new key from Resend if needed

---

### Email not received after deployment?

**Checklist:**
- [ ] Function deployed successfully?
- [ ] RESEND_API_KEY added to Vault?
- [ ] Secret exposed to Edge Functions?
- [ ] Test user created with valid email?
- [ ] Checked spam folder?
- [ ] Checked Resend dashboard for delivery status?

---

## Quick Commands Reference

```bash
# Install CLI
npm install -g supabase

# Login
supabase login

# Link project
cd /tmp/cc-agent/59164212/project
supabase link --project-ref boolqagzdqbahqnpawpb

# Deploy function
npx supabase functions deploy send-activation-email

# View logs
npx supabase functions logs send-activation-email

# List all functions
npx supabase functions list

# Test function locally (optional)
npx supabase functions serve send-activation-email
```

---

## Using the Automated Script

We've created a script that handles everything:

```bash
cd /tmp/cc-agent/59164212/project
chmod +x DEPLOY_EMAIL_FUNCTION.sh
./DEPLOY_EMAIL_FUNCTION.sh
```

**The script will:**
1. ✅ Check you're in correct directory
2. ✅ Verify Supabase CLI is installed
3. ✅ Deploy the function
4. ✅ Show success message with next steps
5. ✅ Handle errors gracefully

---

## Expected Results

After successful deployment:

✅ Function shows as "Active" in dashboard
✅ Latest version number incremented
✅ Logs show deployment timestamp
✅ Creating a user sends email automatically
✅ Email arrives in user's inbox within 30 seconds
✅ No credentials modal shown (when Resend configured)

---

## Next Step

After deployment succeeds:

**→ Go to STEP 4: Test Email Sending**

1. Create user with YOUR email
2. Check inbox
3. Verify email looks professional
4. Test activation link
5. Celebrate! 🎉

---

## Need Help?

**Check logs:**
- Dashboard: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions
- CLI: `npx supabase functions logs send-activation-email`

**Check Resend:**
- Emails: https://resend.com/emails
- API Keys: https://resend.com/api-keys

**Check Supabase Vault:**
- Secrets: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/settings/vault

---

## Summary

**Recommended method:** Option A (Dashboard upload)
**Alternative:** Option B (CLI - for developers)
**Time required:** 1-2 minutes
**Difficulty:** Easy

**Just follow Option A for the quickest deployment!**
