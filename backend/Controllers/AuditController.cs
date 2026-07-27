using EDUMETRICS_DR.Models;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace EDUMETRICS_DR.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuditController : ControllerBase
    {
        private readonly IMongoCollection<AuditLog> _auditCollection;

        public AuditController(IConfiguration configuration)
        {
            var client = new MongoClient(configuration.GetConnectionString("MongoConnection"));
            var database = client.GetDatabase("EdumetricsDB");
            _auditCollection = database.GetCollection<AuditLog>("AuditLogs");
        }

        [HttpGet]
        public async Task<IActionResult> GetAuditLogs()
        {
            var logs = await _auditCollection.Find(_ => true)
                .SortByDescending(l => l.Fecha)
                .ToListAsync();
            return Ok(logs);
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarAccion([FromBody] AuditLog log)
        {
            log.Fecha = DateTime.UtcNow;
            log.Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            
            await _auditCollection.InsertOneAsync(log);
            return Ok(new { success = true, message = "Registro de auditoría guardado correctamente." });
        }
    }
}