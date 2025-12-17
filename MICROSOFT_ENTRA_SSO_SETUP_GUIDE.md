# Microsoft Entra (Azure AD) SSO Setup Guide

This guide provides step-by-step instructions for configuring Microsoft Entra (formerly Azure AD) Single Sign-On (SSO) authentication for the Mansa Gold Tracker application.

## Prerequisites

- Access to Microsoft Entra admin center (formerly Azure Portal)
- Supabase project admin access
- Your application's production URL

## Step 1: Configure Microsoft Entra Application

### 1.1 Create a New App Registration

1. Go to [Microsoft Entra Admin Center](https://entra.microsoft.com/)
2. Navigate to **Identity** > **Applications** > **App registrations**
3. Click **New registration**
4. Fill in the application details:
   - **Name**: `Mansa Gold Tracker`
   - **Supported account types**: Choose based on your organization's needs:
     - **Single tenant**: Only users from your organization
     - **Multitenant**: Users from any organization (recommended for multi-org support)
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`

       Replace `YOUR_SUPABASE_PROJECT_REF` with your actual Supabase project reference
       (e.g., `https://abcdefghijklmnop.supabase.co/auth/v1/callback`)

5. Click **Register**

### 1.2 Configure Authentication Settings

1. After registration, go to **Authentication** in the left sidebar
2. Under **Platform configurations**, verify your Redirect URI is listed
3. Under **Implicit grant and hybrid flows**, enable:
   - ✅ **ID tokens** (used for implicit and hybrid flows)
4. Click **Save**

### 1.3 Configure API Permissions

1. Go to **API permissions** in the left sidebar
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add the following permissions:
   - `openid` (Sign users in)
   - `profile` (View users' basic profile)
   - `email` (View users' email address)
6. Click **Add permissions**
7. Click **Grant admin consent for [Your Organization]** (if you have admin rights)

### 1.4 Get Application Credentials

1. Go to **Overview** in the left sidebar
2. Copy and save these values:
   - **Application (client) ID** - You'll need this
   - **Directory (tenant) ID** - You'll need this

3. Go to **Certificates & secrets** in the left sidebar
4. Under **Client secrets**, click **New client secret**
5. Add a description: `Supabase SSO`
6. Choose an expiration period (recommended: 24 months)
7. Click **Add**
8. **IMPORTANT**: Copy the **Value** immediately - it won't be shown again!

## Step 2: Configure Supabase Authentication

### 2.1 Enable Azure Provider in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** > **Providers**
4. Find **Azure** in the list and click to expand
5. Toggle **Enable Azure**

### 2.2 Configure Azure Provider Settings

Fill in the following fields:

- **Azure Client ID**: Paste the Application (client) ID from Step 1.4
- **Azure Secret**: Paste the Client secret value from Step 1.4
- **Azure Tenant ID**: Paste the Directory (tenant) ID from Step 1.4

**Additional Settings:**
- **Redirect URL**: This is automatically set by Supabase
  - It should be: `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`
  - Make sure this matches the Redirect URI you configured in Microsoft Entra

### 2.3 Save Configuration

1. Click **Save** to apply the changes
2. Test the configuration by attempting to sign in with Microsoft

## Step 3: Test SSO Authentication

### 3.1 Test Login Flow

1. Open your application login page
2. Click the **Sign in with Microsoft** button
3. You should be redirected to Microsoft login
4. Enter your Microsoft credentials
5. Approve the requested permissions
6. You should be redirected back to your application

### 3.2 Verify User Profile

1. After successful login, check that:
   - User is authenticated in Supabase
   - User profile is created in the `profiles` table
   - Email and name are correctly populated

## Step 4: Configure User Profile Auto-Creation

To ensure user profiles are automatically created on first SSO login, you need to set up a database trigger:

```sql
-- Create a function to handle new user creation from SSO
CREATE OR REPLACE FUNCTION public.handle_sso_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if profile already exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    -- Create profile for SSO user
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      role,
      site_ids,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'management', -- Default role for SSO users
      ARRAY['guinea'], -- Default site
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auth.users table
DROP TRIGGER IF EXISTS on_sso_user_created ON auth.users;
CREATE TRIGGER on_sso_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_app_meta_data->>'provider' = 'azure')
  EXECUTE FUNCTION public.handle_sso_user_creation();
```

## Troubleshooting

### Common Issues

#### 1. "Invalid redirect URI" error

**Problem**: The redirect URI in Microsoft Entra doesn't match Supabase's callback URL

**Solution**:
- Verify the redirect URI in Microsoft Entra matches exactly:
  `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`
- Check for trailing slashes or typos

#### 2. "Unauthorized client" error

**Problem**: Client secret is invalid or expired

**Solution**:
- Generate a new client secret in Microsoft Entra
- Update the secret in Supabase configuration
- Save the changes

#### 3. "User cannot sign in" error

**Problem**: User doesn't have permission to sign in to the application

**Solution**:
- In Microsoft Entra, go to **Enterprise applications**
- Find your application
- Go to **Properties** and set **User assignment required** to **No** (for testing)
- Or add specific users/groups under **Users and groups**

#### 4. Profile not created after SSO login

**Problem**: Database trigger not working or profile creation failing

**Solution**:
- Verify the trigger exists and is enabled
- Check Supabase logs for any errors
- Manually create a profile for the user in the `profiles` table

#### 5. "Consent required" error

**Problem**: Admin consent not granted for required permissions

**Solution**:
- Go to **API permissions** in Microsoft Entra
- Click **Grant admin consent for [Your Organization]**
- Or have users consent individually on first login

## Security Best Practices

1. **Client Secret Rotation**
   - Rotate client secrets regularly (every 6-12 months)
   - Update the secret in Supabase when rotating

2. **Restrict Access**
   - Use Microsoft Entra's user assignment to control who can access the application
   - Configure conditional access policies if needed

3. **Monitor Sign-Ins**
   - Regularly review sign-in logs in Microsoft Entra
   - Set up alerts for suspicious activity

4. **Role Assignment**
   - Assign appropriate roles to SSO users in your application
   - Consider mapping Azure AD groups to application roles

## Multi-Tenant Considerations

If you need to support multiple organizations:

1. Configure the app as **Multitenant** in Microsoft Entra
2. Each organization will need to consent to your application
3. Consider implementing tenant isolation in your database

## Additional Resources

- [Microsoft Entra Documentation](https://learn.microsoft.com/en-us/entra/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OAuth 2.0 and OpenID Connect](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-protocols)

## Support

For issues with:
- **Microsoft Entra configuration**: Contact your Microsoft admin or Microsoft Support
- **Supabase configuration**: Check Supabase documentation or contact Supabase support
- **Application integration**: Review this guide or contact your development team

---

**Last Updated**: December 2024
**Version**: 1.0
