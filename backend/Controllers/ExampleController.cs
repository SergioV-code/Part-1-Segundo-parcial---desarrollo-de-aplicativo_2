using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using EDUMETRICS_DR.Models;
using Estudiante = EDUMETRICS_DR.Models.Student;

namespace EDUMETRICS_DR.Controllers
{
    /// <summary>
    /// Controlador REST API para gestión de estudiantes y expedientes educativos
    /// Proporciona operaciones CRUD completas para el sistema EDUMETRICS-DR
    /// </summary>
    [ApiController]
    [Route("api")]
    public class ExampleController : ControllerBase
    {
        private readonly IMongoCollection<Student> _studentCollection;
        private readonly IMongoCollection<Estudiante> _dbCollection;
        private readonly IMongoCollection<AuditLog> _auditLogCollection;
        private readonly ILogger<ExampleController> _logger;

        public ExampleController(
            IMongoCollection<Student> studentCollection,
            IMongoCollection<AuditLog> auditLogCollection,
            ILogger<ExampleController> logger)
        {
            _studentCollection = studentCollection ?? throw new ArgumentNullException(nameof(studentCollection));
            _dbCollection = studentCollection;
            _auditLogCollection = auditLogCollection ?? throw new ArgumentNullException(nameof(auditLogCollection));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        private async Task RegistrarAuditoriaAsync(string accion, string entidad, string detalles, string rolUsuario)
        {
            await _auditLogCollection.InsertOneAsync(new AuditLog
            {
                Accion = accion,
                Entidad = entidad,
                Detalles = detalles,
                RolUsuario = rolUsuario,
                Fecha = DateTime.UtcNow,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            });
        }

        /// <summary>
        /// GET /api/AllExampleData
        /// Obtiene la lista completa de todos los estudiantes registrados
        /// </summary>
        /// <returns>Lista de estudiantes</returns>
        [HttpGet("AllExampleData")]
        public async Task<ActionResult<IEnumerable<Student>>> GetAllData()
        {
            try
            {
                var userRole = Request.Headers["X-User-Role"].ToString();
                if (!string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(userRole, "Consultor", StringComparison.OrdinalIgnoreCase))
                {
                    return StatusCode(403, new { error = "Acceso denegado para este rol" });
                }

                _logger.LogInformation("[API] GET /api/AllExampleData - Obteniendo todos los estudiantes");
                var students = await _studentCollection.Find(_ => true).ToListAsync();
                return Ok(students);
            }
            catch (Exception ex)
            {
                _logger.LogError($"[API] Error al obtener estudiantes: {ex.Message}");
                return StatusCode(500, new { error = "Error al obtener estudiantes" });
            }
        }

        /// <summary>
        /// POST /api/CreateExample
        /// Crea un nuevo registro de estudiante
        /// </summary>
        /// <param name="student">Datos del nuevo estudiante</param>
        /// <returns>Estudiante creado con su ID</returns>
        [HttpPost("CreateExample")]
        public async Task<IActionResult> CreateExample([FromBody] Estudiante nuevoEstudiante)
        {
            try
            {
                var userRole = Request.Headers["X-User-Role"].ToString();
                if (!string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    return StatusCode(403, new { error = "Acceso denegado para este rol" });
                }

                if (nuevoEstudiante == null)
                    return BadRequest(new { error = "El cuerpo de la solicitud es inválido" });

                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                if (string.IsNullOrWhiteSpace(nuevoEstudiante.Nombre))
                    return BadRequest(new { error = "El nombre del estudiante es requerido" });

                if (string.IsNullOrWhiteSpace(nuevoEstudiante.Cedula))
                    return BadRequest(new { error = "La cédula del estudiante es requerida" });

                if (string.IsNullOrWhiteSpace(nuevoEstudiante.CentroEducativo))
                    return BadRequest(new { error = "El centro educativo es requerido" });

                if (string.IsNullOrWhiteSpace(nuevoEstudiante.Rne))
                    return BadRequest(new { error = "El RNE es requerido" });

                nuevoEstudiante.Id = ObjectId.GenerateNewId().ToString();
                nuevoEstudiante.FechaCreacion = DateTime.UtcNow;
                nuevoEstudiante.FechaActualizacion = DateTime.UtcNow;

                await _dbCollection.InsertOneAsync(nuevoEstudiante);
                await RegistrarAuditoriaAsync(
                    "POST",
                    "Estudiante",
                    $"Estudiante creado: {nuevoEstudiante.Id} - {nuevoEstudiante.Nombre}",
                    userRole
                );

                _logger.LogInformation($"[API] POST /api/CreateExample - Estudiante creado: {nuevoEstudiante.Id}");
                return CreatedAtAction(nameof(GetAllData), new { id = nuevoEstudiante.Id }, nuevoEstudiante);
            }
            catch (Exception ex)
            {
                _logger.LogError($"[API] Error al crear estudiante: {ex.Message}");
                return StatusCode(500, new { error = "Error al crear el estudiante" });
            }
        }

        /// <summary>
        /// PUT /api/ChangeExampleData/{id}
        /// Reemplaza completamente un registro de estudiante existente
        /// </summary>
        /// <param name="id">ID de MongoDB del estudiante</param>
        /// <param name="student">Datos completos del estudiante actualizado</param>
        /// <returns>204 No Content si es exitoso</returns>
        [HttpPut("ChangeExampleData/{id}")]
        public async Task<IActionResult> PutChangeExampleData(string id, [FromBody] Student student)
        {
            try
            {
                var userRole = Request.Headers["X-User-Role"].ToString();
                if (!string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    return StatusCode(403, new { error = "Acceso denegado para este rol" });
                }

                if (!ObjectId.TryParse(id, out _))
                    return BadRequest(new { error = "ID inválido" });

                if (student == null)
                    return BadRequest(new { error = "El cuerpo de la solicitud es inválido" });

                student.Id = id;
                student.FechaActualizacion = DateTime.UtcNow;

                var result = await _studentCollection.ReplaceOneAsync(
                    Builders<Student>.Filter.Eq(s => s.Id, id),
                    student
                );

                if (result.MatchedCount == 0)
                    return NotFound(new { error = "Estudiante no encontrado" });

                await RegistrarAuditoriaAsync(
                    "PUT",
                    "Estudiante",
                    $"Estudiante actualizado (reemplazo completo): {id}",
                    userRole
                );

                _logger.LogInformation($"[API] PUT /api/ChangeExampleData/{id} - Estudiante actualizado");
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError($"[API] Error al actualizar estudiante: {ex.Message}");
                return StatusCode(500, new { error = "Error al actualizar el estudiante" });
            }
        }

        /// <summary>
        /// DELETE /api/DeleteExample/{id}
        /// Elimina un registro de estudiante
        /// </summary>
        /// <param name="id">ID de MongoDB del estudiante</param>
        /// <returns>204 No Content si es exitoso</returns>
        [HttpDelete("DeleteExample/{id}")]
        public async Task<IActionResult> DeleteExample(string id)
        {
            try
            {
                var userRole = Request.Headers["X-User-Role"].ToString();
                if (!string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    return StatusCode(403, new { error = "Acceso denegado para este rol" });
                }

                if (!ObjectId.TryParse(id, out _))
                    return BadRequest(new { error = "ID inválido" });

                var result = await _dbCollection.DeleteOneAsync(x => x.Id == id);

                if (result.DeletedCount == 0)
                    return NotFound();

                await RegistrarAuditoriaAsync(
                    "DELETE",
                    "Estudiante",
                    $"Estudiante eliminado: {id}",
                    userRole
                );

                _logger.LogInformation($"[API] DELETE /api/DeleteExample/{id} - Estudiante eliminado");
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError($"[API] Error al eliminar estudiante: {ex.Message}");
                return StatusCode(500, new { error = "Error al eliminar el estudiante" });
            }
        }

        /// <summary>
        /// PATCH /api/PatchExampleData/{id}
        /// Actualiza parcialmente un registro de estudiante (solo los campos proporcionados)
        /// </summary>
        /// <param name="id">ID de MongoDB del estudiante</param>
        /// <param name="updates">Diccionario con los campos a actualizar</param>
        /// <returns>Estudiante actualizado</returns>
        [HttpPatch("PatchExampleData/{id}")]
        public async Task<ActionResult<Student>> PatchPatchExampleData(string id, [FromBody] Dictionary<string, object> updates)
        {
            try
            {
                var userRole = Request.Headers["X-User-Role"].ToString();
                if (!string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    return StatusCode(403, new { error = "Acceso denegado para este rol" });
                }

                if (!ObjectId.TryParse(id, out _))
                    return BadRequest(new { error = "ID inválido" });

                if (updates == null || updates.Count == 0)
                    return BadRequest(new { error = "No hay campos para actualizar" });

                // Construir el update dinámicamente basado en los campos proporcionados
                var updateBuilder = Builders<Student>.Update;
                var updateDefinition = updateBuilder.Set(s => s.FechaActualizacion, DateTime.UtcNow);

                foreach (var kvp in updates)
                {
                    var key = kvp.Key;
                    var value = kvp.Value;

                    // Convertir nombres de propiedades de camelCase a PascalCase
                    switch (key.ToLower())
                    {
                        case "nombre":
                            updateDefinition = updateDefinition.Set(s => s.Nombre, value?.ToString());
                            break;
                        case "cedula":
                            updateDefinition = updateDefinition.Set(s => s.Cedula, value?.ToString());
                            break;
                        case "rne":
                            updateDefinition = updateDefinition.Set(s => s.Rne, value?.ToString());
                            break;
                        case "estado":
                            updateDefinition = updateDefinition.Set(s => s.Estado, value?.ToString());
                            break;
                        case "tasaasistencia":
                            if (double.TryParse(value?.ToString(), out var asistencia))
                                updateDefinition = updateDefinition.Set(s => s.TasaAsistencia, asistencia);
                            break;
                        case "promediogeneral":
                            if (double.TryParse(value?.ToString(), out var promedio))
                                updateDefinition = updateDefinition.Set(s => s.PromedioGeneral, promedio);
                            break;
                        case "estadobecamescyt":
                            updateDefinition = updateDefinition.Set(s => s.EstadoBecaMescyt, value?.ToString());
                            break;
                        case "protocoloarquitectura":
                            updateDefinition = updateDefinition.Set(s => s.ProtocoloArquitectura, value?.ToString());
                            break;
                        case "logssincronizacion":
                            updateDefinition = updateDefinition.Set(s => s.LogsSincronizacion, value?.ToString());
                            break;
                    }
                }

                var result = await _studentCollection.FindOneAndUpdateAsync(
                    Builders<Student>.Filter.Eq(s => s.Id, id),
                    updateDefinition,
                    new FindOneAndUpdateOptions<Student, Student> { ReturnDocument = ReturnDocument.After }
                );

                if (result == null)
                    return NotFound(new { error = "Estudiante no encontrado" });

                await RegistrarAuditoriaAsync(
                    "PATCH",
                    "Estudiante",
                    $"Estudiante actualizado parcialmente: {id}. Campos: {string.Join(", ", updates.Keys)}",
                    userRole
                );

                _logger.LogInformation($"[API] PATCH /api/PatchExampleData/{id} - Estudiante parcialmente actualizado");
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError($"[API] Error al actualizar estudiante (PATCH): {ex.Message}");
                return StatusCode(500, new { error = "Error al actualizar el estudiante" });
            }
        }
    }
}
