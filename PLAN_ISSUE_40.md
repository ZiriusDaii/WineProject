# Plan de Trabajo — Issue #40 (FIXES) — v2

_Fecha: 2026-07-11 | Rama base: `develop`_

Este plan reemplaza `PLAN_ISSUE_40.md` v1 tras feedback del compa (Samuel) sobre el plan original de DeepSeek. Cambios de fondo respecto a v1:

- **Sedes se elimina de `develop`**, pero como trabajo independiente (rama propia, PR propio), no mezclado con las otras 8 tareas. Antes de borrar nada, se crea una rama de respaldo (`archive/sedes`) con el estado actual, por si se quiere retomar el concepto más adelante — así "muere" en la rama principal pero no se pierde el código.
- Se aclara el alcance real del calendario (punto 2): landing principal, perfil de usuario, booking, reprogramación **y** una vista nueva de calendario para el admin.
- El código de descuento (punto 4) cambia de "input siempre visible" a "botón que revela el campo" (patrón Temu/Amazon).
- Categorías de servicios pasan a ser administrables (hoy es un array hardcodeado `CATEGORIES` en el frontend, sin gestión ni validación de duplicados).
- Landing de servicios (punto 8) necesita una animación/transición al pasar a la vista dedicada, no solo un link plano.
- Se agregan dos tareas de verificación que no estaban en v1: CMS de anuncios (falta visibilidad del botón "Editar" en ciertos casos) e imágenes (avatar de manicurista, servicios, anuncios).

---

## 1. Agendamiento mobile por pasos

**Problema:** En mobile el flujo de reserva muestra todos los pasos juntos (servicios, especialista, fecha/hora). Debe ser wizard paso a paso.

**Archivos:** `frontend/src/App.tsx` (booking flow, ~línea 1200-1440)

**Tareas:**
- [ ] 1.1 Agregar estado `bookingMobileStep` (1 = servicios, 2 = especialista, 3 = fecha/hora, 4 = confirmar) — ya no hay paso de sede
- [ ] 1.2 Detectar `window.innerWidth < 768` para activar modo pasos
- [ ] 1.3 Renderizar solo el paso actual en mobile, con botones "Siguiente" / "Anterior"
- [ ] 1.4 Barra de progreso visual (dots o steps indicator)
- [ ] 1.5 Mantener el resumen visible en un drawer inferior fijo (ver tarea 3.5)

**Estimado:** 3h

**Rama sugerida:** `feature/issue-40-booking-mobile-steps`

---

## 2. Calendario bonito para seleccionar fecha

**Problema:** El input `type="date"` nativo es feo y poco accesible. Debe ser un calendario visual con días disponibles resaltados.

**Alcance real (aclarado):** no es solo el booking. Aplica a:
- Landing principal (si hay algún selector de fecha visible ahí)
- Booking (`frontend/src/App.tsx` ~línea 1286)
- Perfil de usuario (donde el cliente vea/gestione sus citas)
- Reprogramación de citas de la manicurista (`frontend/src/features/manicurista/views/StylistAgenda.tsx` ~línea 971, input `newDateInput`)
- **Nueva vista de calendario para el admin**: mismo componente `DatePicker`, pero en un modo de "vista abierta" (mes completo, todas las citas de todas las manicuristas visibles de un vistazo) para que el admin tenga una perspectiva general, no solo seleccionar un día.

**Nota:** no hay ninguna librería de date-picker instalada (`react-datepicker`, `flatpickr`, `react-day-picker`, `date-fns`, `dayjs` — verificado en `package.json`). Construir el componente a mano es correcto; no evaluar instalar una dependencia nueva para esto.

**Tareas:**
- [ ] 2.1 Crear componente base `DatePicker.tsx` en `frontend/src/components/` (cuadrícula de mes, navegación anterior/siguiente, días pasados deshabilitados, días con horarios libres resaltados en verde)
- [ ] 2.2 Al clickear un día, mostrar los horarios disponibles debajo
- [ ] 2.3 Reemplazar `<input type="date">` en booking (App.tsx) y en reprogramación (StylistAgenda.tsx)
- [ ] 2.4 Integrar el mismo componente donde el cliente vea sus citas (perfil de usuario)
- [ ] 2.5 Crear variante/modo "vista admin": mismo `DatePicker` con prop de modo `overview` que muestra densidad de citas por día (ej. contador o badges) en vez de solo disponibilidad — agregar como pestaña nueva o sección en `AdminDashboard.tsx`
- [ ] 2.6 Estilo consistente con la paleta WineSpa (bordós, dorados, crema) en las dos variantes

