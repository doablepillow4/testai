#!/bin/bash
echo '🚀 Setting up Hivemind Predictor for Codespaces...'

pnpm install

# Create .env for Codespaces Postgres
cat > .env << 'EOL'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hivemind"
EOL

echo '🔄 Pushing database schema...'
pnpm --filter @workspace/db run push

echo '✅ Setup done! You can now run: pnpm dev:codespaces'
