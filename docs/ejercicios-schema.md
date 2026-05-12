# Diseño del módulo de ejercicios — Schema enriquecido

> **Estado:** Documentación pre-implementación. Sin código generado aún.
> **Fuente:** Notion "Fitness app (Miriam)" + estado actual del repositorio.

---

## 1. Estado actual en CMW Atleta

La tabla `exercise` hoy tiene solo los campos básicos:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `description` | text nullable | |
| `is_public` | boolean | público o privado (solo 2 niveles) |
| `owner_user_id` | text FK → user nullable | ejercicio personal |
| `owner_team_id` | uuid FK → team nullable | ejercicio del equipo |
| `created_at` | timestamp | |

**Qué falta:** clasificación muscular, equipamiento, patrones de movimiento, dificultad, contexto de uso, video, visibilidad granular (3 niveles), métricas de reputación.

---

## 2. Atributos del ejercicio enriquecido

Definición completa según la visión del producto. Dividido por categoría.

### 2.1 Identificación básica

| Campo | Tipo | Notas |
|---|---|---|
| `name` | text | Nombre del ejercicio |
| `description` | text nullable | Texto libre explicando en qué consiste |
| `difficulty` | enum | `beginner` \| `intermediate` \| `advanced` |

### 2.2 Clasificación muscular

El ejercicio tiene dos niveles de clasificación muscular. Ambos distinguen entre músculos **primarios** (foco principal) y **secundarios** (participan de apoyo).

**Zona del cuerpo** — se infiere automáticamente de los músculos seleccionados:
- `upper` — tren superior
- `lower` — tren inferior
- `core` — abdomen / estabilización
- `full_body` — cuando involucra más de una zona

> La zona **no se almacena directamente** en el ejercicio. Se deriva de los músculos seleccionados en la consulta. Esto evita inconsistencias y simplifica el mantenimiento.

**Grupos musculares y músculos específicos** — via tabla de catálogo + junction table con rol:

```
exercise_muscle
  ├── muscle_id → muscle (catálogo)
  │     └── muscle_group_id → muscle_group (pierna, espalda, pecho, etc.)
  └── role: primary | secondary
```

Ejemplos de clasificación:
- **Press de banca:** pectoral (primary) · tríceps (secondary) · deltoides anterior (secondary)
- **Sentadilla:** cuádriceps (primary) · glúteo (primary) · isquiotibiales (secondary)

### 2.3 Equipamiento

- Un ejercicio puede requerir **múltiples equipos** (ej. banco + mancuernas)
- Los entrenadores pueden agregar equipos nuevos que quedan **privados** (solo para ellos y sus atletas)
- El campo `requires_equipment` (boolean) funciona como filtro rápido de calistenia vs con peso

```
exercise_equipment
  └── equipment_id → equipment (catálogo + privados)
```

**Catálogo base de equipamiento:**
mancuernas, barra olímpica, kettlebell, banda elástica, máquina/cable, polea alta, polea baja, TRX/suspensión, balón medicinal, caja/step, banco, barra de dominadas, anillas, rueda abdominal, pelota de estabilidad, bosu

### 2.4 Patrones de movimiento

Un ejercicio puede tener **más de un patrón** (ej. clean & press = bisagra + empuje).

| Valor | Descripción | Ejemplo |
|---|---|---|
| `push` | Empuje — alejar resistencia del cuerpo | Press de banca, lagartijas |
| `pull` | Jalón — acercar resistencia al cuerpo | Dominadas, remo |
| `squat` | Sentadilla — flexión dominante de rodilla | Sentadilla, prensa de pierna |
| `hinge` | Bisagra de cadera — flexión dominante de cadera | Peso muerto, hip thrust |
| `carry` | Cargada/Acarreo — transportar peso | Farmer's walk |
| `rotation` | Movimiento rotacional del tronco | Giro ruso, wood chop |
| `isometric` | Mantener posición sin movimiento | Plancha, wall sit |
| `mobility` | Rango de movimiento y estiramiento | Hip flexor stretch, rotación de cadera |

