import type { Metadata } from "next"
import { Barlow_Condensed, Inter } from "next/font/google"
import "./globals.css"
import { TRPCProvider } from "@/lib/trpc/client"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  weight: ["500", "600", "700", "800"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Atleta",
  description: "Gestión de entrenamientos para entrenadores y atletas",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${barlowCondensed.variable}`}>
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  )
}