**Estimado:** 5.5h (subió de 4h por la vista admin y perfil de usuario)

**Rama sugerida:** `feature/issue-40-calendario`

---

## 3. Sidebar de resumen en desktop

**Problema:** El resumen del agendamiento (total, descuento, confirmar) está abajo en desktop. Debe estar en el sidebar izquierdo visible siempre.

**Archivos:** `frontend/src/App.tsx` (~línea 1131-1395)

**Nota de diseño:** el resumen debe verse cuidado (tipografía, espaciado, jerarquía visual clara) pero sin sobrecargarlo de elementos — nada "arcaico"/genérico. Revisar con la skill de diseño frontend antes de dar por cerrada esta tarea.

**Tareas:**
- [ ] 3.1 Mover la sección de resumen (total, código descuento, botón confirmar) al `<aside>` izquierdo
- [ ] 3.2 El aside ya muestra la especialista seleccionada — agregar servicios seleccionados con precios
- [ ] 3.3 Mostrar total calculado con descuento aplicado en tiempo real
- [ ] 3.4 El aside debe ser sticky y visible durante todo el flujo
- [ ] 3.5 En mobile, el resumen va en el drawer inferior (ya existe, verificar que funcione con el wizard de la tarea 1)

**Estimado:** 2h

**Rama sugerida:** `feature/issue-40-booking-sidebar`

---

## 4. Código de descuento — de input directo a botón revelador

**Problema:** El input de código de descuento se ve mal / siempre visible ocupando espacio.

**Cambio de UX (aclarado):** no debe salir como campo de texto directo por defecto. Debe ser un botón tipo "¿Tienes un código de descuento?" que, al clickear, revela el input + botón "Aplicar" (patrón Temu/Amazon).

**Archivos:** `frontend/src/App.tsx` (dentro del sidebar de la tarea 3, ~línea 1326-1332 desktop, ~línea 1430-1433 mobile)

**Tareas:**
- [ ] 4.1 Reemplazar el input siempre-visible por un botón/link discreto que despliega el campo al clickear
- [ ] 4.2 Al desplegarse: input + botón "Aplicar", con animación simple de apertura
- [ ] 4.3 Feedback visual claro: ✅ aplicado (verde) o ❌ inválido (rojo)
- [ ] 4.4 Si hay descuento aplicado, mostrar precio original tachado + precio final, y dejar el campo desplegado/aplicado (no se vuelve a colapsar)
- [ ] 4.5 El código debe persistir al cambiar entre pasos en mobile
- [ ] 4.6 Mismo patrón en desktop (sidebar) y mobile (drawer)

**Estimado:** 2h (subió de 1.5h por el rediseño de interacción)

**Rama sugerida:** `feature/issue-40-discount-fix`

---

## 5. Pizarra de Citas — mobile responsive

**Problema:** La tabla de citas en desktop funciona bien. En mobile es ilegible (tabla horizontal, obliga a deslizar).

**Archivos:** `frontend/src/features/admin/views/AdminDashboard.tsx` (tabla ~línea 508-534, búsqueda/header ~503-507)

**Tareas:**
- [ ] 5.1 En mobile (< 768px), reemplazar `<table>` por cards apiladas — **no debe requerir scroll horizontal**, esa es la queja concreta a resolver
- [ ] 5.2 Cada card muestra: #cita, cliente, especialista, fecha/hora, servicios, estado, botones de acción
- [ ] 5.3 Estados con colores visibles (badges)
- [ ] 5.4 Botones de acción (Iniciar, Completar, Cancelar) accesibles con tap targets grandes
- [ ] 5.5 Búsqueda y paginación responsive

**Estimado:** 2.5h

**Rama sugerida:** `feature/issue-40-pizarra-mobile`

---

## 6. Staff — formulario colapsable, nombre "Manicuristas", paginación, búsqueda, categorías administrables

**Problema:** El formulario de crear/editar manicurista ocupa media pantalla siempre (debe ir detrás de un botón). El tab dice "Especialistas" y debe decir "Manicuristas". Falta paginación y buscador. Además, las categorías de servicios hoy son un array fijo en el código (`CATEGORIES` en `AdminDashboard.tsx:101`), sin gestión desde el admin ni validación de duplicados.

