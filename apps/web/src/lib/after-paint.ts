/**
 * Llama a `callback` cuando el navegador ya pintó el frame actual, y devuelve una
 * función para cancelarlo (útil como cleanup de un efecto).
 *
 * Es lo que necesita cualquier elemento que entra animado al montarse (hojas,
 * vistas que se deslizan): hay que pintarlo primero en su posición inicial y solo
 * después pedirle la final. Un solo rAF no basta, porque el navegador puede fusionar
 * el paint inicial con el callback en el mismo frame y el elemento "salta" a su
 * sitio en vez de animar; el segundo rAF garantiza que ese primer frame existió.
 */
export function afterNextPaint(callback: () => void): () => void {
  let inner = 0
  const outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(callback)
  })
  return () => {
    cancelAnimationFrame(outer)
    cancelAnimationFrame(inner)
  }
}
