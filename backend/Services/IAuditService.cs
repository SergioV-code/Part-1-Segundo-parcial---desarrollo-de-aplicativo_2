namespace EDUMETRICS_DR.Services;

public interface IAuditService
{
    Task LogAsync(string usuario, string rol, string accion, string detalles, CancellationToken cancellationToken = default);
}
