#!/bin/bash
# ArdouraAI VPS deploy script
# Usage: bash deploy.sh

set -e

APP_DIR="/opt/ardoura-ai"
REPO="https://github.com/ashishpropt/ArdouraAI_L.git"
NODE_VERSION="20"

echo "=== ArdouraAI Deploy ==="

# Install system deps
apt-get update -y
apt-get install -y curl git nginx postgresql postgresql-contrib

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
npm install -g pm2

# Clone or pull repo
if [ -d "$APP_DIR/.git" ]; then
  echo "Pulling latest..."
  cd $APP_DIR && git pull origin main
else
  echo "Cloning repo..."
  git clone $REPO $APP_DIR
fi

cd $APP_DIR

# Install deps
npm install --production=false

# Setup PostgreSQL
sudo -u postgres psql -c "CREATE USER ardoura WITH PASSWORD 'ArdouraDB2026' CREATEDB;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ardoura OWNER ardoura;" 2>/dev/null || true

# Write .env if it doesn't exist
if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
DATABASE_URL="postgresql://ardoura:ArdouraDB2026@localhost:5432/ardoura"
NEXTAUTH_URL="http://SERVER_IP"
NEXTAUTH_SECRET="REPLACE_WITH_RANDOM_SECRET"
ANTHROPIC_API_KEY="REPLACE_WITH_KEY"
GITHUB_TOKEN="REPLACE_WITH_TOKEN"
GITHUB_OWNER="ashishpropt"
VULTR_API_KEY="MPQRAPPUUHQ66VPMWQQ6MMVBTI4BSSXKKU2A"
NEXT_PUBLIC_APP_URL="http://SERVER_IP"
ENVEOF
  # Replace SERVER_IP with actual IP
  SERVER_IP=$(curl -s ifconfig.me)
  sed -i "s/SERVER_IP/$SERVER_IP/g" .env
  echo ">>> .env created. Fill in NEXTAUTH_SECRET and ANTHROPIC_API_KEY before running app!"
fi

# Run migrations
npx prisma generate
npx prisma db push

# Build
npm run build

# Start with PM2
pm2 delete ardoura-ai 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure nginx
cat > /etc/nginx/sites-available/ardoura-ai << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/ardoura-ai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

SERVER_IP=$(curl -s ifconfig.me)
echo ""
echo "=== Deploy complete! ==="
echo "ArdouraAI running at: http://$SERVER_IP"
echo ""
echo "IMPORTANT: Edit /opt/ardoura-ai/.env and set:"
echo "  NEXTAUTH_SECRET (run: openssl rand -base64 32)"
echo "  ANTHROPIC_API_KEY"
echo "  GITHUB_TOKEN"
echo "Then: pm2 restart ardoura-ai --update-env"
