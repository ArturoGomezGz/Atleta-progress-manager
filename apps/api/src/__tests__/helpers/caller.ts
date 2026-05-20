import type { Context } from "../../trpc"
import { createCallerFactory } from "../../trpc"
import { appRouter } from "../../routers"

const factory = createCallerFactory(appRouter)

export type MockUser = { id: string; name: string; email: string }

function mockSession(user: MockUser): NonNullable<Context["session"]> {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: `sess-${user.id}`,
      userId: user.id,
      token: `tok-${user.id}`,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
  } as NonNullable<Context["session"]>
}

/** Caller tRPC con sesión autenticada de un usuario real (debe existir en la DB). */
export function makeCaller(user: MockUser) {
  return factory({ session: mockSession(user) })
}

/** Caller sin sesión — para verificar que los endpoints lanzan UNAUTHORIZED. */
export function makeAnonymousCaller() {
  return factory({ session: null })
}
