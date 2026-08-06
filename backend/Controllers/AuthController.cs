using EDUMETRICS_DR.DTOs;
using EDUMETRICS_DR.Services;
using Microsoft.AspNetCore.Mvc;

namespace EDUMETRICS_DR.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private static readonly TimeSpan LoginTimeout = TimeSpan.FromSeconds(7);

    private readonly IAuthService _authService;
    private readonly IUserService _userService;

    public AuthController(IAuthService authService, IUserService userService)
    {
        _authService = authService;
        _userService = userService;
    }

    [HttpPost("login/estudiante")]
    public async Task<IActionResult> LoginEstudiante([FromBody] LoginEstudianteRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        using var loginCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        loginCts.CancelAfter(LoginTimeout);

        var normalizedCedula = NormalizeStudentCedula(request.Cedula);
        var authResponse = await _authService.LoginEstudianteAsync(normalizedCedula, loginCts.Token);
        if (authResponse is null)
        {
            return Unauthorized(new { error = "Cédula no encontrada." });
        }

        return Ok(authResponse);
    }

    [HttpPost("login/analista")]
    public async Task<IActionResult> LoginAnalista([FromBody] LoginAnalistaRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var rolSeleccionado = NormalizeAnalystRole(request.Rol, request.CorreoInstitucional);
        var correo = _userService.NormalizeInstitutionalEmail(request.CorreoInstitucional);
        if (rolSeleccionado == "Analista MINERD" && !correo.EndsWith("@minerd.gob.do", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "El correo institucional para Analista MINERD debe terminar en @minerd.gob.do." });
        }

        if (rolSeleccionado == "Analista MESCYT" && !correo.EndsWith("@mescyt.gob.do", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "El correo institucional para Analista MESCYT debe terminar en @mescyt.gob.do." });
        }

        using var loginCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        loginCts.CancelAfter(LoginTimeout);

        var authResponse = await _authService.LoginAnalistaAsync(rolSeleccionado, correo, request.Password, loginCts.Token);
        if (authResponse is null)
        {
            return Unauthorized(new { error = "Credenciales institucionales inválidas." });
        }

        return Ok(authResponse);
    }

    private static string NormalizeAnalystRole(string role, string email)
    {
        var normalizedRole = (role ?? string.Empty).Trim();
        if (normalizedRole == "Analista MINERD" || normalizedRole == "Analista MESCYT")
        {
            return normalizedRole;
        }

        var normalizedEmail = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (normalizedRole == "Analista MESCYT/MINERD")
        {
            return normalizedEmail.EndsWith("@minerd.gob.do", StringComparison.OrdinalIgnoreCase)
                ? "Analista MINERD"
                : "Analista MESCYT";
        }

        return normalizedRole;
    }

    private static string NormalizeStudentCedula(string cedula)
    {
        var raw = (cedula ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(raw)) return raw;

        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length != 11) return raw;

        return $"{digits[..3]}-{digits[3..10]}-{digits[10..]}";
    }

    [HttpPost("login/administrador")]
    public async Task<IActionResult> LoginAdministrador([FromBody] LoginAdministradorRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var correo = _userService.NormalizeInstitutionalEmail(request.CorreoInstitucional);
        using var loginCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        loginCts.CancelAfter(LoginTimeout);

        var authResponse = await _authService.LoginAdministradorAsync(correo, request.Password, loginCts.Token);
        if (authResponse is null)
        {
            return Unauthorized(new { error = "Credenciales administrativas inválidas." });
        }

        return Ok(authResponse);
    }
}
