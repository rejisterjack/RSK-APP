# Authentication Issues

This guide covers problems with authentication, including OAuth, sessions, CSRF protection, SAML SSO, and API keys. The authentication module is implemented in `src/lib/auth/index.ts` using NextAuth.js v5.

---

## "OAuth callback fails"

After authenticating with GitHub or Google, you are redirected back to the login page with an error.

### Wrong redirect URL

The OAuth callback URL must match what is configured in the provider. The application uses `NEXTAUTH_URL` as the base URL. For the default configuration:

- **Development**: `NEXTAUTH_URL=http://localhost:3000`
- **Production**: `NEXTAUTH_URL=https://your-domain.com`

The callback URLs that must be registered with the OAuth provider are:

```
# GitHub OAuth App settings
Authorization callback URL: https://your-domain.com/api/auth/callback/github

# Google OAuth Client settings
Authorized redirect URIs: https://your-domain.com/api/auth/callback/google
```

### GitHub OAuth configuration

The application uses `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` (referenced in `src/lib/auth/index.ts`):

```env
AUTH_GITHUB_ID=your_github_client_id
AUTH_GITHUB_SECRET=your_github_client_secret
```

To set up or verify:
1. Go to https://github.com/settings/developers
2. Create or edit your OAuth App
3. Set the "Authorization callback URL" to `https://your-domain.com/api/auth/callback/github`
4. Copy the Client ID and Client Secret to your `.env`

### Google OAuth configuration

The application uses `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`:

```env
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
```

To set up or verify:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create or edit your OAuth 2.0 Client ID
3. Add `https://your-domain.com/api/auth/callback/google` to "Authorized redirect URIs"
4. Add your domain to "Authorized JavaScript origins"
5. Copy the Client ID and Client Secret to your `.env`

### Common mistakes

- **http vs https**: Production OAuth requires HTTPS. Make sure `NEXTAUTH_URL` uses `https://` in production.
- **Trailing slash**: Do not include a trailing slash in `NEXTAUTH_URL`.
- **Port number**: Include the port in development (`http://localhost:3000`), omit in production.
- **Multiple domains**: If you have multiple domains (preview deployments), register all callback URLs with the provider.

---

## "Session expires immediately"

After logging in, you are immediately redirected back to the login page, or the session appears to be invalid.

### NEXTAUTH_SECRET issues

The session JWT is encrypted with `NEXTAUTH_SECRET`. If this value changes between requests, sessions become invalid.

- The secret must be at least 32 characters (validated in `src/lib/env.ts`)
- It must be the same across all instances (in a multi-instance deployment)
- Generate a stable secret:

```bash
openssl rand -base64 32
```

Add to `.env`:

```
NEXTAUTH_SECRET=your-generated-secret-here
```

### Cookie settings

The session uses JWT tokens stored in cookies. If the cookie settings are incorrect, the browser may reject the cookie:

- **Secure flag**: In production, cookies require HTTPS. The `trustHost: true` setting in the NextAuth config helps, but ensure your reverse proxy passes the correct headers.
- **SameSite policy**: The middleware uses `SameSite=Strict` for session cookies. If your frontend and backend are on different domains, this can cause issues. Set `ALLOWED_ORIGINS` to include all frontend domains.

### Clock skew

JWT tokens include timestamps. If the server clock is significantly out of sync, tokens may be treated as expired. Check server time:

```bash
date
```

Compare with actual time. If there is significant drift, synchronize the clock:

```bash
# Linux
sudo ntpdate -s time.nist.gov

# macOS (automatic via system preferences)
sntp time.nist.gov
```

### Session configuration

The session is configured in `src/lib/auth/index.ts`:

```typescript
session: {
  strategy: 'jwt',
  maxAge: 7 * 24 * 60 * 60, // 7 days
  updateAge: 24 * 60 * 60,  // Refresh every 24 hours
}
```

If `maxAge` is too short, sessions expire quickly. The default of 7 days should be sufficient for most use cases.

---

## "CSRF token mismatch"

You see errors like "Invalid CSRF token" or `CSRF_INVALID` when making API requests.

### Understanding CSRF protection

The middleware in `src/middleware.ts` implements CSRF protection using the double-submit cookie pattern with HMAC validation. CSRF validation is enforced for unauthenticated requests to state-changing API routes (POST, PUT, DELETE) to these paths:

```
/api/admin, /api/export, /api/invite, /api/chat,
/api/ingest, /api/documents, /api/workspaces, /api/api-keys,
/api/webhooks, /api/billing, /api/voice
```

Authenticated requests (with valid session cookies) are not subject to CSRF token checks, because `SameSite=Strict` cookies already prevent cross-site attacks.

### Cookie settings in reverse proxy

If the application is behind a reverse proxy, the CSRF cookie may not be set correctly. Ensure the proxy forwards the `Set-Cookie` header and does not strip cookies.

For nginx:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

### CSRF_SECRET configuration

