import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { DashboardNav } from '@/components/layout/DashboardNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authConfig)
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <DashboardNav user={session.user} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
