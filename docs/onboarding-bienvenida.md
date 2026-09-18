# Bienvenida para usuarios nuevos — plan y decisiones

---

## Objetivo

Cuando un usuario entra a la app por primera vez, se le muestra un mensaje de
bienvenida corto con un mini-tour de 3 pasos, apuntándolo al núcleo del
producto: **explorar el catálogo de ejercicios, guardar los que le sirvan y
crear los suyos**. El objetivo es causar buena primera impresión y dirigir al
usuario nuevo hacia esas acciones concretas, sin agregar fricción.

---

## Patrón elegido

**Modal de bienvenida de 3 pasos, sin anclar a ningún elemento del DOM**,
montado en `apps/web/src/app/(app)/layout.tsx` y disparado por un flag en
`user_preferences`.

Se descartaron coach-marks/spotlight (romperían en el sidebar, que es un
drawer oculto en móvil), un checklist persistente de primeros pasos (mucho
más trabajo del que se pidió) y una página dedicada `/bienvenida` (agrega un
salto más a una cadena de redirects ya delicada).

El modal vive en el layout de `(app)` y no en `/dashboard` porque esa página
redirige de inmediato (`router.replace`) en cuanto resuelve el equipo del
usuario — el layout no se remonta entre `/dashboard` y `/teams/{id}/...`, así
que el modal sobrevive a ese redirect y funciona también para quien entra por
un enlace profundo.

---

## Flujo

1. **Bienvenido a Atleta** — saludo corto, botón "Empezar".
2. **Explora y guarda** — explica el catálogo público (`/explorar`) y el
   marcador para guardar ejercicios.
3. **Crea el tuyo** — explica el botón "Nuevo" de "Mis ejercicios" y el
   autocompletado con IA desde un link de YouTube. La última frase cambia
   según el rol (coach ve "publícalo para otros entrenadores", atleta ve
   "tenlo siempre a mano"). El CTA final navega a `/teams/{teamId}/explorar`.

Se puede saltar en cualquier paso (botón "Saltar", Escape). El backdrop no
cierra el modal — evita cierres accidentales en el gimnasio.

## Disparo y persistencia

- Se muestra solo si el usuario ya pertenece a un equipo (si no, se pospone:
  no tiene sentido apuntar a `/explorar` sin `teamId`) y no está en una
  pantalla de rutina en curso.
- Se marca como visto **al abrirse**, no al cerrarse, para no repetirse en
  otro dispositivo/pestaña donde el usuario ya lo vio.
- Se puede volver a ver desde el menú de cuenta → "Cómo funciona Atleta",
  sin tocar el flag de "ya visto".
- La migración incluye backfill: todos los usuarios existentes antes de este
  cambio quedan marcados como "ya visto" para no mostrárselo a la base
  instalada.

## Qué se dejó fuera a propósito

Sin librerías de tour, sin coach-marks anclados al sidebar/pestañas/botones
(se rompen en móvil), sin checklist de progreso real, sin pedir datos de
perfil, sin tocar el flujo de registro ni las pantallas de invitado.

---

_Documento de referencia; implementación en
`apps/web/src/components/welcome-onboarding.tsx`,
`apps/web/src/app/(app)/onboarding-gate.tsx`._
