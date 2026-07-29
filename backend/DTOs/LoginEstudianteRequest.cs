using System.ComponentModel.DataAnnotations;

namespace EDUMETRICS_DR.DTOs;

public class LoginEstudianteRequest
{
    [Required]
    [MaxLength(20)]
    public string Cedula { get; set; } = string.Empty;
}
