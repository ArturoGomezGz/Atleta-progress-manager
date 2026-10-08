// Posición del pop-over del tutorial respecto al elemento resaltado. Funciones puras (sin DOM)
// para poder probarlas aparte.

export type Box = { left: number; top: number; width: number; height: number }
export type Side = "bottom" | "top" | "right" | "left"

export type Placement = {
  left: number
  top: number
  /** Lado del pop-over donde va la flecha (mira al objetivo). null = sin flecha (no cabe o no hay objetivo). */
  arrowSide: Side | null
  /** Posición de la punta de la flecha dentro del pop-over, en px desde su borde izquierdo (o superior si es lateral). */
  arrowOffset: number
}

const MARGIN = 12 // separación mínima con el borde de la pantalla
const GAP = 14 // separación entre el objetivo y el pop-over (aquí cabe la flecha)
const ARROW_PAD = 20 // la flecha no se acerca más que esto a una esquina

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max))

/**
 * Elige arriba/abajo/lado según el espacio libre y deja el pop-over dentro de la pantalla.
 * Si no cabe en ningún lado sin tapar al objetivo, lo pega al borde con más espacio y sin flecha.
 */
export function computePlacement(
  target: Box | null,
  pop: { width: number; height: number },
  view: { width: number; height: number },
): Placement {
  if (!target) {
    return {
      left: clamp((view.width - pop.width) / 2, MARGIN, view.width - pop.width - MARGIN),
      top: clamp((view.height - pop.height) / 2, MARGIN, view.height - pop.height - MARGIN),
      arrowSide: null,
      arrowOffset: 0,
    }
  }

  const right = target.left + target.width
  const bottom = target.top + target.height
  const cx = target.left + target.width / 2
  const cy = target.top + target.height / 2

  const space: Record<Side, number> = {
    bottom: view.height - bottom,
    top: target.top,
    right: view.width - right,
    left: target.left,
  }
  const need: Record<Side, number> = {
    bottom: pop.height + GAP + MARGIN,
    top: pop.height + GAP + MARGIN,
    right: pop.width + GAP + MARGIN,
    left: pop.width + GAP + MARGIN,
  }
  // Primero abajo y arriba (lo normal en móvil y en listas), después los lados
  const order: Side[] = ["bottom", "top", "right", "left"]
  const side = order.find((s) => space[s] >= need[s])

  if (!side) {
    // Nada cabe (objetivo muy grande, como una hoja a pantalla completa): se pega al borde
    // inferior, encima del objetivo y sin flecha
    return {
      left: clamp(cx - pop.width / 2, MARGIN, view.width - pop.width - MARGIN),
      top: Math.max(MARGIN, view.height - pop.height - MARGIN),
      arrowSide: null,
      arrowOffset: 0,
    }
  }

  if (side === "bottom" || side === "top") {
    const left = clamp(cx - pop.width / 2, MARGIN, view.width - pop.width - MARGIN)
    return {
      left,
      top: side === "bottom" ? bottom + GAP : target.top - GAP - pop.height,
      // La flecha apunta hacia el objetivo: va en el borde que lo mira
      arrowSide: side === "bottom" ? "top" : "bottom",
      arrowOffset: clamp(cx - left, ARROW_PAD, pop.width - ARROW_PAD),
    }
  }
  const top = clamp(cy - pop.height / 2, MARGIN, view.height - pop.height - MARGIN)
  return {
    left: side === "right" ? right + GAP : target.left - GAP - pop.width,
    top,
    arrowSide: side === "right" ? "left" : "right",
    arrowOffset: clamp(cy - top, ARROW_PAD, pop.height - ARROW_PAD),
  }
}

/** Rectángulo del hueco: el objetivo con un poco de aire, recortado a la pantalla. */
export function holeBox(target: Box, view: { width: number; height: number }, pad = 6): Box {
  const left = Math.max(0, target.left - pad)
  const top = Math.max(0, target.top - pad)
  const right = Math.min(view.width, target.left + target.width + pad)
  const bottom = Math.min(view.height, target.top + target.height + pad)
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}
