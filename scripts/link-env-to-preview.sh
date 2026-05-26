#!/bin/bash
# Bulk-add every var from .env.prod-snapshot to Vercel's Preview environment.
# Run AFTER `vercel env pull .env.prod-snapshot --environment=production`.
# Delete .env.prod-snapshot when done.

set -e

SNAPSHOT=".env.prod-snapshot"
if [ ! -f "$SNAPSHOT" ]; then
  echo "Missing $SNAPSHOT — run: vercel env pull $SNAPSHOT --environment=production"
  exit 1
fi

while IFS='=' read -r key value; do
  [ -z "$key" ] && continue
  case "$key" in \#*) continue ;; esac
  # Strip surrounding quotes if present
  value="${value%\"}"
  value="${value#\"}"
  echo "→ $key"
  printf '%s' "$value" | vercel env add "$key" preview --force 2>&1 | tail -2
done < "$SNAPSHOT"

echo ""
echo "Done. Now run: rm $SNAPSHOT"
echo "Then redeploy 'launch-preview' branch from Vercel dashboard."
