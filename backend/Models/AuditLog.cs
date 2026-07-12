using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace EDUMETRICS_DR.Models
{
    public class AuditLog
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("accion")]
        public string Accion { get; set; } = string.Empty;

        [BsonElement("detalles")]
        public string Detalles { get; set; } = string.Empty;

        [BsonElement("fecha")]
        public DateTime Fecha { get; set; } = DateTime.UtcNow;

        [BsonElement("rolUsuario")]
        public string RolUsuario { get; set; } = string.Empty;
    }
}
