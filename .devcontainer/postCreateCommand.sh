#!/bin/bash
# Post create setup for Codespaces
echo '🚀 Setting up Hivemind Predictor...'

# Install pnpm if not present
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
fi

pnpm install

# Setup database if .env doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hivemind"' >> .env
fi

echo '✅ Setup complete!'
echo 'Run these commands:'
echo '  Terminal 1: PORT=8080 pnpm --filter @workspace/api-server run dev'
echo '  Terminal 2: PORT=5173 BASE_PATH=/ pnpm --filter @workspace/hivemind run dev'