using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.DTOs;
using EDUMETRICS_DR.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EDUMETRICS_DR.Services;

public class AuthService : IAuthService
{
    private readonly SchoolContext _context;
    private readonly JwtOptions _jwtOptions;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuditService _auditService;

    public AuthService(
        SchoolContext context,
        IOptions<JwtOptions> jwtOptions,
        IPasswordHasher passwordHasher,
        IAuditService auditService)
    {
        _context = context;
        _jwtOptions = jwtOptions.Value;
        _passwordHasher = passwordHasher;
        _auditService = auditService;
    }

    public async Task<AuthResponseDto?> LoginEstudianteAsync(string cedula, CancellationToken cancellationToken = default)
    {
        var student = await _context.Students
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Cedula == cedula, cancellationToken);

        if (student is null)
        {
            return null;
        }

        var user = await _context.Users.FirstOrDefaultAsync(
            x => x.Cedula == cedula && x.Rol == SystemRoles.Estudiante,
            cancellationToken);

        if (user is null)
        {
            user = new User
            {
                Cedula = cedula,
                NombreCompleto = student.Nombre,
                Rol = SystemRoles.Estudiante,
                Activo = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync(cancellationToken);
        }

        var response = BuildToken(
            user.Id.ToString(),
            student.Nombre,
            SystemRoles.Estudiante,
            user.Cedula ?? cedula,
            user.CorreoInstitucional);

        await _auditService.LogAsync(
            student.Nombre,
            SystemRoles.Estudiante,
            "LOGIN_EXITOSO_ESTUDIANTE",
            $"Inicio de sesion por cedula: {cedula}",
            cancellationToken);

        return response;
    }

    public async Task<AuthResponseDto?> LoginAnalistaAsync(string rolSeleccionado, string correoInstitucional, string password, CancellationToken cancellationToken = default)
    {
        var normalized = correoInstitucional.Trim().ToLowerInvariant();

        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.CorreoInstitucional != null
                  && x.CorreoInstitucional.ToLower() == normalized
                  && x.Activo,
                cancellationToken);

        if (user is null)
        {
            return null;
        }

        if (!string.Equals(user.Rol, rolSeleccionado, StringComparison.Ordinal))
        {
            return null;
        }

        var isAnalista = user.Rol == SystemRoles.AnalistaMinerd || user.Rol == SystemRoles.AnalistaMescyt;
        if (!isAnalista || string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            return null;
        }

        if (!_passwordHasher.Verify(password, user.PasswordHash))
        {
            return null;
        }

        var response = BuildToken(
            user.Id.ToString(),
            user.NombreCompleto,
            user.Rol,
            user.Cedula,
            user.CorreoInstitucional);

        await _auditService.LogAsync(
            user.NombreCompleto,
            user.Rol,
            "LOGIN_EXITOSO_ANALISTA",
            $"Inicio de sesion de analista: {user.CorreoInstitucional}",
            cancellationToken);

        return response;
    }

    private AuthResponseDto BuildToken(string userId, string nombre, string rol, string? cedula, string? correo)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(_jwtOptions.ExpirationMinutes);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Name, nombre),
            new(ClaimTypes.Role, rol)
        };

        if (!string.IsNullOrWhiteSpace(cedula))
        {
            claims.Add(new Claim("cedula", cedula));
        }

        if (!string.IsNullOrWhiteSpace(correo))
        {
            claims.Add(new Claim("email", correo));
        }

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds);

        return new AuthResponseDto
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAtUtc = expiresAt,
            Usuario = nombre,
            Rol = rol
        };
    }
}
