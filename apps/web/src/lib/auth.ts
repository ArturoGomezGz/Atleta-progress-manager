import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  // No baseURL: uses same origin, /api/auth/* is proxied to the API via Next.js rewrites
  // oauthProviderClient: en el login, el registro y el consentimiento de un flujo OAuth
  // (conector MCP) agrega a las peticiones la query firmada de la página (`oauth_query`) y el
  // servidor responde con la siguiente URL del flujo, a la que el cliente navega solo.
  plugins: [oauthProviderClient()],
})

export const { signIn, signOut, signUp, useSession } = authClient