Almacenado como array de enum en la tabla de ejercicios (no junction table — la combinación es parte del ejercicio, no entidad separada).

### 2.5 Contexto de uso

| Campo | Tipo | Notas |
|---|---|---|
| `is_warmup_suitable` | boolean | ¿Apto para fase de calentamiento? |
| `is_evaluation_suitable` | boolean | ¿Se puede usar para medir progreso (peso + reps)? |
| `contraindications` | text nullable | Texto libre o tags: lesión de rodilla, embarazo, espalda baja |

> **`is_evaluation_suitable`** conecta directamente con el módulo de progreso: una sesión de evaluación solo puede contener ejercicios marcados con este flag. Determina si el atleta puede registrar series con peso + reps para alimentar gráficas históricas.

**Lo que NO es atributo del ejercicio:**
- Reps, series, tempo, descanso → son del plan de entrenamiento
- Objetivo (fuerza, hipertrofia, resistencia) → depende del contexto del plan, no del ejercicio en sí

### 2.6 Contenido visual

| Campo | Tipo | Notas |
|---|---|---|
| `video_url` | text nullable | URL del video subido por el creador (Supabase Storage o externo) |

> El video es el **medio principal** de demostración. No se piden fotos, GIFs ni thumbnails adicionales — se consideran fricción innecesaria para el creador. La vista de lista de resultados de búsqueda no muestra video; solo se muestra en la vista de detalle del ejercicio.

> **Avatar:** Se contempla como extensión futura (v2+) para ejercicios oficiales de la plataforma. La arquitectura no debe impedirlo pero no es prioritario.

### 2.7 Metadata y reputación

| Campo | Tipo | Notas |
|---|---|---|
| `creator_id` | text FK → user | Quién creó el ejercicio |
| `created_at` | timestamp | |
| `updated_at` | timestamp | El creador puede editar descripción, video, etc. |
| `visibility` | enum | `private` \| `team` \| `public` (ver sección 3) |
| `times_used` | integer | Contador de inclusiones en planes/rutinas |
| `is_platform_recommended` | boolean | Badge automático por popularidad + calificaciones |
| `source` | enum | `user` \| `platform` \| `external` (para integración futura de catálogos externos) |
| `external_id` | text nullable | ID en fuente externa cuando `source = external` |

---

## 3. Visibilidad — owner + is_public

Se mantiene el modelo actual de dos campos ortogonales en lugar de un enum de 3 niveles. Ownership y visibilidad son responsabilidades distintas y separarlas evita ambigüedad.

| `owner_user_id` | `owner_team_id` | `is_public` | Resultado |
|---|---|---|---|
| ✓ (el creador) | — | `false` | Privado del usuario — solo él lo ve |
| ✓ (el creador) | — | `true` | Personal pero público a toda la plataforma |
| — | ✓ (su equipo) | `false` | Del equipo — visible solo a miembros del equipo |
| — | ✓ (su equipo) | `true` | Del equipo y público a toda la plataforma |

`created_by` siempre registra el usuario que creó el ejercicio, independientemente del ownership.

**Por qué no el enum de 3 niveles (`private / team / public`):**
El caso "ejercicio personal compartido solo con mi equipo sin ser público" existe en papel pero no tiene un caso de uso fuerte en la práctica. Si un coach crea un ejercicio para su equipo, el ownership natural es del equipo. El modelo de dos campos cubre todos los estados reales sin mezclar ownership con visibilidad en un solo campo.

---

## 4. Sistema de calificación

Tabla separada `exercise_rating`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `exercise_id` | uuid FK → exercise | cascade delete |
| `user_id` | text FK → user | |
| `rating` | integer | 1–5 estrellas |
| `comment` | text nullable | Comentario libre opcional |
| `created_at` | timestamp | |

**Reglas:**
- Un usuario puede calificar un ejercicio **una sola vez** (unique constraint: exercise_id + user_id)
- La calificación **no puede editarse ni eliminarse** una vez emitida
- El creador puede leer los comentarios pero **no puede responderlos**
- Visible para cualquier usuario que vea el ejercicio

---

## 5. Catálogos (tablas de referencia)

