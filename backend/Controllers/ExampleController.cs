using System.Security.Claims;
using EDUMETRICS_DR.Filters;
using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDUMETRICS_DR.Controllers;

[ApiController]
[Route("api")]
public class ExampleController : ControllerBase
{
    private readonly StudentService _studentService;

    public ExampleController(StudentService studentService)
    {
        _studentService = studentService;
    }

    [HttpGet("AllExampleData")]
    [Authorize(Roles = "Analista MINERD,Analista MESCYT")]
    public async Task<ActionResult<IEnumerable<Student>>> GetAllData(CancellationToken cancellationToken)
    {
        var students = await _studentService.GetAllAsync(cancellationToken);
        return Ok(students);
    }

    [HttpPost("CreateExample")]
    [Authorize(Roles = "Analista MINERD,Analista MESCYT")]
    [ServiceFilter(typeof(AuditActionFilter))]
    [AuditAction("CREAR_EXPEDIENTE")]
    public async Task<IActionResult> CreateExample([FromBody] Student nuevoEstudiante, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var created = await _studentService.CreateAsync(nuevoEstudiante, cancellationToken);
        return CreatedAtAction(nameof(GetAllData), new { id = created.Id }, created);
    }

    [HttpPut("ChangeExampleData/{id:int}")]
    [Authorize(Roles = "Analista MINERD,Analista MESCYT")]
    [ServiceFilter(typeof(AuditActionFilter))]
    [AuditAction("EDITAR_EXPEDIENTE")]
    public async Task<IActionResult> PutChangeExampleData(int id, [FromBody] Student student, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var updated = await _studentService.UpdateAsync(id, student, cancellationToken);
        if (!updated)
        {
            return NotFound(new { error = "Estudiante no encontrado" });
        }

        return NoContent();
    }

    [HttpDelete("DeleteExample/{id:int}")]
    [Authorize(Roles = "Analista MINERD,Analista MESCYT")]
    [ServiceFilter(typeof(AuditActionFilter))]
    [AuditAction("ELIMINAR_EXPEDIENTE")]
    public async Task<IActionResult> DeleteExample(int id, CancellationToken cancellationToken)
    {
        var deleted = await _studentService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound(new { error = "Estudiante no encontrado" });
        }

        return NoContent();
    }

    [HttpGet("student/profile")]
    [Authorize(Roles = SystemRoles.Estudiante)]
    public async Task<IActionResult> GetStudentProfile(CancellationToken cancellationToken)
    {
        var cedula = User.FindFirstValue("cedula");
        if (string.IsNullOrWhiteSpace(cedula))
        {
            return Unauthorized(new { error = "Token de estudiante sin cédula" });
        }

        var student = await _studentService.GetByCedulaAsync(cedula, cancellationToken);
        if (student is null)
        {
            return NotFound(new { error = "Perfil académico no encontrado" });
        }

        return Ok(student);
    }
}
