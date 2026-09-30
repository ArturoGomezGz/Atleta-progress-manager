import { Button } from "@/components/button"
import { signIn } from "@/lib/auth"
import { colors, radius } from "@/lib/theme"
import { useState } from "react"
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

// Códigos de error de better-auth → mensaje para el atleta
const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  EMAIL_NOT_VERIFIED: "Verifica tu correo antes de entrar. Revisa tu bandeja de entrada.",
}

export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="height" style={styles.container}>
        <Text style={styles.title}>Atleta</Text>
        <Text style={styles.subtitle}>Entra para ver tus rutinas pendientes.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Correo"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={colors.mutedForeground}
            autoComplete="password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Entrar" onPress={submit} loading={loading} disabled={!email || !password} />
        </View>

        <Text style={styles.hint}>¿No tienes cuenta? Créala en la web de Atleta.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 8 },
  title: { color: colors.foreground, fontSize: 32, fontWeight: "700" },
  subtitle: { color: colors.mutedForeground, fontSize: 16, marginBottom: 24 },
  form: { gap: 12 },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    color: colors.foreground,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  error: { color: colors.destructive, fontSize: 14 },
  hint: { color: colors.mutedForeground, fontSize: 14, textAlign: "center", marginTop: 24 },
})
