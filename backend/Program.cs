using System.Text;
using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;
using EDUMETRICS_DR.Filters;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;
using System.Text.Json;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);

var sqlConnection = ResolveSqlConnectionString(builder.Configuration);
// InMemory fallback allowed by default in any environment; disable with ALLOW_INMEMORY_FALLBACK=false
var shouldAllowInMemoryFallback = builder.Configuration.GetValue<bool?>("ALLOW_INMEMORY_FALLBACK") ?? true;
var shouldUseInMemoryDatabase = false;

if (string.IsNullOrWhiteSpace(sqlConnection))
{
    sqlConnection = "Server=localhost,1433;Database=EdumetricsDR_Fallback;User Id=sa;Password=ChangeMe123!;TrustServerCertificate=True;Connection Timeout=5;";
    Console.WriteLine("[Startup Warning] SQLSERVER_CONNECTION_STRING no configurada. Se usará una conexión fallback para mantener la API online.");

    if (shouldAllowInMemoryFallback)
    {
        shouldUseInMemoryDatabase = true;
        Console.WriteLine("[Startup Warning] SQL no configurado en Development. Se habilita EF Core InMemory para continuidad local.");
    }
}
else
{
    Console.WriteLine("[Startup] Cadena de conexión SQL detectada desde variables de entorno/configuración.");

    if (shouldAllowInMemoryFallback)
    {
        var sqlIsReachable = await CanOpenSqlConnectionAsync(sqlConnection);
        if (!sqlIsReachable)
        {
            shouldUseInMemoryDatabase = true;
            Console.WriteLine("[Startup Warning] SQL Server no respondió en Development. Se habilita EF Core InMemory para evitar indisponibilidad local.");
        }
    }
}

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
                 ?? new JwtOptions();

if (string.IsNullOrWhiteSpace(jwtOptions.Key) || jwtOptions.Key.Length < 32)
{
    jwtOptions.Key = "EDUMETRICS_DR_FALLBACK_JWT_KEY_CHANGE_IN_PRODUCTION_2026";
    Console.WriteLine("[Startup Warning] Jwt:Key ausente o inválida. Se usará una clave fallback temporal.");
}

if (string.IsNullOrWhiteSpace(jwtOptions.Issuer))
{
    jwtOptions.Issuer = "EDUMETRICS-DR";
    Console.WriteLine("[Startup Warning] Jwt:Issuer no configurado. Se usará valor por defecto.");
}

if (string.IsNullOrWhiteSpace(jwtOptions.Audience))
{
    jwtOptions.Audience = "EDUMETRICS-DR-CLIENTS";
    Console.WriteLine("[Startup Warning] Jwt:Audience no configurado. Se usará valor por defecto.");
}

if (jwtOptions.ExpirationMinutes <= 0)
{
    jwtOptions.ExpirationMinutes = 120;
    Console.WriteLine("[Startup Warning] Jwt:ExpirationMinutes inválido. Se usará 120 minutos.");
}

builder.Services.Configure<JwtOptions>(options =>
{
    options.Key = jwtOptions.Key;
    options.Issuer = jwtOptions.Issuer;
    options.Audience = jwtOptions.Audience;
    options.ExpirationMinutes = jwtOptions.ExpirationMinutes;
});

if (shouldUseInMemoryDatabase)
{
    builder.Services.AddDbContext<SchoolContext>(options =>
        options.UseInMemoryDatabase("EdumetricsDevInMemory"));
}
else
{
    builder.Services.AddDbContext<SchoolContext>(options =>
        options.UseSqlServer(sqlConnection, sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorNumbersToAdd: null);
            sqlOptions.CommandTimeout(15);
        }));
}

builder.Services.AddScoped<IPasswordHasher, Pbkdf2PasswordHasher>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserManagementService, UserManagementService>();
builder.Services.AddScoped<IScholarshipApplicationService, ScholarshipApplicationService>();
builder.Services.AddScoped<StudentService>();
builder.Services.AddScoped<AuditActionFilter>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
            RoleClaimType = ClaimTypes.Role,
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Headers.ContainsKey("X-User-Role"))
                {
                    context.NoResult();
                    return Task.CompletedTask;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireAdminOrConsultor", policy =>
        policy.RequireRole(SystemRoles.Administrador, SystemRoles.AnalistaMinerd, SystemRoles.AnalistaMescyt));
    options.AddPolicy("RequireAdmin", policy =>
        policy.RequireRole(SystemRoles.Administrador));
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "EDUMETRICS-DR API",
        Version = "v1",
        Description = "API con autenticación JWT, RBAC y auditoría para EDUMETRICS-DR"
    });

    var jwtSecurityScheme = new OpenApiSecurityScheme
    {
        Scheme = "bearer",
        BearerFormat = "JWT",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Description = "Header Authorization usando Bearer token.",
        Reference = new OpenApiReference
        {
            Id = JwtBearerDefaults.AuthenticationScheme,
            Type = ReferenceType.SecurityScheme
        }
    };

    options.AddSecurityDefinition(jwtSecurityScheme.Reference.Id, jwtSecurityScheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { jwtSecurityScheme, Array.Empty<string>() }
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy
            .SetIsOriginAllowed(_ => true)
            .AllowAnyMethod()
            .AllowAnyHeader());
});

