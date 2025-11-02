# 📧 EMAIL SETUP GUIDE - Automatic Email Notifications

## Overview

I've updated the Edge Function to **automatically send emails** using Resend API. When you create a user, they will receive:

1. ✉️ Welcome email with temporary password
2. 🔗 Activation link to set up their account
3. 📋 Step-by-step instructions
4. ⚠️ Security guidelines

---

## STEP 1: Sign Up for Resend (5 minutes)

### 1.1 Create Account

1. Go to: **https://resend.com/signup**
2. Sign up with your email
3. Verify your email address
4. Log in to dashboard

### 1.2 Get API Key

1. In Resend dashboard, go to: **API Keys**
2. Click **"Create API Key"**
3. Name it: `Gold Shipper Production`
4. Select permissions: **"Sending access"**
5. Click **"Create"**
6. **COPY THE API KEY** (starts with `re_...`)
7. ⚠️ IMPORTANT: Save it now - you won't see it again!

Example API key format:
```
re_123abc456def789ghi012jkl345mno678
```

---

## STEP 2: Add Domain (For Production) - OPTIONAL

For development/testing, skip this step. Resend provides a test domain.

### For Production Only:

1. In Resend dashboard, go to: **Domains**
2. Click **"Add Domain"**
3. Enter your domain: `goldshipper.app` (or your domain)
4. Add DNS records provided by Resend
5. Wait for verification (5-15 minutes)

---

## STEP 3: Configure Supabase (2 minutes)

### 3.1 Add API Key to Supabase Secrets

1. Go to: **https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/settings/vault**

2. Click **"New Secret"**

3. Fill in:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_123abc456def789ghi012jkl345mno678` (your actual key)

4. Click **"Create Secret"**

### 3.2 Make Secret Available to Edge Functions

1. Still in Vault page, find your secret
2. Click the **"..."** menu next to it
3. Select **"Expose to Edge Functions"**
4. Confirm

---

## STEP 4: Deploy Updated Edge Function (1 minute)

Run this command in your terminal:

```bash
npx supabase functions deploy send-activation-email
```

Or copy this command for your project:

```bash
cd /tmp/cc-agent/59164212/project
npx supabase functions deploy send-activation-email
```

**Expected output:**
```
✓ Deployed function send-activation-email
```

---

## STEP 5: Update Email "From" Address (Optional)

### For Testing (Works Immediately):
The function uses: `Gold Shipper <noreply@goldshipper.app>`

Resend will use their test domain: `onboarding@resend.dev`

### For Production (After Adding Domain):
Edit the Edge Function (line 103):

```typescript
from: 'Gold Shipper <noreply@yourdomain.com>',
```

Then redeploy:
```bash
npx supabase functions deploy send-activation-email
```

---

## STEP 6: Test Email Sending (2 minutes)

### 6.1 Create Test User

1. Refresh your app (Ctrl+Shift+R)
2. Go to: **Administration → User Management**
3. Click **"Create User"**
4. Fill form:
   - Full Name: `Test User`
   - Email: **YOUR REAL EMAIL** (so you can receive the test email)
   - Role: `Factory`
   - Click **"Generate"** for password
5. Click **"Create User"**

### 6.2 Check Results

**In the app:**
- ✅ Success message: "User created successfully"
- ✅ Should NOT show credentials modal anymore (email sent automatically)

**In your inbox:**
- ✅ Email received within 30 seconds
- ✅ Subject: "Activate Your Gold Shipper Account"
- ✅ Contains temporary password
- ✅ Contains activation link
- ✅ Professional HTML design

**In browser console (F12):**
- ✅ `[send-activation-email] Email sent successfully via Resend: re_xyz123...`

---

## Troubleshooting

### Email Not Received?

**Check 1: Verify API Key**
```bash
# Test API key directly
curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "your-email@example.com",
    "subject": "Test Email",
    "html": "<p>Testing Resend API</p>"
  }'
```

**Check 2: View Edge Function Logs**
1. Go to: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions
2. Click **"send-activation-email"**
3. Click **"Logs"** tab
4. Look for errors

**Check 3: Check Spam Folder**
Resend test emails might go to spam initially.

**Check 4: Verify Secret**
1. Go to: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/settings/vault
2. Verify `RESEND_API_KEY` exists
3. Verify it's exposed to Edge Functions

### Common Errors

**Error: "RESEND_API_KEY not configured"**
- Solution: Add the API key to Supabase Vault (Step 3)
- Make sure it's exposed to Edge Functions

**Error: "Failed to send email: Invalid API key"**
- Solution: Copy the API key again from Resend
- Paste exactly as shown (no spaces)

**Error: "Failed to send email: Invalid from address"**
- Solution: Use `onboarding@resend.dev` for testing
- Or add and verify your own domain in Resend

---

## Email Limits

### Resend Free Tier:
- ✅ 100 emails/day
- ✅ 1 domain
- ✅ Full API access
- ✅ Email logs & analytics

### Need More?
Upgrade to Resend Pro:
- 50,000 emails/month for $20/month
- Unlimited domains
- Priority support

---

## What Happens Now

### When Creating a User:

1. **Admin fills form** → Creates user
2. **System generates** → Temporary password + activation token
3. **Edge Function sends** → Beautiful HTML email via Resend
4. **User receives** → Email within 30 seconds
5. **User clicks link** → Activates account + changes password
6. **User logs in** → With new password

### Email Content:

The user receives:
- 🏆 Gold Shipper branding
- 👤 Their full name
- 📧 Email address (username)
- 🔑 Temporary password (in large, highlighted box)
- 🔗 Activation link (click to activate)
- 📝 Step-by-step instructions
- ⚠️ Security warnings
- ⏰ 24-hour expiry notice

---

## Keep Credentials Modal? (Optional)

If you want to STILL show credentials modal for admin (as backup):

Edit `UserManagementPage.tsx` line 299:

```typescript
// Always show credentials modal for admin record
setUserCredentials({
  email: formData.email,
  full_name: formData.full_name,
  temporary_password: result.temporary_password || formData.password,
  activation_url: result.activation_url,
});
setShowCredentialsModal(true);
```

This way:
- ✅ Email sent to user automatically
- ✅ Admin also sees credentials (backup)

---

## Testing Checklist

- [ ] Resend account created
- [ ] API key copied
- [ ] API key added to Supabase Vault
- [ ] Secret exposed to Edge Functions
- [ ] Edge Function deployed
- [ ] Test user created
- [ ] Email received
- [ ] Email looks professional
- [ ] Temporary password works
- [ ] Activation link works

---

## Quick Commands

### Deploy Edge Function
```bash
cd /tmp/cc-agent/59164212/project
npx supabase functions deploy send-activation-email
```

### View Logs
```bash
npx supabase functions logs send-activation-email
```

### Test API Key
```bash
curl -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"onboarding@resend.dev","to":"your-email@example.com","subject":"Test","html":"<p>Test</p>"}'
```

---

## Summary

**Time Required:**
- Resend signup: 5 min
- Configure Supabase: 2 min
- Deploy function: 1 min
- Test: 2 min
- **TOTAL: 10 minutes**

**Result:**
✅ Automatic email notifications
✅ Professional HTML emails
✅ 100 free emails/day
✅ Beautiful branding
✅ No more manual credential sharing

---

## Support

Need help? Check:
1. **Edge Function Logs**: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions
2. **Resend Logs**: https://resend.com/emails
3. **Supabase Vault**: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/settings/vault

**Ready to set up? Start with STEP 1 above!**
