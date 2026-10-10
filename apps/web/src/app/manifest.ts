import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atleta",
    short_name: "Atleta",
    description: "Gestión de entrenamientos para entrenadores y atletas",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#07090d",
    theme_color: "#07090d",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
