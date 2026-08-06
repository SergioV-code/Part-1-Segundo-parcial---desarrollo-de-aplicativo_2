using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.DTOs;
using EDUMETRICS_DR.Models;
using Microsoft.EntityFrameworkCore;
using System.Text;

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
        if (request is null)
        {
            throw new InvalidOperationException("La solicitud de beca es obligatoria.");
        }

        var normalizedCedula = (studentCedula ?? string.Empty).Trim();
        var normalizedCedulaDigits = NormalizeCedulaDigits(normalizedCedula);
        if (string.IsNullOrWhiteSpace(normalizedCedula) && string.IsNullOrWhiteSpace(normalizedCedulaDigits))
        {
            throw new InvalidOperationException("No se pudo identificar la cédula del estudiante autenticado.");
        }

        var scholarshipType = (request.ScholarshipType ?? "Nacional").Trim();
        var institutionName = (request.InstitutionName ?? string.Empty).Trim();
        var scholarshipName = (request.ScholarshipName ?? string.Empty).Trim();
        var careerName = (request.CareerName ?? string.Empty).Trim();
        var destinationCountry = (request.DestinationCountry ?? string.Empty).Trim();
        var foreignUniversity = (request.ForeignUniversity ?? string.Empty).Trim();
        var internationalCoverageType = (request.InternationalCoverageType ?? string.Empty).Trim();
        var languageOrAdmissionRequirement = (request.LanguageOrAdmissionRequirement ?? string.Empty).Trim();
        var studentComment = (request.StudentComment ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(scholarshipType))
        {
            throw new InvalidOperationException("La modalidad de beca es obligatoria.");
        }

        if (string.IsNullOrWhiteSpace(institutionName))
        {
            throw new InvalidOperationException("La institución gestora es obligatoria.");
        }

        if (string.IsNullOrWhiteSpace(scholarshipName))
        {
            throw new InvalidOperationException("El nombre de la beca es obligatorio.");
        }

        if (string.IsNullOrWhiteSpace(careerName))
        {
            throw new InvalidOperationException("La carrera o programa es obligatoria.");
        }

        if (string.IsNullOrWhiteSpace(studentComment))
        {
            throw new InvalidOperationException("El comentario del estudiante es obligatorio.");
        }

        var isInternational = string.Equals(scholarshipType, "Internacional", StringComparison.OrdinalIgnoreCase);
        if (isInternational)
        {
            if (string.IsNullOrWhiteSpace(destinationCountry))
            {
                throw new InvalidOperationException("Para beca internacional debe indicar el país de destino.");
            }

            if (string.IsNullOrWhiteSpace(foreignUniversity))
            {
                throw new InvalidOperationException("Para beca internacional debe indicar la universidad extranjera.");
            }

            if (string.IsNullOrWhiteSpace(internationalCoverageType))
            {
                throw new InvalidOperationException("Para beca internacional debe indicar el tipo de cobertura.");
            }

            if (string.IsNullOrWhiteSpace(languageOrAdmissionRequirement))
            {
                throw new InvalidOperationException("Para beca internacional debe indicar los requisitos de idioma o admisión.");
            }
        }

        var commentWithMetadata = BuildCommentWithMetadata(
            studentComment,
            scholarshipType,
            destinationCountry,
            foreignUniversity,
            internationalCoverageType,
            languageOrAdmissionRequirement);

        var student = await _context.Students
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.Cedula == normalizedCedula
                || x.Cedula.Replace("-", string.Empty) == normalizedCedulaDigits,
                cancellationToken);

        if (student is null)
        {
            throw new InvalidOperationException("No se encontró el expediente del estudiante para registrar la solicitud.");
        }

        var application = new ScholarshipApplication
        {
            StudentId = student.Id,
            StudentName = student.Nombre,
            StudentCedula = student.Cedula,
            ScholarshipName = scholarshipName,
            InstitutionName = institutionName,
            CareerName = careerName,
            StudentComment = commentWithMetadata,
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
            application.StudentCedula,
            SystemRoles.Estudiante,
            "CREAR_SOLICITUD_BECA",
            $"Solicitud #{application.Id} creada por estudiante {application.StudentCedula}. Trazabilidad nominal y notificación: {ScholarshipTraceability.InstitutionalEmail}.",
            cancellationToken);

        return await GetByIdRequiredAsync(application.Id, cancellationToken);
    }

    public async Task<IReadOnlyList<ScholarshipApplicationDto>> GetMineAsync(string studentCedula, CancellationToken cancellationToken = default)
    {
        var normalizedCedula = (studentCedula ?? string.Empty).Trim();
        var normalizedCedulaDigits = NormalizeCedulaDigits(normalizedCedula);
        return await _context.ScholarshipApplications
            .AsNoTracking()
            .Include(x => x.History.OrderByDescending(h => h.CreatedAtUtc))
            .Where(x =>
                x.StudentCedula == normalizedCedula
                || x.StudentCedula.Replace("-", string.Empty) == normalizedCedulaDigits)
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
        var internationalCriteria = BuildInternationalCriteriaAuditSuffix(application);
        await LogAuditAsync(
            actorEmail,
            actorRole,
            "APROBAR_SOLICITUD_BECA",
            $"Solicitud #{application.Id} aprobada por {actorEmail}. Nueva fase: {ScholarshipApplicationStatuses.EnAnalisisEconomico}. Trazabilidad nominal: {ScholarshipTraceability.InstitutionalEmail}.{internationalCriteria}",
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
        var internationalCriteria = BuildInternationalCriteriaAuditSuffix(application);
        await LogAuditAsync(
            actorEmail,
            actorRole,
            "RECHAZAR_SOLICITUD_BECA",
            $"Solicitud #{application.Id} rechazada por {actorEmail}. Motivo: {reason}. Trazabilidad nominal: {ScholarshipTraceability.InstitutionalEmail}.{internationalCriteria}",
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
        var internationalCriteria = BuildInternationalCriteriaAuditSuffix(application);
        await LogAuditAsync(
            actorEmail,
            actorRole,
            "COMPLETAR_SOLICITUD_BECA",
            $"Solicitud #{application.Id} completada por {actorEmail}. Ambas verificaciones marcadas. Trazabilidad nominal: {ScholarshipTraceability.InstitutionalEmail}.{internationalCriteria}",
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

    private async Task LogAuditAsync(string actorIdentifier, string role, string action, string details, CancellationToken cancellationToken)
    {
        await _auditService.LogAsync(
            string.IsNullOrWhiteSpace(actorIdentifier) ? ScholarshipTraceability.InstitutionalEmail : actorIdentifier.Trim(),
            role,
            action,
            details,
            cancellationToken);
    }

    private static string BuildInternationalCriteriaAuditSuffix(ScholarshipApplication application)
    {
        if (application is null)
        {
            return string.Empty;
        }

        var scholarshipName = (application.ScholarshipName ?? string.Empty).Trim();
        var comment = (application.StudentComment ?? string.Empty).Trim();
        var isInternational = scholarshipName.Contains("[Internacional]", StringComparison.OrdinalIgnoreCase)
            || comment.Contains("[DETALLE_BECA_INTERNACIONAL]", StringComparison.OrdinalIgnoreCase);

        if (!isInternational)
        {
            return " Criterios validados: modalidad nacional.";
        }

        var metadata = ParseMetadataBlock(comment, "[DETALLE_BECA_INTERNACIONAL]", "[/DETALLE_BECA_INTERNACIONAL]");
        var country = GetMetadataValue(metadata, "Pais de destino", "No informado");
        var university = GetMetadataValue(metadata, "Universidad extranjera", "No informada");
        var coverage = GetMetadataValue(metadata, "Cobertura", "No informada");
        var languageOrAdmission = GetMetadataValue(metadata, "Requisitos idioma/admision", "No informado");

        var builder = new StringBuilder(256);
        builder.Append(" Criterios validados [Internacional]: ");
        builder.Append($"Pais={country}; ");
        builder.Append($"Universidad={university}; ");
        builder.Append($"Cobertura={coverage}; ");
        builder.Append($"Idioma/Admision={languageOrAdmission}.");
        return builder.ToString();
    }

    private static Dictionary<string, string> ParseMetadataBlock(string source, string startTag, string endTag)
    {
        var text = source ?? string.Empty;
        var startIndex = text.IndexOf(startTag, StringComparison.OrdinalIgnoreCase);
        if (startIndex < 0)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        var contentStart = startIndex + startTag.Length;
        var endIndex = text.IndexOf(endTag, contentStart, StringComparison.OrdinalIgnoreCase);
        if (endIndex <= contentStart)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        var block = text[contentStart..endIndex];
        var lines = block.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var line in lines)
        {
            var separatorIndex = line.IndexOf(':');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var key = line[..separatorIndex].Trim();
            var value = line[(separatorIndex + 1)..].Trim();
            if (!string.IsNullOrWhiteSpace(key))
            {
                result[key] = value;
            }
        }

        return result;
    }

    private static string GetMetadataValue(IReadOnlyDictionary<string, string> metadata, string key, string fallback)
    {
        if (metadata.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        return fallback;
    }

    private static string BuildCommentWithMetadata(
        string studentComment,
        string scholarshipType,
        string destinationCountry,
        string foreignUniversity,
        string internationalCoverageType,
        string languageOrAdmissionRequirement)
    {
        if (!string.Equals(scholarshipType, "Internacional", StringComparison.OrdinalIgnoreCase))
        {
            return studentComment;
        }

        var metadata = string.Join("\n", new[]
        {
            "[DETALLE_BECA_INTERNACIONAL]",
            $"Pais de destino: {destinationCountry}",
            $"Universidad extranjera: {foreignUniversity}",
            $"Cobertura: {internationalCoverageType}",
            $"Requisitos idioma/admision: {languageOrAdmissionRequirement}",
            "[/DETALLE_BECA_INTERNACIONAL]",
        });

        if (studentComment.Contains("[DETALLE_BECA_INTERNACIONAL]", StringComparison.OrdinalIgnoreCase))
        {
            return studentComment;
        }

        return string.Join("\n\n", new[] { studentComment, metadata }.Where(x => !string.IsNullOrWhiteSpace(x)));
    }

    private static string NormalizeCedulaDigits(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var chars = value.Where(char.IsDigit).ToArray();
        return new string(chars);
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
            CareerName = application.CareerName ?? string.Empty,
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