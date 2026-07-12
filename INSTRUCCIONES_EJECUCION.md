## 🚀 INSTRUCCIONES DE EJECUCIÓN - EDUMETRICS-DR

### ✅ PROYECTO COMPLETAMENTE CREADO E INDEPENDIENTE

Tu proyecto ya está en:  
```
C:\Users\sergi\source\EDUMETRICS-DR\backend\
```

---

## 📋 PASO 1: Verificar Requisitos

Abre PowerShell o CMD y ejecuta:

```bash
# Verificar .NET 8
dotnet --version

# Verificar MongoDB (si lo tienes instalado)
mongod --version
```

**Si no tienes .NET 8**, descárgalo aquí:
👉 https://dotnet.microsoft.com/download/dotnet/8.0

---

## 📦 PASO 2: Navegar al Proyecto

```bash
cd C:\Users\sergi\source\EDUMETRICS-DR\backend
```

---

## 🔧 PASO 3: Restaurar Dependencias

```bash
dotnet restore
```

Esto descargará automáticamente:
- ✅ MongoDB.Driver 2.24.0
- ✅ MongoDB.Bson 2.24.0
- ✅ Swashbuckle.AspNetCore 6.4.6

---

## 🏃 PASO 4: EJECUTAR EL PROYECTO

### Opción A: Desarrollo Local (CON SWAGGER UI)

```bash
dotnet run --configuration Development
```

**Resultado esperado**:
```
Building...
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5123
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to exit.
```

Luego abre en el navegador:
👉 http://localhost:5123

Verás la interfaz Swagger con todos los endpoints documentados.

---

### Opción B: Producción

```bash
dotnet run --configuration Release
```

---

## 📡 PASO 5: PROBAR LOS ENDPOINTS

Con la aplicación corriendo, abre otra terminal y ejecuta:

### Obtener todos los estudiantes
```bash
curl -X GET http://localhost:5123/api/AllExampleData
```

### Crear un nuevo estudiante
```bash
curl -X POST http://localhost:5123/api/CreateExample ^
  -H "Content-Type: application/json" ^
  -d "{\"nombre\":\"Juan Garcia\",\"cedula\":\"002-9876543-1\",\"rne\":\"RNE-2024-006\",\"distritoEducativo\":\"10-01\",\"modalidadAcademica\":\"General\",\"centroEducativo\":\"Liceo Rosa Duarte\"}"
```

---

## ⚙️ CONFIGURACIÓN DE MONGODB

### Opción 1: MongoDB Local (Recomendado para desarrollo)

**1. Instala MongoDB Community:**
👉 https://www.mongodb.com/try/download/community

**2. Inicia MongoDB:**

```bash
# Windows
mongod

# macOS (con Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

**3. Variable de entorno (automática en launchSettings.json):**
```
DATABASE_URL=mongodb://localhost:27017/edumetrics
```

---

### Opción 2: MongoDB Atlas (Nube)

**1. Crea una cuenta en:**
👉 https://www.mongodb.com/cloud/atlas

**2. Obtén la cadena de conexión (connection string):**
```
mongodb+srv://usuario:contraseña@cluster.mongodb.net/edumetrics
```

**3. Configura la variable:**
```bash
# Windows PowerShell
$env:DATABASE_URL="mongodb+srv://usuario:contraseña@cluster.mongodb.net/edumetrics"
dotnet run

# Windows CMD
set DATABASE_URL=mongodb+srv://usuario:contraseña@cluster.mongodb.net/edumetrics
dotnet run
```

---

## 🌐 ACCESO A LA API

### Swagger UI (Documentación Interactiva)
```
http://localhost:5123
```

### Endpoints Disponibles

| Verbo | Ruta | Descripción |
|-------|------|-------------|
| **GET** | `/api/AllExampleData` | Obtener todos los estudiantes |
| **POST** | `/api/CreateExample` | Crear nuevo estudiante |
| **PUT** | `/api/ChangeExampleData/{id}` | Actualizar estudiante |
| **DELETE** | `/api/DeleteExample/{id}` | Eliminar estudiante |
| **PATCH** | `/api/PatchExampleData/{id}` | Actualización parcial |

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### ❌ Error: "MongoDB connection refused"

**Solución:**
```bash
# 1. Inicia MongoDB
mongod

# 2. En otra terminal, corre la API
dotnet run
```

---

### ❌ Error: "Port 5123 already in use"

**Solución:**
```bash
# Usa otro puerto
dotnet run --urls "http://localhost:5124"
```

---

### ❌ Error: "Could not restore packages"

**Solución:**
```bash
# Limpia la caché de NuGet
dotnet nuget locals all --clear

# Intenta de nuevo
dotnet restore
```

---

## 📁 ESTRUCTURA DEL PROYECTO

```
C:\Users\sergi\source\EDUMETRICS-DR\backend\
│
├── Controllers/
│   └── ExampleController.cs         ← 5 endpoints REST
│
├── Models/
│   └── Student.cs                   ← Modelo BSON (18 propiedades)
│
├── Data/
│   └── SchoolContext.cs             ← Contexto MongoDB
│
├── Properties/
│   └── launchSettings.json          ← Config de puertos y variables
│
├── Program.cs                       ← Configuración principal
├── EDUMETRICS-DR.csproj            ← Archivo de proyecto
├── appsettings.json                ← Config producción
├── appsettings.Development.json    ← Config desarrollo
└── README.md                        ← Documentación completa
```

---

## ✅ VERIFICACIÓN FINAL

Una vez ejecutando el proyecto, verifica que:

1. ✅ La consola muestra: `Now listening on: http://localhost:5123`
2. ✅ Abre http://localhost:5123 en el navegador
3. ✅ Ves la interfaz Swagger con documentación
4. ✅ Haz clic en "Try it out" en cualquier endpoint
5. ✅ El endpoint responde con datos

---

## 📝 NOTAS IMPORTANTES

- El proyecto está **completamente separado** de ContosoUniversity
- Estructura lista para **producción**
- Todos los archivos están en: `C:\Users\sergi\source\EDUMETRICS-DR\`
- MongoDB se configura automáticamente desde `DATABASE_URL`
- La carpeta `/backend` contiene el .NET 8 API
- La carpeta `/frontend` está lista para agregar React

---

## 🎯 PRÓXIMOS PASOS

1. **Backend corriendo** ✅ (Haz en este momento)
2. **Frontend React** (Crearé después en `/frontend`)
3. **Integración completa** (Backend + Frontend)
4. **Deployment** a producción

---

¿Listo para ejecutar? Sigue los pasos arriba y ¡la API estará lista! 🚀
