# Matriz de Pruebas Post-Deploy (10 minutos)

Objetivo: validar rapidamente seguridad, permisos, CORS y flujo funcional en produccion.

## Precondiciones

- Frontend desplegado en Cloudflare Pages.
- Backend desplegado en Railway.
- Variables de entorno cargadas en Railway y Pages.
- Credenciales seed activas:
  - Analista MINERD: analista@minerd.gob.do / Minerd#2026
  - Analista MESCYT: analista@mescyt.gob.do / Mescyt#2026
  - Estudiante: usar cedula existente de la tabla Student seed.

## Matriz

| ID | Tiempo | Escenario | Datos de prueba | Pasos | Resultado esperado |
|---|---:|---|---|---|---|
| T01 | 1 min | Login Analista MINERD valido | Rol: Analista MINERD, correo: analista@minerd.gob.do, pass correcta | Iniciar sesion desde login analista | 200 OK, token JWT, acceso a panel analista sin 403 |
| T02 | 1 min | Login Analista MINERD dominio invalido | Rol: Analista MINERD, correo: analista@mescyt.gob.do | Intentar login | 400 BadRequest con mensaje de dominio requerido @minerd.gob.do |
| T03 | 1 min | Login Analista MESCYT valido | Rol: Analista MESCYT, correo: analista@mescyt.gob.do, pass correcta | Iniciar sesion | 200 OK, token JWT, acceso a reportes/datos sin 403 |
| T04 | 1 min | Login Analista MESCYT dominio invalido | Rol: Analista MESCYT, correo: analista@minerd.gob.do | Intentar login | 400 BadRequest con mensaje de dominio requerido @mescyt.gob.do |
| T05 | 1 min | Login Estudiante valido | Rol: Estudiante, cedula existente | Iniciar sesion | 200 OK, token JWT, acceso al portal estudiantil |
| T06 | 1 min | CRUD expediente con Analista | Crear, editar y eliminar un expediente | Desde Gestion/Formulario ejecutar C, U y D | Operaciones exitosas, sin 403 ni 401 |
| T07 | 1 min | Permisos por rol (403 esperado) | Usuario Estudiante autenticado | Intentar endpoint de analistas (AllExampleData o Reportes) | 403 Forbidden (control de acceso correcto) |
| T08 | 1 min | Perfil y pensum Estudiante | Estudiante autenticado | Abrir tabs Mi Perfil y Mi Pensum | Datos visibles, sin errores de carga |
| T09 | 1 min | Conectividad CORS Frontend -> API | App en Pages consumiendo API Railway | Recargar app, ejecutar login y consulta de datos | Sin bloqueos CORS en navegador, requests exitosos |
| T10 | 1 min | Auditoria de eventos | Ejecutar login + CRUD analista | Abrir modulo de auditoria | Se registran eventos de login y acciones criticas (crear/editar/eliminar) |

## Criterio de salida

- Aprobado si T01-T10 cumplen exactamente el resultado esperado.
- Si falla T09, revisar CORS_ALLOWED_ORIGINS en Railway.
- Si falla T01/T03 por 403, validar claim de rol y atributo Authorize en controladores.
