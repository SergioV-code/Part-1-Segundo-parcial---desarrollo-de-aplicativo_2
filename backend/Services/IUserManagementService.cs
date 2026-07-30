using EDUMETRICS_DR.DTOs;

namespace EDUMETRICS_DR.Services;

public interface IUserManagementService
{
    Task<IReadOnlyList<AdminUserDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<AdminUserDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<AdminUserDto> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task<AdminUserDto?> UpdateAsync(int id, UpdateUserRequest request, CancellationToken cancellationToken = default);
    Task<bool> RevokeAsync(int id, CancellationToken cancellationToken = default);
}