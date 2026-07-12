using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using EDUMETRICS_DR.Models;

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
        private readonly IMongoCollection<AuditLog> _auditLogCollection;
        private readonly ILogger<ExampleController> _logger;

        public ExampleController(
            IMongoCollection<Student> studentCollection,
            IMongoCollection<AuditLog> auditLogCollection,
            ILogger<ExampleController> logger)
        {
            _studentCollection = studentCollection ?? throw new ArgumentNullException(nameof(studentCollection));
            _auditLogCollection = auditLogCollection ?? throw new ArgumentNullException(nameof(auditLogCollection));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// GET /api/AllExampleData
        /// Obtiene la lista completa de todos los estudiantes registrados
        /// </summary>
        /// <returns>Lista de estudiantes</returns>
        [HttpGet("AllExampleData")]
        public async Task<ActionResult<IEnumerable<Student>>> GetAllExampleData()
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
        public async Task<ActionResult<Student>> PostCreateExample([FromBody] Student student)
        {
            try
            {
                var userRole = Request.Headers["X-User-Role"].ToString();
                if (!string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    return StatusCode(403, new { error = "Acceso denegado para este rol" });
                }

                if (string.IsNullOrWhiteSpace(student.Nombre))
                    return BadRequest(new { error = "El nombre del estudiante es requerido" });

                if (string.IsNullOrWhiteSpace(student.Rne))
                    return BadRequest(new { error = "El RNE es requerido" });

                student.Id = ObjectId.GenerateNewId().ToString();
                student.FechaCreacion = DateTime.UtcNow;
                student.FechaActualizacion = DateTime.UtcNow;

                await _studentCollection.InsertOneAsync(student);
                await _auditLogCollection.InsertOneAsync(new AuditLog
                {
                    Accion = "CREATE_STUDENT",
                    Detalles = $"Estudiante creado: {student.Id} - {student.Nombre}",
                    RolUsuario = userRole
                });

                _logger.LogInformation($"[API] POST /api/CreateExample - Estudiante creado: {student.Id}");
                return CreatedAtAction(nameof(PostCreateExample), new { id = student.Id }, student);
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
                if (!ObjectId.TryParse(id, out _))
                    return BadRequest(new { error = "ID inválido" });

                student.Id = id;
                student.FechaActualizacion = DateTime.UtcNow;

                var result = await _studentCollection.ReplaceOneAsync(
                    Builders<Student>.Filter.Eq(s => s.Id, id),
                    student
                );

                if (result.MatchedCount == 0)
                    return NotFound(new { error = "Estudiante no encontrado" });

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
        public async Task<IActionResult> DeleteDeleteExample(string id)
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

                var result = await _studentCollection.DeleteOneAsync(
                    Builders<Student>.Filter.Eq(s => s.Id, id)
                );

                if (result.DeletedCount == 0)
                    return NotFound(new { error = "Estudiante no encontrado" });

                await _auditLogCollection.InsertOneAsync(new AuditLog
                {
                    Accion = "DELETE_STUDENT",
                    Detalles = $"Estudiante eliminado: {id}",
                    RolUsuario = userRole
                });

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
