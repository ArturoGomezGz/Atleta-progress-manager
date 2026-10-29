import { existsSync } from "node:fs"
import type { ConfigContext, ExpoConfig } from "expo/config"

// Sobre app.json (que sigue siendo la fuente de la versión y del resto). Con APP_VARIANT=testing
// la app es OTRA instalación: otro identificador, nombre e íconos, así que se puede tener junto
// a la de producción en el mismo teléfono. El esquema "atleta" no cambia: la API lo valida contra
// trustedOrigins y la app no usa enlaces profundos. Los íconos de testing se generan con
// scripts/testing-icons.py.
const testing = process.env.APP_VARIANT === "testing"

// Notificaciones push (FCM): el google-services.json del proyecto de Firebase, con las dos apps
// (com.atleta.app y com.atleta.app.testing) registradas. Va en apps/mobile/google-services.json
// (ignorado por git; en CI lo escribe el workflow desde el secreto GOOGLE_SERVICES_JSON) o en la
// ruta de GOOGLE_SERVICES_JSON. Sin el archivo la app compila igual, pero sin push.
const googleServicesFile = [process.env.GOOGLE_SERVICES_JSON, "./google-services.json"].find(
  (p) => p && existsSync(p),
)

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = googleServicesFile
    ? ({ ...config, android: { ...config.android, googleServicesFile } } as ExpoConfig)
    : (config as ExpoConfig)
  if (!testing) return base
  return {
    ...base,
    name: "Atleta Test",
    icon: "./assets/testing/icon.png",
    android: {
      ...base.android,
      package: "com.atleta.app.testing",
      adaptiveIcon: {
        ...base.android?.adaptiveIcon,
        foregroundImage: "./assets/testing/android-icon-foreground.png",
        monochromeImage: "./assets/testing/android-icon-monochrome.png",
      },
    },
  } as ExpoConfig
}
