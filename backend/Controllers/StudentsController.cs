using Microsoft.AspNetCore.Mvc;
using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;

namespace EDUMETRICS_DR.Controllers
{
    [ApiController]
    public class StudentsController : ControllerBase
    {
        private readonly StudentService _studentService;

        public StudentsController(StudentService studentService)
        {
            _studentService = studentService;
        }

        // GET /api/AllExampleData
        [HttpGet("/api/AllExampleData")]
        public async Task<ActionResult<List<Student>>> GetAll()
        {
            var students = await _studentService.GetAsync();
            return Ok(students);
        }

        // GET /api/AllExampleData/{id}
        [HttpGet("/api/AllExampleData/{id}")]
        public async Task<ActionResult<Student>> GetById(string id)
        {
            var student = await _studentService.GetByIdAsync(id);
            if (student is null) return NotFound(new { error = "Estudiante no encontrado" });
            return Ok(student);
        }

        // POST /api/CreateExample
        [HttpPost("/api/CreateExample")]
        public async Task<ActionResult<Student>> Create([FromBody] Student student)
        {
            if (student is null) return BadRequest(new { error = "El cuerpo de la solicitud es invalido" });
            if (string.IsNullOrWhiteSpace(student.Nombre))          return BadRequest(new { error = "El nombre es requerido" });
            if (string.IsNullOrWhiteSpace(student.Cedula))          return BadRequest(new { error = "La cedula es requerida" });
            if (string.IsNullOrWhiteSpace(student.CentroEducativo)) return BadRequest(new { error = "El centro educativo es requerido" });
            if (string.IsNullOrWhiteSpace(student.Rne))             return BadRequest(new { error = "El RNE es requerido" });

            var created = await _studentService.CreateAsync(student);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        // PUT /api/ChangeExampleData/{id}
        [HttpPut("/api/ChangeExampleData/{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Student student)
        {
            if (student is null) return BadRequest(new { error = "El cuerpo de la solicitud es invalido" });

            var updated = await _studentService.UpdateAsync(id, student);
            if (!updated) return NotFound(new { error = "Estudiante no encontrado" });

            return NoContent();
        }

        // DELETE /api/DeleteExample/{id}
        [HttpDelete("/api/DeleteExample/{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var deleted = await _studentService.DeleteAsync(id);
            if (!deleted) return NotFound(new { error = "Estudiante no encontrado" });

            return NoContent();
        }
    }
}
