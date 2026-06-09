#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deploy ArdouraAI to the bizpioneers Vultr VPS."""

import sys
import io
import paramiko

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "207.246.122.5"
USER = "root"
PASSWORD = "=Gz5v*CrGVGth5Nd"
APP_DIR = "/opt/ardoura-ai"
REPO = "https://github.com/ashishPropt/ArdouraAI_L.git"
NEXTAUTH_SECRET = "Q5hvR5UB84mAFwaL4v0jQUZoeffeyr0MdfcTVUQWHmY="

ENV_LINES = [
    f'DATABASE_URL="postgresql://ardoura:ArdouraDB2026@localhost:5432/ardoura"',
    f'NEXTAUTH_URL="http://{HOST}"',
    f'NEXTAUTH_SECRET="{NEXTAUTH_SECRET}"',
    f'ANTHROPIC_API_KEY="REPLACE_WITH_YOUR_KEY"',
    f'GITHUB_TOKEN="REPLACE_WITH_YOUR_TOKEN"',
    f'GITHUB_OWNER="ashishpropt"',
    f'VULTR_API_KEY="MPQRAPPUUHQ66VPMWQQ6MMVBTI4BSSXKKU2A"',
    f'NEXT_PUBLIC_APP_URL="http://{HOST}"',
    f'NEXT_PUBLIC_APP_NAME="ArdouraAI"',
]

NGINX_CONF = """server {
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
}"""


def run(client, cmd, timeout=300, ignore_errors=False):
    print(f"\n>>> {cmd[:100]}{'...' if len(cmd) > 100 else ''}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    rc = stdout.channel.recv_exit_status()
    if out:
        print(out[-1500:])
    if err and rc != 0 and not ignore_errors:
        print(f"STDERR: {err[-500:]}")
    print(f"  exit={rc}")
    return rc


def main():
    print(f"Connecting to {HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected!")

    steps = [
        ("PM2 install",          "npm install -g pm2 --quiet"),
        ("PG user",              "sudo -u postgres psql -c \"CREATE USER ardoura WITH PASSWORD 'ArdouraDB2026' CREATEDB;\""),
        ("PG database",          "sudo -u postgres psql -c \"CREATE DATABASE ardoura OWNER ardoura;\""),
        ("Clone repo",           f"rm -rf {APP_DIR} && git clone {REPO} {APP_DIR}"),
        ("npm install",          f"cd {APP_DIR} && npm install 2>&1 | tail -5"),
        ("Write .env",           f"printf '%s\\n' {chr(39)} {chr(10).join(ENV_LINES)} {chr(39)} > {APP_DIR}/.env"),
        ("Prisma generate",      f"cd {APP_DIR} && npx prisma generate 2>&1 | tail -5"),
        ("Prisma db push",       f"cd {APP_DIR} && npx prisma db push 2>&1 | tail -10"),
        ("Next build",           f"cd {APP_DIR} && npm run build 2>&1 | tail -20"),
        ("PM2 start",            f"cd {APP_DIR} && pm2 delete ardoura-ai 2>/dev/null; pm2 start ecosystem.config.js"),
        ("PM2 save",             "pm2 save"),
        ("Write nginx conf",     f"cat > /etc/nginx/sites-available/ardoura-ai << 'NGEOF'\n{NGINX_CONF}\nNGEOF"),
        ("Nginx enable",         "ln -sf /etc/nginx/sites-available/ardoura-ai /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default"),
        ("Nginx reload",         "nginx -t && systemctl restart nginx"),
    ]

    for name, cmd in steps:
        print(f"\n[{name}]")
        run(client, cmd, ignore_errors=True)

    client.close()
    print(f"\n{'='*50}")
    print(f"ArdouraAI deployed at: http://{HOST}")
    print()
    print("IMPORTANT: Set these in /opt/ardoura-ai/.env then restart:")
    print("  ANTHROPIC_API_KEY=sk-ant-...")
    print("  GITHUB_TOKEN=ghp_...")
    print("  pm2 restart ardoura-ai --update-env")


if __name__ == "__main__":
    main()
