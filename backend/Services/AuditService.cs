using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.Models;

namespace EDUMETRICS_DR.Services;

public class AuditService : IAuditService
{
    private readonly SchoolContext _context;

    public AuditService(SchoolContext context)
    {
        _context = context;
    }

    public async Task LogAsync(string usuario, string rol, string accion, string detalles, CancellationToken cancellationToken = default)
    {
        var entry = new AuditLog
        {
            FechaHora = DateTime.UtcNow,
            Usuario = string.IsNullOrWhiteSpace(usuario) ? "anonimo" : usuario,
            Rol = string.IsNullOrWhiteSpace(rol) ? "sin-rol" : rol,
            Accion = accion,
            Detalles = detalles
        };

        _context.AuditLogs.Add(entry);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
