# Custom OIDC Provider

A self-hosted OpenID Connect identity provider built with Express, Drizzle ORM, and `jose`. Supports the Authorization Code flow with PKCE and SSO session cookies.

**Live:** https://custom-oidc-provider.onrender.com  
**Docs:** https://custom-oidc-provider.onrender.com (served at `/`)

---

## Features

- Authorization Code flow (OIDC compliant)
- PKCE support (S256 only)
- SSO — users stay logged in across client apps via a session cookie
- RS256-signed JWTs verified via JWKS
- Client app registration via a password-protected UI
- User signup/login UI served by the provider

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/.well-known/openid-configuration` | OIDC discovery document |
| GET | `/.well-known/jwks.json` | Public key set for token verification |
| GET | `/authorize` | Start the login flow |
| POST | `/authorize/callback` | Submit credentials (used by login UI) |
| POST | `/token` | Exchange auth code for tokens |
| GET | `/userinfo` | Get authenticated user's profile |
| POST | `/logout` | Clear the SSO session |
| POST | `/api/auth/register` | Create a user account |
| POST | `/api/admin/verify` | Verify admin password, get admin JWT |
| POST | `/api/admin/clients` | Register a new OAuth client |

---

## Integrating with Your App

**1. Register your app** at `/register-client.html` — you'll get a `client_id` and `client_secret`.

**2. Add to your `.env`:**
```env
AUTH_ISSUER=https://custom-oidc-provider.onrender.com
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
REDIRECT_URI=https://yourapp.com/callback
```

**3. Redirect users to login:**
```js
const params = new URLSearchParams({
  client_id: process.env.CLIENT_ID,
  redirect_uri: process.env.REDIRECT_URI,
  response_type: "code",
  scope: "openid profile email",
  state: crypto.randomUUID(),
});
res.redirect(`${process.env.AUTH_ISSUER}/authorize?${params}`);
```

**4. Handle the callback (server-side):**
```js
const tokenRes = await fetch(`${AUTH_ISSUER}/token`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    grant_type: "authorization_code",
    code: req.query.code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }),
});
const { access_token, id_token } = await tokenRes.json();
```

**5. Verify the id_token:**
```js
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_ISSUER}/.well-known/jwks.json`)
);

const { payload } = await jwtVerify(id_token, JWKS, {
  issuer: AUTH_ISSUER,
  audience: CLIENT_ID,
});
// payload.sub, payload.email, payload.given_name etc.
```

---

## Running Locally

```bash
git clone <repo>
cd oidc
pnpm install
cp .env.example .env  # fill in your values
pnpm db:generate
pnpm db:migrate
pnpm dev
```

**Required `.env` variables:**
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/oidc
ISSUER=http://localhost:3000
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
ADMIN_PASSWORD=your-admin-password
ADMIN_JWT_SECRET=random-secret-32-chars
SESSION_SECRET=another-random-secret-32-chars
```

**Generate RSA keys:**
```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
node export-keys.mjs  # converts to single-line env format
```

---

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL via Drizzle ORM + postgres.js
- **Tokens:** `jose` (RS256 signed JWTs)
- **Passwords:** bcrypt
- **Validation:** Zod v4
- **Deploy:** Render

---

## Project Structure

```
src/
├── db/
│   ├── index.ts          # DB client
│   └── schema.ts         # Drizzle schema
├── modules/
│   ├── authentication/   # Register + login (auth.routes, service, repo, dto)
│   └── oidc/             # Full OIDC flow (routes, controller, service, repo, dto)
├── admin/
│   └── admin.routes.ts   # Client registration endpoints
├── common/
│   ├── config/env.ts     # Zod env validation
│   ├── middleware/        # Error handler
│   └── utils/            # ApiError, ApiResponse, keys
└── index.ts              # Entry point
public/
├── index.html            # Docs (served at /)
├── login.html            # OIDC login page
├── signup.html           # Account creation
├── register-client.html  # Developer client registration
└── error.html            # OIDC error page
```