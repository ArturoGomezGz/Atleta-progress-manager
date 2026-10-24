import type { NextConfig } from "next"

const config: NextConfig = {
  transpilePackages: ["@atleta/api", "@atleta/db"],
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/auth/:path*`,
      },
      {
        source: "/api/telegram/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/telegram/:path*`,
      },
      // Discovery OAuth del conector MCP: el issuer es <web>/api/auth, así que los clientes
      // piden <web>/.well-known/oauth-authorization-server/api/auth (la sirve la API)
      {
        source: "/.well-known/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/.well-known/:path*`,
      },
      {
        source: "/trpc/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/trpc/:path*`,
      },
    ]
  },
}

export default config
