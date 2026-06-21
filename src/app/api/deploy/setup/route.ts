import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

// SSE stream that polls Vultr until instance is active, then generates a
// startup script the user can run (or we can queue via HealAction).
// Full SSH automation requires a server-side SSH key; we do the safe
// version: generate + display the bootstrap script.

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { projectId } = await req.json()
  if (!projectId) return new Response(JSON.stringify({ error: 'projectId required' }), { status: 400 })

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })
  if (!project.vultrIp) return new Response(JSON.stringify({ error: 'No VPS assigned to this project' }), { status: 400 })

  const repoUrl = project.githubRepo
  if (!repoUrl) return new Response(JSON.stringify({ error: 'Push to GitHub first before setting up VPS' }), { status: 400 })

  const script = generateSetupScript(repoUrl, project.name)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      send({ type: 'log', message: `VPS IP: ${project.vultrIp}` })
      send({ type: 'log', message: `GitHub repo: ${repoUrl}` })
      send({ type: 'log', message: 'Generating bootstrap script...' })
      send({ type: 'script', content: script })
      send({
        type: 'instructions',
        steps: [
          `SSH into your server: ssh root@${project.vultrIp}`,
          'Paste and run the bootstrap script below',
          'Your app will be live in ~2 minutes at http://' + project.vultrIp,
        ],
      })
      send({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

function generateSetupScript(repoUrl: string, projectName: string): string {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return `#!/bin/bash
set -e

echo "=== ArdouraAI Bootstrap: ${projectName} ==="

# Install Node.js 20 if not present
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Install PM2 globally
npm install -g pm2 2>/dev/null || true

# Install Nginx
apt-get install -y nginx 2>/dev/null || true

# Clone repo
APP_DIR="/opt/${safeName}"
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git pull origin main
else
  git clone ${repoUrl} "$APP_DIR"
  cd "$APP_DIR"
fi

# Install dependencies
npm install --legacy-peer-deps

# Build (Next.js or Vite)
if [ -f "next.config.js" ] || [ -f "next.config.ts" ]; then
  npm run build
  pm2 start npm --name "${safeName}" -- start
elif [ -f "vite.config.ts" ] || [ -f "vite.config.js" ]; then
  npm run build
  pm2 serve dist 3000 --name "${safeName}" --spa
else
  pm2 start src/index.ts --name "${safeName}" --interpreter=node_modules/.bin/tsx 2>/dev/null || \\
  pm2 start dist/index.js --name "${safeName}"
fi

# Configure Nginx reverse proxy
cat > /etc/nginx/sites-available/${safeName} <<'NGINX'
server {
    listen 80;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/${safeName} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo "=== Done! App is live at http://\\$(curl -s ifconfig.me) ==="
`
}
