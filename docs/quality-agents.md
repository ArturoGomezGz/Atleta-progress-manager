# Quality agents

Este repositorio incluye agentes de calidad orientados a:

- logging estructurado y rastreable
- manejo de errores
- detección de huecos de pruebas unitarias

## Agentes disponibles

1. **logging-audit**  
   Detecta `console.*` y patrones de error async no trazables.

2. **error-flow-audit**  
   Detecta non-null assertions riesgosas y respuestas 500 con error crudo.

3. **unit-test-gap-finder**  
   Detecta módulos críticos sin pruebas `.test`/`.spec`.

4. **quality-orchestrator (`run-all`)**  
   Ejecuta todos los agentes, consolida hallazgos y genera resumen.

## Ejecutar localmente

Desde la raíz:

```bash
pnpm qa:agents
```

Comandos individuales:

```bash
pnpm qa:agent:logging
pnpm qa:agent:errors
pnpm qa:agent:tests
```

Los reportes se guardan en `.quality-reports/`.

## Ejecutar en GitHub Actions

Workflow:

- `.github/workflows/quality-agents.yml`

Triggers:

- `pull_request`
- `workflow_dispatch` (manual)
- `schedule` (diario)

### Modo manual

Al correr por `workflow_dispatch`:

- `strict=true` hace fallar el workflow si hay hallazgos.
- `action_mode=open-issue` crea un issue con el resumen (`summary.md`) cuando hay hallazgos.

### Strict mode en PR/schedule

Para habilitar `strict` fuera de ejecución manual (`pull_request` y `schedule`), define la variable de repositorio:

- `QUALITY_AGENTS_STRICT=true`
