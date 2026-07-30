using System.Text;
using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;
using EDUMETRICS_DR.Filters;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

var sqlConnection =
    Environment.GetEnvironmentVariable("SQLSERVER_CONNECTION_STRING")
    ?? builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(sqlConnection))
{
    sqlConnection = "Server=localhost,1433;Database=EdumetricsDR_Fallback;User Id=sa;Password=ChangeMe123!;TrustServerCertificate=True;Connection Timeout=5;";
    Console.WriteLine("[Startup Warning] SQLSERVER_CONNECTION_STRING no configurada. Se usará una conexión fallback para mantener la API online.");
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

builder.Services.AddDbContext<SchoolContext>(options =>
    options.UseSqlServer(sqlConnection));

builder.Services.AddScoped<IPasswordHasher, Pbkdf2PasswordHasher>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAuthService, AuthService>();
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
    });

builder.Services.AddAuthorization();

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
            .AllowAnyOrigin()
            .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .AllowAnyHeader());
});

var app = builder.Build();
var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
var enableDbBootstrap = builder.Configuration.GetValue<bool?>("ENABLE_DB_BOOTSTRAP")
    ?? true;
var bootstrapTimeoutSeconds = app.Environment.IsProduction() ? 8 : 30;

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
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        var payload = new
        {
            error = "Error interno del servidor.",
            detail = exception?.Message
        };

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

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "EDUMETRICS-DR API",
    utc = DateTime.UtcNow
}));

app.MapControllers();

app.Run($"http://0.0.0.0:{port}");
