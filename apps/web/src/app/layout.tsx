import type { Metadata } from "next"
import "./globals.css"
import { TRPCProvider } from "@/lib/trpc/client"

export const metadata: Metadata = {
  title: "Atleta",
  description: "Athlete progress tracking",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  )
}
