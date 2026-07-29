using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EDUMETRICS_DR.Models
{
    public class Student
    {
        [Key]
        public int Id { get; set; }

        [MaxLength(200)]
        public string Nombre { get; set; } = string.Empty;

        [MaxLength(20)]
        public string Cedula { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Rne { get; set; } = string.Empty;

        [MaxLength(20)]
        public string DistritoEducativo { get; set; } = string.Empty;

        [MaxLength(100)]
        public string ModalidadAcademica { get; set; } = string.Empty;

        [MaxLength(200)]
        public string CentroEducativo { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Estado { get; set; } = "Regular";

        public double TasaAsistencia { get; set; } = 80.0;

        public double PromedioGeneral { get; set; } = 75.0;

        [MaxLength(128)]
        public string FirmaCriptografica { get; set; } = string.Empty;

        [MaxLength(50)]
        public string EstadoBecaMescyt { get; set; } = "No Aplica";

        [MaxLength(500)]
        public string ProtocoloArquitectura { get; set; } = "Sincronización pendiente";

        [MaxLength(4000)]
        public string LogsSincronizacion { get; set; } = string.Empty;

        public List<Asignatura> Asignaturas { get; set; } = new();

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

        public DateTime FechaActualizacion { get; set; } = DateTime.UtcNow;
    }

    public class Asignatura
    {
        [Key]
        public int Id { get; set; }

        [ForeignKey(nameof(Student))]
        public int StudentId { get; set; }

        [MaxLength(120)]
        public string Nombre { get; set; } = string.Empty;

        public int Nota { get; set; } = 0;

        [MaxLength(20)]
        public string Estatus { get; set; } = "Reprobado";

        public Student? Student { get; set; }
    }
}
