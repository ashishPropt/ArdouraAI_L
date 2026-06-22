"""Full Phase 1 deploy: pull + prisma + build + restart"""
import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import paramiko

HOST = '207.246.122.5'
USER = 'root'
APP_DIR = '/opt/ardoura-ai'
PASSWORD = os.environ.get('VPS_PASSWORD', '')

def run(client, cmd, timeout=600):
    print(f'\n$ {cmd}', flush=True)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc = stdout.channel.recv_exit_status()
    if out.strip(): print(out, flush=True)
    if err.strip(): print('[stderr]', err, flush=True)
    if rc != 0:
        raise RuntimeError(f'Exit {rc}: {cmd}')
    return out

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=20)
print('Connected to', HOST, flush=True)

try:
    run(client, f'cd {APP_DIR} && git checkout -- . 2>&1')
    run(client, f'cd {APP_DIR} && git pull origin main 2>&1')
    # Force-install Phase 1 packages first so they land in the lock file
    run(client, f'cd {APP_DIR} && npm install kafkajs pg mysql2 mongodb @types/pg --legacy-peer-deps 2>&1', timeout=180)
    run(client, f'cd {APP_DIR} && npm install --legacy-peer-deps 2>&1', timeout=120)
    run(client, f'cd {APP_DIR} && npx prisma db push --accept-data-loss 2>&1', timeout=120)
    run(client, f'rm -rf {APP_DIR}/.next 2>&1')
    run(client, f'cd {APP_DIR} && npm run build 2>&1', timeout=600)
    run(client, f'pm2 restart all 2>&1 || pm2 start {APP_DIR}/ecosystem.config.js 2>&1')
    run(client, 'pm2 status')
    print('\nPhase 1 deploy complete! Site: http://207.246.122.5', flush=True)
except Exception as e:
    print(f'\nDeploy failed: {e}', flush=True)
    sys.exit(1)
finally:
    client.close()
