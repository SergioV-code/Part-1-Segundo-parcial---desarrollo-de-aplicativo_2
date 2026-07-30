using EDUMETRICS_DR.Models;

namespace EDUMETRICS_DR.Services;

public interface IUserService
{
    string NormalizeInstitutionalEmail(string email);
    Task<User?> FindActiveAnalystByInstitutionalEmailAsync(string institutionalEmail, CancellationToken cancellationToken = default);
    Task<User?> FindActiveAnalystByRoleAsync(string role, CancellationToken cancellationToken = default);
}