**Nota:** el campo `sedeId`/selector de sede que aparecía en este formulario **se deja tal cual por ahora** — no se toca en esta tarea, sedes queda fuera de este plan.

**Archivos:** `frontend/src/features/admin/views/AdminDashboard.tsx` (tab config ~línea 425-426, formulario manicurista ~línea 539-575, `CATEGORIES` línea 101, formulario servicio ~línea 653)

**Tareas — manicuristas:**
- [ ] 6.1 Cambiar etiqueta del tab de "Especialistas" a "Manicuristas"
- [ ] 6.2 El formulario de nueva/editar manicurista se oculta por defecto. Botón "Nueva Manicurista" lo muestra (mismo patrón "botón que revela" que la tarea 4)
- [ ] 6.3 Al editar una existente, el formulario se abre y se llena con sus datos
- [ ] 6.4 Agregar buscador por nombre/usuario en la lista
- [ ] 6.5 Paginación de 5 items por página con controles
- [ ] 6.6 Mostrar avatar, nombre, usuario, edad, botón editar (sede se mantiene tal cual, sin cambios)

**Tareas — categorías de servicios (nuevo, backend + frontend):**
- [ ] 6.7 Backend: crear tabla/modelo mínimo `ServiceCategory` (id, name) en `schema.prisma`, o alternativa más simple: endpoint que devuelva/gestione la lista de categorías distintas ya en uso — decidir en implementación cuál requiere menos migración
- [ ] 6.8 Endpoint admin para crear/renombrar categorías (`POST`/`PATCH /admin/categories`)
- [ ] 6.9 En el formulario de servicio, botón "Categorías" que abre un panel simple para agregar/renombrar categorías (reemplaza el array hardcodeado `CATEGORIES`)
- [ ] 6.10 Validación: no permitir dos servicios con el **mismo nombre** dentro de la **misma categoría** (bug actual: no hay ningún chequeo de duplicados al crear/editar servicio) — validar en `createService`/`updateService` en `admin.controller.ts`
- [ ] 6.11 Mismo patrón de formulario colapsable ("botón que revela") también para el formulario de servicios, si no lo tiene ya

**Estimado:** 5h (subió de 2h por la gestión de categorías)

**Rama sugerida:** `feature/issue-40-staff-categories`

---

## 7. Descuentos — rango de duración + atributos nuevos usuarios

**Problema:** El modelo `SpecialOffer` no tiene campo de vigencia/duración ni atributo para nuevos usuarios. (Confirmado: el modelo actual solo tiene `title, description, discountPercentage, code, isActive` — sin fechas de vigencia ni `newUsersOnly`.)

**Tareas backend:**
- [ ] 7.1 Agregar a `SpecialOffer` en `schema.prisma`: `validFrom DateTime?`, `validUntil DateTime?`, `newUsersOnly Boolean @default(false)` — campos opcionales, no obligatorios (así lo pide el issue)
- [ ] 7.2 `npx prisma db push` + `npx prisma generate`
- [ ] 7.3 Actualizar `createSpecialOffer` y `updateSpecialOffer` en `admin.controller.ts` para aceptar los nuevos campos
- [ ] 7.4 Modificar `validateOfferCode` en `client.controller.ts` para verificar vigencia y restricción de nuevos usuarios

**Tareas frontend:**
- [ ] 7.5 AdminDashboard: formulario de ofertas con campos nuevos (fecha inicio, fecha fin — usar el `DatePicker` de la tarea 2 si ya está listo, si no, input date nativo temporalmente; checkbox "Solo nuevos usuarios")
- [ ] 7.6 Mostrar estado de vigencia en la lista (vigente, expirada, programada)
- [ ] 7.7 Booking: si el código es solo para nuevos usuarios, verificar que el cliente no tenga citas previas

**Estimado:** 3h

**Rama sugerida:** `feature/issue-40-offers-duration`

---

## 8. Landing — vista separada para servicios, con transición animada

**Problema:** Los servicios se muestran en la landing en un grid largo. Si hay muchos, la página se hace interminable. Debe haber una vista dedicada, accesible con una transición vistosa (no un link plano).

**Archivos:** `frontend/src/App.tsx` (grid de servicios en landing ~línea 1129-1242)