### `muscle_group`
Agrupación general de músculos.

| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `name` | text |
| `body_zone` | enum: `upper` \| `lower` \| `core` |

Valores iniciales: pierna, espalda, pecho, hombro, brazo, glúteo, abdomen, antebrazo

### `muscle`
Músculo específico dentro de un grupo.

| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `name` | text |
| `muscle_group_id` | uuid FK → muscle_group |

Ejemplos:
- pierna → cuádriceps, isquiotibiales, pantorrillas, aductores
- espalda → dorsal, trapecio, romboides, erector espinal
- pecho → pectoral mayor, pectoral menor
- hombro → deltoides anterior, deltoides lateral, deltoides posterior
- brazo → bíceps, tríceps, braquial
- glúteo → glúteo mayor, glúteo medio, glúteo menor
- abdomen → recto abdominal, oblicuos, transverso

### `equipment`
Catálogo de equipamiento. Puede ser global (plataforma) o privado (entrenador).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `is_global` | boolean | true = visible para todos, false = privado del creador |
| `created_by` | text FK → user nullable | null para equipos globales de la plataforma |

---

## 6. Tablas junction

### `exercise_muscle`
Relación ejercicio ↔ músculo con rol.

| Campo | Tipo |
|---|---|
| `exercise_id` | uuid FK → exercise, cascade delete |
| `muscle_id` | uuid FK → muscle |
| `role` | enum: `primary` \| `secondary` |

PK compuesta: `(exercise_id, muscle_id)`

### `exercise_equipment`
Relación ejercicio ↔ equipamiento (muchos a muchos).

| Campo | Tipo |
|---|---|
| `exercise_id` | uuid FK → exercise, cascade delete |
| `equipment_id` | uuid FK → equipment |

PK compuesta: `(exercise_id, equipment_id)`

---

## 7. Schema completo de `exercise` (columnas directas)

```
exercise
├── id                     uuid PK
├── name                   text NOT NULL
├── description            text nullable
├── difficulty             enum(beginner, intermediate, advanced) nullable
├── movement_patterns      text[] (array de enum values)
├── requires_equipment     boolean NOT NULL default false
├── is_warmup_suitable     boolean NOT NULL default false
├── is_evaluation_suitable boolean NOT NULL default false
├── contraindications      text nullable
├── video_url              text nullable
├── visibility             enum(private, team, public) NOT NULL default 'private'
├── times_used             integer NOT NULL default 0
├── is_platform_recommended boolean NOT NULL default false
├── source                 enum(user, platform, external) NOT NULL default 'user'
├── external_id            text nullable
├── owner_user_id          text FK → user nullable
├── owner_team_id          uuid FK → team nullable
├── created_at             timestamp NOT NULL
└── updated_at             timestamp NOT NULL

+ junction tables:
  exercise_muscle    (exercise_id, muscle_id, role)
  exercise_equipment (exercise_id, equipment_id)

+ catálogos:
  muscle_group (id, name, body_zone)
  muscle       (id, name, muscle_group_id)
  equipment    (id, name, is_global, created_by)

+ reputación:
  exercise_rating (id, exercise_id, user_id, rating, comment, created_at)
```

---

## 8. Orden de resultados en búsqueda

Los resultados de búsqueda se presentan en tres grupos, dentro de cada uno ordenados por similitud semántica:

```
1. Ejercicios propios del entrenador (private + team propios)
2. Ejercicios del equipo (team de otros entrenadores del mismo equipo)
3. Ejercicios públicos de la plataforma
```

El entrenador siempre ve su propio contenido primero.

---

## 9. Vista de resultados (UI — sin thumbnails)

Los resultados de búsqueda **no muestran video ni imagen** en la lista. El video es exclusivo de la vista de detalle.

Cada resultado es un paquete denso de señales escaneables:
- Barra lateral de color según zona corporal
- Nombre del ejercicio
- Músculo(s) principal(es) + secundarios en texto muted
- Pills: patrón de movimiento · equipamiento · dificultad
- Badges: apto para calentamiento · apto para evaluación
- Indicador de contraindicaciones (cuando aplica)
- Calificación + número de usos
- Autor + badge "recomendado" cuando aplica

