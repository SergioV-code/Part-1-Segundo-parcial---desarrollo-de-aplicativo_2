using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.Models;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Analista MINERD,Analista MESCYT")]
public class ReportesController : ControllerBase
{
    private readonly SchoolContext _context;

    public ReportesController(SchoolContext context)
    {
        _context = context;
    }

    [HttpGet("resumen")]
    public async Task<IActionResult> GetResumen(CancellationToken cancellationToken)
    {
        try
        {
            var total = await _context.Students.CountAsync(cancellationToken);
            var promedioGeneral = await _context.Students
                .Select(x => x.PromedioGeneral)
                .DefaultIfEmpty(0)
                .AverageAsync(cancellationToken);

            var promedioAsistencia = await _context.Students
                .Select(x => x.TasaAsistencia)
                .DefaultIfEmpty(0)
                .AverageAsync(cancellationToken);

            return Ok(new
            {
                TotalEstudiantes = total,
                PromedioGeneral = Math.Round(promedioGeneral, 2),
                PromedioAsistencia = Math.Round(promedioAsistencia, 2)
            });
        }
        catch (SqlException)
        {
            return Ok(new
            {
                TotalEstudiantes = 0,
                PromedioGeneral = 0,
                PromedioAsistencia = 0
            });
        }
        catch (DbUpdateException)
        {
            return Ok(new
            {
                TotalEstudiantes = 0,
                PromedioGeneral = 0,
                PromedioAsistencia = 0
            });
        }
    }
}
