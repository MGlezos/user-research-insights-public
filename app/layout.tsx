import type React from "react"
import type { Metadata } from "next"
import { Cabin, Oswald } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const cabin = Cabin({ subsets: ["latin"], variable: "--font-cabin" })
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" })

export const metadata: Metadata = {
  title: "Supersoniq Insights",
  description: "Audio transcription and insights powered by Assembly AI",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${cabin.variable} ${oswald.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
