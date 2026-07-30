using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.DTOs;
using EDUMETRICS_DR.Models;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Services;

public class UserManagementService : IUserManagementService
{
    private readonly SchoolContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IUserService _userService;

    public UserManagementService(SchoolContext context, IPasswordHasher passwordHasher, IUserService userService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _userService = userService;
    }

    public async Task<IReadOnlyList<AdminUserDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .OrderByDescending(x => x.Activo)
            .ThenBy(x => x.Rol)
            .ThenBy(x => x.NombreCompleto)
            .Select(MapToDto())
            .ToListAsync(cancellationToken);
    }

    public async Task<AdminUserDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(MapToDto())
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<AdminUserDto> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken = default)
    {
        var user = new User
        {
            FechaCreacion = DateTime.UtcNow,
        };

        await ApplyChangesAsync(
            user,
            request.NombreCompleto,
            request.Rol,
            request.Cedula,
            request.CorreoInstitucional,
            request.Password,
            request.Activo,
            isCreate: true,
            cancellationToken);

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        return ToDto(user);
    }

    public async Task<AdminUserDto?> UpdateAsync(int id, UpdateUserRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return null;
        }

        await ApplyChangesAsync(
            user,
            request.NombreCompleto,
            request.Rol,
            request.Cedula,
            request.CorreoInstitucional,
            request.Password,
            request.Activo,
            isCreate: false,
            cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);
        return ToDto(user);
    }

    public async Task<bool> RevokeAsync(int id, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return false;
        }

        user.Activo = false;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task ApplyChangesAsync(
        User user,
        string nombreCompleto,
        string rol,
        string? cedula,
        string? correoInstitucional,
        string? password,
        bool activo,
        bool isCreate,
        CancellationToken cancellationToken)
    {
        var normalizedName = (nombreCompleto ?? string.Empty).Trim();
        var normalizedRole = (rol ?? string.Empty).Trim();
        var normalizedCedula = string.IsNullOrWhiteSpace(cedula) ? null : cedula.Trim();
        var normalizedEmail = string.IsNullOrWhiteSpace(correoInstitucional)
            ? null
            : _userService.NormalizeInstitutionalEmail(correoInstitucional);
        var normalizedPassword = (password ?? string.Empty).Trim();

        if (!SystemRoles.All.Contains(normalizedRole, StringComparer.Ordinal))
        {
            throw new InvalidOperationException("El rol seleccionado no es válido.");
        }

        Student? matchingStudent = null;
        if (normalizedRole == SystemRoles.Estudiante)
        {
            if (string.IsNullOrWhiteSpace(normalizedCedula))
            {
                throw new InvalidOperationException("La cédula es obligatoria para cuentas de estudiante.");
            }

            matchingStudent = await _context.Students
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Cedula == normalizedCedula, cancellationToken);

            if (matchingStudent is null)
            {
                throw new InvalidOperationException("No existe un expediente estudiantil con la cédula indicada.");
            }

            if (string.IsNullOrWhiteSpace(normalizedName))
            {
                normalizedName = matchingStudent.Nombre;
            }

            normalizedEmail = null;
            normalizedPassword = string.Empty;
            user.PasswordHash = null;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(normalizedEmail))
            {
                throw new InvalidOperationException("El correo institucional es obligatorio para este tipo de cuenta.");
            }

            if (normalizedRole == SystemRoles.AnalistaMinerd && !normalizedEmail.EndsWith("@minerd.gob.do", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("El correo para Analista MINERD debe terminar en @minerd.gob.do.");
            }

            if (normalizedRole == SystemRoles.AnalistaMescyt && !normalizedEmail.EndsWith("@mescyt.gob.do", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("El correo para Analista MESCYT debe terminar en @mescyt.gob.do.");
            }

            if (!string.IsNullOrWhiteSpace(normalizedPassword))
            {
                if (normalizedPassword.Length < 8)
                {
                    throw new InvalidOperationException("La contraseña debe tener al menos 8 caracteres.");
                }

                user.PasswordHash = _passwordHasher.Hash(normalizedPassword);
            }
            else if (isCreate || string.IsNullOrWhiteSpace(user.PasswordHash))
            {
                throw new InvalidOperationException("Debes establecer una contraseña válida para esta cuenta.");
            }
        }

        if (normalizedName.Length < 3)
        {
            throw new InvalidOperationException("El nombre completo debe tener al menos 3 caracteres.");
        }

        await EnsureUniquenessAsync(user.Id, normalizedCedula, normalizedEmail, cancellationToken);

        user.NombreCompleto = normalizedRole == SystemRoles.Estudiante && matchingStudent is not null
            ? matchingStudent.Nombre
            : normalizedName;
        user.Rol = normalizedRole;
        user.Cedula = normalizedCedula;
        user.CorreoInstitucional = normalizedEmail;
        user.Activo = activo;
    }

    private async Task EnsureUniquenessAsync(int currentUserId, string? cedula, string? correoInstitucional, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(cedula))
        {
            var duplicateCedula = await _context.Users
                .AsNoTracking()
                .AnyAsync(x => x.Id != currentUserId && x.Cedula == cedula, cancellationToken);

            if (duplicateCedula)
            {
                throw new InvalidOperationException("Ya existe otra cuenta con esa cédula.");
            }
        }

        if (!string.IsNullOrWhiteSpace(correoInstitucional))
        {
            var duplicateEmail = await _context.Users
                .AsNoTracking()
                .AnyAsync(x => x.Id != currentUserId && x.CorreoInstitucional == correoInstitucional, cancellationToken);

            if (duplicateEmail)
            {
                throw new InvalidOperationException("Ya existe otra cuenta con ese correo institucional.");
            }
        }
    }

    private static AdminUserDto ToDto(User user)
    {
        return new AdminUserDto
        {
            Id = user.Id,
            NombreCompleto = user.NombreCompleto,
            Rol = user.Rol,
            Cedula = user.Cedula,
            CorreoInstitucional = user.CorreoInstitucional,
            Activo = user.Activo,
            FechaCreacion = user.FechaCreacion,
        };
    }

    private static System.Linq.Expressions.Expression<Func<User, AdminUserDto>> MapToDto()
    {
        return user => new AdminUserDto
        {
            Id = user.Id,
            NombreCompleto = user.NombreCompleto,
            Rol = user.Rol,
            Cedula = user.Cedula,
            CorreoInstitucional = user.CorreoInstitucional,
            Activo = user.Activo,
            FechaCreacion = user.FechaCreacion,
        };
    }
}