# dev-front — Frontend local con API de Railway Testing

Levanta solo el servidor de Next.js apuntando a la API de Railway Testing.
Útil para iterar estilos y cambios de UI con hot reload sin levantar nada más.

> **Limitación importante:** Solo sirve para cambios de frontend.
> Cualquier cambio en el backend (API, DB) requiere hacer commit y esperar
> el deploy en Railway Testing para que sea visible aquí.

---

## Pasos que debes seguir

### 1. URL de la API de testing

La URL de la API de Railway Testing ya está configurada. Usa directamente:

```
NEXT_PUBLIC_API_URL=https://api-testing-c8b5.up.railway.app
```

No hace falta pedirle nada al usuario — ya está validada y funcionando.

### 2. Verificar que no hay un servidor corriendo

Ejecuta este comando para verificar que el puerto 3000 no está ocupado:

```powershell
netstat -ano | findstr ":3000"
```

Si hay algo en el puerto 3000, informa al usuario e identifica el proceso (PID)
para que pueda detenerlo con `Stop-Process -Id <PID> -Force` si lo desea.

### 3. Levantar el servidor

Usa el siguiente comando. Reemplaza `<URL_TESTING>` con la URL real:

```powershell
$env:NEXT_PUBLIC_API_URL="https://api-testing-c8b5.up.railway.app"; pnpm --filter @atleta/web dev
```

Este comando:
- Inyecta la URL de la API solo para esta sesión de terminal (no modifica ningún archivo)
- Levanta Next.js en modo dev con hot reload en http://localhost:3000
- No levanta la API ni la DB local — todo el backend viene de Railway

Ejecuta el comando en **background** con `run_in_background: true` y notifica
al usuario que el servidor está iniciando. Espera la confirmación de que Next.js
está listo (línea `✓ Ready in` en el output) antes de dar instrucciones de uso.

### 4. Confirmar que está corriendo

Cuando el servidor esté listo, informa al usuario:
- URL local: http://localhost:3000
- API apuntando a: `https://api-testing-c8b5.up.railway.app`
- Hot reload activo — los cambios en `apps/web/src/` se reflejan al guardar

### 5. Cómo detener el servidor

Para detener el servidor hay dos opciones:

**Opción A — Desde la terminal donde corre:**
```
Ctrl + C
```

**Opción B — Desde otra terminal (si perdiste el proceso):**
```powershell
# Encuentra el PID del proceso en el puerto 3000
netstat -ano | findstr ":3000"

# Mata el proceso usando el PID encontrado
Stop-Process -Id <PID> -Force
```

---

## Recordatorio de flujo de trabajo

| Cambio | ¿Se ve con dev-front? |
|--------|----------------------|
| Estilos, colores, layout | Sí, instantáneo |
| Componentes React, lógica UI | Sí, con hot reload |
| Nuevo endpoint en la API | No — requiere commit + deploy |
| Cambio en esquema de DB | No — requiere commit + deploy |
| Nueva query/mutation tRPC | No — requiere commit + deploy |
