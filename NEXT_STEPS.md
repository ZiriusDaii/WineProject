# WineSpa — Plan de lo que sigue

_Actualizado 2026-07-08. Estado tras mergear PRs #17–#21 a `develop`._

## Ya hecho (mergeado a `develop`)

- Pipeline CI/CD (GitHub Actions) + Dockerfile del backend.
- Issue #7 (Visual bugs — navbar/botón Volver): **PR #13**.
- Issue #3 (Perfil manicura — mes fijo, citas que no cargan, subida de foto): **PR #15**. De paso arregló el avatar en Admin > Staff y en el portal del cliente.
- Límites de inputs en login/reserva (teléfono, nombre, usuario, contraseña): **PR #16**.
- Issue #10 (páginas legales — Términos, Privacidad, Cancelación, placeholder): **PR #17**.
- Issue #6 punto 3 (direcciones + teléfono de las 3 sedes reales en el landing): **PR #18**. Faltan los puntos 1 y 2 (ver abajo).
- Bug real: cancelar/reprogramar cita no persistía (`PUT /api/appointments/:id` no existía): **PR #19**.
- Issue #11 puntos 2 y 5 (pizarra de citas del admin no mostraba datos, CMS del landing roto en 3 puntos de ruta/payload distintos): **PR #20**.
- Chore: aprobar postinstall scripts de Prisma/esbuild para que `npm install` funcione sin pasos manuales: **PR #21**.
- Servicio inapropiado ("Blowjob") borrado de la base de datos.

## Pendiente inmediato (housekeeping)

- [ ] Cerrar manualmente issues #3, #7 y #10 en GitHub (el auto-close de `Closes #N` no aplica porque los PRs mergean a `develop`, no a la rama default `main`).
- [ ] Conseguir rol admin/maintain en el repo para crear el ruleset de protección de `main`/`staging`/`develop` (deletion + PR requerido). Configuración ya lista, falta el permiso.
- [ ] Limpiar los archivos de rutas muertos (`auth.routes.ts`, `client.routes.ts`, `admin.routes.ts`, `landing.routes.ts` en `backend/src/routes/`) — no se importan en `index.ts`, todo el ruteo real vive en `api.routes.ts`.

## Issues abiertos, con su alcance real (texto de GitHub) y qué falta

1. **#5 Agendamiento** — parcialmente resuelto
   - ~~Cancelar/reprogramar no persistía~~ → arreglado en PR #19 (no era parte del texto original del issue, pero bloqueaba probarlo).
   - Punto 1 del issue ("agendamientos previos deben verse reflejados para no poner dos citas en el mismo horario"): el backend ya soporta `GET /api/appointments?date=&manicuristId=` devolviendo los slots ocupados, pero **el frontend de reserva todavía no lo consume** — falta deshabilitar/tachar horarios ocupados en el selector de hora.
   - Punto 2 ("ajustar horas disponibles según horario del local y disponibilidad"): no empezado.

2. **#11 Perfil admin** — parcialmente resuelto, con sub-issue #12
   - ~~Punto 2, pizarra de citas no mostraba datos~~ → arreglado en PR #20 (mismo patrón `serviceIds`/`clientName` vs `services`/`client.name` de siempre).
   - ~~Punto 5, CMS no dejaba montar imagen~~ → arreglado en PR #20 (eran 3 bugs de ruta/payload distintos, no uno).
   - Punto 1 (estadísticas): no hay datos reales todavía para verificar que el módulo funcione — depende de que existan citas reales en la BD.
   - Punto 3 (Staff): organización por sedes (depende de #6 puntos 1-2), corrección de tipografía en "Staff", orden semanal de las jornadas (hoy están por orden de asignación, no Lunes-a-Domingo). La imagen de trabajadores ya se arregló en PR #15.
   - Punto 4 (Base de clientes): falta mostrar las citas de cada cliente y si tiene una pendiente.

3. **#6 Agregar opciones para diferentes sedes** — parcialmente resuelto
   - ~~Punto 3, direcciones en pantalla principal~~ → arreglado en PR #18 (con teléfono placeholder, pendiente el número real).
   - Punto 1 (cambiar de sede al agendar) y punto 2 (trabajadores por sede): no empezado. Requiere modelo `Sede`/`Location` nuevo en Prisma, relación con `User` (manicurista) y con `Appointment`, más UI de selección en el flujo de reserva y en Admin > Staff.

4. **#4 Corregir imágenes** (help wanted) — no empezado
   - Cambiar imágenes de los servicios ofrecidos (necesita assets reales del negocio).
   - Arreglar descripciones repetidas en pantalla principal.

5. **#8 Ajuste de parámetros del negocio** — no empezado, texto del issue no revisado en detalle todavía.

6. **#12** — sub-issue de #11, no revisado en detalle todavía.

7. **#9 AUDITORÍA DE SEGURIDAD** — dejar para el final, después de estabilizar funcionalidad
   - Hallazgo confirmado: `User.password` se guarda en texto plano, sin hash. Corregirlo implica migrar a bcrypt/argon2 y forzar reset de las contraseñas existentes.

## Notas de proceso

- Cada fix va en su propia rama `bugfix/*` o `feature/*` desde `develop`, con su propio PR — no mezclar issues distintos en la misma rama.
- Si dos ramas tocan las mismas líneas de un archivo (pasó con #17 y #18 en el footer de `App.tsx`), se resuelve con un rebase de la segunda sobre `develop` ya actualizado, no a mano en la UI de GitHub.
- Docker: el contenedor `winespa_backend` tiene `restart: always` y se revive solo si Docker Desktop reinicia — pararlo (`docker compose stop backend`) antes de correr el backend en local con hot-reload, si no compite por el puerto 3000.
- Antes de dar un bug por corregido, probarlo contra datos reales (curl al backend con la base real, no solo `tsc` limpio) — varios de los bugs de este documento eran mismatches de forma entre frontend y backend que typecheck no detecta porque las respuestas de `fetch` son `any`.
