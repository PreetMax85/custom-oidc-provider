# YourApp Auth — OAuth 2.0 + OIDC Provider

A self-hosted OAuth 2.0 + OpenID Connect provider built with Express, TypeScript, Drizzle ORM, and PostgreSQL. Use it as the auth system across all your projects.

## Features
- Authorization Code Flow with PKCE
- OpenID Connect discovery + JWKS
- SSO across multiple client apps
- Admin panel for registering OAuth clients
- Bcrypt password hashing
- RSA256-signed JWTs via jose

## Quick Start

### 1. Clone & Install
git clone ...
npm install

### 2. Generate RSA Keys
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
node export-keys.mjs
# Copy values from .env.keys into your .env

### 3. Configure .env
cp .env.example .env
# Fill in DATABASE_URL, ADMIN_PASSWORD, ADMIN_JWT_SECRET
# Paste keys from step 2

### 4. Run Migrations
npm run db:generate
npm run db:migrate

### 5. Start
npm run dev

## Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/openid-configuration` | GET | OIDC discovery |
| `/.well-known/jwks.json` | GET | Public key set |
| `/authorize` | GET | Start auth flow |
| `/authorize/callback` | POST | Handle login |
| `/token` | POST | Exchange code for tokens |
| `/userinfo` | GET | Get user profile |
| `/api/auth/register` | POST | Create user account |
| `/api/admin/verify` | POST | Admin password check |
| `/api/admin/clients` | POST | Register OAuth client |

## Using in Your Projects
1. Register your app at /register-client.html
2. Save the client_id and client_secret
3. Redirect users to /authorize with your client_id
4. Exchange the code at /token
5. Read the id_token or call /userinfo

## Deploy to Render
- Build command: npm install && npm run build
- Start command: npm start
- Set all env vars from .env.example
- Set ISSUER to your Render URL
