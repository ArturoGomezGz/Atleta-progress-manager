import type { NextConfig } from "next"

const config: NextConfig = {
  transpilePackages: ["@atleta/api", "@atleta/db"],
}

export default config
