#!/usr/bin/env bash
# One-time local setup for ai-apply (macOS + Homebrew).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Checking Node.js..."
node -v
npm -v

echo "==> Installing npm dependencies..."
npm install
npm install --prefix client

echo "==> Ensuring .env files exist..."
[[ -f .env ]] || cp .env.example .env
[[ -f client/.env ]] || cp client/.env.example client/.env

if ! grep -q '^ENCRYPTION_KEY=.\+' .env 2>/dev/null; then
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if grep -q '^ENCRYPTION_KEY=' .env; then
    sed -i '' "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$KEY/" .env
  else
    echo "ENCRYPTION_KEY=$KEY" >> .env
  fi
  echo "    Generated ENCRYPTION_KEY"
fi

if ! grep -q '^INTERNAL_API_KEY=.\+' .env 2>/dev/null; then
  IKEY="dev-local-$(openssl rand -hex 16)"
  if grep -q '^INTERNAL_API_KEY=' .env; then
    sed -i '' "s/^INTERNAL_API_KEY=.*/INTERNAL_API_KEY=$IKEY/" .env
  else
    echo "INTERNAL_API_KEY=$IKEY" >> .env
  fi
  echo "    Generated INTERNAL_API_KEY"
fi

echo "==> Starting Redis + PostgreSQL (Homebrew)..."
if command -v brew >/dev/null; then
  brew list redis >/dev/null 2>&1 || brew install redis
  brew list postgresql@16 >/dev/null 2>&1 || brew install postgresql@16
  brew services start redis
  brew services start postgresql@16
  export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
  sleep 2
  createdb ai_apply 2>/dev/null || true
  psql -d postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'user') THEN CREATE ROLE \"user\" WITH LOGIN PASSWORD 'pass'; END IF; END \$\$;" 2>/dev/null || true
  psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ai_apply TO \"user\";" 2>/dev/null || true
fi

echo "==> Running migrations..."
npm run migrate

echo "==> Building UI..."
npm run build:ui

echo ""
echo "Setup complete. Before starting:"
echo "  1. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env"
echo "  2. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in client/.env"
echo "  3. Optional: OPENAI_API_KEY in .env"
echo ""
echo "Start the dev server:"
echo "  npm run dev"
echo ""
echo "Open http://localhost:5000"
