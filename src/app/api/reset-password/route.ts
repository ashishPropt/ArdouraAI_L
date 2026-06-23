import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()
    console.log('[reset-password] attempt')

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      console.log('[reset-password] invalid or expired token')
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 401 })
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    })

    console.log('[reset-password] success for user:', user.id)
    return NextResponse.json({ success: true, message: 'Password reset successful' })
  } catch (err: any) {
    console.error('[reset-password] error:', err.message)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}
