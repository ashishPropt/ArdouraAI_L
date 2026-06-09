#!/usr/bin/env python3
import sys, io, paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "207.246.122.5"
USER = "root"
PASSWORD = "=Gz5v*CrGVGth5Nd"

ENV_CONTENT = """DATABASE_URL="postgresql://ardoura:ArdouraDB2026@localhost:5432/ardoura"
NEXTAUTH_URL="http://207.246.122.5"
NEXTAUTH_SECRET="Q5hvR5UB84mAFwaL4v0jQUZoeffeyr0MdfcTVUQWHmY="
ANTHROPIC_API_KEY="REPLACE_WITH_YOUR_KEY"
GITHUB_TOKEN="REPLACE_WITH_YOUR_TOKEN"
GITHUB_OWNER="ashishpropt"
VULTR_API_KEY="MPQRAPPUUHQ66VPMWQQ6MMVBTI4BSSXKKU2A"
NEXT_PUBLIC_APP_URL="http://207.246.122.5"
NEXT_PUBLIC_APP_NAME="ArdouraAI"
"""

def run(client, label, cmd, timeout=300):
    print(f"\n[{label}]")
    _, stdout, _ = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    rc = stdout.channel.recv_exit_status()
    print(out[-2000:] if out else '(no output)')
    print(f"  exit={rc}")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
print("Connected to 207.246.122.5")

# Write .env properly
sftp = client.open_sftp()
with sftp.open('/opt/ardoura-ai/.env', 'w') as f:
    f.write(ENV_CONTENT)
sftp.close()
print("\n[.env] Written via SFTP")

steps = [
    ("git pull",        "cd /opt/ardoura-ai && git pull origin main"),
    ("npm install",     "cd /opt/ardoura-ai && npm install 2>&1 | tail -5"),
    ("prisma gen",      "cd /opt/ardoura-ai && npx prisma generate 2>&1 | tail -3"),
    ("prisma push",     "cd /opt/ardoura-ai && npx prisma db push 2>&1 | grep -E '(Done|error|warn|schema)' | head -5"),
    ("next build",      "cd /opt/ardoura-ai && npm run build 2>&1 | tail -15"),
    ("pm2 restart",     "cd /opt/ardoura-ai && pm2 delete ardoura-ai 2>/dev/null || true; pm2 start ecosystem.config.js 2>&1 | tail -5"),
]

for label, cmd in steps:
    run(client, label, cmd)

client.close()
print("\n=== Done ===")
print("Visit: http://207.246.122.5")
