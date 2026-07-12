using MongoDB.Driver;
using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Data;

var builder = WebApplication.CreateBuilder(args);

// ==================== MONGODB CONFIGURATION ====================
var configuredConnectionString = builder.Configuration["MongoDB:ConnectionString"];
var configuredDatabaseName = builder.Configuration["MongoDB:DatabaseName"];

var databaseUrl = Environment.GetEnvironmentVariable("MONGODB_URI");
if (string.IsNullOrWhiteSpace(databaseUrl))
{
    if (!string.IsNullOrWhiteSpace(configuredConnectionString) && !string.IsNullOrWhiteSpace(configuredDatabaseName))
    {
        databaseUrl = $"{configuredConnectionString.TrimEnd('/')}/{configuredDatabaseName}";
    }
    else if (!string.IsNullOrWhiteSpace(configuredConnectionString))
    {
        databaseUrl = configuredConnectionString;
    }
    else
    {
        databaseUrl = "mongodb://localhost:27017/edumetrics";
    }
}

var mongoUrl = new MongoUrl(databaseUrl);
var mongoClient = new MongoClient(mongoUrl);
var databaseName = string.IsNullOrWhiteSpace(mongoUrl.DatabaseName) ? "edumetrics" : mongoUrl.DatabaseName;

builder.Services.AddSingleton<IMongoClient>(mongoClient);
builder.Services.AddSingleton<IMongoDatabase>(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    return client.GetDatabase(databaseName);
});

// Register IMongoCollection<Student> with automatic index creation
builder.Services.AddSingleton<IMongoCollection<Student>>(sp =>
{
    var database = sp.GetRequiredService<IMongoDatabase>();
    var collection = database.GetCollection<Student>("students");
    
    // Create index on Rne field for better query performance
    var indexModel = new CreateIndexModel<Student>(
        Builders<Student>.IndexKeys.Ascending(s => s.Rne)
    );

    try
    {
        collection.Indexes.CreateOne(indexModel);
    }
    catch
    {
        // Si MongoDB no esta disponible al iniciar, evitamos romper la inyeccion de dependencias.
        // El controlador devolvera un 500 controlado cuando intente consultar datos.
    }
    
    return collection;
});

builder.Services.AddSingleton<IMongoCollection<AuditLog>>(sp =>
{
    var database = sp.GetRequiredService<IMongoDatabase>();
    return database.GetCollection<AuditLog>("AuditLogs");
});

// ==================== SERVICES ====================
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "EDUMETRICS-DR API",
        Version = "v1.0",
        Description = "API de Telemetría Educativa Dominicana - Plataforma integrada MINERD-MESCYT",
        Contact = new Microsoft.OpenApi.Models.OpenApiContact
        {
            Name = "EDUMETRICS-DR Team",
            Email = "info@edumetrics-dr.gov.do"
        }
    });
});

// ==================== CORS CONFIGURATION ====================
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigins", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // En desarrollo, permitimos todo para facilitar el debugging
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
        }
        else
        {
            // En producción, permitimos solo los frontends desplegados autorizados
            policy.WithOrigins(
                    "https://resilient-transformation-production.up.railway.app",
                    "https://part-1-segundo-parcial---desarrollo-de-aplicativo-2.pages.dev"
                  )
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        }
    });
});

// ==================== LOGGING ====================
builder.Services.AddLogging(options =>
{
    options.AddConsole();
    options.AddDebug();
});

var app = builder.Build();

// ==================== MIDDLEWARE ====================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "EDUMETRICS-DR API v1.0");
        c.RoutePrefix = string.Empty;
    });
}

app.UseHttpsRedirection();

// Custom logging middleware for API calls
app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    var path = context.Request.Path.Value;
    
    if (path?.StartsWith("/api") == true)
    {
        logger.LogInformation($"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] {context.Request.Method} {path}");
    }
    
    await next();
});

app.UseCors("AllowSpecificOrigins");
app.UseAuthorization();
app.MapControllers();

app.Run();
