using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Data;

public static class AppDbSeeder
{
    public static async Task SeedAsync(SchoolContext context, IPasswordHasher passwordHasher, CancellationToken cancellationToken = default)
    {
        var minerdEmail = "analista@minerd.gob.do";
        var mescytEmail = "analista@mescyt.gob.do";

        var minerdUser = await context.Users.FirstOrDefaultAsync(
            u => u.Rol == SystemRoles.AnalistaMinerd || u.CorreoInstitucional == minerdEmail,
            cancellationToken);

        if (minerdUser is null)
        {
            context.Users.Add(new User
            {
                NombreCompleto = "Analista MINERD",
                CorreoInstitucional = minerdEmail,
                PasswordHash = passwordHasher.Hash("Minerd#2026"),
                Rol = SystemRoles.AnalistaMinerd,
                Activo = true
            });
        }
        else
        {
            minerdUser.NombreCompleto = "Analista MINERD";
            minerdUser.CorreoInstitucional = minerdEmail;
            minerdUser.PasswordHash = passwordHasher.Hash("Minerd#2026");
            minerdUser.Rol = SystemRoles.AnalistaMinerd;
            minerdUser.Activo = true;
        }

        var mescytUser = await context.Users.FirstOrDefaultAsync(
            u => u.Rol == SystemRoles.AnalistaMescyt || u.CorreoInstitucional == mescytEmail,
            cancellationToken);

        if (mescytUser is null)
        {
            context.Users.Add(new User
            {
                NombreCompleto = "Analista MESCYT",
                CorreoInstitucional = mescytEmail,
                PasswordHash = passwordHasher.Hash("Mescyt#2026"),
                Rol = SystemRoles.AnalistaMescyt,
                Activo = true
            });
        }
        else
        {
            mescytUser.NombreCompleto = "Analista MESCYT";
            mescytUser.CorreoInstitucional = mescytEmail;
            mescytUser.PasswordHash = passwordHasher.Hash("Mescyt#2026");
            mescytUser.Rol = SystemRoles.AnalistaMescyt;
            mescytUser.Activo = true;
        }

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
}
