// URL de la API. Se fija en el build (EXPO_PUBLIC_*), ver .env.example.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3001").replace(/\/$/, "")
