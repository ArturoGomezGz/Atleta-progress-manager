# Monetización — Implementación a corto plazo

## Modelo de negocio

**Free tier por equipo:** 1 atleta + coaches ilimitados  
**Plan de pago:** coaches ilimitados + atletas ilimitados, cobro mensual por equipo

El valor se cobra a nivel de equipo, no de usuario. Un coach puede tener múltiples equipos — cada uno se gestiona y factura de forma independiente.

---

## Procesador de pagos

**LemonSqueezy** como primera opción.

- Actúa como Merchant of Record: ellos gestionan y remiten el IVA europeo. Elimina la carga fiscal desde el día 1.
- Webhooks fiables, SDK oficial para Node.js.
- Si en el futuro se requiere más control fiscal o mercado enterprise → migrar a Stripe es sencillo porque la capa de abstracción interna es la misma.

---

## Tiers

| Plan | Atletas | Coaches | Precio |
|---|---|---|---|
| **Free** | 1 | ilimitados | €0/mes |
| **Pro** | ilimitados | ilimitados | €X/mes por equipo |

El precio exacto se define antes del lanzamiento. La arquitectura soporta añadir tiers intermedios (p.ej. hasta 10 atletas) sin cambios de schema.

---

## Política de downgrade / cancelación

Al cancelar el plan Pro, el equipo vuelve a Free:
- **No se elimina ningún dato** — atletas, sesiones y registros históricos se conservan.
- Se bloquea únicamente la acción de **añadir nuevos atletas** si el equipo ya supera el límite de 1.
- Los atletas existentes por encima del límite quedan en modo _read-only_: pueden consultar su historial pero no registrar nuevas series.
- El coach ve un banner explicando la situación y un CTA para reactivar el plan.

---

## Cambios en base de datos

### Nueva tabla: `team_subscription`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `team_id` | uuid FK → team | `UNIQUE`, cascade delete |
| `plan` | enum | `free` \| `pro` |
| `status` | enum | `active` \| `cancelled` \| `past_due` |
| `lemon_squeezy_customer_id` | text nullable | ID de cliente en LS |
| `lemon_squeezy_subscription_id` | text nullable | ID de suscripción en LS |
| `current_period_end` | timestamptz nullable | Fecha de próxima renovación o fin de gracia |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Un equipo sin fila en esta tabla se trata como `free` por defecto — no se requiere registrar todos los equipos al crearlos.

### Helper de límites

Función de consulta reutilizable (no tabla):

```ts
// packages/db/src/limits.ts
export async function getTeamAthleteLimit(teamId: string): Promise<number> {
  const sub = await db.query.teamSubscription.findFirst({ where: eq(teamSubscription.teamId, teamId) });
  if (!sub || sub.plan === "free") return 1;
  return Infinity;
}
```

---

## Cambios en el API (`apps/api`)

### Nuevo router: `billing`

| Procedimiento | Tipo | Descripción |
|---|---|---|
| `billing.getStatus` | query | Devuelve plan actual + atletas usados vs límite |
| `billing.createCheckout` | mutation | Crea sesión de checkout en LemonSqueezy y devuelve la URL |
| `billing.cancelSubscription` | mutation | Cancela en LS al final del período |
| `billing.webhook` | HTTP POST raw | Recibe y valida webhooks de LemonSqueezy (firma HMAC) |

### Guard en `teams.addMember` / `teams.addMemberByEmail`

Antes de insertar un `team_member` con role `athlete`:

```ts
const athleteCount = await db
  .select({ count: count() })
  .from(teamMember)
  .where(and(eq(teamMember.teamId, input.teamId), eq(teamMember.role, "athlete")));

const limit = await getTeamAthleteLimit(input.teamId);

if (athleteCount[0].count >= limit) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "ATHLETE_LIMIT_REACHED", // código que el frontend interpreta para mostrar el paywall
  });
}
```

Los coaches no tienen límite — el guard solo aplica cuando `role === "athlete"`.

### Webhook handler

Eventos que se deben manejar:

