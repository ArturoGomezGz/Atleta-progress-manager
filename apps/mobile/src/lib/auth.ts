import { expoClient } from "@better-auth/expo/client"
import { createAuthClient } from "better-auth/react"
import Constants from "expo-constants"
import * as SecureStore from "expo-secure-store"
import { API_URL } from "./config"

// Esquema de enlaces profundos de esta variante (app.config.ts): "atleta" o "atleta-testing"
const rawScheme = Constants.expoConfig?.scheme
const scheme = (Array.isArray(rawScheme) ? rawScheme[0] : rawScheme) ?? "atleta"

// La sesión (cookie de better-auth) se guarda cifrada en el Keystore de Android.
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme,
      storagePrefix: "atleta",
      storage: SecureStore,
    }),
  ],
})

export const { signIn, signOut, useSession } = authClient
