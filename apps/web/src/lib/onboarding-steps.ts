// Pasos del tutorial guiado (docs/onboarding.md): qué ruta le toca a cada paso, cuándo se da por
// hecho y qué se le muestra al usuario. Lógica pura (sin React ni DOM) para poder probarla aparte.

import type { OnboardingStep } from "@atleta/db/schema"

export type Step = OnboardingStep

export type TourCtx = {
  base: string // /teams/<teamId>
  pathname: string
  /** Parámetros de la URL (solo `routineId` importa). */
  routineIdParam: string | null
  /** Datos de onboarding.get. */
  assignRoutineId: string | null
  /** El entrenamiento más reciente del usuario: el que está armando. */
  lastRoutineId: string | null
  pendingSessionId: string | null
  hasRoutine: boolean
  /** Alguno de sus entrenamientos ya tiene al menos un ejercicio guardado. */
  hasExercises: boolean
  assigned: boolean
  completed: boolean
  /** Los datos se pidieron al servidor después de entrar a esta ruta: solo así sirven para retroceder. */
  fresh: boolean
  /** Señales publicadas por las pantallas (lib/tour-signals). */
  signals: Readonly<Record<string, string | number | boolean | undefined>>
}

export type ViewSpec = {
  key: string
  selector: string | null
  title: string
  body: string
  interactive?: boolean
  blocking?: boolean
  compact?: boolean
  /** "complete" = el botón principal termina el tutorial; "dismissRunInfo" = oculta el aviso del entrenamiento. */
  action?: { label: string; kind: "complete" | "dismissRunInfo" }
}

type StepDef = {
  /** ¿La ruta actual es la de este paso? */
  matches: (c: TourCtx) => boolean
  /** A dónde llevar al usuario si cayó en otra ruta. */
  href: (c: TourCtx) => string
  /** ¿Ya hizo lo que pide el paso? Entonces se pasa al siguiente. */
  done: (c: TourCtx) => boolean
  next: Step | null
  /** Paso anterior al que volver si los datos reales dicen que falta algo (solo con datos frescos). */
  regress?: (c: TourCtx) => Step | null
  views: (c: TourCtx) => ViewSpec[]
}

const re = (c: TourCtx, tail: string) => new RegExp(`^${c.base}${tail}$`)
const under = (c: TourCtx) => c.pathname === c.base || c.pathname.startsWith(`${c.base}/`)

const isList = (c: TourCtx) => re(c, "/plantillas/?").test(c.pathname)
const isNew = (c: TourCtx) => re(c, "/plantillas/nueva/?").test(c.pathname)
const isEditor = (c: TourCtx) => re(c, "/plantillas/(?!nueva/?$)[^/]+/?").test(c.pathname)
const isAssign = (c: TourCtx) => re(c, "/sesiones/new/?").test(c.pathname)
const isAssignedDetail = (c: TourCtx) => re(c, "/sesiones/(?!new/?$)[^/]+/?").test(c.pathname)
const isHoyList = (c: TourCtx) => re(c, "/mis-rutinas/?").test(c.pathname)
const isHoyDetail = (c: TourCtx) => re(c, "/mis-rutinas/[^/]+/?").test(c.pathname)
const isHoy = (c: TourCtx) => isHoyList(c) || isHoyDetail(c)
const isExplore = (c: TourCtx) => re(c, "/explorar/?").test(c.pathname)

const editorHref = (c: TourCtx) => (c.lastRoutineId ? `${c.base}/plantillas/${c.lastRoutineId}` : `${c.base}/plantillas`)
const needsRoutine = (c: TourCtx): Step | null => (c.fresh && !c.hasRoutine ? "create" : null)

