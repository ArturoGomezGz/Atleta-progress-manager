// Habilidades planeadas: solo metadatos (sin entrada ni `run`). Existen en el registro para que el
// documento docs/habilidades-ia-rutinas.md y el código no se desalineen. Al implementar una, muévela
// a skills-basic.ts o skills-compound.ts y cambia su estado en el documento.

import type { AnySkill, McpFit, SkillCategory, SkillExecution, SkillRisk, SkillScope } from "./types"

const REVIEWED = "2026-10-06"

function planned(id: string, name: string, description: string, category: SkillCategory, extra: { execution?: SkillExecution; scope?: SkillScope; risk?: SkillRisk; mcp?: McpFit; notes?: string } = {}): AnySkill {
  return {
    id, name, description, category,
    execution: extra.execution ?? "deterministic",
    scope: extra.scope ?? "draft",
    status: "planned",
    risk: extra.risk ?? "low",
    mcp: extra.mcp ?? "pending",
    reviewedAt: REVIEWED,
    notes: extra.notes,
  }
}

const account = { scope: "persist" as const, mcp: "yes" as const }

export const PLANNED_SKILLS: AnySkill[] = [
  // Consulta
  planned("routine_summary", "Resumen de la rutina", "Describe la rutina: duración estimada, zonas, patrones y carga total.", "read", { scope: "read", mcp: "yes" }),
  planned("review_against_constraints", "Revisar contra lesiones o equipo", "Señala ejercicios que choquen con limitaciones o equipamiento dados, sin editar.", "read", { scope: "read", execution: "llm", mcp: "no", notes: "Necesita las restricciones persistentes, fuera de alcance por ahora." }),
  planned("answer_question", "Responder preguntas sobre la rutina", "Contesta \"¿por qué este ejercicio?\" sin cambiar nada.", "read", { scope: "read", execution: "llm", mcp: "no", notes: "El tweak es una sola tarea; hoy un pedido que solo pregunta se responde como \"fuera de alcance\"." }),
  // Catálogo
  planned("find_alternatives", "Buscar alternativas", "Devuelve opciones equivalentes a un ejercicio (mismo patrón y rol) sin reemplazarlo.", "catalog", { scope: "read", mcp: "yes" }),
  // Edición básica
  planned("duplicate_item", "Duplicar ejercicio o bloque", "Copia un ítem con ids nuevos justo debajo.", "edit", { mcp: "yes" }),
  planned("group_into_block", "Agrupar en bloque", "Junta ejercicios sueltos en un circuito o superserie.", "edit", { mcp: "yes" }),
  planned("split_block", "Separar bloque", "Saca los ejercicios de un bloque al nivel superior.", "edit", { mcp: "yes" }),
  // Intenciones compuestas
  planned("fit_to_duration", "Ajustar a una duración", "Recorta o amplía descansos y series para acercarse a N minutos.", "compound", { notes: "El estimador de duración vive hoy solo en la web (`lib/ai-routine-diff.ts`, ≈40 s por serie). Falta moverlo a un módulo compartido antes de usarlo en la API." }),
  planned("scale_volume", "Escalar volumen", "Multiplica series o rondas por un factor acotado.", "compound", { notes: "Hoy cubierto en parte por `adjust_difficulty` con palanca de volumen (±1)." }),
  planned("apply_equipment_constraint", "Aplicar restricción de equipo", "Reemplaza todo ejercicio que use un equipo no disponible.", "compound", { execution: "llm", risk: "medium", mcp: "no", notes: "Hoy se logra por el reemplazo individual con exclusiones (`avoid`)." }),
  planned("apply_limitation", "Aplicar limitación o lesión", "Sustituye ejercicios con contraindicaciones para una lesión dada.", "compound", { execution: "llm", risk: "high", mcp: "no", notes: "Requiere decidir cómo se declaran y persisten las limitaciones; no es consejo médico." }),
  planned("convert_rpe_to_percent_rm", "Convertir RPE a % RM", "Cambia cargas RPE a % RM cuando hay RM registrados.", "compound", { mcp: "yes", notes: "Depende de RM por atleta ([rm-atleta.md](rm-atleta.md))." }),
  planned("create_variant", "Crear variante", "Misma estructura y volumen con variantes de los ejercicios principales.", "compound", { execution: "llm", risk: "medium", mcp: "no" }),
  // Cuenta (pensadas para un futuro conector MCP)
  planned("create_routine", "Crear rutina", "Crea una rutina vacía en un equipo.", "account", account),
  planned("duplicate_routine", "Duplicar rutina", "Copia una rutina con ids nuevos.", "account", account),
  planned("rename_routine", "Renombrar rutina", "Cambia el nombre de una rutina.", "account", account),
  planned("list_routines", "Listar rutinas", "Lista las rutinas de un equipo.", "account", { scope: "read", mcp: "yes" }),
  planned("generate_routine", "Generar rutina desde cero", "Genera una rutina completa con IA a partir de objetivo y duración.", "account", { scope: "persist", execution: "llm", risk: "medium", mcp: "no", notes: "Ya existe como generador (`routines.generateWithAI`, flag `ai_generator`), pero fuera del registro." }),
  planned("list_athletes", "Listar atletas", "Lista los atletas de un equipo.", "account", { scope: "read", mcp: "yes", notes: "Datos personales: exige permisos por equipo." }),
  planned("read_athlete_progress", "Leer progreso de un atleta", "Lee RM, marcas y avance de un atleta.", "account", { scope: "read", mcp: "yes", risk: "medium", notes: "Depende del flag `progress`." }),
]