**Tareas:**
- [ ] 8.1 Agregar estado `view = 'servicesCatalog'`
- [ ] 8.2 En la landing, mostrar solo 3-4 servicios destacados con botón "Ver todos los servicios"
- [ ] 8.3 El botón dispara una animación de transición (ej. fade/slide de la sección landing hacia la vista catálogo) al cambiar de vista — no un salto seco
- [ ] 8.4 Crear vista `servicesCatalog`: grid completo con filtro por categoría (reutiliza las categorías administrables de la tarea 6), búsqueda
- [ ] 8.5 Cada servicio muestra: imagen (si tiene), nombre, descripción corta, precio, duración
- [ ] 8.6 Botón "Reservar" en cada servicio que redirige al booking con ese servicio preseleccionado
- [ ] 8.7 Navegación: breadcrumb o botón volver a la landing (con la misma transición inversa)

**Estimado:** 3.5h (subió de 3h por la animación)

**Rama sugerida:** `feature/issue-40-services-catalog`

---

## 9. Verificación — CMS de anuncios, imágenes, secciones del admin

**Problema reportado:** en el CMS (pestaña "Novedades"/anuncios) no aparece la opción de modificar los anuncios existentes. Además, pidieron verificar que las imágenes funcionen (avatar de manicurista, servicios, anuncios) y que las secciones del admin (Especialistas/Manicuristas, Servicios, Anuncios) funcionen correctamente.

**Diagnóstico ya hecho (código, no en vivo):**
- El botón "Editar" de anuncios **sí existe** en el código (`AdminDashboard.tsx:755`, función `editCms` en línea 356), pero está dentro de un bloque que solo se renderiza `{cmsItems.length > 0 && (...)}` (línea 742). Si `cmsItems` viene vacío (falla silenciosa de `fetchCMS`, o simplemente no hay anuncios cargados en esa sesión/entorno), el bloque entero desaparece y con él el botón — hay que confirmar en vivo cuál de los dos casos es.
- Subida de avatar de manicurista: el endpoint `POST /admin/manicurists/upload-avatar` existe y está enlazado (`api.routes.ts:81`, `client.controller.ts:503`). Falta verificación en vivo end-to-end.

