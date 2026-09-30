import { expoClient } from "@better-auth/expo/client"
import { createAuthClient } from "better-auth/react"
import * as SecureStore from "expo-secure-store"
import { API_URL } from "./config"

// La sesión (cookie de better-auth) se guarda cifrada en el Keystore de Android.
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "atleta",
      storagePrefix: "atleta",
      storage: SecureStore,
    }),
  ],
})

export const { signIn, signOut, useSession } = authClient
