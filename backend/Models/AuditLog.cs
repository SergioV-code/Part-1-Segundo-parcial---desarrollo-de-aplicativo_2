using System.ComponentModel.DataAnnotations;

namespace EDUMETRICS_DR.Models
{
    public class AuditLog
    {
        [Key]
        public int Id { get; set; }

        public DateTime FechaHora { get; set; } = DateTime.UtcNow;

        [MaxLength(200)]
        public string Usuario { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Rol { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Accion { get; set; } = string.Empty;

        [MaxLength(4000)]
        public string Detalles { get; set; } = string.Empty;
    }
}