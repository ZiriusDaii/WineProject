# Plan de Trabajo — Issue #40 (FIXES)

_Fecha: 2026-07-11 | Rama base: `develop`_

---

## 1. Agendamiento mobile por pasos

**Problema:** En mobile el flujo de reserva muestra todos los pasos juntos (servicios, especialista, fecha/hora). Debe ser wizard paso a paso.

**Archivos:** `frontend/src/App.tsx` (líneas ~1200-1420)

**Tareas:**
- [ ] 1.1 Agregar estado `bookingMobileStep` (1 = sede, 2 = servicios, 3 = especialista, 4 = fecha/hora, 5 = confirmar)
- [ ] 1.2 Detectar `window.innerWidth < 768` para activar modo pasos
- [ ] 1.3 Renderizar solo el paso actual en mobile, con botones "Siguiente" / "Anterior"
- [ ] 1.4 Barra de progreso visual (dots o steps indicator)
- [ ] 1.5 Mantener el resumen visible en un drawer inferior fijo

**Estimado:** 3h

**Rama sugerida:** `feature/issue-40-booking-mobile-steps`

---

## 2. Calendario bonito para seleccionar fecha

**Problema:** El input `type="date"` nativo es feo y poco accesible. Debe ser un calendario visual con días disponibles resaltados.

**Archivos:** `frontend/src/App.tsx` (~línea 1275, ~línea 290)

**Tareas:**
- [ ] 2.1 Crear componente `DatePicker.tsx` en `frontend/src/components/`
- [ ] 2.2 Mostrar cuadrícula de días del mes actual con navegación mes anterior/siguiente
- [ ] 2.3 Días pasados deshabilitados, días con horarios libres resaltados en verde
- [ ] 2.4 Al clickear un día, mostrar los horarios disponibles debajo
- [ ] 2.5 Reemplazar `<input type="date">` en booking y en reprogramación (App.tsx y StylistAgenda.tsx si aplica)
- [ ] 2.6 Estilo consistente con la paleta WineSpa (bordos, dorados, crema)

**Estimado:** 4h

**Rama sugerida:** `feature/issue-40-calendario-booking`

---

## 3. Sidebar de resumen en desktop

**Problema:** El resumen del agendamiento (total, descuento, confirmar) está abajo en desktop. Debe estar en el sidebar izquierdo visible siempre.

**Archivos:** `frontend/src/App.tsx` (~línea 1131-1395)

**Tareas:**
- [ ] 3.1 Mover la sección de resumen (total, código descuento, botón confirmar) al `<aside>` izquierdo
- [ ] 3.2 El aside ya muestra la especialista seleccionada — agregar servicios seleccionados con precios
- [ ] 3.3 Mostrar total calculado con descuento aplicado en tiempo real
- [ ] 3.4 El aside debe ser sticky y visible durante todo el flujo
- [ ] 3.5 En mobile, el resumen va en el drawer inferior (ya existe, verificar que funcione)

**Estimado:** 2h

**Rama sugerida:** `feature/issue-40-booking-sidebar`

---

## 4. Código de descuento — fix visual

**Problema:** El input de código de descuento se ve mal o no aparece correctamente.

**Archivos:** `frontend/src/App.tsx` (~línea 1316-1325, ~línea 1415-1420)

**Tareas:**
- [ ] 4.1 Revisar estilos del input de descuento y botón "Aplicar" en desktop y mobile
- [ ] 4.2 Alinear correctamente en el nuevo layout del sidebar
- [ ] 4.3 Mostrar feedback visual claro: ✅ aplicado (verde) o ❌ inválido (rojo)
- [ ] 4.4 Si hay descuento aplicado, mostrar precio original tachado + precio final
- [ ] 4.5 El código debe persistir al cambiar entre pasos en mobile

**Estimado:** 1.5h

**Rama sugerida:** `feature/issue-40-discount-fix`

---

## 5. Pizarra de Citas — mobile responsive

