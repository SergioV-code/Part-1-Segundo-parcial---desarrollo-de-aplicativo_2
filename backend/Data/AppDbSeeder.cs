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

        if (!await context.Students.AnyAsync(cancellationToken))
        {
            var now = DateTime.UtcNow;
            var students = Enumerable.Range(1, 20).Select(i => new Student
            {
                Nombre = $"Estudiante {i:00}",
                Cedula = $"001-{i:0000000}-{i % 10}",
                Rne = $"RNE-SEED-{i:000}",
                CentroEducativo = i % 2 == 0 ? "Politecnico Loyola" : "Liceo Union Panamericana",
                ModalidadAcademica = i % 2 == 0 ? "Modalidad Tecnico Profesional" : "Modalidad Academica",
                DistritoEducativo = $"{(i % 18) + 1:00}-01",
                Estado = "Regular",
                TasaAsistencia = 80 + (i % 20),
                PromedioGeneral = 70 + (i % 25),
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