The CSRF validation uses `CSRF_SECRET` if set, otherwise falls back to `NEXTAUTH_SECRET`. Ensure one of these is set:

```env
NEXTAUTH_SECRET=your-secret-at-least-32-characters
# Or explicitly:
CSRF_SECRET=your-csrf-secret-at-least-32-characters
```

### For API consumers

If you are calling the API from a script or non-browser client:
- Authenticate with a session cookie (login first) to bypass CSRF checks
- Or use an API key (via `X-API-Key` header) which also bypasses CSRF checks

API key authentication is validated in the middleware and passes requests through without CSRF validation.

---

## "SAML SSO not working"

Enterprise SAML Single Sign-On fails to authenticate users. The SAML module is in `src/lib/auth/saml/`.

### IdP metadata configuration

The SAML connection requires the Identity Provider's metadata. Configure it in the `saml_connections` table:

```sql
SELECT id, workspace_id, idp_entity_id, idp_sso_url, idp_certificate, enabled
FROM saml_connections
WHERE workspace_id = 'YOUR_WORKSPACE_ID';
```

Ensure these fields are populated:
- `idp_entity_id`: The IdP's entity identifier
- `idp_sso_url`: The IdP's Single Sign-On URL
- `idp_certificate`: The IdP's X.509 certificate (PEM format)

### Service Provider metadata

Generate the SP metadata XML to provide to your IdP admin:

```typescript
import { generateSPMetadata } from '@/lib/auth/saml';
```

The SP metadata includes:
- Entity ID: defaults to `rag-starter-kit`
- ACS URL: Your callback URL
- Certificate: Your public certificate (if signing is enabled)

### Certificate issues

- **Expired certificate**: Check the certificate expiry:

```sql
SELECT workspace_id,
       public_certificate,
       private_key IS NOT NULL as has_private_key
FROM saml_connections;
```

- **Invalid certificate format**: Ensure the certificate is in PEM format (starts with `-----BEGIN CERTIFICATE-----`).
- **Missing private key**: The `private_key` field is encrypted at rest using `ENCRYPTION_MASTER_KEY`. Ensure this env var is set in production.

### Encryption key

SAML private keys are encrypted with `ENCRYPTION_MASTER_KEY` (must be at least 32 characters, required in production). If this key changes, existing encrypted private keys become unreadable:

```env
ENCRYPTION_MASTER_KEY=your-encryption-key-at-least-32-characters
```

### IdP-specific configuration

**Okta**:
- Application type: SAML 2.0 Web App
- Single sign-on URL: `https://your-domain.com/api/auth/saml/callback`
- Audience URI: `rag-starter-kit` (or your custom `spEntityId`)

**Azure AD**:
- Identifier (Entity ID): `rag-starter-kit`
- Reply URL: `https://your-domain.com/api/auth/saml/callback`

**OneLogin**:
- Application type: SAML Custom Connector
- ACS URL: `https://your-domain.com/api/auth/saml/callback`
- Audience: `rag-starter-kit`

---

## "API key authentication fails"

Requests with the `X-API-Key` header return 401 Unauthorized.

### Key format validation

The middleware performs basic format validation on API keys (in `src/middleware.ts`):

```typescript
if (apiKey.length < 20 || apiKey.length > 200) {
  // Returns 401: "Invalid API key format"
}
```

Ensure your API key is between 20 and 200 characters.

### Key has been revoked

API keys have a status of `ACTIVE`, `REVOKED`, or `EXPIRED`. Check the key status:

```sql
SELECT name, key_preview, status, expires_at, last_used_at
FROM api_keys
WHERE key_hash = 'hash-of-your-key';
```

If the status is `REVOKED`, the key was intentionally disabled. If `EXPIRED`, the key has passed its expiration date.

### Key has expired

If `expires_at` is set and in the past, the key is expired. Generate a new API key through the application UI or API.

### Wrong workspace

API keys are scoped to a workspace. If the key was generated for workspace A but you are trying to access resources in workspace B, the request will fail.

### Checking API key usage

```sql
SELECT ak.name, ak.key_preview, au.endpoint, au.method, au.created_at
FROM api_usage au
JOIN api_keys ak ON ak.id = au.api_key_id
WHERE ak.key_preview = 'first-few-chars'
ORDER BY au.created_at DESC
LIMIT 20;
```

---

## Still having issues?

1. Check the audit logs for authentication events:

```sql
SELECT event, severity, error, created_at
FROM audit_logs
WHERE event IN ('USER_LOGIN', 'USER_LOGOUT', 'SUSPICIOUS_ACTIVITY', 'PERMISSION_DENIED')
ORDER BY created_at DESC
LIMIT 20;
```

2. Enable debug logging in development:

```env
LOG_LEVEL=debug
```

3. Check the browser's developer tools Network tab for cookie and response header details during login.

4. Open a GitHub issue with the authentication method, the error message, and relevant audit log entries.
