# Funcionalidades de Atleta

Registro de lo que tiene el producto y en qué estado está, para no perder el rastro. Cubre la web y menciona la app móvil.

> **Última revisión:** 2026-10-02.
> **Cómo mantenerlo:** cuando una función cambie de estado, muévela de sección y actualiza la fecha. Las limitadas por usuario viven en `apps/api/src/lib/features.ts` (ver [feature-flags.md](feature-flags.md)); los nombres visibles, en [terminologia-ui.md](terminologia-ui.md).

## Estados

| Estado | Significa |
|---|---|
| Disponible | Lo ven y usan todos los usuarios |
| Limitada | Oculta y bloqueada en la API para todos salvo usuarios permitidos con un flag |
| Por pulir | Está disponible pero tiene fallas o detalles pendientes conocidos |
| Planeada | Diseñada o documentada, sin implementar |

La columna **Verificación** indica de dónde viene el estado:
- **Probada**: el dueño la ha usado y confirmó que funciona.
- **Por confirmar**: el estado se infiere del código; falta que el dueño lo confirme.

## Disponibles para todos

| Función | Qué hace | Verificación |
|---|---|---|
| Registro e inicio de sesión | Correo y contraseña, y Google si está configurado. Recuperar contraseña. Confirmación de correo (en testing se omite con `AUTO_VERIFY_EMAIL`). | Por confirmar |
| Equipo por defecto | Cada usuario nuevo recibe "Mi equipo", donde es coach y tiene el auto-entrenamiento activado ([equipo-por-defecto.md](equipo-por-defecto.md)). | Por confirmar |
| Onboarding de usuarios nuevos | Tarjeta "Primeros pasos" en Mis entrenamientos (crear, asignar, hacer, explorar), CTA al terminar y banner en Explorar. Solo para quien recibe el equipo por defecto ([onboarding.md](onboarding.md)). | Por confirmar |
| Equipos | Crear equipos, cambiar entre ellos desde la sección Equipo, eliminar equipo. | Por confirmar |
| Miembros e invitaciones | Invitar atletas por enlace, ver miembros y roles. | Por confirmar |
| Auto-entrenamiento | El coach se asigna entrenamientos a sí mismo y los ve en "Hoy". | Por confirmar |
| Entrenamientos (builder) | Crear y editar entrenamientos con ejercicios individuales y circuitos; series por repeticiones o tiempo; carga fija, % RM o RPE; tempo, descanso, objetivo y notas; reordenar arrastrando. | Probada |
| Asignar y entrenar ahora | Asignar un entrenamiento a uno o más atletas y comenzarlo en el momento. | Probada |
| Pestaña Asignados | Lista de lo asignado con atletas y avance completado. | Por confirmar |
| Hoy (atleta) | Lo que toca hoy, en curso, próximos y terminados; ejecutar el entrenamiento paso a paso. | Por confirmar |
| Biblioteca de ejercicios | Ejercicios con video, zonas del cuerpo, contraindicaciones y alternativas; los propios del equipo. | Por confirmar |
| Explorar | Catálogo público de ejercicios. | Por confirmar |
| Configuración | Contraseña, tema (claro/oscuro) y temporizador de descanso. | Por confirmar |
| Ejecución con temporizador de descanso | Descanso automático entre series, configurable. | Por confirmar |

## Limitadas (solo usuarios permitidos)

Se activan por usuario con variables de entorno en la API. El dueño las tiene todas con `FEATURE_ALL_USERS`.

| Función | Clave | Variable | Motivo |
|---|---|---|---|
| Evaluación (entrenamientos y asignados de categoría evaluación, registro de peso y repeticiones por atleta) | `evaluation` | `FEATURE_EVALUATION_USERS` | Aún sin probar |
| Progreso (RM, gráficas, reportes) | `progress` | `FEATURE_PROGRESS_USERS` | Depende de evaluación; requiere ambas |
| Generador de entrenamientos con IA | `ai_generator` | `FEATURE_AI_GENERATOR_USERS` | Experimental |
| Apariencia del equipo (logo y color) | `team_appearance` | `FEATURE_TEAM_APPEARANCE_USERS` | Decisión de producto |
| Compartir por enlace (crear enlaces nuevos) | `share_links` | `FEATURE_SHARE_LINKS_USERS` | Decisión de producto. Los enlaces ya creados siguen funcionando. |
| Programar asignados para una fecha futura | `scheduled_sessions` | `FEATURE_SCHEDULED_SESSIONS_USERS` | Sin probar; solo se ha usado "Ahora" |
| Grupos de atletas | `groups` | `FEATURE_GROUPS_USERS` | Tiene bugs pendientes de revisar |

## Por pulir

Nada marcado todavía. Aquí van las funciones disponibles que tengan fallas conocidas.

Pendientes ya detectados en el producto:
- Decidir qué hacer con un invitado que abre un enlace de invitación y no se une: hoy recibe "Mi equipo" al entrar al dashboard.
- Decidir si eliminar el único equipo debe volver a crear "Mi equipo" (hoy sí).
- Las etiquetas "Evaluación" en ejercicios (`suitableFor`) siguen visibles aunque la función esté limitada.
- Las rutas antiguas `/sessions/*` conservan textos y estructura anteriores al rediseño.
- La página de Equipo no muestra el número de miembros por equipo en las tarjetas.

## App móvil (Android)

Fuera del alcance de esta lista web; el detalle está en [mobile.md](mobile.md). Solo para el atleta: ver entrenamientos pendientes y ejecutarlos. No usa las funciones limitadas.

## Planeadas

| Función | Detalle |
|---|---|
| Monetización por equipo | Plan gratuito con 1 atleta y plan de pago ilimitado; ver [monetizacion.md](monetizacion.md). Sin implementar. |
| RM por atleta | Cálculo y almacenamiento del RM para cargas en % RM; ver [rm-atleta.md](rm-atleta.md). Depende de evaluación. |
| Capa "Plan" (agrupar entrenamientos) | Fuera de v1 en [rutinas-normales.md](rutinas-normales.md). |
