import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  // No baseURL: uses same origin, /api/auth/* is proxied to the API via Next.js rewrites
})

export const { signIn, signOut, signUp, useSession } = authClient
