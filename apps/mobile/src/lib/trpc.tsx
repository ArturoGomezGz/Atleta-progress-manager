import type { AppRouter } from "@atleta/api/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCReact, httpBatchLink } from "@trpc/react-query"
import type { inferRouterOutputs } from "@trpc/server"
import { useState } from "react"
import { authClient } from "./auth"
import { API_URL } from "./config"

export const trpc = createTRPCReact<AppRouter>()
export type RouterOutputs = inferRouterOutputs<AppRouter>

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }))
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${API_URL}/trpc`,
          // En nativo no hay cookies del navegador: la sesión viaja a mano.
          headers: () => ({ cookie: authClient.getCookie() }),
          fetch: (url, options) => fetch(url, { ...options, credentials: "omit" }),
        }),
      ],
    }),
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
