import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { DashboardNav } from '@/components/layout/DashboardNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <DashboardNav user={session.user} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
