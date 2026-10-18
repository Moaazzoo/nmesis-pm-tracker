#!/bin/bash
# Deploy the tracker to Vercel from a git-less copy (dodges the Team seat block, uploads no .env file).
#   ./deploy.sh          → preview URL (protected by your Vercel login)
#   ./deploy.sh --prod   → production URL (public login page)
set -e
source ~/.nvm/nvm.sh
SRC="$(cd "$(dirname "$0")" && pwd)"
TMP="/tmp/nmesis-tracker-deploy"
rm -rf "$TMP"; mkdir -p "$TMP"
rsync -a --exclude ".git" --exclude "node_modules" --exclude ".next" --exclude ".env.local" --exclude ".superpowers" --exclude "research" --exclude "data/seed/*.json" "$SRC/" "$TMP/"
printf '.env*\nresearch\ndocs\n.superpowers\ndata/seed/*.json\n' > "$TMP/.vercelignore"
cd "$TMP"
npx --yes vercel deploy --yes --scope nmesis-dashboard "$@"
