# EDUMETRICS-DR Backend

Plataforma de Telemetría Educativa Dominicana - API REST en .NET 8

## 📋 Descripción

Backend de la plataforma integrada MINERD-MESCYT para gestión de expedientes estudiantiles, telemetría educativa y sincronización de datos entre instituciones del sector educativo dominicano.

## 🏗️ Estructura del Proyecto

```
backend/
├── Controllers/           # Controladores REST API
│   └── ExampleController.cs
├── Models/               # Modelos BSON para MongoDB
│   └── Student.cs
├── Data/                 # Contexto y configuración de datos
│   └── SchoolContext.cs
├── Services/             # Servicios de negocio
├── Properties/           # Configuración de lanzamiento
│   └── launchSettings.json
├── appsettings.json      # Configuración en producción
├── appsettings.Development.json  # Configuración en desarrollo
├── EDUMETRICS-DR.csproj  # Archivo de proyecto
└── Program.cs            # Configuración y entrada de la aplicación
```

## 🚀 Requisitos Previos

- **.NET 8 SDK** - [Descargar](https://dotnet.microsoft.com/download)
- **MongoDB** - [Descargar](https://www.mongodb.com/try/download/community)
  - O usar MongoDB Atlas para una instancia en la nube

## 📦 Dependencias

| Paquete | Versión | Descripción |
|---------|---------|-------------|
| MongoDB.Driver | 2.24.0 | Driver para MongoDB |
| MongoDB.Bson | 2.24.0 | Serialización BSON |
| Swashbuckle.AspNetCore | 6.4.6 | Swagger/OpenAPI |

## ⚙️ Configuración

### 1. Variables de Entorno

```bash
# Windows
set DATABASE_URL=mongodb://localhost:27017/edumetrics

# Linux/macOS
export DATABASE_URL=mongodb://localhost:27017/edumetrics

# MongoDB Atlas
set DATABASE_URL=mongodb+srv://usuario:contraseña@cluster.mongodb.net/edumetrics
```

### 2. Instalar Dependencias

```bash
cd backend
dotnet restore
```

### 3. Compilar el Proyecto

```bash
dotnet build
```

## 🏃 Ejecución

### Modo Desarrollo (con Swagger)

```bash
cd backend
dotnet run --configuration Development
```

La API estará disponible en:
- **HTTP**: http://localhost:5123
- **Swagger UI**: http://localhost:5123

### Modo Producción

```bash
dotnet run --configuration Release
```

## 📡 Endpoints API

### GET /api/AllExampleData
Obtiene la lista completa de estudiantes.

**Respuesta (200 OK)**:
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "nombre": "Mariela Almonte Santana",
    "cedula": "002-1234567-8",
    "rne": "RNE-2024-001",
    "estado": "Excelente",
    ...
  }
]
```

### POST /api/CreateExample
Crea un nuevo registro de estudiante.

**Body**:
```json
{
  "nombre": "Juan García",
  "cedula": "002-9876543-1",
  "rne": "RNE-2024-006",
  "distritoEducativo": "10-01",
  "modalidadAcademica": "General",
  "centroEducativo": "Liceo Rosa Duarte"
}
```

**Respuesta (201 Created)**:
```json
{
  "id": "507f1f77bcf86cd799439012",
  "nombre": "Juan García",
  ...
}
```

### PUT /api/ChangeExampleData/{id}
Reemplaza completamente un registro existente.

**Respuesta**: 204 No Content

### DELETE /api/DeleteExample/{id}
Elimina un registro de estudiante.

**Respuesta**: 204 No Content

### PATCH /api/PatchExampleData/{id}
Actualiza parcialmente un registro.

**Body**:
```json
{
  "estado": "Destacado Técnico",
  "tasaAsistencia": 95.5
}
```

**Respuesta (200 OK)**:
```json
{
  "id": "507f1f77bcf86cd799439011",
  "estado": "Destacado Técnico",
  ...
}
```

## 🔐 CORS

CORS está configurado globalmente permitiendo:
- ✅ Cualquier origen (`*`)
- ✅ Cualquier método (GET, POST, PUT, DELETE, PATCH)
- ✅ Cualquier encabezado

Para producción, considera restringir el origen:

```csharp
options.AddPolicy("AllowFrontend", policy =>
{
    policy.WithOrigins("https://tudominio.com")
          .AllowAnyMethod()
          .AllowAnyHeader();
});
```

## 📊 MongoDB

### Esquema de Colección `students`

```bson
{
  "_id": ObjectId,
  "nombre": String,
  "cedula": String,
  "rne": String (indexed),
  "distritoEducativo": String,
  "modalidadAcademica": String,
  "centroEducativo": String,
  "estado": String,
  "tasaAsistencia": Double,
  "promedioGeneral": Double,
  "firmaCriptografica": String,
  "estadoBecaMescyt": String,
  "protocoloArquitectura": String,
  "logsSincronizacion": String,
  "asignaturas": [
    {
      "nombre": String,
      "nota": Int32,
      "estatus": String
    }
  ],
  "fechaCreacion": ISODate,
  "fechaActualizacion": ISODate
}
```

## 🧪 Testing con cURL

```bash
# Obtener todos los estudiantes
curl -X GET http://localhost:5123/api/AllExampleData

