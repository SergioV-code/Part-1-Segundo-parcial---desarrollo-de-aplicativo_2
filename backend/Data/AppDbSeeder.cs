using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Data;

public static class AppDbSeeder
{
    public static async Task SeedAsync(SchoolContext context, IPasswordHasher passwordHasher, CancellationToken cancellationToken = default)
    {
        await EnsureUserRoleConstraintAsync(context, cancellationToken);

        var minerdEmail = NormalizeEmail("analista@minerd.gob.do");
        var mescytEmail = NormalizeEmail("analista@mescyt.gob.do");
        var adminEmail = NormalizeEmail(Environment.GetEnvironmentVariable("FALLBACK_ADMIN_EMAIL") ?? "admin@edumetrics.gob.do");
        var minerdPassword = Environment.GetEnvironmentVariable("FALLBACK_MINERD_PASSWORD") ?? "Minerd#2026";
        var mescytPassword = Environment.GetEnvironmentVariable("FALLBACK_MESCYT_PASSWORD") ?? "Mescyt#2026";
        var adminPassword = Environment.GetEnvironmentVariable("FALLBACK_ADMIN_PASSWORD") ?? "Admin#2026";

        await UpsertAnalystUserAsync(
            context,
            passwordHasher,
            role: SystemRoles.AnalistaMinerd,
            displayName: "Analista MINERD",
            institutionalEmail: minerdEmail,
            cedula: "ANL-MINERD-001",
            plainPassword: minerdPassword,
            cancellationToken);

        await UpsertAnalystUserAsync(
            context,
            passwordHasher,
            role: SystemRoles.AnalistaMescyt,
            displayName: "Analista MESCYT",
            institutionalEmail: mescytEmail,
            cedula: "ANL-MESCYT-001",
            plainPassword: mescytPassword,
            cancellationToken);

        await UpsertAnalystUserAsync(
            context,
            passwordHasher,
            role: SystemRoles.Administrador,
            displayName: "Administrador EDUMETRICS",
            institutionalEmail: adminEmail,
            cedula: "ADM-EDR-001",
            plainPassword: adminPassword,
            cancellationToken);

        var now = DateTime.UtcNow;
        var firstNames = new[]
        {
            "Adrian", "Bianca", "Camila", "Dario", "Elisa", "Fabian", "Grecia", "Hector", "Ines", "Julian",
            "Karla", "Leandro", "Mia", "Nadia", "Orlando", "Paula", "Quincy", "Rita", "Samuel", "Tamara",
            "Ulises", "Valeria", "Wendy", "Xavier", "Yadira", "Zoe"
        };

        var lastNames = new[]
        {
            "Arias", "Beltre", "Caceres", "Delgado", "Escobar", "Franco", "Guzman", "Herrera", "Ibarra", "Jimenez",
            "Lora", "Montero", "Navarro", "Ortega", "Pena", "Quinones", "Rojas", "Suero", "Tejada", "Urena",
            "Valdez", "Wong", "Ximenez", "Yepez", "Zamora"
        };

        var centers = new[]
        {
            "Liceo Union Panamericana",
            "Politecnico Loyola",
            "Liceo Ramon Emilio Jimenez",
            "Politecnico Nuestra Senora del Carmen",
            "Liceo Miguel Canela Lazaro",
            "Instituto Tecnico Salesiano",
            "Liceo Juan Pablo Duarte",
            "Politecnico Femenino Nuestra Senora de las Mercedes",
            "Centro Educativo Maria Montez",
            "Escuela Basica Juan Bosch",
        };

        var modalities = new[]
        {
            "Modalidad Academica",
            "Modalidad Tecnico Profesional",
            "Modalidad Primaria",
        };

        var districts = new[] { "01-01", "02-03", "03-02", "04-01", "05-01", "06-02", "07-01", "08-03", "09-02", "10-01" };

        var currentStudentCount = await context.Students.CountAsync(cancellationToken);
        if (currentStudentCount < 50)
        {
            var students = Enumerable.Range(currentStudentCount + 1, 50 - currentStudentCount).Select(i => new Student
            {
                Nombre = $"{firstNames[(i - 1) % firstNames.Length]} {lastNames[(i * 3) % lastNames.Length]}",
                Cedula = $"001-{i:0000000}-{i % 10}",
                Rne = $"RNE-SEED-{i:0000}",
                CentroEducativo = centers[(i - 1) % centers.Length],
                ModalidadAcademica = modalities[(i - 1) % modalities.Length],
                DistritoEducativo = districts[(i - 1) % districts.Length],
                Estado = "Regular",
                TasaAsistencia = 78 + (i % 22),
                PromedioGeneral = 68 + (i % 30),
                EstadoBecaMescyt = "No Aplica",
                ProtocoloArquitectura = "Sincronizacion pendiente",
                FechaCreacion = now,
                FechaActualizacion = now
            });

            context.Students.AddRange(students);
        }

        // Anonimiza y normaliza todos los registros existentes para consistencia en ambientes de prueba.
        var allStudents = await context.Students
            .OrderBy(s => s.Id)
            .ToListAsync(cancellationToken);

        for (var index = 0; index < allStudents.Count; index++)
        {
            var student = allStudents[index];
            var sequence = index + 1;

            student.Nombre = $"{firstNames[index % firstNames.Length]} {lastNames[(index * 3) % lastNames.Length]}";
            student.CentroEducativo = centers[index % centers.Length];
            student.ModalidadAcademica = modalities[index % modalities.Length];
            student.DistritoEducativo = districts[index % districts.Length];
            student.Rne = $"RNE-SEED-{sequence:0000}";
            student.Estado = string.IsNullOrWhiteSpace(student.Estado) ? "Regular" : student.Estado;
            student.TasaAsistencia = 78 + (sequence % 22);
            student.PromedioGeneral = 68 + (sequence % 30);
            student.FechaActualizacion = now;
        }

        await context.SaveChangesAsync(cancellationToken);
    }