**Tareas:**
- [ ] 9.1 Probar en vivo: pestaña Novedades con al menos un anuncio ya publicado — confirmar que el botón "Editar" aparece y funciona (guardar cambios, cancelar)
- [ ] 9.2 Si no aparece con anuncios existentes: revisar `fetchCMS()` (`AdminDashboard.tsx:343`) y el endpoint `GET /api/landing/content` — ¿devuelve datos?, ¿hay error de red/CORS silencioso?
- [ ] 9.3 Probar en vivo: crear/editar manicurista con imagen de avatar (subida de archivo y por URL si aplica) — confirmar que se guarda y se ve en la lista y en el perfil público
- [ ] 9.4 Probar en vivo: crear/editar servicio con imagen — confirmar que llega al catálogo público (ya verificado en PR #37, solo re-confirmar que sigue funcionando tras los cambios de este plan)
- [ ] 9.5 Recorrer las 3 secciones del admin (Manicuristas, Servicios, Anuncios) tras aplicar las tareas 1-8 y confirmar cero regresiones (crear, editar, eliminar, paginar/buscar donde aplique)

**Estimado:** 1.5h (verificación, no debería requerir código nuevo salvo que 9.2 revele un bug real)

**Rama sugerida:** ejecutar como QA final, no necesita rama propia — o incluir en la rama de la tarea 6 si el bug del CMS resulta ser trivial

---

## 10. ELIMINAR SEDES — limpieza total, en rama independiente 🚨

**Trata como su propio PR, separado de las tareas 1-9.** No bloquea ni depende de ellas (puede correr en paralelo o antes, es indistinto ya que toca zonas de código distintas salvo el formulario de manicuristas de la tarea 6 — coordinar para no pisarse si corren a la vez).

### 10.0 Respaldo antes de borrar

- [ ] 10.0.1 Crear rama `archive/sedes` desde el `develop` actual (antes de cualquier borrado) y pushearla — sirve como snapshot recuperable si se quiere retomar el concepto de sedes más adelante
- [ ] 10.0.2 A partir de ahí, crear `feature/issue-40-remove-sedes` desde `develop` para el trabajo real de borrado

### 10.1 Backend

**Archivos a modificar:**
- [ ] `prisma/schema.prisma`: eliminar modelo `Sede`, eliminar `sedeId` y relación `sede` de `User`
- [ ] `npx prisma db push` (esto **borrará** la tabla `sedes` y la columna `sede_id` de `users` en la base de datos activa — confirmar que no hay datos productivos que se necesiten conservar; si los hay, exportarlos antes)
- [ ] `src/controllers/client.controller.ts`: eliminar `getSedes()`
- [ ] `src/controllers/admin.controller.ts`: eliminar referencias a `sedeId` en `updateManicuristStatus`, `getAdminManicurists` y en el formulario de creación/edición (línea ~285, `sedeId` en el destructuring del body)
- [ ] `src/routes/api.routes.ts`: eliminar `GET /api/sedes`, eliminar import de `getSedes`
- [ ] `prisma/seed.ts`: eliminar `seedSede()`, eliminar llamadas a `seedSede`, eliminar `sedeId` de `seedUser`

### 10.2 Frontend

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
  - Eliminar constante `SEDES` del footer (usar datos de contacto genéricos o vacíos)
- [ ] `frontend/src/features/admin/views/AdminDashboard.tsx`:
  - Eliminar interfaz `Sede`
  - Eliminar estado `sedes`, fetch de sedes en `loadData`
  - Eliminar campo `sedeId`/`manSede` del formulario de manicuristas
  - Eliminar `sedeId` de `handleSaveManicurist` body
  - Eliminar visualización de sede en cards de manicuristas (`getSedeName`)
  - Eliminar `sedes` del `<select>` de sede en el form
- [ ] `frontend/src/features/legal/LegalPages.tsx`: reescribir las referencias a "sede/sedes" en el texto de Términos, Privacidad y Política de Cancelación (contenido de prosa, no basta con borrar — hay que redactar de nuevo esas frases)
- [ ] `README.md`: eliminar la mención a sedes en la documentación de setup/estructura

### 10.3 No tocar a mano

- [ ] `backend/prisma/generated/**` (incluye `models/Sede.ts`, hoy sin commitear) — se regenera solo con `npx prisma generate` / `db push` tras editar el schema, no hay que borrarlo manualmente

### 10.4 Verificación post-limpieza

- [ ] `npx tsc --noEmit` en backend y frontend (debe compilar limpio)
- [ ] `docker compose up -d --build backend` (reconstruir imagen)
- [ ] Probar: booking sin selector de sede, admin sin sede, seed sin sedes
- [ ] Probar: login, servicios, ofertas, CMS — nada debe romperse

**Estimado:** 3h (2.5h de borrado + 0.5h del paso de respaldo)

**Rama sugerida:** `archive/sedes` (respaldo) → `feature/issue-40-remove-sedes` (trabajo real)

---

## Orden recomendado de ejecución

| # | Tarea | Depende de |
|---|---|---|
| 3 | Sidebar resumen desktop | Nada |
| 1 | Booking mobile pasos | #3 |
| 4 | Fix código descuento (botón revelador) | #3 |
| 2 | Calendario (booking, perfil, reprogramación, vista admin) | Nada, pero conviene antes de #7 |
| 5 | Pizarra mobile | Nada |
| 6 | Staff overhaul + categorías | Nada, pero conviene antes de #8 |
| 7 | Descuentos duración | Idealmente después de #2 (reutiliza DatePicker) |
| 8 | Landing catálogo servicios | Idealmente después de #6 (reutiliza categorías) |
| 9 | Verificación CMS/imágenes/admin | Al final, después de 1-8 |
| 10 | Eliminar sedes (rama propia) | Independiente — coordinar con #6 si corre en paralelo |

---

## Estimación total

| Tarea | Horas |
|---|---|
| 1. Booking mobile pasos | 3h |
| 2. Calendario (ampliado) | 5.5h |
| 3. Sidebar resumen | 2h |
| 4. Descuento — botón revelador | 2h |
| 5. Pizarra mobile | 2.5h |
| 6. Staff overhaul + categorías | 5h |
| 7. Descuentos duración | 3h |
| 8. Catálogo servicios + animación | 3.5h |
| 9. Verificación CMS/imágenes/admin | 1.5h |
| 10. Eliminar sedes (rama propia) | 3h |
| **Total** | **~31h** |
