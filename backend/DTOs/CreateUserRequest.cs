using System.ComponentModel.DataAnnotations;

namespace EDUMETRICS_DR.DTOs;

public class CreateUserRequest
{
    [Required]
    [MaxLength(200)]
    public string NombreCompleto { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Rol { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Cedula { get; set; }

    [EmailAddress]
    [MaxLength(200)]
    public string? CorreoInstitucional { get; set; }

    [MaxLength(100)]
    public string? Password { get; set; }

    public bool Activo { get; set; } = true;
}