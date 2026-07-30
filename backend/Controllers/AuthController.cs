using EDUMETRICS_DR.DTOs;
using EDUMETRICS_DR.Services;
using Microsoft.AspNetCore.Mvc;

namespace EDUMETRICS_DR.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
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

        var authResponse = await _authService.LoginEstudianteAsync(request.Cedula, cancellationToken);
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

        var rolSeleccionado = request.Rol.Trim();
        var correo = _userService.NormalizeInstitutionalEmail(request.CorreoInstitucional);
        if (rolSeleccionado == "Analista MINERD" && !correo.EndsWith("@minerd.gob.do", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "El correo institucional para Analista MINERD debe terminar en @minerd.gob.do." });
        }

        if (rolSeleccionado == "Analista MESCYT" && !correo.EndsWith("@mescyt.gob.do", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "El correo institucional para Analista MESCYT debe terminar en @mescyt.gob.do." });
        }

        var authResponse = await _authService.LoginAnalistaAsync(rolSeleccionado, correo, request.Password, cancellationToken);
        if (authResponse is null)
        {
            return Unauthorized(new { error = "Credenciales institucionales inválidas." });
        }

        return Ok(authResponse);
    }
}
