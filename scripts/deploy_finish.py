"""Finish Phase 1 deploy: prisma db push + build + pm2 restart"""
import paramiko, sys, os

HOST = '207.246.122.5'
USER = 'root'
APP_DIR = '/opt/ardoura-ai'
PASSWORD = os.environ.get('VPS_PASSWORD', '')

def run(client, cmd, timeout=600):
    print(f'\n$ {cmd}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=False)
    stdin.close()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc = stdout.channel.recv_exit_status()
    if out: print(out)
    if err: print('[stderr]', err, file=sys.stderr)
    if rc != 0:
        raise RuntimeError(f'Exit {rc}: {cmd}')
    return out

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=20)
print(f'Connected to {HOST}')

try:
    # Prisma db push (no migrations dir needed, just syncs schema)
    run(client, f'cd {APP_DIR} && npx prisma db push --accept-data-loss 2>&1', timeout=120)
    run(client, f'cd {APP_DIR} && npm run build 2>&1', timeout=600)
    run(client, f'pm2 restart all 2>&1 || pm2 start ecosystem.config.js 2>&1')
    run(client, 'pm2 status')
    print('\nDeploy complete!')
except Exception as e:
    print(f'\nDeploy failed: {e}', file=sys.stderr)
    sys.exit(1)
finally:
    client.close()