var app = builder.Build();
var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
var enableDbBootstrap = builder.Configuration.GetValue<bool?>("ENABLE_DB_BOOTSTRAP")
    ?? true;
var bootstrapTimeoutSeconds = app.Environment.IsProduction() ? 45 : 30;

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

if (enableDbBootstrap)
{
    using var scope = app.Services.CreateScope();
    try
    {
        using var bootstrapCts = new CancellationTokenSource(TimeSpan.FromSeconds(bootstrapTimeoutSeconds));
        var context = scope.ServiceProvider.GetRequiredService<SchoolContext>();

        var canConnect = await context.Database.CanConnectAsync(bootstrapCts.Token);
        if (!canConnect)
        {
            startupLogger.LogWarning("No se pudo conectar a SQL durante bootstrap. La API inicia y reintentará en la siguiente inicialización.");
        }
        else
        {
            await context.Database.EnsureCreatedAsync(bootstrapCts.Token);
            await EnsureScholarshipCareerColumnAsync(context, startupLogger, bootstrapCts.Token);

            var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            await AppDbSeeder.SeedAsync(context, passwordHasher, bootstrapCts.Token);
        }
    }
    catch (OperationCanceledException)
    {
        startupLogger.LogWarning("Bootstrap de base de datos cancelado por timeout ({timeout}s). La API seguirá levantada.", bootstrapTimeoutSeconds);
    }
    catch (Exception ex)
    {
        startupLogger.LogError(ex, "Fallo durante inicialización de base de datos/seed. La API seguirá levantada para diagnóstico.");
    }
}
else
{
    startupLogger.LogInformation("Inicialización de base de datos deshabilitada en startup (ENABLE_DB_BOOTSTRAP=false). La API inicia sin bloquearse por SQL.");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler(handler =>
{
    handler.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var isDatabaseUnavailable = IsDatabaseUnavailable(exception);

        context.Response.StatusCode = isDatabaseUnavailable
            ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        object payload;
        if (isDatabaseUnavailable)
        {
            payload = new
            {
                error = "Servicio temporalmente no disponible.",
                detail = "La base de datos SQL Server no está accesible en este momento. Intenta nuevamente en unos minutos.",
                code = StatusCodes.Status503ServiceUnavailable,
                source = "sql-connectivity"
            };
        }
        else
        {
            payload = new
            {
                error = "Error interno del servidor.",
                detail = exception?.Message,
                code = StatusCodes.Status500InternalServerError
            };
        }

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    });
});

app.UseStatusCodePages(async statusContext =>
{
    var response = statusContext.HttpContext.Response;
    if (response.HasStarted)
    {
        return;
    }

    response.ContentType = "application/json";
    var payload = new { error = $"HTTP {response.StatusCode}" };
    await response.WriteAsync(JsonSerializer.Serialize(payload));
});

