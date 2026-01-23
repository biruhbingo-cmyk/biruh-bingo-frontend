import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trial Bingo - Telegram Game',
  description: 'Play bingo and win exciting prizes!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

