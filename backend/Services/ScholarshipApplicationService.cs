using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.DTOs;
using EDUMETRICS_DR.Models;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Services;

public class ScholarshipApplicationService : IScholarshipApplicationService
{
    private readonly SchoolContext _context;
    private readonly IAuditService _auditService;

    public ScholarshipApplicationService(SchoolContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<ScholarshipApplicationDto> CreateAsync(string studentCedula, CreateScholarshipApplicationRequest request, CancellationToken cancellationToken = default)
    {
        var normalizedCedula = (studentCedula ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalizedCedula))
        {
            throw new InvalidOperationException("No se pudo identificar la cédula del estudiante autenticado.");
        }

        var student = await _context.Students
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Cedula == normalizedCedula, cancellationToken);

        if (student is null)
        {
            throw new InvalidOperationException("No se encontró el expediente del estudiante para registrar la solicitud.");
        }

        var application = new ScholarshipApplication
        {
            StudentId = student.Id,
            StudentName = student.Nombre,
            StudentCedula = student.Cedula,
            ScholarshipName = request.ScholarshipName.Trim(),
            InstitutionName = request.InstitutionName.Trim(),
            StudentComment = (request.StudentComment ?? string.Empty).Trim(),
            NotificationEmail = ScholarshipTraceability.InstitutionalEmail,
            Status = ScholarshipApplicationStatuses.Pendiente,
            SubmittedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };

        application.History.Add(new ScholarshipApplicationHistory
        {
            Action = "SOLICITUD_CREADA",
            PreviousStatus = string.Empty,
            NewStatus = ScholarshipApplicationStatuses.Pendiente,
            ActorRole = SystemRoles.Estudiante,
            ActorEmail = ScholarshipTraceability.InstitutionalEmail,
            Notes = $"Solicitud creada y notificación nominal enviada a {ScholarshipTraceability.InstitutionalEmail}."
        });

        _context.ScholarshipApplications.Add(application);
        await _context.SaveChangesAsync(cancellationToken);

        await LogAuditAsync(
            SystemRoles.Estudiante,
            "CREAR_SOLICITUD_BECA",
            $"Solicitud #{application.Id} creada por estudiante {application.StudentCedula}. Trazabilidad nominal y notificación: {ScholarshipTraceability.InstitutionalEmail}.",
            cancellationToken);

