import type { TRPCDefaultErrorShape, TRPCError } from "@trpc/server"

// En producción no enviamos al cliente el mensaje ni el stack de errores internos
// (p. ej. errores de Postgres); los demás códigos conservan su mensaje de negocio.
// Solo se ocultan los errores que tRPC envolvió porque se lanzó algo que no era
// TRPCError (en ese caso expone el original en `error.cause`); un TRPCError lanzado
// a mano con INTERNAL_SERVER_ERROR y mensaje para el usuario se conserva.
export function hideInternalErrors(
  shape: TRPCDefaultErrorShape,
  error: TRPCError,
  nodeEnv: string | undefined,
): TRPCDefaultErrorShape {
  const wrappedUnknownError = error.cause !== undefined
  if (
    error.code === "INTERNAL_SERVER_ERROR" &&
    wrappedUnknownError &&
    nodeEnv === "production"
  ) {
    const { stack: _stack, ...data } = shape.data
    return {
      ...shape,
      message: "Ocurrió un error interno. Intenta de nuevo más tarde.",
      data,
    }
  }
  return shape
}
