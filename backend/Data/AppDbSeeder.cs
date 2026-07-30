using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Data;

public static class AppDbSeeder
{
    public static async Task SeedAsync(SchoolContext context, IPasswordHasher passwordHasher, CancellationToken cancellationToken = default)
    {
        var minerdEmail = NormalizeEmail("analista@minerd.gob.do");
        var mescytEmail = NormalizeEmail("analista@mescyt.gob.do");
        var minerdPassword = Environment.GetEnvironmentVariable("FALLBACK_MINERD_PASSWORD") ?? "Minerd#2026";
        var mescytPassword = Environment.GetEnvironmentVariable("FALLBACK_MESCYT_PASSWORD") ?? "Mescyt#2026";

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

        var currentStudentCount = await context.Students.CountAsync(cancellationToken);
        if (currentStudentCount < 50)
        {
            var now = DateTime.UtcNow;
            var firstNames = new[]
            {
                "Ana", "Carlos", "María", "José", "Luis", "Carmen", "Miguel", "Elena", "David", "Paola",
                "Jorge", "Lucía", "Andrés", "Yolanda", "Pedro", "Noelia", "Rafael", "Sofía", "Manuel", "Gabriela"
            };

            var lastNames = new[]
            {
                "Pérez", "Gómez", "Rodríguez", "Santos", "Reyes", "Martínez", "Fernández", "Núñez", "López", "Castillo",
                "Méndez", "García", "Ramírez", "Torres", "Medina", "Vásquez", "Hernández", "Bautista", "Morillo", "Almonte"
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
            };

            var districts = new[] { "01-01", "02-03", "03-02", "04-01", "05-01", "06-02", "07-01", "08-03", "09-02", "10-01" };

            var students = Enumerable.Range(currentStudentCount + 1, 50 - currentStudentCount).Select(i => new Student
            {
                Nombre = $"{firstNames[(i - 1) % firstNames.Length]} {lastNames[(i * 3) % lastNames.Length]}",
                Cedula = $"001-{i:0000000}-{i % 10}",
                Rne = $"RNE-SEED-{i:0000}",
                CentroEducativo = centers[(i - 1) % centers.Length],
                ModalidadAcademica = i % 2 == 0 ? "Modalidad Tecnico Profesional" : "Modalidad Academica",
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
}
