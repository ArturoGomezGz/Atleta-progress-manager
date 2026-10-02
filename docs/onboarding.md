# Tutorial guiado para usuarios nuevos (web)

Un tutorial **guiado y bloqueante** que lleva al usuario nuevo a hacer de verdad lo primero que necesita: crear su primer entrenamiento, asignárselo, hacerlo y conocer Explorar. Mientras está activo, solo se puede hacer clic donde el tutorial indica. Siempre se puede omitir. Mobile no lo usa.

## A quién aplica

Solo a quien recibe el equipo por defecto ([equipo-por-defecto.md](equipo-por-defecto.md)): `ensureDefaultTeam` guarda el onboarding como activo en la misma transacción que crea "Mi equipo". Usuarios existentes, invitados a un equipo y atletas invitados no lo tienen (el estado es `null`) y no ven nada. Solo aparece en ese equipo (no en otros equipos ni en `/dashboard`). Un usuario con el tutorial omitido o completado no ve overlay.

## Cómo se ve y se comporta

- Una capa oscura cubre toda la página con un hueco (spotlight) sobre el elemento objetivo. Solo el objetivo y el pop-over reciben clics y teclado: el resto de la página, el menú lateral, sus enlaces y los atajos de teclado quedan bloqueados.
- El pop-over trae título, texto breve, una flecha hacia el objetivo (arriba, abajo o al lado según el espacio; se acomoda en móvil) y el botón **Omitir tutorial**, siempre visible dentro del pop-over.
- El tutorial avanza solo cuando el usuario hace la acción real (clic en el objetivo o un dato que se cumple), no con un botón "Siguiente". Los pasos informativos (explicación final, aviso durante el entrenamiento) tienen botón "Entendido".
- En móvil, cuando el paso apunta a un enlace del menú, el menú lateral se abre solo.
- `Esc` no omite ni cierra nada: omitir es el botón. El foco va al pop-over y `Tab` cicla solo entre el pop-over y el objetivo. Respeta `prefers-reduced-motion` y usa los tokens de color existentes (claro y oscuro).
- El objetivo se marca en cada pantalla con `data-tour="<id>"`. Un elemento dentro del objetivo con `data-tour-block` queda bloqueado (p. ej. Cancelar en la pantalla de nombre, Filtros en el selector de ejercicios).

## Pasos

El paso actual vive en la BD. Cada paso se da por hecho con una acción o dato real:

| Paso (`step`) | Pantalla y elemento resaltado | Se da por hecho cuando |
|---|---|---|
| `create` | Entrenamientos, botón **Crear**: "¡Bienvenido! Vamos a crear tu primer entrenamiento" | Se abre `plantillas/nueva` |
| `name` | Nuevo entrenamiento, el formulario (nombre y Crear; Cancelar bloqueado) | Se crea y se abre el editor |
| `exercises` | Editor: tarjeta **Agregar ejercicio**; al abrirse el selector, el selector completo (búsqueda libre; Filtros bloqueado). Sugiere, solo en el texto, un circuito de 2 rondas | El editor tiene al menos 1 ejercicio |
| `save` | Editor: botón **Salir** y, al abrirse la confirmación, **Guardar** | De vuelta en la lista y el servidor ya ve un entrenamiento suyo con ejercicios |
| `assign-pick` | Lista: botón **Asignar** del entrenamiento recién creado. Explica entrenamiento (molde) vs asignado | Se abre `sesiones/new` |
| `assign` | Asignar: la fila **Tú** y después **Asignar y comenzar** (solo "Ahora"; no se menciona programar fecha) | Se crea el asignado (se abre su pantalla) |
| `hoy` | Menú: enlace **Hoy** | Se abre Hoy |
| `run` | Hoy: la tarjeta del asignado; en su pantalla, **Empezar entrenamiento**. Ya entrenando **no se bloquea nada**: solo un aviso arriba con "Entendido" que se reduce a una cinta "Tutorial · Omitir" | El asignado termina (pantalla final o estado `completed`) |
| `explore-go` | "¡Lo lograste!" con flecha al enlace **Explorar** del menú (en la pantalla de felicitación, que no tiene menú, a un enlace "Conocer Explorar") | Se abre Explorar |
| `explore` | Explorar: pop-over centrado que explica el catálogo (video, músculos, guardar para encontrarlo en Ejercicios) | Pulsa "Entendido": el estado pasa a `completed` |

