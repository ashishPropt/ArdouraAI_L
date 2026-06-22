import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const publicPaths = ['/', '/login', '/register']
  const isPublic =
    publicPaths.includes(pathname) ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/status/')

  if (!isPublic && !req.auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
}