**Problema:** La tabla de citas en desktop funciona, pero en mobile es ilegible (tabla horizontal).

**Archivos:** `frontend/src/features/admin/views/AdminDashboard.tsx` (~línea 480-560)

**Tareas:**
- [ ] 5.1 En mobile (< 768px), reemplazar `<table>` por cards apiladas
- [ ] 5.2 Cada card muestra: #cita, cliente, especialista, fecha/hora, servicios, estado, botones de acción
- [ ] 5.3 Estados con colores visibles (badges)
- [ ] 5.4 Botones de acción (Iniciar, Completar, Cancelar) accesibles con tap targets grandes
- [ ] 5.5 Búsqueda y paginación responsive

**Estimado:** 2.5h

**Rama sugerida:** `feature/issue-40-pizarra-mobile`

---

## 6. Staff — formulario colapsable, nombre "Manicuristas", paginación, búsqueda

**Problema:** El formulario de crear/editar manicurista ocupa media pantalla siempre. Debe estar oculto detrás de un botón. El tab debe llamarse "Manicuristas". Falta paginación y buscador.

**Archivos:** `frontend/src/features/admin/views/AdminDashboard.tsx` (~línea 440-530)

**Tareas:**
- [ ] 6.1 Cambiar etiqueta del tab de "Especialistas" a "Manicuristas"
- [ ] 6.2 El formulario de nueva/editar manicurista se oculta por defecto. Botón "Nueva Manicurista" lo muestra.
- [ ] 6.3 Al editar una existente, el formulario se abre y se llena con sus datos
- [ ] 6.4 Agregar buscador por nombre/usuario en la lista
- [ ] 6.5 Paginación de 5 items por página con controles
- [ ] 6.6 Mostrar avatar, nombre, usuario, sede (mientras exista), edad, botón editar

**Estimado:** 2h

**Rama sugerida:** `feature/issue-40-staff-overhaul`

---

## 7. Descuentos — rango de duración + atributos nuevos usuarios

**Problema:** El modelo `SpecialOffer` no tiene campo de vigencia/duración ni atributo para nuevos usuarios.

**Tareas backend:**
- [ ] 7.1 Agregar a `SpecialOffer` en `schema.prisma`: `validFrom DateTime?`, `validUntil DateTime?`, `newUsersOnly Boolean @default(false)`
- [ ] 7.2 `npx prisma db push`
- [ ] 7.3 Actualizar `createSpecialOffer` y `updateSpecialOffer` en `admin.controller.ts` para aceptar los nuevos campos
- [ ] 7.4 Modificar `validateOfferCode` en `client.controller.ts` para verificar vigencia y restricción de nuevos usuarios

**Tareas frontend:**
- [ ] 7.5 AdminDashboard: formulario de ofertas con campos nuevos (fecha inicio, fecha fin, checkbox "Solo nuevos usuarios")
- [ ] 7.6 Mostrar estado de vigencia en la lista (vigente, expirada, programada)
- [ ] 7.7 Booking: si el código es solo para nuevos usuarios, verificar que el cliente no tenga citas previas

**Estimado:** 3h

**Rama sugerida:** `feature/issue-40-offers-duration`

---

## 8. Landing — vista separada para servicios

**Problema:** Los servicios se muestran en la landing en un grid. Si hay muchos, la página se hace muy larga. Debe haber una vista dedicada.

**Archivos:** `frontend/src/App.tsx` (~línea 1121-1170)

**Tareas:**
- [ ] 8.1 Agregar estado `view = 'servicesCatalog'` 
- [ ] 8.2 En la landing, mostrar solo 3-4 servicios destacados con botón "Ver todos los servicios"
- [ ] 8.3 Crear vista `servicesCatalog`: grid completo con filtro por categoría, búsqueda
- [ ] 8.4 Cada servicio muestra: imagen (si tiene), nombre, descripción corta, precio, duración
- [ ] 8.5 Botón "Reservar" en cada servicio que redirige al booking con ese servicio preseleccionado
- [ ] 8.6 Navegación: breadcrumb o botón volver a la landing

