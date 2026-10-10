import type { ConfigContext, ExpoConfig } from "expo/config"

// Sobre app.json (que sigue siendo la fuente de la versión y del resto). Con APP_VARIANT=testing
// la app es OTRA instalación: otro identificador, nombre e íconos, así que se puede tener junto
// a la de producción en el mismo teléfono. El esquema "atleta" no cambia: la API lo valida contra
// trustedOrigins y la app no usa enlaces profundos. Los íconos de testing se generan con
// scripts/testing-icons.py.
const testing = process.env.APP_VARIANT === "testing"

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!testing) return config as ExpoConfig
  return {
    ...config,
    name: "Atleta Test",
    icon: "./assets/testing/icon.png",
    android: {
      ...config.android,
      package: "com.atleta.app.testing",
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: "./assets/testing/android-icon-foreground.png",
        monochromeImage: "./assets/testing/android-icon-monochrome.png",
      },
    },
  } as ExpoConfig
}
