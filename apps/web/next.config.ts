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
        source: "/trpc/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/trpc/:path*`,
      },
    ]
  },
}

export default config
