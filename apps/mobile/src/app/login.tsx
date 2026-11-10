import { Button } from "@/components/button"
import { authClient, signIn } from "@/lib/auth"
import { Text } from "@/components/text"
import { colors, fonts, radius } from "@/lib/theme"
import { useState } from "react"
import { KeyboardAvoidingView, StyleSheet, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

// Códigos de error de better-auth → mensaje para el atleta
const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  EMAIL_NOT_VERIFIED: "Verifica tu correo antes de entrar. Revisa tu bandeja de entrada.",
}

// Icono de Google (mismo trazado que GoogleIcon de la web)
function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  )
}

export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      const { error } = await signIn.email({ email: email.trim(), password })
      if (error) setError((error.code && ERRORS[error.code]) ?? "No pudimos iniciar sesión. Intenta de nuevo.")
      // Con éxito, useSession cambia y el layout muestra la app.
    } catch {
      setError("Sin conexión con el servidor. Revisa tu internet.")
    } finally {
      setLoading(false)
    }
  }

  // Abre Google en el navegador del sistema; al volver, el cliente guarda la sesión y useSession
  // cambia. Si el usuario cierra el navegador no hay error ni sesión: se avisa que no se completó.
  async function signInWithGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      // "/" se convierte en el deep link atleta:/// (esquema de la app, en trustedOrigins de la API)
      const { error } = await signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/login" })
      if (error) {
        setError("No pudimos iniciar sesión con Google. Intenta de nuevo.")
        return
      }
      const { data } = await authClient.getSession()
      if (!data) setError("No se completó el inicio de sesión con Google.")
    } catch {
      setError("Sin conexión con el servidor. Revisa tu internet.")
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="height" style={styles.container}>
        <Text heading size={44}>Atleta</Text>
        <Text color={colors.mutedForeground} style={{ marginBottom: 24 }}>Entra para ver tus rutinas pendientes.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Correo"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
          {error && <Text size={14} color={colors.destructive}>{error}</Text>}
          <Button label="Entrar" onPress={submit} loading={loading} disabled={!email || !password || googleLoading} />
        </View>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text size={13} color={colors.mutedForeground}>o</Text>
          <View style={styles.line} />
        </View>
        <Button
          label="Continuar con Google"
          variant="outline"
          onPress={signInWithGoogle}
          loading={googleLoading}
          disabled={loading}
          leading={<GoogleIcon />}
        />

        <Text size={14} color={colors.mutedForeground} center style={{ marginTop: 24 }}>¿No tienes cuenta? Continúa con Google o créala en la web de Atleta.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 8 },
  form: { gap: 12 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 8 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    color: colors.foreground,
    fontSize: 16,
    fontFamily: fonts.regular,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
})
