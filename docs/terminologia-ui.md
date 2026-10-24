# Terminología de la UI web

Lo que ve la persona usa estos nombres. Los nombres internos no cambian.

| Antes | Ahora | Qué es |
|---|---|---|
| Plantilla | **Entrenamiento** | Lo que el coach diseña: ejercicios, series, circuitos. |
| Sesión | **Asignado** | Un entrenamiento puesto a atletas en una fecha. Se crea con el botón "Asignar". |
| Mis rutinas | **Hoy** | Lo que me toca hacer (atleta, y coach con auto-entrenamiento). |
| Rutinas (grupo del menú) | **Entrenamientos** | Una sola entrada del menú del coach, con dos pestañas: "Mis entrenamientos" y "Asignados". |
| Mis ejercicios | **Ejercicios** | Catálogo de ejercicios. |
| — (nuevo) | **Plan de entrenamiento** | Varias semanas (1–16) de entrenamientos por día. Al programarlo a atletas desde una fecha se crea un asignado por entrenamiento. Interno: `training_plan`, `plans.*`. Hoy solo existe por el conector MCP (flag `training_plans`). En textos visibles se dice "plan" o "plan de entrenamiento". |

"Rutina" ya no se usa como sinónimo en textos visibles: se dice "entrenamiento".

## Navegación

- Coach: Equipo · Entrenamientos · Ejercicios · Explorar · Progreso (solo con el flag `progress`).
- Atleta: Hoy · Ejercicios · Explorar · Progreso (solo con el flag `progress`).
- Coach con auto-entrenamiento: añade "Hoy" tras "Entrenamientos".

"Entrenamientos" agrupa las rutas `plantillas` (pestaña Mis entrenamientos) y `rutinas`/`sesiones` (pestaña Asignados). El botón "Asignar" de cada entrenamiento abre `sesiones/new?routineId=<id>` con el entrenamiento preseleccionado.

## Regla

Los nombres internos (tablas, tipos, endpoints de API, variables y URLs como `/plantillas`, `/rutinas`, `/sesiones`, `/mis-rutinas`) **no cambian**: mobile y los enlaces compartidos dependen de ellos. Solo se renombra lo visible.
