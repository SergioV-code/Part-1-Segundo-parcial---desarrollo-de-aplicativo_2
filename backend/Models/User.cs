using System.ComponentModel.DataAnnotations;

namespace EDUMETRICS_DR.Models;

public class User
{
    [Key]
    public int Id { get; set; }

    [MaxLength(20)]
    public string? Cedula { get; set; }

    [EmailAddress]
    [MaxLength(200)]
    public string? CorreoInstitucional { get; set; }

    [MaxLength(500)]
    public string? PasswordHash { get; set; }

    [MaxLength(200)]
    public string NombreCompleto { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Rol { get; set; } = SystemRoles.Estudiante;

    public bool Activo { get; set; } = true;

    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
}
