import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'

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

    // Create a simple JWT-like token manually
    const tokenData = Buffer.from(JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
    })).toString('base64')

    const response = NextResponse.json({ success: true, user: { id: user.id, email, name: user.name } })

    // Set the session cookie - same name NextAuth uses
    response.cookies.set('authjs.session-token', tokenData, {
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