        return await GetByIdRequiredAsync(application.Id, cancellationToken);
    }

    public async Task<IReadOnlyList<ScholarshipApplicationDto>> GetMineAsync(string studentCedula, CancellationToken cancellationToken = default)
    {
        var normalizedCedula = (studentCedula ?? string.Empty).Trim();
        return await _context.ScholarshipApplications
            .AsNoTracking()
            .Include(x => x.History.OrderByDescending(h => h.CreatedAtUtc))
            .Where(x => x.StudentCedula == normalizedCedula)
            .OrderByDescending(x => x.SubmittedAtUtc)
            .Select(MapToDtoExpression())
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ScholarshipApplicationDto>> GetPendingAsync(CancellationToken cancellationToken = default)
    {
        return await QueryByStatusAsync(ScholarshipApplicationStatuses.Pendiente, cancellationToken);
    }

    public async Task<IReadOnlyList<ScholarshipApplicationDto>> GetInEconomicAnalysisAsync(CancellationToken cancellationToken = default)
    {
        return await QueryByStatusAsync(ScholarshipApplicationStatuses.EnAnalisisEconomico, cancellationToken);
    }

    public async Task<ScholarshipApplicationDto?> ApprovePendingAsync(int id, string actorRole, string actorEmail, CancellationToken cancellationToken = default)
    {
        var application = await _context.ScholarshipApplications
            .Include(x => x.History)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (application is null)
        {
            return null;
        }

        if (!string.Equals(application.Status, ScholarshipApplicationStatuses.Pendiente, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Solo se pueden aprobar solicitudes en estado Pendiente.");
        }

        var previousStatus = application.Status;
        application.Status = ScholarshipApplicationStatuses.EnAnalisisEconomico;
        application.ReviewedAtUtc = DateTime.UtcNow;
        application.UpdatedAtUtc = DateTime.UtcNow;
        application.RejectionReason = null;
        application.History.Add(BuildHistory(
            "SOLICITUD_APROBADA",
            previousStatus,
            application.Status,
            actorRole,
            actorEmail,
            $"Solicitud aprobada en primera fase. Continúa en análisis económico. Notificación y trazabilidad: {ScholarshipTraceability.InstitutionalEmail}."));

        await _context.SaveChangesAsync(cancellationToken);
        await LogAuditAsync(
            actorRole,
            "APROBAR_SOLICITUD_BECA",
            $"Solicitud #{application.Id} aprobada por {actorEmail}. Nueva fase: {ScholarshipApplicationStatuses.EnAnalisisEconomico}. Trazabilidad nominal: {ScholarshipTraceability.InstitutionalEmail}.",
            cancellationToken);

        return await GetByIdOrDefaultAsync(id, cancellationToken);
    }

    public async Task<ScholarshipApplicationDto?> RejectPendingAsync(int id, string actorRole, string actorEmail, string rejectionReason, CancellationToken cancellationToken = default)
    {
        var application = await _context.ScholarshipApplications
            .Include(x => x.History)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (application is null)
        {
            return null;
        }

        if (!string.Equals(application.Status, ScholarshipApplicationStatuses.Pendiente, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Solo se pueden rechazar solicitudes en estado Pendiente.");
        }

        var reason = (rejectionReason ?? string.Empty).Trim();
        if (reason.Length < 5)
        {
            throw new InvalidOperationException("El motivo de rechazo es obligatorio.");
        }

        var previousStatus = application.Status;
        application.Status = ScholarshipApplicationStatuses.Rechazada;
        application.RejectionReason = reason;
        application.ReviewedAtUtc = DateTime.UtcNow;
        application.UpdatedAtUtc = DateTime.UtcNow;
        application.History.Add(BuildHistory(
            "SOLICITUD_RECHAZADA",
            previousStatus,
            application.Status,
            actorRole,
            actorEmail,
            $"Motivo de rechazo: {reason}. Trazabilidad nominal: {ScholarshipTraceability.InstitutionalEmail}."));

        await _context.SaveChangesAsync(cancellationToken);
        await LogAuditAsync(
            actorRole,
            "RECHAZAR_SOLICITUD_BECA",
            $"Solicitud #{application.Id} rechazada por {actorEmail}. Motivo: {reason}. Trazabilidad nominal: {ScholarshipTraceability.InstitutionalEmail}.",
            cancellationToken);

        return await GetByIdOrDefaultAsync(id, cancellationToken);
    }

    public async Task<ScholarshipApplicationDto?> CompleteEconomicAnalysisAsync(int id, string actorRole, string actorEmail, CompleteScholarshipAnalysisRequest request, CancellationToken cancellationToken = default)
    {
        var application = await _context.ScholarshipApplications
            .Include(x => x.History)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (application is null)
        {
            return null;
        }

        if (!string.Equals(application.Status, ScholarshipApplicationStatuses.EnAnalisisEconomico, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Solo se puede finalizar una solicitud en análisis económico.");
        }

        if (!request.FinancialAnalysisCompleted || !request.SecondaryStudiesVerificationCompleted)
        {
            throw new InvalidOperationException("Debes completar ambas verificaciones para finalizar el flujo.");
        }

        var previousStatus = application.Status;
        application.FinancialAnalysisCompleted = true;
        application.SecondaryStudiesVerificationCompleted = true;
        application.Status = ScholarshipApplicationStatuses.Completada;
        application.CompletedAtUtc = DateTime.UtcNow;
        application.UpdatedAtUtc = DateTime.UtcNow;
        application.History.Add(BuildHistory(
            "ANALISIS_ECONOMICO_COMPLETADO",
            previousStatus,
            application.Status,
            actorRole,
            actorEmail,
            $"Análisis financiero y verificación escolar completados. Trazabilidad nominal: {ScholarshipTraceability.InstitutionalEmail}."));

        await _context.SaveChangesAsync(cancellationToken);
        await LogAuditAsync(
            actorRole,
            "COMPLETAR_SOLICITUD_BECA",
            $"Solicitud #{application.Id} completada por {actorEmail}. Ambas verificaciones marcadas. Trazabilidad nominal: {ScholarshipTraceability.InstitutionalEmail}.",
            cancellationToken);

        return await GetByIdOrDefaultAsync(id, cancellationToken);
    }

    private async Task<IReadOnlyList<ScholarshipApplicationDto>> QueryByStatusAsync(string status, CancellationToken cancellationToken)
    {
        return await _context.ScholarshipApplications
            .AsNoTracking()
            .Include(x => x.History.OrderByDescending(h => h.CreatedAtUtc))
            .Where(x => x.Status == status)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Select(MapToDtoExpression())
            .ToListAsync(cancellationToken);
    }

    private async Task<ScholarshipApplicationDto> GetByIdRequiredAsync(int id, CancellationToken cancellationToken)
    {
        return await GetByIdOrDefaultAsync(id, cancellationToken)
            ?? throw new InvalidOperationException("No se pudo recuperar la solicitud creada.");
    }

    private async Task<ScholarshipApplicationDto?> GetByIdOrDefaultAsync(int id, CancellationToken cancellationToken)
    {
        return await _context.ScholarshipApplications
            .AsNoTracking()
            .Include(x => x.History.OrderByDescending(h => h.CreatedAtUtc))
            .Where(x => x.Id == id)
            .Select(MapToDtoExpression())
            .FirstOrDefaultAsync(cancellationToken);
    }

    private ScholarshipApplicationHistory BuildHistory(string action, string previousStatus, string newStatus, string actorRole, string actorEmail, string notes)
    {
        return new ScholarshipApplicationHistory
        {
            Action = action,
            PreviousStatus = previousStatus,
            NewStatus = newStatus,
            ActorRole = actorRole,
            ActorEmail = string.IsNullOrWhiteSpace(actorEmail) ? ScholarshipTraceability.InstitutionalEmail : actorEmail.Trim(),
            Notes = notes,
            CreatedAtUtc = DateTime.UtcNow,
        };
    }

    private async Task LogAuditAsync(string role, string action, string details, CancellationToken cancellationToken)
    {
        await _auditService.LogAsync(
            ScholarshipTraceability.InstitutionalEmail,
            role,
            action,
            details,
            cancellationToken);
    }

    private static System.Linq.Expressions.Expression<Func<ScholarshipApplication, ScholarshipApplicationDto>> MapToDtoExpression()
    {
        return application => new ScholarshipApplicationDto
        {
            Id = application.Id,
            StudentId = application.StudentId,
            StudentName = application.StudentName,
            StudentCedula = application.StudentCedula,
            ScholarshipName = application.ScholarshipName,
            InstitutionName = application.InstitutionName,
            NotificationEmail = application.NotificationEmail,
            Status = application.Status,
            StudentComment = application.StudentComment,
            RejectionReason = application.RejectionReason,
            FinancialAnalysisCompleted = application.FinancialAnalysisCompleted,
            SecondaryStudiesVerificationCompleted = application.SecondaryStudiesVerificationCompleted,
            SubmittedAtUtc = application.SubmittedAtUtc,
            UpdatedAtUtc = application.UpdatedAtUtc,
            ReviewedAtUtc = application.ReviewedAtUtc,
            CompletedAtUtc = application.CompletedAtUtc,
            History = application.History
                .OrderByDescending(history => history.CreatedAtUtc)
                .Select(history => new ScholarshipApplicationHistoryDto
                {
                    Id = history.Id,
                    Action = history.Action,
                    PreviousStatus = history.PreviousStatus,
                    NewStatus = history.NewStatus,
                    ActorRole = history.ActorRole,
                    ActorEmail = history.ActorEmail,
                    Notes = history.Notes,
                    CreatedAtUtc = history.CreatedAtUtc,
                })
                .ToList(),
        };
    }
}