---

## 10. Sistema de color por zona corporal (tentativo)

| Zona | Color | Hex tentativo | Lógica |
|---|---|---|---|
| Tren inferior | Rojo terracota | `#D85A30` | Cálido, pesado, anclado — músculos más grandes |
| Tren superior | Verde azulado / Teal | `#1D9E75` | Frío, ligero, elevado — empuje y jalón |
| Core | Ámbar dorado | `#BA7517` | Punto medio — conecta inferior y superior |
| Full body | Púrpura | `#7F77DD` | Síntesis, integración |

> Estado: **tentativo**. La lógica cromática está definida; los hex exactos requieren validación con la paleta de marca final.

---

## 11. Alineación con el stack actual de CMW Atleta

| Aspecto | Estado actual | Cambio requerido |
|---|---|---|
| ORM | Drizzle + PostgreSQL | Sin cambio |
| Autenticación | better-auth | Sin cambio |
| Almacenamiento de video | No existe | Evaluar Supabase Storage o Cloudflare R2 |
| Búsqueda semántica | No existe | pgvector (post v1, no bloquea schema inicial) |
| Roles de equipo | `coach` \| `athlete` | El schema de ejercicios funciona tal cual; roles se extienden en Teams cuando se implemente `owner` |
| Visibilidad ejercicios | `is_public` boolean | Migrar a enum de 3 niveles |

---

## 12. Decisiones pendientes

- [ ] **Datos maestros de catálogos** — ¿quién gestiona el catálogo inicial de músculos y equipamiento? ¿se hace seed directo en migración o se crea panel de admin?
- [ ] **Zona del cuerpo** — confirmar que se deriva en consulta (no se almacena). Evaluar si conviene una columna calculada persistida en Postgres para performance de búsqueda/filtrado.
- [ ] **Video storage** — definir proveedor: Supabase Storage (ya en el stack de la visión) vs alternativa. Evaluar límites de tamaño y transcoding.
- [ ] **Búsqueda semántica** — pgvector para v1+ (no bloquea el schema inicial, solo se agrega la columna `embedding` más adelante).
- [ ] **`is_platform_recommended`** — definir umbrales: popularidad mínima, calificación mínima, si el admin puede dar visto bueno manual.
- [ ] **Integración de fuentes externas** — patrón Adapter/Repository ya documentado en Notion. Fuente(s) concretas y fase pendientes de definir.
- [ ] **Colores de zona corporal** — validar contra la paleta de marca de CMW Atleta (actualmente usa `--primary` gold/teal). Revisar conflictos con tokens existentes.
- [ ] **Calificaciones** — confirmar regla de no edición. Evaluar si aplica alguna ventana de tiempo para editar antes de bloquear.
- [ ] **Migración de datos existentes** — los ejercicios actuales (`is_public`, `owner_user_id`, `owner_team_id`) se migran a la nueva estructura. Definir valores por defecto para los campos nuevos (difficulty, movement_patterns, etc.) en registros existentes.

---

## 13. Orden de implementación sugerido

Este es el orden recomendado para no bloquear otras funcionalidades y poder ir probando incrementalmente:

1. **Migración de schema base** — agregar campos directos al ejercicio (`difficulty`, `movement_patterns`, `is_warmup_suitable`, `is_evaluation_suitable`, `contraindications`, `visibility`). Esto no rompe lo existente.
2. **Seed de catálogos** — tablas `muscle_group`, `muscle`, `equipment` con datos iniciales.
3. **Junction tables** — `exercise_muscle`, `exercise_equipment`.
4. **Actualizar form de creación/edición** — UI para los nuevos campos.
5. **Búsqueda y filtrado** — filtros por zona, músculo, equipamiento, patrón, dificultad.
6. **Sistema de calificación** — tabla `exercise_rating` + UI.
7. **Video** — integración con storage (requiere decisión de proveedor).
8. **Búsqueda semántica** — pgvector, columna `embedding`, job de generación (post v1).
