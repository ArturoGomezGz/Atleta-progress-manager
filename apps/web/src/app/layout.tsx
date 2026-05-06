import type { Metadata } from "next"
import { Inter, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { TRPCProvider } from "@/lib/trpc/client"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Atleta",
  description: "Gestión de entrenamientos para entrenadores y atletas",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  )
}