# Crear nuevo estudiante
curl -X POST http://localhost:5123/api/CreateExample \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Ana García",
    "cedula": "002-1111111-1",
    "rne": "RNE-2024-007",
    "distritoEducativo": "10-01",
    "modalidadAcademica": "General",
    "centroEducativo": "Liceo Rosa Duarte"
  }'

# Actualizar parcialmente (PATCH)
curl -X PATCH http://localhost:5123/api/PatchExampleData/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{"estado": "Regular"}'

# Eliminar estudiante
curl -X DELETE http://localhost:5123/api/DeleteExample/507f1f77bcf86cd799439011
```

## 📝 Logging

La aplicación registra automáticamente:
- ✅ Todas las solicitudes a `/api`
- ✅ Operaciones de base de datos
- ✅ Errores y excepciones

Ver logs en tiempo real:
```bash
dotnet run --configuration Development
```

## 🐛 Troubleshooting

### Error: "MongoDB Connection Refused"

```bash
# Iniciar MongoDB localmente
# Windows
mongod

# macOS (con Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### Error: "Port Already in Use"

```bash
# Cambiar puerto en launchSettings.json o usar:
dotnet run --urls "http://localhost:5124"
```

### Error: "Database Authentication Failed"

Asegurar que la URL de conexión incluya credenciales:
```
mongodb+srv://usuario:contraseña@cluster.mongodb.net/nombredb
```

## 📚 Documentación Adicional

- [Documentación MongoDB.Driver](https://www.mongodb.com/docs/drivers/csharp/)
- [Documentación ASP.NET Core](https://learn.microsoft.com/es-es/aspnet/core/)
- [Documentación Swagger](https://swagger.io/)

## 👨‍💻 Desarrollo

### Crear nueva migración (si fuera EF Core)
```bash
dotnet ef migrations add NombreMigracion
```

### Aplicar migraciones
```bash
dotnet ef database update
```

## 📦 Deployment

### Publicar para producción

```bash
dotnet publish -c Release -o ./publish
```

Luego desplegar el contenido de `./publish` en tu servidor.

### Con Docker

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV DATABASE_URL=mongodb://mongo:27017/edumetrics
EXPOSE 80
ENTRYPOINT ["dotnet", "EDUMETRICS-DR.dll"]
```

## 📄 Licencia

Proyecto EDUMETRICS-DR - Sistema de Telemetría Educativa Dominicana

## 👥 Soporte

Para reportar bugs o solicitar features, contactar a: info@edumetrics-dr.gov.do

---

**Versión**: 1.0.0  
**Última actualización**: 2026-07-10  
**Estado**: Production Ready ✅
