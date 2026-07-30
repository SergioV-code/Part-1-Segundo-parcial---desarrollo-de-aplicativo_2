using EDUMETRICS_DR.DTOs;

namespace EDUMETRICS_DR.Services;

public interface IAuthService
{
    Task<AuthResponseDto?> LoginEstudianteAsync(string cedula, CancellationToken cancellationToken = default);
    Task<AuthResponseDto?> LoginAnalistaAsync(string rolSeleccionado, string correoInstitucional, string password, CancellationToken cancellationToken = default);
    Task<AuthResponseDto?> LoginAdministradorAsync(string correoInstitucional, string password, CancellationToken cancellationToken = default);
}
