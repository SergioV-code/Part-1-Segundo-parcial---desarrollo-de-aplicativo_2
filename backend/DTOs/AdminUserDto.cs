namespace EDUMETRICS_DR.DTOs;

public class AdminUserDto
{
    public int Id { get; set; }
    public string NombreCompleto { get; set; } = string.Empty;
    public string Rol { get; set; } = string.Empty;
    public string? Cedula { get; set; }
    public string? CorreoInstitucional { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
}