if (!app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

app.Use(async (context, next) =>
{
    var origin = context.Request.Headers.Origin.ToString();
    if (!string.IsNullOrWhiteSpace(origin))
    {
        context.Response.Headers["Access-Control-Allow-Origin"] = origin;
        context.Response.Headers["Vary"] = "Origin";
    }
    else
    {
        context.Response.Headers["Access-Control-Allow-Origin"] = "*";
    }

    context.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
    context.Response.Headers["Access-Control-Allow-Headers"] = "Authorization,Content-Type,Accept,Origin,X-Requested-With,X-User-Role";

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    await next();
});

app.UseCors("AllowAll");

app.UseAuthentication();
app.Use(async (context, next) =>
{
    var requestedRole = context.Request.Headers["X-User-Role"].FirstOrDefault();
    if (!string.IsNullOrWhiteSpace(requestedRole))
    {
        var normalizedRole = requestedRole.Trim();
        if (string.Equals(normalizedRole, "Consultor", StringComparison.OrdinalIgnoreCase))
        {
            normalizedRole = SystemRoles.AnalistaMinerd;
        }
        else if (string.Equals(normalizedRole, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            normalizedRole = SystemRoles.Administrador;
        }

        var existingIdentity = context.User.Identity as ClaimsIdentity;
        var claims = new List<Claim>();

        if (existingIdentity is not null)
        {
            claims.AddRange(existingIdentity.Claims.Where(claim => claim.Type != ClaimTypes.Role));
        }

        claims.Add(new Claim(ClaimTypes.Role, normalizedRole));
        var newIdentity = new ClaimsIdentity(claims, "X-User-Role");
        context.User = new ClaimsPrincipal(newIdentity);
    }

    await next();
});
app.UseAuthorization();

app.MapGet("/health", async () =>
{
    var sqlStatus = "unknown";
    var mongoStatus = "unknown";

    try
    {
        using var scope = app.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<SchoolContext>();
        sqlStatus = await context.Database.CanConnectAsync() ? "ok" : "down";
    }
    catch (Exception ex)
    {
        sqlStatus = $"error:{ex.GetType().Name}";
    }

    try
    {
        var mongoUri = Environment.GetEnvironmentVariable("MONGODB_URI")
            ?? builder.Configuration["MONGODB_URI"]
            ?? builder.Configuration["ConnectionStrings:MongoDb"];
        if (!string.IsNullOrWhiteSpace(mongoUri))
        {
            var mongoClient = new MongoClient(mongoUri);
            await mongoClient.GetDatabase("admin").RunCommandAsync((Command<MongoDB.Bson.BsonDocument>)"{ ping: 1 }");
            mongoStatus = "ok";
        }
        else
        {
            mongoStatus = "not-configured";
        }
    }
    catch (Exception ex)
    {
        mongoStatus = $"error:{ex.GetType().Name}";
    }

    return Results.Ok(new
    {
        status = "ok",
        service = "EDUMETRICS-DR API",
        sql = sqlStatus,
        mongo = mongoStatus,
        utc = DateTime.UtcNow
    });
});

app.MapControllers();

if (app.Environment.IsDevelopment())
{
    app.Run();
}
else
{
    app.Run($"http://0.0.0.0:{port}");
}

static string? ResolveSqlConnectionString(IConfiguration configuration)
{
    var candidates = new[]
    {
        Environment.GetEnvironmentVariable("SQLSERVER_CONNECTION_STRING"),
        Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection"),
        configuration["SQLSERVER_CONNECTION_STRING"],
        configuration["ConnectionStrings:DefaultConnection"],
        configuration.GetConnectionString("DefaultConnection"),
    };

    return candidates
        .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))
        ?.Trim();
}

static bool IsDatabaseUnavailable(Exception? exception)
{
    Exception? current = exception;
    while (current is not null)
    {
        if (current is SqlException || current is TimeoutException || current is DbUpdateException)
        {
            return true;
        }

        var message = current.Message?.ToLowerInvariant() ?? string.Empty;
        if (message.Contains("sql server")
            || message.Contains("network-related")
            || message.Contains("server was not found")
            || message.Contains("not accessible")
            || message.Contains("tcp provider")
            || message.Contains("connection timeout")
            || message.Contains("could not open a connection"))
        {
            return true;
        }

        current = current.InnerException;
    }

    return false;
}

static async Task EnsureScholarshipCareerColumnAsync(SchoolContext context, ILogger logger, CancellationToken cancellationToken)
{
    if (!context.Database.IsRelational())
    {
        return;
    }

    const string sql = """
        IF OBJECT_ID(N'[dbo].[ScholarshipApplications]', N'U') IS NOT NULL
        BEGIN
            IF COL_LENGTH('dbo.ScholarshipApplications', 'CareerName') IS NULL
            BEGIN
                ALTER TABLE [dbo].[ScholarshipApplications]
                ADD [CareerName] nvarchar(180) NULL;
            END
        END
        """;

    try
    {
        await context.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "No se pudo asegurar la columna CareerName en ScholarshipApplications durante bootstrap.");
    }
}

static async Task<bool> CanOpenSqlConnectionAsync(string connectionString)
{
    try
    {
        var connectionBuilder = new SqlConnectionStringBuilder(connectionString);
        var timeout = connectionBuilder.ConnectTimeout > 0 ? connectionBuilder.ConnectTimeout : 5;

        var builder = new SqlConnectionStringBuilder(connectionBuilder.ConnectionString)
        {
            ConnectTimeout = Math.Min(5, timeout)
        };

        await using var connection = new SqlConnection(builder.ConnectionString);
        await connection.OpenAsync();
        return true;
    }
    catch
    {
        return false;
    }
}
