using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.Models;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Services;

public class UserService : IUserService
{
    private readonly SchoolContext _context;

    public UserService(SchoolContext context)
    {
        _context = context;
    }

    public string NormalizeInstitutionalEmail(string email)
    {
        return (email ?? string.Empty)
            .Trim()
            .ToLowerInvariant()
            .TrimEnd('.', ',', ';', ':');
    }

    public async Task<User?> FindActiveAnalystByInstitutionalEmailAsync(string institutionalEmail, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = NormalizeInstitutionalEmail(institutionalEmail);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return null;
        }

        var analysts = await _context.Users
            .AsNoTracking()
            .Where(x => x.Activo
                && x.CorreoInstitucional != null
                && (x.Rol == SystemRoles.AnalistaMinerd || x.Rol == SystemRoles.AnalistaMescyt))
            .ToListAsync(cancellationToken);

        return analysts.FirstOrDefault(x => NormalizeInstitutionalEmail(x.CorreoInstitucional ?? string.Empty) == normalizedEmail);
    }

    public async Task<User?> FindActiveAnalystByRoleAsync(string role, CancellationToken cancellationToken = default)
    {
        var normalizedRole = (role ?? string.Empty).Trim();
        return await _context.Users
            .AsNoTracking()
            .Where(x => x.Activo
                && x.Rol == normalizedRole
                && !string.IsNullOrWhiteSpace(x.PasswordHash))
            .OrderBy(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }
}