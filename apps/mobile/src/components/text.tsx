import { colors, fonts } from "@/lib/theme"
import { Text as RNText, type TextProps } from "react-native"

type Props = TextProps & {
  size?: number
  weight?: "regular" | "medium" | "semibold" | "bold"
  /** Barlow Condensed, como los títulos de la web. */
  heading?: boolean
  color?: string
  center?: boolean
  /** Cifras de ancho fijo para que un contador no "baile" al cambiar. */
  tabular?: boolean
}

export function Text({ size = 16, weight = "regular", heading, color = colors.foreground, center, tabular, style, ...props }: Props) {
  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily: heading ? (weight === "semibold" ? fonts.headingSemibold : fonts.heading) : fonts[weight],
          fontSize: size,
          lineHeight: Math.round(size * (heading ? 1.15 : 1.45)),
          letterSpacing: heading ? size * 0.02 : 0,
          color,
        },
        center && { textAlign: "center" },
        tabular && { fontVariant: ["tabular-nums"] },
        style,
      ]}
    />
  )
}
