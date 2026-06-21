"""Finish Phase 1 deploy — stdout forced to UTF-8"""
import sys, os, io
# Force UTF-8 on Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import paramiko

HOST = '207.246.122.5'
USER = 'root'
APP_DIR = '/opt/ardoura-ai'
PASSWORD = os.environ.get('VPS_PASSWORD', '')

def run(client, cmd, timeout=600):
    print(f'\n$ {cmd}', flush=True)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    stdin.close()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc = stdout.channel.recv_exit_status()
    if out: print(out, flush=True)
    if err: print('[stderr]', err, flush=True)
    if rc != 0:
        raise RuntimeError(f'Exit {rc}: {cmd}')
    return out

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=20)
print('Connected to', HOST, flush=True)

try:
    run(client, f'cd {APP_DIR} && npx prisma db push --accept-data-loss 2>&1', timeout=120)
    run(client, f'cd {APP_DIR} && npm run build 2>&1', timeout=600)
    run(client, 'pm2 restart all 2>&1 || pm2 start ecosystem.config.js 2>&1')
    run(client, 'pm2 status')
    print('Deploy complete!', flush=True)
except Exception as e:
    print(f'Deploy failed: {e}', flush=True)
    sys.exit(1)
finally:
    client.close()
