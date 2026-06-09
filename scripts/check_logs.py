#!/usr/bin/env python3
import sys, io, paramiko
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "207.246.122.5"
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password="=Gz5v*CrGVGth5Nd", timeout=30)

for label, cmd in [
    ("PM2 status", "pm2 list"),
    ("PM2 logs (last 50)", "pm2 logs ardoura-ai --nostream --lines 50 2>&1 || cat /root/.pm2/logs/ardoura-ai-error.log 2>/dev/null | tail -50"),
    ("Nginx status", "systemctl status nginx --no-pager | tail -5"),
    ("Port 3000", "ss -tlnp | grep 3000 || echo 'port 3000 not listening'"),
]:
    print(f"\n[{label}]")
    _, out, _ = client.exec_command(cmd, timeout=30)
    print(out.read().decode('utf-8', errors='replace').strip()[-2000:])

client.close()
