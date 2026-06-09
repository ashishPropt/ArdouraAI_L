import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ArdouraAI — Build Apps with AI',
  description: 'Turn your business ideas into production-ready applications using AI. Chat, generate, deploy.',
  openGraph: {
    title: 'ArdouraAI',
    description: 'Build full-stack apps from your business ideas using AI',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
