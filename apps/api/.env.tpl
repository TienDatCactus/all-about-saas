# 1Password template for apps/api. COMMITTED to git — contains NO real secrets.
#
# `op://Vault/Item/field` are references. Run `npm run env:pull` from the repo
# root and `op inject` replaces them with the real values, writing the result
# to .env.development.local (which stays gitignored).
#
# Non-secret config is written inline. Only true secrets are op:// references.

# --- Database (must match docker-compose.yml) ---
DATABASE_USER=aas
DATABASE_PASSWORD=op://AAS/api/DATABASE_PASSWORD
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=aas
PORT=8000

# --- Auth / JWT ---
JWT_SECRET=op://AAS/api/JWT_SECRET
JWT_EXPIRES_IN=15m
REFRESH_EXPIRES_IN=7d
BASE_PASSWORD=op://AAS/api/BASE_PASSWORD
FRONTEND_URL=http://localhost:3000

# --- Google OAuth ---
GOOGLE_CLIENT_ID=op://AAS/google-oauth/CLIENT_ID
GOOGLE_CLIENT_SECRET=op://AAS/google-oauth/CLIENT_SECRET
GOOGLE_CALLBACK_URL=http://localhost:8000/auth/google/callback

# --- GitHub OAuth ---
GITHUB_CLIENT_ID=op://AAS/github-oauth/CLIENT_ID
GITHUB_CLIENT_SECRET=op://AAS/github-oauth/CLIENT_SECRET
GITHUB_CALLBACK_URL=http://localhost:8000/auth/github/callback

# --- Facebook OAuth ---
FACEBOOK_CLIENT_ID=op://AAS/facebook-oauth/CLIENT_ID
FACEBOOK_CLIENT_SECRET=op://AAS/facebook-oauth/CLIENT_SECRET
FACEBOOK_CALLBACK_URL=http://localhost:8000/auth/facebook/callback

# --- Email (points at the Mailpit container from docker-compose.yml) ---
EMAIL_HOST=localhost
EMAIL_PORT=1025
EMAIL_SECURE=false
EMAIL_USER=op://AAS/email/USER
EMAIL_PASS=op://AAS/email/PASS
