using System.ComponentModel.DataAnnotations;

namespace EDUMETRICS_DR.DTOs;

public class LoginAnalistaRequest
{
    [Required]
    [RegularExpression("^(Analista MINERD|Analista MESCYT|Analista MESCYT/MINERD)$", ErrorMessage = "El rol debe ser 'Analista MINERD', 'Analista MESCYT' o 'Analista MESCYT/MINERD'.")]
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
