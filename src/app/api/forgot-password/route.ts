import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    console.log('[forgot-password] request for:', email)

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Always return success (don't reveal if user exists)
    if (!user) {
      console.log('[forgot-password] user not found:', email)
      return NextResponse.json({ success: true, message: 'If email exists, reset link sent' })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Store reset token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpiry: resetTokenExpiry,
      },
    })

    // In production, send email with reset link
    // For now, just log it
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`
    console.log('[forgot-password] reset link:', resetUrl)

    return NextResponse.json({ success: true, message: 'If email exists, reset link sent' })
  } catch (err: any) {
    console.error('[forgot-password] error:', err.message)
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
