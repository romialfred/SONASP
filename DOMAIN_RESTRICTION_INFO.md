# Domain Restriction Configuration

## Overview
This application includes domain restriction security to ensure it's only accessible from authorized domains.

## Current Configuration

### Allowed Domains
- `global-shipping.org` (Production)
- `www.global-shipping.org` (Production with www)
- `localhost` (Local development)
- `127.0.0.1` (Local development)

### Blocked Domains
- **WebContainer Preview URLs**: All URLs containing:
  - `webcontainer`
  - `local-credentialless`
  - `.local-`

- **Other Unauthorized Domains**: Any domain not in the allowed list

## How It Works

The domain restriction is implemented in `/src/components/auth/DomainRestriction.tsx` and wraps the entire application in `/src/App.tsx`.

When a user tries to access the application from an unauthorized domain:
1. The application detects the hostname
2. Checks against allowed domains
3. If unauthorized, displays a security message with a redirect link to `https://global-shipping.org`
4. Prevents the application from loading

## For Development

During local development on `localhost` or `127.0.0.1`, the application works normally. This allows developers to test the application locally while blocking unauthorized preview URLs.

## Adding New Domains

To add a new authorized domain, edit `/src/components/auth/DomainRestriction.tsx`:

```typescript
const ALLOWED_DOMAINS = [
  'global-shipping.org',
  'www.global-shipping.org',
  'your-new-domain.com',  // Add here
  'localhost',
  '127.0.0.1'
];
```

## Security Notice

This restriction helps prevent:
- Unauthorized access via development preview URLs
- Access from cloned or copied deployments
- Phishing attempts using similar domains

The restriction is client-side and serves as an additional security layer. Always ensure your backend APIs also validate the request origin.