**Estimado:** 3h

**Rama sugerida:** `feature/issue-40-services-catalog`

---

## 9. ELIMINAR SEDES — limpieza total 🚨

**Problema:** El modelo Sede y toda su infraestructura debe eliminarse completamente del código.

### 9.1 Backend

**Archivos a modificar:**
- [ ] `prisma/schema.prisma`: eliminar modelo `Sede`, eliminar `sedeId` y relación `sede` de `User`
- [ ] `npx prisma db push` (esto **borrará** la tabla `sedes` y la columna `sede_id` de `users`)
- [ ] `src/controllers/client.controller.ts`: eliminar `getSedes()`
- [ ] `src/controllers/admin.controller.ts`: eliminar referencias a `sedeId` en `updateManicuristStatus` y `getAdminManicurists`
- [ ] `src/routes/api.routes.ts`: eliminar `GET /api/sedes`, eliminar import de `getSedes`
- [ ] `prisma/seed.ts`: eliminar `seedSede()`, eliminar llamadas a `seedSede`, eliminar `sedeId` de `seedUser`

### 9.2 Frontend

- [ ] `frontend/src/App.tsx`:
  - Eliminar interfaz `Sede`
  - Eliminar estados `sedes` y `selectedSede`
  - Eliminar `fetch('.../api/sedes')` de `loadData()`
  - Eliminar sección "0. Elige tu Sede" del booking
  - Eliminar filtro `sedeId` de `fetchManicurists`
  - Eliminar `selectedSede` del `useEffect` de manicuristas
  - Eliminar `setSelectedSede` de `handleLogout`
  - Eliminar `sedePhone` de `createAppointment` (usar teléfono default)
  - Eliminar referencia a `sedes` del WhatsApp redirect
- [ ] `frontend/src/features/admin/views/AdminDashboard.tsx`:
  - Eliminar interfaz `Sede`
  - Eliminar estado `sedes`, fetch de sedes en `loadData`
  - Eliminar campo `sedeId` del formulario de manicuristas
  - Eliminar `sedeId` de `handleSaveManicurist` body
  - Eliminar visualización de sede en cards de manicuristas
  - Eliminar `sedes` del `<select>` de sede en el form
- [ ] `frontend/src/App.tsx`: eliminar constante `SEDES` del footer (usar datos de contacto genéricos o vacíos)

### 9.3 Verificación post-limpieza

- [ ] `npx tsc --noEmit` en backend y frontend (debe compilar limpio)
- [ ] `docker compose up -d --build backend` (reconstruir imagen)
- [ ] Probar: booking sin selector de sede, admin sin sede, seed sin sedes
- [ ] Probar: login, servicios, ofertas, CMS — nada debe romperse

**Estimado:** 2.5h

**Rama sugerida:** `feature/issue-40-remove-sedes`

---

## Orden recomendado de ejecución

| # | Tarea | Depende de |
|---|---|---|
| 9 | ELIMINAR SEDES | Nada (va primero para limpiar) |
| 1 | Booking mobile pasos | #9 |
| 2 | Calendario bonito | #9 |
| 3 | Sidebar resumen desktop | #9 |
| 4 | Fix código descuento | #3 |
| 5 | Pizarra mobile | Nada |
| 6 | Staff overhaul | #9 |
| 7 | Descuentos duración | Nada |
| 8 | Landing catálogo servicios | Nada |

---

## Estimación total

| Tarea | Horas |
|---|---|
| 1. Booking mobile pasos | 3h |
| 2. Calendario | 4h |
| 3. Sidebar resumen | 2h |
| 4. Fix descuento | 1.5h |
| 5. Pizarra mobile | 2.5h |
| 6. Staff overhaul | 2h |
| 7. Descuentos duración | 3h |
| 8. Catálogo servicios | 3h |
| 9. Eliminar sedes | 2.5h |
| **Total** | **~23.5h** |
