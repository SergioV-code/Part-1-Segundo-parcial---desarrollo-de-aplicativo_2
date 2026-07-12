using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace EDUMETRICS_DR.Models
{
    /// <summary>
    /// Representa un estudiante registrado en el sistema EDUMETRICS-DR
    /// Modelo BSON para almacenamiento en MongoDB
    /// </summary>
    public class Student
    {
        /// <summary>
        /// Identificador único del documento MongoDB (ObjectId)
        /// </summary>
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        /// <summary>
        /// Nombre completo del estudiante
        /// </summary>
        [BsonElement("nombre")]
        public string Nombre { get; set; } = string.Empty;

        /// <summary>
        /// Número de cédula del estudiante (formato: 000-0000000-0)
        /// </summary>
        [BsonElement("cedula")]
        public string Cedula { get; set; } = string.Empty;

        /// <summary>
        /// Registro Nacional de Educación (RNE)
        /// </summary>
        [BsonElement("rne")]
        public string Rne { get; set; } = string.Empty;

        /// <summary>
        /// Código de distrito educativo (ej: 10-01, 15-02, 20-03)
        /// </summary>
        [BsonElement("distritoEducativo")]
        public string DistritoEducativo { get; set; } = string.Empty;

        /// <summary>
        /// Modalidad académica: General, Técnico Profesional, Artes
        /// </summary>
        [BsonElement("modalidadAcademica")]
        public string ModalidadAcademica { get; set; } = string.Empty;

        /// <summary>
        /// Nombre del centro educativo
        /// </summary>
        [BsonElement("centroEducativo")]
        public string CentroEducativo { get; set; } = string.Empty;

        /// <summary>
        /// Estado actual del estudiante: Excelente, Destacado Técnico, Regular, Riesgo Mitigado, En Riesgo Crítico
        /// </summary>
        [BsonElement("estado")]
        public string Estado { get; set; } = "Regular";

        /// <summary>
        /// Tasa de asistencia en porcentaje (0-100)
        /// </summary>
        [BsonElement("tasaAsistencia")]
        public double TasaAsistencia { get; set; } = 80.0;

        /// <summary>
        /// Promedio general de calificaciones (0-100)
        /// </summary>
        [BsonElement("promedioGeneral")]
        public double PromedioGeneral { get; set; } = 75.0;

        /// <summary>
        /// Firma criptográfica SHA-256 del expediente
        /// </summary>
        [BsonElement("firmaCriptografica")]
        public string FirmaCriptografica { get; set; } = string.Empty;

        /// <summary>
        /// Estado de la beca en MESCYT: Aprobada, En Evaluación, Rechazada, No Aplica
        /// </summary>
        [BsonElement("estadoBecaMescyt")]
        public string EstadoBecaMescyt { get; set; } = "No Aplica";

        /// <summary>
        /// Descripción del protocolo de arquitectura agnóstica y estado de sincronización
        /// </summary>
        [BsonElement("protocoloArquitectura")]
        public string ProtocoloArquitectura { get; set; } = "Sincronización pendiente";

        /// <summary>
        /// Logs de sincronización de interoperabilidad (formato multilinea)
        /// </summary>
        [BsonElement("logsSincronizacion")]
        public string LogsSincronizacion { get; set; } = string.Empty;

        /// <summary>
        /// Lista de asignaturas del estudiante con notas y estatus
        /// </summary>
        [BsonElement("asignaturas")]
        public List<Asignatura> Asignaturas { get; set; } = new();

        /// <summary>
        /// Fecha de creación del registro
        /// </summary>
        [BsonElement("fechaCreacion")]
        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Fecha de última actualización
        /// </summary>
        [BsonElement("fechaActualizacion")]
        public DateTime FechaActualizacion { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Representa una asignatura con calificación y estatus de aprobación
    /// </summary>
    public class Asignatura
    {
        /// <summary>
        /// Nombre de la asignatura
        /// </summary>
        [BsonElement("nombre")]
        public string Nombre { get; set; } = string.Empty;

        /// <summary>
        /// Calificación obtenida (0-100)
        /// </summary>
        [BsonElement("nota")]
        public int Nota { get; set; } = 0;

        /// <summary>
        /// Estatus: Aprobado, Reprobado
        /// </summary>
        [BsonElement("estatus")]
        public string Estatus { get; set; } = "Reprobado";
    }
}
