# Atleta

Herramienta de seguimiento de progreso deportivo diseñada para entrenadores y atletas. Permite registrar sesiones de evaluación, capturar datos de rendimiento en tiempo real y visualizar el progreso individual de cada atleta.

---

## Descripción general

Atleta centraliza el flujo de trabajo de un entrenador durante una sesión de evaluación: crear una plantilla de rutina, ejecutarla con uno o varios atletas, registrar los datos (ejercicio, series, repeticiones, peso) y consultar el historial de progreso. Los atletas acceden a una vista de solo lectura de su propio progreso.

El proyecto está concebido como un módulo independiente que en el futuro formará parte de un sistema mayor.

---

## Roles y equipos

El acceso está organizado en **equipos**. Cada equipo tiene dos tipos de miembro:

| Rol | Capacidades |
|---|---|
| **Entrenador** | Crear y gestionar rutinas, registrar datos de sesión, modificar rutinas sobre la marcha, ver el progreso de todos los atletas del equipo |
| **Atleta** | Ver únicamente su propio historial y progreso |

Todos los entrenadores dentro de un equipo tienen los mismos permisos; no existe jerarquía entre ellos.

---

## Flujo principal: sesión de evaluación

1. **Crear plantilla** — El entrenador define una rutina con ejercicios, series y repeticiones objetivo antes de la sesión.
2. **Iniciar sesión** — El entrenador arranca la rutina en el momento que considere. Se registra fecha y hora de inicio sin restricciones de horario.
3. **Registrar datos en tiempo real** — La interfaz permite iterar libremente entre atletas para ir llenando los datos de cada serie conforme se ejecuta. El entrenador no está bloqueado a un flujo lineal.
4. **Modificaciones sobre la marcha** — Durante la sesión el entrenador puede:
   - Agregar una serie extra a un atleta
   - Invalidar una serie (se conserva el dato pero no cuenta para el cálculo)
   - Eliminar una serie
   - Cancelar la rutina completa para un atleta específico
5. **Cierre de sesión** — Los datos quedan almacenados y disponibles para consulta histórica.

---

## Visualización de progreso

Cada atleta tiene una vista individual donde se puede consultar su progreso por ejercicio. La métrica principal a desarrollar es el **porcentaje del PR (récord personal)**: qué tan cerca estuvo el atleta de su mejor marca en cada ejercicio durante una sesión.

> El diseño exacto del dashboard y la lógica de procesamiento de datos están pendientes de definición.

---

## Estado del proyecto

| Área | Estado |
|---|---|
| Definición de roles y equipos | Definido |
| Flujo de sesión de evaluación | Definido |
| Catálogo de ejercicios | Pendiente |
| Stack tecnológico | Pendiente |
| Lógica de procesamiento y métricas | Pendiente |
| Diseño de UI/UX | Pendiente |

---

## Pendientes de definición

- **Catálogo de ejercicios**: qué ejercicios estarán disponibles para evaluar y si el entrenador puede crear ejercicios personalizados.
- **Stack tecnológico**: framework frontend, backend y base de datos.
- **Métricas de progreso**: cálculo del PR, tendencias, comparativas entre sesiones.
- **Modelo de datos**: estructura de equipos, usuarios, rutinas, sesiones y series.
