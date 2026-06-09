#!/bin/bash
# Pull latest and redeploy — run from the server
set -e
cd /opt/ardoura-ai
git pull origin main
npm install --production=false
npx prisma generate
npx prisma db push
npm run build
pm2 reload ardoura-ai --update-env
echo "Update complete."
