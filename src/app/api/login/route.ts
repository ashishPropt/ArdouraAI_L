import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { EncryptJWT } from 'jose'

// Use the first 32 bytes of NEXTAUTH_SECRET for A128CBC-HS256 (256-bit key requirement)
const secretStr = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-minimum-32-chars-long!'
const secretBytes = new TextEncoder().encode(secretStr)
const secret = secretBytes.slice(0, 32)

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    console.log('[login] attempt:', email)

    if (!email || !password) {
      console.log('[login] missing email or password')
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    console.log('[login] user found:', !!user, 'has password:', !!user?.password)

    if (!user?.password) {
      console.log('[login] user not found or no password')
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    console.log('[login] password valid:', valid)

    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Create encrypted JWT using NextAuth's EncryptJWT (compatible with NextAuth's decryption)
    const now = Math.floor(Date.now() / 1000)
    const token = await new EncryptJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + 30 * 24 * 60 * 60)
      .encrypt(secret)

    const response = NextResponse.json({ success: true, user: { id: user.id, email, name: user.name } })

    // Set the session cookie - same name and format NextAuth uses
    response.cookies.set('authjs.session-token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    console.log('[login] success:', user.id)
    return response
  } catch (err: any) {
    console.error('[login] error:', err.message)
    return NextResponse.json({ error: 'Login failed: ' + err.message }, { status: 500 })
  }
}