export const STEPS: Record<Step, StepDef> = {
  create: {
    matches: isList,
    href: (c) => `${c.base}/plantillas`,
    done: (c) => isNew(c) || isEditor(c),
    next: "name",
    views: () => [{
      key: "create",
      selector: '[data-tour="create"]',
      title: "¡Bienvenido!",
      body: "Vamos a crear tu primer entrenamiento. Pulsa Crear para empezar.",
    }],
  },

  name: {
    matches: isNew,
    href: (c) => `${c.base}/plantillas/nueva`,
    done: isEditor,
    next: "exercises",
    views: () => [{
      key: "name",
      selector: '[data-tour="new-form"]',
      title: "Ponle nombre",
      body: "Escribe cómo quieres llamarlo, por ejemplo «Piernas» o «Cuerpo completo», y pulsa Crear.",
    }],
  },

  exercises: {
    matches: isEditor,
    href: editorHref,
    done: (c) => isEditor(c) && Number(c.signals["editor.exercises"] ?? 0) >= 1,
    next: "save",
    regress: (c) => (!isEditor(c) ? needsRoutine(c) : null),
    views: () => [
      {
        key: "exercises-picker",
        selector: '[data-tour="exercise-picker"]',
        title: "Elige un ejercicio",
        body: "Busca por nombre o músculo y toca el que quieras: tú decides qué lleva tu entrenamiento.",
      },
      {
        key: "exercises-add",
        selector: '[data-tour="editor-add"]',
        title: "Agrega tus ejercicios",
        body: "Pulsa Agregar ejercicio y busca libremente en el catálogo. Con uno basta para empezar; después puedes sumar más o armar un circuito de 2 rondas.",
      },
    ],
  },

  save: {
    matches: isEditor,
    href: editorHref,
    // De vuelta en la lista solo cuenta si lo guardado de verdad tiene ejercicios (se sale sin guardar con la URL)
    done: (c) => isList(c) && c.fresh && c.hasExercises,
    next: "assign-pick",
    regress: (c) =>
      (isEditor(c) && c.signals["editor.exercises"] === 0 ? ("exercises" as Step) : null) ??
      (isList(c) && c.fresh && c.hasRoutine && !c.hasExercises ? ("exercises" as Step) : null) ??
      (!isEditor(c) ? needsRoutine(c) : null),
    views: () => [
      {
        key: "save-confirm",
        selector: '[data-tour="editor-save"]',
        title: "Guarda tu entrenamiento",
        body: "Pulsa Guardar para conservarlo.",
      },
      {
        key: "save-exit",
        selector: '[data-tour="editor-exit"]',
        title: "¡Buen comienzo!",
        body: "Ya tienes un ejercicio. Pulsa Salir y elige Guardar para conservar tu entrenamiento.",
      },
    ],
  },

  "assign-pick": {
    matches: isList,
    href: (c) => `${c.base}/plantillas`,
    done: (c) => isAssign(c) || isAssignedDetail(c) || isHoy(c),
    next: "assign",
    regress: needsRoutine,
    views: () => [{
      key: "assign-pick",
      selector: '[data-tour="assign-btn"]',
      title: "Ahora asígnatelo",
      body: "Un entrenamiento es el molde; al asignarlo se convierte en un asignado, la versión que se hace de verdad. Pulsa Asignar.",
    }],
  },

  assign: {
    matches: (c) => isAssign(c) && (!c.assignRoutineId || c.routineIdParam === c.assignRoutineId),
    href: (c) => (c.assignRoutineId ? `${c.base}/sesiones/new?routineId=${c.assignRoutineId}` : `${c.base}/plantillas`),
    done: (c) => isAssignedDetail(c) || isHoy(c),
    next: "hoy",
    regress: needsRoutine,
    views: (c) => [
      ...(c.signals["assign.self"] === true
        ? [{
            key: "assign-submit",
            selector: '[data-tour="assign-submit"]',
            title: "Asigna y comienza",
            body: "Pulsa Asignar y comenzar para crear tu asignado.",
          }]
        : []),
      {
        key: "assign-self",
        selector: '[data-tour="assign-self"]',
        title: "Elígete a ti",
        body: "Marca tu nombre (Tú): serás el atleta que hace este entrenamiento.",
      },
    ],
  },

  hoy: {
    matches: under,
    href: (c) => `${c.base}/mis-rutinas`,
    done: isHoy,
    next: "run",
    regress: (c) => needsRoutine(c) ?? (c.fresh && !c.assigned ? ("assign-pick" as Step) : null),
    views: () => [{
      key: "hoy",
      selector: '[data-tour="nav-hoy"]',
      title: "¡Asignado!",
      body: "Ahora hazlo de verdad. Entra a Hoy desde el menú: ahí están tus entrenamientos asignados.",
    }],
  },

  run: {
    matches: isHoy,
    href: (c) => (c.pendingSessionId ? `${c.base}/mis-rutinas/${c.pendingSessionId}` : `${c.base}/mis-rutinas`),
    done: (c) =>
      c.signals["run.status"] === "completed" ||
      c.signals["run.done"] === true ||
      // En Hoy, sin nada pendiente y con un asignado ya terminado: no hay nada más que hacer aquí
      (isHoyList(c) && c.fresh && c.completed && !c.pendingSessionId),
    next: "explore-go",
    regress: (c) => needsRoutine(c) ?? (c.fresh && !c.assigned ? ("assign-pick" as Step) : null),
    views: (c) => {
      if (isHoyList(c)) {
        return c.pendingSessionId
          ? [{
              key: "run-card",
              selector: '[data-tour="run-card"]',
              title: "Tu entrenamiento te espera",
              body: "Ábrelo para ver los ejercicios que acabas de asignarte.",
            }]
          : []
      }
      const status = c.signals["run.status"]
      if (status === "scheduled") {
        return [{
          key: "run-start",
          selector: '[data-tour="run-start"]',
          title: "Empieza cuando quieras",
          body: "Aquí ves tus ejercicios; toca uno si quieres ver su video. Cuando estés listo, pulsa Empezar entrenamiento.",
        }]
      }
      if (status === "active") {
        // Durante el entrenamiento no se bloquea nada: es el entrenamiento real
        return [{
          key: "run-active",
          selector: null,
          blocking: false,
          title: "¡A entrenar!",
          body: "Registra cada serie conforme la hagas. Al terminar seguimos con Explorar.",
          action: { label: "Entendido", kind: "dismissRunInfo" },
        }]
      }
      return []
    },
  },

  "explore-go": {
    matches: under,
    href: (c) => `${c.base}/mis-rutinas`,
    done: isExplore,
    next: "explore",
    views: () => [
      {
        key: "explore-nav",
        selector: '[data-tour="nav-explorar"]',
        title: "¡Lo lograste!",
        body: "Terminaste tu primer entrenamiento. Ahora conoce Explorar: pulsa Explorar en el menú.",
      },
      {
        key: "explore-cta",
        selector: '[data-tour="explore-cta"]',
        title: "¡Lo lograste!",
        body: "Terminaste tu primer entrenamiento. Ahora conoce Explorar.",
      },
    ],
  },

  explore: {
    matches: isExplore,
    href: (c) => `${c.base}/explorar`,
    done: () => false,
    next: null,
    views: () => [{
      key: "explore",
      selector: null,
      title: "Esto es Explorar",
      body: "Es el catálogo de ejercicios. Toca uno para ver su video y los músculos que trabaja, y guarda los que te gusten: los encontrarás en Ejercicios para usarlos en tus entrenamientos.",
      action: { label: "Entendido", kind: "complete" },
    }],
  },
}

/** Pasos en orden, para quien necesite compararlos. */
export const STEP_ORDER: Step[] = ["create", "name", "exercises", "save", "assign-pick", "assign", "hoy", "run", "explore-go", "explore"]

const MAX_HOPS = STEP_ORDER.length

/**
 * Paso al que corresponde pasar desde `step` con el contexto actual: avanza mientras el paso
 * esté hecho y, con datos frescos, retrocede si falta algo. Devuelve `step` si no cambia.
 */
export function resolveStep(step: Step, ctx: TourCtx): Step {
  let s = step
  for (let i = 0; i < MAX_HOPS; i++) {
    const def = STEPS[s]
    if (def.next && def.done(ctx)) { s = def.next; continue }
    const back = def.regress?.(ctx)
    if (back && back !== s) {
      // Tras retroceder se vuelve a avanzar con lo que ya está hecho, sin volver a retroceder
      let f: Step = back
      for (let j = 0; j < MAX_HOPS; j++) {
        const d = STEPS[f]
        if (d.next && d.done(ctx)) f = d.next
        else break
      }
      return f
    }
    break
  }
  return s
}
