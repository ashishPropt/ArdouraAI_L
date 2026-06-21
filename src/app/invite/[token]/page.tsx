import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'

export default async function InvitePage({ params }: { params: { token: string } }) {
  const session = await auth()

  const invite = await prisma.invitation.findUnique({
    where: { token: params.token },
    include: { org: { select: { name: true } } },
  })

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-xl font-semibold text-white mb-2">Invalid Invitation</p>
          <p className="text-slate-400">This invitation link is invalid or has been revoked.</p>
        </div>
      </div>
    )
  }

  if (invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-xl font-semibold text-white mb-2">Invitation Expired</p>
          <p className="text-slate-400">This invitation has already been used or has expired.</p>
        </div>
      </div>
    )
  }

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/invite/${params.token}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-ardoura-700 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
          {invite.org.name[0].toUpperCase()}
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Join {invite.org.name}</h1>
        <p className="text-slate-400 text-sm mb-6">
          You've been invited to join as <span className="text-white font-medium">{invite.role.toLowerCase()}</span>.
        </p>
        <form action={async () => {
          'use server'
          const res = await fetch(`${process.env.NEXTAUTH_URL}/api/invitations/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: '' },
            body: JSON.stringify({ token: params.token }),
          })
          if (res.ok) {
            const data = await res.json()
            redirect(`/organizations/${data.orgId}`)
          }
        }}>
          <button type="submit" className="w-full bg-ardoura-600 hover:bg-ardoura-500 text-white font-medium py-3 rounded-xl transition-colors">
            Accept Invitation
          </button>
        </form>
        <a href="/dashboard" className="block mt-4 text-sm text-slate-500 hover:text-slate-300">
          Maybe later
        </a>
      </div>
    </div>
  )
}
