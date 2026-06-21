#!/usr/bin/env python3
import sys, io, paramiko
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = "207.246.122.5"
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password="=Gz5v*CrGVGth5Nd", timeout=30)

for label, cmd in [
    ("PM2 error log", "pm2 logs ardoura-ai --nostream --lines 80 --err 2>&1"),
    ("PM2 out log", "pm2 logs ardoura-ai --nostream --lines 30 --out 2>&1"),
]:
    print(f"\n[{label}]")
    _, out, _ = client.exec_command(cmd, timeout=30)
    print(out.read().decode('utf-8', errors='replace').strip()[-3000:])

client.close()
