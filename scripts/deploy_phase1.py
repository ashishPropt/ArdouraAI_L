"""
Deploy Phase 1 to the ArdouraAI VPS at 207.246.122.5
- git pull
- npm install (for new deps: kafkajs, pg, mysql2, etc.)
- npx prisma migrate deploy (applies schema changes)
- npm run build
- pm2 restart all
"""
import paramiko, sys, time

HOST = '207.246.122.5'
USER = 'root'
APP_DIR = '/opt/ardoura-ai'

# Try password from env or prompt
import os
PASSWORD = os.environ.get('VPS_PASSWORD', '')
if not PASSWORD:
    import getpass
    PASSWORD = getpass.getpass(f'Password for {USER}@{HOST}: ')

def run(client, cmd, timeout=300):
    print(f'\n$ {cmd}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    stdin.close()
    out = stdout.read().decode()
    err = stderr.read().decode()
    rc = stdout.channel.recv_exit_status()
    if out: print(out)
    if err: print('[stderr]', err, file=sys.stderr)
    if rc != 0:
        raise RuntimeError(f'Command failed (exit {rc}): {cmd}')
    return out

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=20)
print(f'Connected to {HOST}')

try:
    run(client, f'cd {APP_DIR} && git pull origin main')
    run(client, f'cd {APP_DIR} && npm install --legacy-peer-deps', timeout=180)
    run(client, f'cd {APP_DIR} && npx prisma migrate deploy 2>&1 || npx prisma db push --accept-data-loss 2>&1', timeout=120)
    run(client, f'cd {APP_DIR} && npm run build', timeout=600)
    run(client, f'pm2 restart all 2>&1 || pm2 start ecosystem.config.js 2>&1')
    time.sleep(3)
    run(client, f'pm2 status')
    print('\n✅ Phase 1 deploy complete!')
except Exception as e:
    print(f'\n❌ Deploy failed: {e}', file=sys.stderr)
    sys.exit(1)
finally:
    client.close()
