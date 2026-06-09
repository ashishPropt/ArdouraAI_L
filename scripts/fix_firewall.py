#!/usr/bin/env python3
import sys, io, paramiko
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "207.246.122.5"
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password="=Gz5v*CrGVGth5Nd", timeout=30)

checks = [
    ("curl localhost:3000", "curl -s --max-time 5 http://localhost:3000 | head -c 200"),
    ("ufw status", "ufw status"),
    ("iptables check", "iptables -L INPUT -n | head -10"),
    ("open port 80", "ufw allow 80/tcp 2>/dev/null; ufw allow 443/tcp 2>/dev/null; ufw reload 2>/dev/null || true"),
    ("curl after", "curl -s --max-time 5 http://localhost:3000/ | head -c 300"),
    ("pm2 show", "pm2 show ardoura-ai 2>&1 | grep -E '(status|port|pid|restart)'"),
]

for label, cmd in checks:
    print(f"\n[{label}]")
    _, out, err = client.exec_command(cmd, timeout=30)
    result = out.read().decode('utf-8', errors='replace').strip()
    errs = err.read().decode('utf-8', errors='replace').strip()
    print(result or errs or '(empty)')

client.close()
