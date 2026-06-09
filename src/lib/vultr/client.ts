import axios from 'axios'

const VULTR_API = 'https://api.vultr.com/v2'

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
}

export interface VultrInstance {
  id: string
  ip: string
  status: string
  label: string
  plan: string
  region: string
}

export async function createInstance(
  apiKey: string,
  label: string,
  plan: 'vc2-1c-1gb' | 'vc2-1c-2gb' | 'vc2-2c-4gb' = 'vc2-1c-2gb',
  region: string = 'ewr'
): Promise<VultrInstance> {
  const res = await axios.post(
    `${VULTR_API}/instances`,
    {
      region,
      plan,
      os_id: 1743, // Ubuntu 22.04 LTS
      label,
      hostname: label.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      enable_ipv6: false,
      backups: 'disabled',
      user_data: btoa(getDeployScript()),
    },
    { headers: headers(apiKey) }
  )
  const inst = res.data.instance
  return { id: inst.id, ip: inst.main_ip, status: inst.status, label: inst.label, plan: inst.plan, region: inst.region }
}

export async function getInstance(apiKey: string, instanceId: string): Promise<VultrInstance> {
  const res = await axios.get(`${VULTR_API}/instances/${instanceId}`, { headers: headers(apiKey) })
  const inst = res.data.instance
  return { id: inst.id, ip: inst.main_ip, status: inst.status, label: inst.label, plan: inst.plan, region: inst.region }
}

export async function listInstances(apiKey: string): Promise<VultrInstance[]> {
  const res = await axios.get(`${VULTR_API}/instances`, { headers: headers(apiKey) })
  return res.data.instances.map((inst: any) => ({
    id: inst.id, ip: inst.main_ip, status: inst.status, label: inst.label, plan: inst.plan, region: inst.region,
  }))
}

export async function deleteInstance(apiKey: string, instanceId: string): Promise<void> {
  await axios.delete(`${VULTR_API}/instances/${instanceId}`, { headers: headers(apiKey) })
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    await axios.get(`${VULTR_API}/account`, { headers: headers(apiKey) })
    return true
  } catch {
    return false
  }
}

export async function getAccount(apiKey: string): Promise<{ name: string; email: string; balance: number }> {
  const res = await axios.get(`${VULTR_API}/account`, { headers: headers(apiKey) })
  return { name: res.data.account.name, email: res.data.account.email, balance: res.data.account.balance }
}

function getDeployScript(): string {
  return `#!/bin/bash
apt-get update -y
apt-get install -y curl git nginx nodejs npm
npm install -g pm2 n
n stable
echo "ArdouraAI deploy server ready" > /root/ready.txt
`
}

export const VULTR_PLANS = [
  { id: 'vc2-1c-1gb', name: '1 CPU / 1GB RAM', price: '$5/mo', recommended: false },
  { id: 'vc2-1c-2gb', name: '1 CPU / 2GB RAM', price: '$10/mo', recommended: true },
  { id: 'vc2-2c-4gb', name: '2 CPU / 4GB RAM', price: '$20/mo', recommended: false },
]

export const VULTR_REGIONS = [
  { id: 'ewr', name: 'New York (NJ)', flag: '🇺🇸' },
  { id: 'lax', name: 'Los Angeles', flag: '🇺🇸' },
  { id: 'ord', name: 'Chicago', flag: '🇺🇸' },
  { id: 'dfw', name: 'Dallas', flag: '🇺🇸' },
  { id: 'sea', name: 'Seattle', flag: '🇺🇸' },
  { id: 'mia', name: 'Miami', flag: '🇺🇸' },
  { id: 'lhr', name: 'London', flag: '🇬🇧' },
  { id: 'ams', name: 'Amsterdam', flag: '🇳🇱' },
  { id: 'fra', name: 'Frankfurt', flag: '🇩🇪' },
  { id: 'sgp', name: 'Singapore', flag: '🇸🇬' },
  { id: 'syd', name: 'Sydney', flag: '🇦🇺' },
  { id: 'blr', name: 'Bangalore', flag: '🇮🇳' },
]
