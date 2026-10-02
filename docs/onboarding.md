# Onboarding de usuarios nuevos (web)

Guía corta basada en la primera acción: tener un entrenamiento, asignárselo, hacerlo y conocer Explorar. Es una tarjeta, un banner y un CTA; no hay tour ni globos. Mobile no lo usa.

## A quién aplica

Solo a quien recibe el equipo por defecto ([equipo-por-defecto.md](equipo-por-defecto.md)): `ensureDefaultTeam` guarda el onboarding como en curso en la misma transacción que crea "Mi equipo". Usuarios existentes, invitados a un equipo y atletas invitados no lo tienen (el estado es `null`) y no ven nada. Solo aparece en ese equipo.

## Dónde vive el estado

Columna `onboarding` (jsonb, nullable) de `user_preferences`: `{ status, teamId }` con `status` = `active` | `dismissed` | `completed`. Es de la cuenta, no del navegador. Migración `0004`, que la API aplica sola al arrancar. tRPC: `onboarding.get` (estado y pasos calculados) y `onboarding.setStatus`. Los contratos de `preferences.*` no cambian.

## Pasos

La tarjeta "Primeros pasos" está en Mis entrenamientos mientras el estado sea `active`. Los pasos no se guardan: `onboarding.get` los calcula con datos que ya existen, así que un refresh a mitad no pierde nada.

| Paso | Se marca cuando |
|---|---|
| 1. Crea tu primer entrenamiento (sugiere un circuito simple de 2 rondas) | El usuario tiene un entrenamiento de categoría "training" creado por él en el equipo |
| 2. Asígnatelo (abre `sesiones/new?routineId=<el primero que creó>`) | Tiene un asignado propio, no cancelado, de alguno de esos entrenamientos |
| 3. Hazlo (lleva a Hoy o al asignado pendiente) | Completó uno de esos asignados |
| 4. Explora más ejercicios | Pulsa "Entendido" en el banner de Explorar: el estado pasa a `completed` y la tarjeta desaparece |

Si borra todos sus entrenamientos, el paso 1 vuelve a "Crea" y los siguientes se deshabilitan hasta que cree otro.

## Cierre y reapertura

"Ahora no" pone `dismissed`; el botón "?" junto a Crear lo reabre (`active`). Un onboarding `completed` no se reabre.

## Otras piezas

- Al terminar un entrenamiento (pantalla de celebración de `athlete-session-view.tsx`) y con el estado `active`, aparece el CTA "Siguiente: conoce Explorar".
- El banner de Explorar solo se muestra con el estado `active`.
- Mientras no se conoce el estado (cargando o error) no se muestra nada.
- Código: `apps/web/src/components/onboarding.tsx` y `apps/api/src/routers/onboarding.ts`.
