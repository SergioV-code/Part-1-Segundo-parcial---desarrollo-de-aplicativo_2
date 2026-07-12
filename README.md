# EDUMETRICS-DR - Plataforma de Telemetría Educativa Dominicana

Sistema integral de gestión de expedientes estudiantiles y telemetría educativa para la República Dominicana, con integración de MINERD (Ministerio de Educación) y MESCYT (Ministerio de Educación Superior).

## 📁 Estructura del Proyecto

```
EDUMETRICS-DR/
├── backend/                    # API REST .NET 8 Core
│   ├── Controllers/
│   ├── Models/
│   ├── Data/
│   ├── Services/
│   ├── Program.cs
│   ├── appsettings.json
│   ├── EDUMETRICS-DR.csproj
│   └── README.md
│
└── frontend/                   # React + Tailwind CSS (próximamente)
    ├── src/
    ├── public/
    ├── package.json
    └── README.md
```

## 🚀 Inicio Rápido

### Backend

```bash
# 1. Navegar a la carpeta backend
cd backend

# 2. Restaurar dependencias
dotnet restore

# 3. Ejecutar en desarrollo
dotnet run --configuration Development

# API disponible en: http://localhost:5123
# Swagger UI: http://localhost:5123
```

### Variables de Entorno Requeridas

```bash
DATABASE_URL=mongodb://localhost:27017/edumetrics
# O para MongoDB Atlas:
DATABASE_URL=mongodb+srv://usuario:contraseña@cluster.mongodb.net/edumetrics
```

## 🏗️ Arquitectura

```
┌─────────────────────────┐
│   React Frontend        │
│ (Tailwind + Lucide)     │
└────────────┬────────────┘
             │ HTTP/REST
┌────────────▼────────────┐
│  ASP.NET Core 8 API     │
│ (Controllers/Services)  │
└────────────┬────────────┘
             │ BSON
┌────────────▼────────────┐
│  MongoDB Database       │
│  (students collection)  │
└─────────────────────────┘
```

## 📡 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/AllExampleData` | Obtener todos los estudiantes |
| POST | `/api/CreateExample` | Crear nuevo estudiante |
| PUT | `/api/ChangeExampleData/{id}` | Actualizar estudiante completo |
| DELETE | `/api/DeleteExample/{id}` | Eliminar estudiante |
| PATCH | `/api/PatchExampleData/{id}` | Actualizar parcialmente |

## 📊 Base de Datos

### Modelo de Estudiante (18 propiedades)

```json
{
  "_id": "ObjectId",
  "nombre": "Mariela Almonte Santana",
  "cedula": "002-1234567-8",
  "rne": "RNE-2024-001",
  "distritoEducativo": "10-01",
  "modalidadAcademica": "General",
  "centroEducativo": "Liceo Rosa Duarte",
  "estado": "Excelente",
  "tasaAsistencia": 98.5,
  "promedioGeneral": 93.8,
  "firmaCriptografica": "sha256:...",
  "estadoBecaMescyt": "Aprobada",
  "protocoloArquitectura": "...",
  "logsSincronizacion": "...",
  "asignaturas": [
    { "nombre": "Matemática", "nota": 95, "estatus": "Aprobado" }
  ],
  "fechaCreacion": "2026-07-10T14:32:00Z",
  "fechaActualizacion": "2026-07-10T14:32:00Z"
}
```

## 🔑 Características Principales

✅ **Autenticación Multi-Rol**
- Estudiante
- MINERD (Ministerio de Educación)
- MESCYT (Ministerio de Educación Superior)

✅ **Gestión de Expedientes**
- Crear, leer, actualizar, eliminar estudiantes
- Visualización de calificaciones
- Historial de sincronización
- Firmas criptográficas SHA-256

✅ **Dashboard Telémétrico**
- Métricas en tiempo real
- Desglose regional
- Roadmap de implementación
- Logs de API

✅ **Interoperabilidad**
- Protocolo agnóstico
- Sincronización con MESCYT
- Alertas automáticas
- Integración SAT

## 🛠️ Tech Stack

### Backend
- **Framework**: ASP.NET Core 8
- **BD**: MongoDB 7.0+
- **API Documentation**: Swagger/OpenAPI
- **Language**: C# 12

### Frontend (Próximamente)
- **Framework**: React 18
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State**: React Hooks

## 📋 Requisitos del Sistema

- **.NET 8 SDK** (mínimo)
- **MongoDB 7.0+** (local o MongoDB Atlas)
- **Node.js 18+** (para frontend)
- **npm 9+** o **yarn**

## 🔐 Seguridad

- CORS configurado
- Validación de entrada
- Autenticación por rol
- Encriptación SHA-256
- Logs de auditoría

## 📖 Documentación

- [Backend README](./backend/README.md)
- [API Documentation](http://localhost:5123/swagger) (en desarrollo)

## 🚢 Deployment

### Producción

```bash
# Backend
cd backend
dotnet publish -c Release -o ./publish
```

### Con Docker

```bash
docker build -f Dockerfile -t edumetrics-dr:1.0 .
docker run -e DATABASE_URL=mongodb://mongo:27017/edumetrics -p 5123:80 edumetrics-dr:1.0
```

## 📝 Variables de Configuración

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | `mongodb://localhost:27017/edumetrics` | Conexión MongoDB |
| `ASPNETCORE_ENVIRONMENT` | `Production` | Entorno de ejecución |
| `ASPNETCORE_URLS` | `http://localhost:5123` | URLs de escucha |

## 🐛 Troubleshooting

### Error: MongoDB Connection Refused

```bash
# Iniciar MongoDB
mongod
```

### Error: Port Already in Use

```bash
# Cambiar puerto
dotnet run --urls "http://localhost:5124"
```

## 📞 Soporte

- 📧 Email: info@edumetrics-dr.gov.do
- 🐛 Issues: [GitHub Issues](./issues)
- 📚 Wiki: [Documentación](./wiki)

## 📄 Licencia

© 2026 EDUMETRICS-DR - Sistema de Telemetría Educativa Dominicana

## 👥 Autores

- Sistema diseñado para MINERD-MESCYT
- Desarrollado con arquitectura agnóstica
- Integración multi-institucional

---

**Versión**: 1.0.0  
**Estado**: Production Ready ✅  
**Última actualización**: 2026-07-10
