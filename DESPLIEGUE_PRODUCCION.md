# Despliegue en Produccion: Railway + Cloudflare Pages

Este documento resume la configuracion recomendada para desplegar EDUMETRICS-DR en produccion.

## 1) Backend (.NET + SQL Server) en Railway

### Archivos ya preparados
- backend/Dockerfile
- backend/Program.cs
- backend/.env.railway.example

### Variables de entorno requeridas en Railway
Configura estas variables en el servicio del backend:

- SQLSERVER_CONNECTION_STRING
- JWT__KEY
- JWT__ISSUER
- JWT__AUDIENCE
- JWT__EXPIRATIONMINUTES
- CORS_ALLOWED_ORIGINS
- ASPNETCORE_ENVIRONMENT=Production

Notas:
- Usa `JWT__...` (doble guion bajo) para mapear la seccion `Jwt` de .NET.
- `CORS_ALLOWED_ORIGINS` acepta multiples origenes separados por `;`.
- Ejemplo de CORS: `https://edumetrics-dr.pages.dev;https://app.tudominio.com`.

### Pasos en Railway
1. Crear nuevo proyecto en Railway y conectar este repositorio.
2. Seleccionar la carpeta `backend` como Root Directory del servicio.
3. Railway detectara el `Dockerfile` y construira la imagen automaticamente.
4. Configurar las variables de entorno listadas arriba.
5. Desplegar.
6. Verificar en logs que la API inicia y escucha en `PORT`.

### Verificacion rapida
- Endpoint salud funcional: `GET https://<tu-backend>.up.railway.app/swagger` (si habilitado en entorno).
- Probar login:
  - `POST /api/Auth/login/estudiante`
  - `POST /api/Auth/login/analista`

## 2) Frontend (React + Vite) en Cloudflare Pages

### Archivos ya preparados
- frontend/.env.production.example
- frontend/package.json

### Build settings en Cloudflare Pages
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `frontend`

### Variable de entorno obligatoria
En Cloudflare Pages (Environment Variables):
- `VITE_API_URL = https://<tu-backend-railway>.up.railway.app`

La app ya normaliza automaticamente esta URL y agrega `/api` cuando corresponde.

### Pasos en Cloudflare Pages
1. Crear proyecto Pages y conectar el repositorio.
2. Definir `Root directory = frontend`.
3. Definir `VITE_API_URL` con la URL publica del backend Railway.
4. Ejecutar deploy.
5. Abrir la URL de Pages y validar login/CRUD/reportes.

## 3) Checklist de salida a produccion

1. Cambiar `JWT__KEY` por una clave robusta real (no usar ejemplos).
2. Confirmar que `CORS_ALLOWED_ORIGINS` solo tenga dominios reales de frontend.
3. Verificar conectividad SQL Server desde Railway.
4. Confirmar que el backend responde con HTTPS publico.
5. Volver a desplegar frontend si cambia la URL de backend.

## 4) Notas tecnicas de esta configuracion

- `Program.cs` ya soporta `PORT` dinamico (requerido por Railway).
- `Dockerfile` expone `8080`, configura `ASPNETCORE_URLS` y forwarded headers.
- CORS es configurable por variable de entorno para no recompilar backend en cambios de dominio.
