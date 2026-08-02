using EDUMETRICS_DR.DTOs;

namespace EDUMETRICS_DR.Services;

public interface IScholarshipApplicationService
{
    Task<ScholarshipApplicationDto> CreateAsync(string studentCedula, CreateScholarshipApplicationRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ScholarshipApplicationDto>> GetMineAsync(string studentCedula, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ScholarshipApplicationDto>> GetPendingAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ScholarshipApplicationDto>> GetInEconomicAnalysisAsync(CancellationToken cancellationToken = default);
    Task<ScholarshipApplicationDto?> ApprovePendingAsync(int id, string actorRole, string actorEmail, CancellationToken cancellationToken = default);
    Task<ScholarshipApplicationDto?> RejectPendingAsync(int id, string actorRole, string actorEmail, string rejectionReason, CancellationToken cancellationToken = default);
    Task<ScholarshipApplicationDto?> CompleteEconomicAnalysisAsync(int id, string actorRole, string actorEmail, CompleteScholarshipAnalysisRequest request, CancellationToken cancellationToken = default);
}