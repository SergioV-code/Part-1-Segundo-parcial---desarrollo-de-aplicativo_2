using System.ComponentModel.DataAnnotations;

namespace EDUMETRICS_DR.DTOs;

public class LoginAnalistaRequest
{
    [Required]
    [RegularExpression("^(Analista MINERD|Analista MESCYT)$", ErrorMessage = "El rol debe ser 'Analista MINERD' o 'Analista MESCYT'.")]
    public string Rol { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(200)]
    public string CorreoInstitucional { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    [MaxLength(100)]
    public string Password { get; set; } = string.Empty;
}