| Evento LS | Acción |
|---|---|
| `subscription_created` | Upsert `team_subscription` → `plan: pro, status: active` |
| `subscription_updated` | Actualizar `status` y `current_period_end` |
| `subscription_cancelled` | `status: cancelled` (conservar hasta `current_period_end`) |
| `subscription_expired` | `plan: free, status: cancelled` — aplicar restricciones |
| `subscription_payment_failed` | `status: past_due` — mostrar aviso pero no cortar acceso inmediatamente |

Todos los webhooks se validan con HMAC-SHA256 usando el signing secret de LemonSqueezy antes de procesar.

---

## Cambios en el frontend (`apps/web`)

### Nuevo componente: `<PaywallBanner />`

Se muestra en la vista de gestión de equipo cuando:
- `billing.getStatus` indica `plan: free` y `athleteCount >= 1`

Contiene:
- Descripción del límite actual
- Número de atletas actuales vs límite
- Botón "Actualizar plan" → llama a `billing.createCheckout` y redirige a LemonSqueezy

### Intercepción del error `ATHLETE_LIMIT_REACHED`

En el handler de `addMember`, si el error es `ATHLETE_LIMIT_REACHED`:
- No mostrar toast de error genérico
- Abrir modal de paywall con CTA de upgrade

### Página de gestión de plan

Ruta sugerida: `/team/[teamId]/billing`

Muestra:
- Plan actual y fecha de renovación
- Atletas usados vs límite
- Botón para cancelar (si Pro) o actualizar (si Free)
- Historial no se toca en ningún caso

---

## Flujo completo de upgrade

```
Coach intenta añadir 2º atleta
  │
  ├── API devuelve ATHLETE_LIMIT_REACHED
  │
  └── Frontend muestra modal de paywall
        │
        └── Coach pulsa "Actualizar plan"
              │
              └── billing.createCheckout → URL de LemonSqueezy
                    │
                    └── Coach completa pago en LS
                          │
                          └── LS envía webhook subscription_created
                                │
                                └── API actualiza team_subscription → plan: pro
                                      │
                                      └── Coach puede añadir atletas sin límite
```

---

## Orden de implementación

1. **Schema**: tabla `team_subscription` + migración Drizzle
2. **Helper**: `getTeamAthleteLimit` en `packages/db`
3. **Guard**: añadir check en `teams.addMember` y `teams.addMemberByEmail`
4. **Router billing**: `getStatus` + `createCheckout` + `cancelSubscription`
5. **Webhook endpoint**: validación HMAC + handlers de eventos
6. **Frontend — intercepción de error**: modal de paywall al recibir `ATHLETE_LIMIT_REACHED`
7. **Frontend — PaywallBanner**: banner en gestión de equipo
8. **Frontend — página `/billing`**: gestión de plan y cancelación
9. **Testing end-to-end**: crear equipo → añadir atleta 1 (OK) → añadir atleta 2 (paywall) → pagar → añadir atleta 2 (OK) → cancelar → verificar estado read-only

---

## Decisiones de diseño

- **Límite en el API, no solo en el frontend**: el frontend muestra el paywall para buena UX, pero el hard gate vive en el tRPC router. Un llamada directa a la API sin UI también es bloqueada.
- **Equipos sin suscripción = Free implícito**: no se crean filas en `team_subscription` hasta que el equipo hace upgrade. Reduce ruido en la BD y simplifica la creación de equipos.
- **No se borran datos al cancelar**: la política es conservadora. Los datos históricos nunca se tocan. Solo se bloquea la acción de añadir nuevos atletas.
- **`past_due` tiene periodo de gracia**: un pago fallido no corta el acceso inmediatamente. Se muestra un aviso y se da tiempo para que el pago se resuelva antes de degradar a Free.
- **`current_period_end` como fecha de corte**: al cancelar, el plan Pro se mantiene activo hasta `current_period_end`. Esto lo gestiona LemonSqueezy automáticamente en el webhook `subscription_cancelled`.
