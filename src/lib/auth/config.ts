import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('[auth] authorize called with:', credentials?.email)

        if (!credentials?.email || !credentials?.password) {
          console.log('[auth] missing email or password')
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          })

          console.log('[auth] user found:', !!user)

          if (!user?.password) {
            console.log('[auth] no user or password')
            return null
          }

          const valid = await bcrypt.compare(credentials.password as string, user.password)
          console.log('[auth] password valid:', valid)

          if (!valid) return null

          console.log('[auth] returning user:', user.id)
          return { id: user.id, email: user.email, name: user.name, image: user.image }
        } catch (err) {
          console.error('[auth] error:', err)
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (token?.id) (session.user as any).id = token.id
      return session
    },
  },
}
