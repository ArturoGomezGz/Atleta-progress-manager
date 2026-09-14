# Proveedores de IA

## Decisión

Se utilizan dos proveedores de IA distintos según la naturaleza de cada tarea, priorizando costo y precisión:

| Función | Proveedor | Modelo | Razón |
|---|---|---|---|
| Reportes de progreso | Google AI | `gemini-2.5-flash` | Tarea de texto libre simple — el modelo más barato disponible con buena calidad en español |
| Autofill de ejercicios | OpenAI | `gpt-4o-mini` | Requiere tool use con UUIDs exactos del catálogo — GPT-4o-mini es más preciso en structured outputs |

## Por qué no se usa un solo proveedor

El autofill de ejercicios devuelve UUIDs que deben coincidir exactamente con los registros de la base de datos. Un error produce datos inválidos silenciosamente. GPT-4o-mini tiene mejor tasa de acierto en este tipo de razonamiento estructurado. Para los reportes, que son texto libre de 2 oraciones, cualquier modelo competente sirve y Gemini Flash es el más barato.

## Costos aproximados

Precios vigentes al momento de la decisión (mayo 2025):

### Claude Haiku 4.5 (proveedor anterior)

| | Input | Output |
|---|---|---|
| Precio | $0.80 / MTok | $4.00 / MTok |

### Gemini 2.5 Flash — reportes

| | Input | Output |
|---|---|---|
| Precio | $0.075 / MTok | $0.30 / MTok |
| Tokens por llamada | ~250 | ~80 |
| **Costo por llamada** | **~$0.000044** | |

### GPT-4o-mini — autofill

| | Input | Output |
|---|---|---|
| Precio | $0.15 / MTok | $0.60 / MTok |
| Tokens por llamada | ~2,000 | ~400 |
| **Costo por llamada** | **~$0.00054** | |

### Comparación con el proveedor anterior

| Función | Haiku 4.5 | Nuevo | Ahorro |
|---|---|---|---|
| Reporte de progreso | $0.00052/llamada | $0.000044/llamada | ~12× |
| Autofill de ejercicio | $0.0032/llamada | $0.00054/llamada | ~6× |

El input del autofill es costoso porque incluye el catálogo completo de músculos y equipamiento (UUIDs + nombres) en cada llamada.

## Variables de entorno requeridas

```
# Google AI Studio — https://aistudio.google.com
GEMINI_API_KEY=

# OpenAI Platform — https://platform.openai.com
OPENAI_API_KEY=
```

## Archivos afectados

- `apps/api/src/services/ai-reports.ts` — usa Gemini
- `apps/api/src/routers/exercises.ts` — usa GPT-4o-mini (endpoint `autofill`)