El primer entrenamiento lo arma el usuario libremente: no hay ejemplo precreado.

## Estado y persistencia

Columna `onboarding` (jsonb, nullable) de `user_preferences`: `{ status, teamId, step? }`.

- `status`: `active` (tutorial en curso), `dismissed` (omitido) o `completed`.
- `step`: uno de los ids de la tabla anterior (`ONBOARDING_STEPS` en `packages/db/src/schema/preferences.ts`). Es jsonb, no hay migración. Un estado `active` sin `step` (guardado antes de este tutorial) o con un valor desconocido equivale al primer paso (`create`).

tRPC (`apps/api/src/routers/onboarding.ts`, entradas validadas con zod):

- `onboarding.get`: estado, `step` y lo que la web necesita para guiar, calculado con datos reales: `hasRoutine`, `hasExercises`, `assignRoutineId` (el entrenamiento más reciente con ejercicios, el que se resalta en Asignar), `lastRoutineId`, `assigned`, `completed`, `pendingSessionId`.
- `onboarding.setStep`: guarda el paso (solo con el tutorial `active`). La web lo llama al avanzar, así un refresh o cambiar de dispositivo retoma donde iba.
- `onboarding.setStatus`: `dismissed` (omitir), `completed` (terminar) o `active` (reiniciar; vuelve a `create`, también desde `dismissed` y `completed`).

Para ser robusto, además del paso guardado la web usa datos reales: avanza si ya se hizo lo del paso (p. ej. si cae en la lista con el entrenamiento guardado) y, **solo con datos pedidos al servidor después de entrar a la ruta**, retrocede si falta algo (entrenamiento borrado → vuelve a `create`; sin ejercicios guardados → `exercises`; sin asignado → `assign-pick`).

## Omitir y reiniciar

"Omitir tutorial" pone `dismissed` y quita el overlay de inmediato (si el guardado falla se reintenta una vez). El botón "?" junto a **Crear** en Entrenamientos aparece con el tutorial omitido o completado y lo **reinicia** desde el primer paso, sin confirmación.

## Resiliencia (nunca queda la app bloqueada)

- Mientras no se conoce el estado (cargando o error de la consulta) no se muestra nada ni se bloquea nada. Si falla el pintado del tutorial, un error boundary lo apaga.
- Si el objetivo aún no existe, se espera (observando el DOM y con sondeo corto) y se hace scroll para dejarlo visible, también dentro de contenedores con scroll. Si no aparece en unos 4 segundos, el pop-over sale centrado con **Reintentar** y **Omitir tutorial** (este destacado).
- Si el usuario cae en una ruta que no corresponde al paso (URL manual, botón atrás, refresh), sale "Sigamos con el tutorial" con un botón que lo lleva a la ruta del paso, más Omitir. Solo se avisa si la ruta sigue equivocada tras un instante, para no parpadear al navegar.
- Si el paso lleva 45 segundos sin avanzar con el objetivo a la vista, Omitir pasa a ser el botón destacado.
- Durante el entrenamiento no hay bloqueo.

## Código

- Motor del tour (overlay, spotlight, pop-over, bloqueo): `apps/web/src/components/tour/tour-overlay.tsx`; posición del pop-over: `apps/web/src/lib/tour-placement.ts`.
- Pasos (rutas, condiciones, textos): `apps/web/src/lib/onboarding-steps.ts`.
- Conexión con el estado y la ruta, botón "?": `apps/web/src/components/onboarding.tsx`. Se monta en `app-shell.tsx`.
- Señales de las pantallas al tutorial (ejercicios en el editor, "Tú" elegido, estado del entrenamiento): `apps/web/src/lib/tour-signals.ts`.
- API: `apps/api/src/routers/onboarding.ts`.