    private static async Task UpsertAnalystUserAsync(
        SchoolContext context,
        IPasswordHasher passwordHasher,
        string role,
        string displayName,
        string institutionalEmail,
        string cedula,
        string plainPassword,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(institutionalEmail);

        var user = await context.Users.FirstOrDefaultAsync(
            u => u.Rol == role || (u.CorreoInstitucional != null && u.CorreoInstitucional.Trim().ToLower() == normalizedEmail),
            cancellationToken);

        if (user is null)
        {
            context.Users.Add(new User
            {
                NombreCompleto = displayName,
                CorreoInstitucional = normalizedEmail,
                Cedula = cedula,
                PasswordHash = passwordHasher.Hash(plainPassword),
                Rol = role,
                Activo = true
            });

            return;
        }

        user.NombreCompleto = displayName;
        user.CorreoInstitucional = normalizedEmail;
        user.Cedula = cedula;
        user.PasswordHash = passwordHasher.Hash(plainPassword);
        user.Rol = role;
        user.Activo = true;
    }

    private static string NormalizeEmail(string email)
    {
        return (email ?? string.Empty).Trim().ToLowerInvariant();
    }

    private static async Task EnsureUserRoleConstraintAsync(SchoolContext context, CancellationToken cancellationToken)
    {
        const string sql = """
            IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
            BEGIN
                IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Users_Rol')
                BEGIN
                    ALTER TABLE [dbo].[Users] DROP CONSTRAINT [CK_Users_Rol];
                END

                ALTER TABLE [dbo].[Users] WITH NOCHECK
                ADD CONSTRAINT [CK_Users_Rol]
                CHECK ([Rol] IN ('Estudiante', 'Analista MINERD', 'Analista MESCYT', 'Administrador'));
            END
            """;

        await context.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }
}
