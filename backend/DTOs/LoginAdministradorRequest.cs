using System.ComponentModel.DataAnnotations;

namespace EDUMETRICS_DR.DTOs;

public class LoginAdministradorRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(200)]
    public string CorreoInstitucional { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    [MaxLength(100)]
    public string Password { get; set; } = string.Empty;
}