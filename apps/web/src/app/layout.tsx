import { ThemeProvider } from "@/lib/theme-provider"
import { TRPCProvider } from "@/lib/trpc/client"
import type { Metadata } from "next"
import { Barlow_Condensed, Inter } from "next/font/google"
import "./globals.css"

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
    <html lang="es" className={`${inter.variable} ${barlowCondensed.variable}`} suppressHydrationWarning>
      <head>
        {/* Inline script: applies theme class before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=s==='system'||!s;var dark=d?window.matchMedia('(prefers-color-scheme: dark)').matches:s==='dark';document.documentElement.classList.add(dark?'dark':'light')}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <TRPCProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </TRPCProvider>
      </body>
    </html>
  )
}
